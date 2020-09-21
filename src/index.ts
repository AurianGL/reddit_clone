import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { __prod__ } from './constants';
import { Post } from './entities/Post';
import microConfig from './mikro-orm.config';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/Post';
import { UserResolver } from './resolvers/User';
import redis from 'redis';
import session from 'express-session';
import connectRedis from 'connect-redis';
import cors from 'cors';
// console.log('dirname: ', __dirname);

const main = async () => {
	const orm = await MikroORM.init(microConfig);
	await orm.getMigrator().up();
	const app = express();

	const RedisStore = connectRedis(session);
	const redisClient = redis.createClient();
	app.use(
		cors({
			origin: 'http://localhost:3000',
			credentials: true,
		}),
		session({
			name: 'qid',
			store: new RedisStore({
				client: redisClient,
				disableTouch: true,
				disableTTL: true,
			}),
			cookie: {
				maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
				httpOnly: true,
				sameSite: 'lax', //csrf
				secure: __prod__, //cookie only works in https
			},
			saveUninitialized: false,
			secret: 'kjhsgfjheohzjfhosjdfjj',
			resave: false,
		})
	);
	// REST ENDPOINT
	// app.get('/', (_req, res) => {
	// 	res.send('hello')
	// })
	// graphql schema
	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [HelloResolver, PostResolver, UserResolver],
			validate: false,
		}),
		context: ({ req, res }) => ({ em: orm.em, req, res }),
	});

	apolloServer.applyMiddleware({
		app,
		cors: { origin: 'http://localhost:3000' },
	});

	app.listen(4000, () => {
		console.log('server started at localhost:4000');
	});

	// create posts in DB
	// const post = orm.em.create(Post, { title: 'my first post' });
	// await orm.em.persistAndFlush(post);
	// console.log('--------------------sql 2------------------');
	// await orm.em.nativeInsert(Post, { title: 'my second post' });

	const posts = await orm.em.find(Post, {});
	console.log(posts);
};

main();
