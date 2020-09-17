import "reflect-metadata"
import { MikroORM } from '@mikro-orm/core';
import { __prod__ } from './constants';
import { Post } from './entities/Post';
import microConfig from './mikro-orm.config';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/Post';
import { UserResolver } from "./resolvers/User";

// console.log('dirname: ', __dirname);

const main = async () => {
	const orm = await MikroORM.init(microConfig);
	await orm.getMigrator().up();
	const app = express();
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
		context: () => ({ em: orm.em }),
	});

	apolloServer.applyMiddleware({ app });

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
