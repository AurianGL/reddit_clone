import { UserNamePasswordInput } from 'src/resolvers/UserNamePasswordInput';

export const validateRegister = (options: UserNamePasswordInput) => {
	if (options.username.length <= 2)
		return [
			{
				field: 'username',
				message: 'username must be longer',
			},
		];
	if (!options.email.includes('@'))
		return [
			{
				field: 'email',
				message: 'email must be valid',
			},
		];
	if (options.password.length <= 3)
		return [
			{
				field: 'password',
				message: 'password must be longer',
			},
		];
	if (options.username.includes('@'))
		return [
			{
				field: 'username',
				message: "can't include @",
			},
		];

	return null;
};
