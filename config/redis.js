// // redisClient.js
// const { createClient } = require('redis');

// const redisClient = createClient({
//   url: process.env.REDIS_URL || 'redis://localhost:6379', // adjust for production
// });

// redisClient.on('error', (err) => console.error('Redis Client Error', err));

// (async () => {
//   await redisClient.connect();
// })();

// module.exports = redisClient;
