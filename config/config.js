/*
Called by nconf from ../app/index.js, fetches correct config file form ./env/
*/
/**
 * Module dependencies.
 */

// native modules
var path = require('path');
var extend = require('util')._extend;
var fs = require('fs');

// 3rd party modules
var winston = require('winston');
var nconf = require('nconf');

// configurations
var development = require('./env/development');
var test = require('./env/test');
var production = require('./env/production');

var defaults = {
  root: path.normalize(__dirname + '/..'),
  cfg: nconf.get('cfg')
};

/**
 * Expose
 */

module.exports = {
  development: extend(development, defaults),
  test: extend(test, defaults),
  production: extend(production, defaults)
}[nconf.get('cfg')];

filedb = module.exports.filedb;
if(filedb && filedb !== 'mongodb') {
  if (!fs.existsSync(filedb)){
    winston.info('create %s folder for filedb', filedb);
    fs.mkdirSync(filedb);
  }
}
