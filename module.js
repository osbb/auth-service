import { Client, Consumer, Producer } from 'kafka-node';
import redis, { RedisClient } from 'redis';
import uuid from 'uuid';
import winston from 'winston';
import bluebird from 'bluebird';

bluebird.promisifyAll(Client.prototype);
bluebird.promisifyAll(Producer.prototype);
bluebird.promisifyAll(Consumer.prototype);
bluebird.promisifyAll(RedisClient.prototype);

winston.level = 'debug';

const client = new Client();
const consumer = new Consumer(
  client,
  [
    { topic: 'events' },
  ],
  {
    groupId: 'auth-service-node-group',
    autoCommit: false,
  }
);
const producer = new Producer(client);

const redisClient = redis.createClient(
  process.env.REDIS_PORT_6379_TCP_PORT || 6379,
  process.env.REDIS_PORT_6379_TCP_ADDR || 'localhost'
);

consumer.on('message', msg => {
  let event;

  try {
    event = JSON.parse(msg.value);
  } catch (err) {
    winston.error(err, msg.value);
    return;
  }

  if (event.type !== 'authorizeUser') {
    return;
  }

  winston.log('debug', `New event: ${event.type}`);

  const { login } = event;

  const token = uuid.v4();

  redisClient
    .setAsync(token, login)
    .then(() => producer.sendAsync([
      {
        topic: 'events',
        messages: [
          JSON.stringify({
            type: 'userAuthorized',
            login,
            token,
          }),
        ],
      },
    ]))
    .then(() => {
      winston.log('debug', `New token: ${token}`);
      consumer.commit();
    });
});

process.on('SIGINT', () => {
  bluebird
    .all([
      client.closeAsync(),
      redisClient.quitAsync(),
    ])
    .then(() => process.exit(0));
});
