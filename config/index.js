const nconf = require('nconf');

// read configurations
const args = {
  listen: {
    alias: 'l',
    default: '0.0.0.0',
    type: 'string',
    describe: 'set binding interface',
    nargs: 1
  },
  https: {
    describe: 'use https',
    type: 'bool',
    default: false
  },
  port: {
    describe: 'set listen port',
    type: 'number',
    demand: true,
    default: 3000,
    nargs: 1
  },
  cfg: {
    alias: 'c',
    default: process.env.NODE_ENV || 'development',
    type: 'string',
    describe: 'Select configuration (development,test,production)',
    nargs: 1
  },
  verbose: {
    alias: 'v',
    type: 'number',
    describe: 'verbose level',
    count: 'v'
  },
  silent: {
    alias: 's',
    default: false,
    type: 'bool',
    describe: 'Silent mode'
  }
};

nconf.argv(args, 'Usage: npm start -- (options)')
  .env()
  .defaults(require('./../config/config.js'));


module.exports = nconf;
