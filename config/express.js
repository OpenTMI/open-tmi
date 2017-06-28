/**
  Express configuration
*/

// native modules

/* 3rd party libraries */
var express = require('express');

// Express addons
var session = require('express-session');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var busboy = require('connect-busboy');
var csrf = require('csurf');
var cors = require('cors');

var mongoStore = require('connect-mongo')(session);

var logger = require('winston');
var expressWinston = require('express-winston');

/* Project libraries */
var nconf = require('nconf');
var pkg = require('../package.json');
var env = process.env.NODE_ENV || 'development';

/**
 * Expose
 */
module.exports = function (app) {
  // Compression middleware (should be placed before express.static)
  app.use(compression({
    threshold: 512,
  }));

  app.use(express.static(nconf.get('root') + '/public'));

  // Logging middleware
  app.use(expressWinston.logger({
    winstonInstance: logger,
    meta: false, // optional: control whether you want to log the meta data about the request (default to true)
    //msg: "HTTP {{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}", // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
    expressFormat: true, // Use the default Express/morgan request formatting, with the same colors. Enabling this will override any msg and colorStatus if true. Will only output colors on transports with colorize set to true
    colorize: true, // Color the status code, using the Express/morgan color palette (default green, 3XX cyan, 4XX yellow, 5XX red). Will not be recognized if expressFormat is true
    ignoreRoute: (req, res) => (req.url.match(/^\/api/) !== null && req.method === 'GET'),
  }));

  // set views path, template engine and default layout
  //app.engine('html', swig.renderFile);
  //app.set('views', config.root + '/app/views');
  //app.set('view engine', 'html');

  // expose package.json to views
  app.use(function (req, res, next) {
    res.locals.pkg = pkg;
    res.locals.env = env;
    next();
  });

  app.use(cors());
  // bodyParser should be above methodOverride
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(busboy({
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  }));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(methodOverride(function (req, res) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      // look in urlencoded POST bodies and delete it
      var method = req.body._method;
      delete req.body._method;
      return method;
    }
  }));

  // cookieParser should be above session
  app.use(cookieParser());
  app.use(cookieSession({ secret: 'secret' }));
  app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: pkg.name,
    store: new mongoStore({
      url: nconf.get('db'),
      collection : 'sessions',
    }),
  }));

  // adds CSRF support when production mode
  if ( process.env.NODE_ENV === 'production') {
    // Add CSRF (Cross-site request forgery) support only for production mode app
    //app.use(csrf());

    // This could be moved to view-helpers :-)
    //app.use(function(req, res, next){
    //  res.locals.csrf_token = req.csrfToken();
    //  logger.debug( res.locals.csrf_token )
    //  next();
    //});
  }

  /*
  app.on('mount', function (parent) {
    console.log(parent); // refers to the parent app
  });*/
};
