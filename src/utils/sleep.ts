export const sleep = (sleepTimeInMs: number) =>
	new Promise(res => setTimeout(res, sleepTimeInMs));
