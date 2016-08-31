import amqp from 'amqplib/callback_api';
import { Channel } from 'amqplib/lib/channel';
import { CallbackModel } from 'amqplib/lib/callback_model';
import redis, { RedisClient } from 'redis';
import uuid from 'uuid';
import winston from 'winston';
import bluebird from 'bluebird';

bluebird.promisifyAll(amqp);
bluebird.promisifyAll(Channel.prototype);
bluebird.promisifyAll(CallbackModel.prototype);
bluebird.promisifyAll(RedisClient.prototype);

winston.level = 'debug';

const redisClient = redis.createClient(
  process.env.REDIS_PORT_6379_TCP_PORT || 6379,
  process.env.REDIS_PORT_6379_TCP_ADDR || 'localhost'
);

amqp
  .connectAsync()
  .then(connection => connection.createChannelAsync())
  .then(channel => {
    channel.assertQueue('events', { durable: false });

    channel.sendToQueue('events', Buffer.from(JSON.stringify({
      type: 'authorizeUser',
      login: 'admin',
    })));

    channel.consume('events', msg => {
      let event;

      try {
        event = JSON.parse(msg.content.toString());
      } catch (err) {
        winston.error(err, msg.content.toString());
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
        .then(() => channel.sendToQueue('events', Buffer.from(JSON.stringify({
          type: 'userAuthorized',
          login,
          token,
        }))))
        .then(() => {
          setTimeout(() => {
            console.log(token);
          }, 5000);
        });
    }, { noAck: true });
  });
