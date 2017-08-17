const logger = require('./tools/logger');
const mongoose = require('mongoose');
const Promise = require('bluebird');

const nconf = require('../config');

const dbUrl = nconf.get('db');
mongoose.Promise = Promise;

const connect = function () {
  /**
   const options = {
    server: {
      socketOptions: {keepAlive: 1},
      auto_reconnect: true
    }
  }; */
  const options = {
    useMongoClient: true,
    // logger: logger,
    loggerLevel: 'warning' // @todo fetch from config file
  };
  logger.info(`Create MongoDB connection: ${dbUrl}`);
  return mongoose
    .connect(dbUrl, options)
    .then(() => {
      mongoose.connection.on('error', () => {
        logger.error(`Could not connect to MongoDB: ${dbUrl}`);
      });
    });
};

const close = Promise.promisify(mongoose.connection.close.bind(mongoose.connection));
function disconnect() {
  logger.info(`Force to close the MongoDB connection: ${dbUrl}`);
  return close();
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost, try again');
  connect();
});

mongoose.connection.on('connected', () => {
  logger.info(`Connection established to MongoDB: ${dbUrl}`);
});

mongoose.connection.on('reconnected', () => {
  logger.info(`Reconnected to MongoDB: ${dbUrl}`);
});

module.exports = {
  connect,
  disconnect,
  mongoose
};
