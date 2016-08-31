import amqp from 'amqplib/callback_api';
import { Channel } from 'amqplib/lib/channel';
import { CallbackModel } from 'amqplib/lib/callback_model';
import bluebird from 'bluebird';

bluebird.promisifyAll(amqp);
bluebird.promisifyAll(Channel.prototype);
bluebird.promisifyAll(CallbackModel.prototype);

const login = process.argv.slice(2).join(' ') || 'admin';

amqp
  .connectAsync()
  .then(connection => {
    connection
      .createChannelAsync()
      .then(ch => {
        ch.assertQueue('events', { durable: false });
        ch.sendToQueue('events', new Buffer(JSON.stringify({
          type: 'authorizeUser',
          login,
        })), { persistent: true });
        console.log(" [x] Auth for '%s'", login);

        setTimeout(() => {
          connection.close();
          process.exit(0);
        }, 1000);
      });
  });
