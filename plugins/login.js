const uuid = require('uuid');

module.exports = function loginModule(options) {
  const { redisClient } = options;

  this.add({ role: 'auth', cmd: 'login' }, (msg, done) => {
    const { login } = msg;

    /*
     here we should get user from users service
     */

    const token = uuid.v4();

    redisClient.set(token, login, () => done(null, { token }));
  });
};
