import { User } from '../entities/User';
import { MyContext } from 'src/types';
import {
	Query,
	Arg,
	Ctx,
	Resolver,
	Mutation,
	Field,
	ObjectType,
} from 'type-graphql';
import argon2 from 'argon2';
import { UserNamePasswordInput } from './UserNamePasswordInput';
import { validateRegister } from '../utils/validateRegister';
import { sendEmail } from '../utils/sendEmail';
import { v4 } from 'uuid';
import { FORGET_PASSWORD_PREFIX } from '../constants';
import { getConnection } from 'typeorm';

@ObjectType()
class FieldError {
	@Field()
	field: string;
	@Field()
	message: string;
}

@ObjectType()
class UserResponse {
	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];

	@Field(() => User, { nullable: true })
	user?: User;
}

@Resolver()
export class UserResolver {
	@Mutation(() => UserResponse)
	async changePassword(
		@Arg('token') token: string,
		@Arg('newPassword') newPassword: string,
		@Ctx() { redis, req }: MyContext
	): Promise<UserResponse> {
		if (newPassword.length <= 3)
			return {
				errors: [
					{
						field: 'newPassword',
						message: 'password must be longer',
					},
				],
			};

		const key = FORGET_PASSWORD_PREFIX + token;
		const userId = await redis.get(key);
		if (!userId)
			return {
				errors: [
					{
						field: 'token',
						message: 'token expired',
					},
				],
			};

		const userIdNum = parseInt(userId);
		const user = await User.findOne(userIdNum);

		if (!user)
			return {
				errors: [
					{
						field: 'token',
						message: 'user no longer exists',
					},
				],
			};
		await User.update(
			{ id: userIdNum },
			{ password: await argon2.hash(newPassword) }
		);
		// delete key after password was updated
		await redis.del(key);
		// log in user after change password
		req.session.userId = user.id;

		return { user };
	}

	@Mutation(() => Boolean)
	async forgotPassword(
		@Arg('email') email: string,
		@Ctx() { redis }: MyContext
	) {
		const user = await User.findOne({ where: { email } });
		if (!user) {
			// email not in DB
			return true;
		}
		const token = v4();

		await redis.set(
			FORGET_PASSWORD_PREFIX + token,
			user.id,
			'ex',
			1000 * 60 * 60 * 24 * 3 //3 days
		);

		await sendEmail(
			email,
			`<a href="http://localhost:3000/change-password/${token}">reset password</a>`
		);
		return true;
	}

	@Query(() => User, { nullable: true })
	me(@Ctx() { req }: MyContext) {
		// you are not loged in
		if (!req.session.userId) {
			return null;
		}
		return User.findOne(req.session.userId);
	}

	@Mutation(() => UserResponse)
	async register(
		@Arg('options') options: UserNamePasswordInput,
		@Ctx() { req }: MyContext
	): Promise<UserResponse> {
		const errors = validateRegister(options);
		if (errors) return { errors };

		const hashedPassword = await argon2.hash(options.password);
		// const user = em.create(User, {
		// 	username: options.username,
		// 	password: hashedPassword,
		// });
		let user;
		try {
			// User.create({username: options.username,
			// 	password: hashedPassword,
			// 	email: options.email,}).save()
			const result = await getConnection()
				.createQueryBuilder()
				.insert()
				.into(User)
				.values({
					username: options.username,
					password: hashedPassword,
					email: options.email,
				})
				.returning('*')
				.execute();
			user = result.raw[0];
		} catch (error) {
			console.log('error :', error);
			if (error.code === '23505') {
				//duplicate username error
				return {
					errors: [
						{
							field: 'username',
							message: 'username already taken',
						},
					],
				};
			}
		}

		// store user id session
		// this will set a cookie on the user client
		// keep them logged in
		console.log('user :', user);
		req.session.userId = user.id;

		return { user };
	}

	@Mutation(() => UserResponse)
	async login(
		@Arg('usernameOrEmail') usernameOrEmail: string,
		@Arg('password') password: string,
		@Ctx() { req }: MyContext
	): Promise<UserResponse> {
		const user = await User.findOne(
			usernameOrEmail.includes('@')
				? {
						where: { email: usernameOrEmail },
				  }
				: { where: { username: usernameOrEmail } }
		);
		if (!user) {
			return {
				errors: [
					{
						field: 'usernameOrEmail',
						message: "username doesn't exist",
					},
				],
			};
		}
		const valid = await argon2.verify(user.password, password);
		if (!valid) {
			return {
				errors: [
					{
						field: 'password',
						message: 'incorrect password',
					},
				],
			};
		}

		req.session.userId = user.id;

		return { user };
	}

	@Mutation(() => Boolean)
	logout(@Ctx() { req, res }: MyContext) {
		return new Promise(resolve =>
			req.session.destroy(err => {
				res.clearCookie('qid');
				if (err) {
					console.log(err);
					resolve(false);
					return;
				}
				resolve(true);
			})
		);
	}
}
