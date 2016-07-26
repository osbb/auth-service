const seneca = require('seneca');
const redis = require('redis');

const redisClient = redis.createClient(
    process.env.REDIS_PORT_6379_TCP_PORT,
    process.env.REDIS_PORT_6379_TCP_ADDR
);

seneca()
    .client({
        host: process.env.USERS_PORT_10101_TCP_ADDR,
        port: process.env.USERS_PORT_10101_TCP_PORT,
    })
    .use('./plugins/login', { redisClient })
    .listen();
