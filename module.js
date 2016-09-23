import { getRabbitConnection } from './rabbit-connection';
import { getRedisConnection } from './redis-connection';
import winston from 'winston';
import uuid from 'uuid';

function sendResponseToMsg(ch, msg, data) {
  return Promise
    .resolve()
    .then(() => ch.sendToQueue(
      msg.properties.replyTo,
      new Buffer(JSON.stringify(data)),
      { correlationId: msg.properties.correlationId }
    ));
}

Promise
// wait for connection to RabbitMQ and MongoDB
  .all([getRabbitConnection(), getRedisConnection()])
  // create channel rabbit
  .then(([conn, r]) => Promise.all([conn.createChannel(), r]))
  .then(([ch, r]) => {
    // create topic
    ch.assertExchange('events', 'topic', { durable: true });
    // create queue
    ch.assertQueue('auth-service', { durable: true })
      .then(q => {
        // fetch by one message from queue
        ch.prefetch(1);
        // bind queue to topic
        ch.bindQueue(q.queue, 'events', 'auth.*');
        // listen to new messages
        ch.consume(q.queue, msg => {
          let data;

          try {
            // messages always should be JSONs
            data = JSON.parse(msg.content.toString());
          } catch (err) {
            // log error and exit
            winston.error(err, msg.content.toString());
            return;
          }

          let token;

          // map a routing key with actual logic
          switch (msg.fields.routingKey) {
            case 'auth.login':
              token = uuid.v4();
              r.set(token, data.login, () => {
                sendResponseToMsg(ch, msg, { token, userId: 1 })
                  .then(() => ch.ack(msg));
              });
              break;
            case 'auth.logout':
              r.del(data.token, () => {
                sendResponseToMsg(ch, msg, true)
                  .then(() => ch.ack(msg));
              });
              break;
            default:
              // if we can't process this message, we should send it back to queue
              ch.nack(msg);
              return;
          }
        });
      });
  });
