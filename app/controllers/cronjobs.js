/**
  CronJobs Controller
*/

// native modules

// 3rd party modules
const Promise = require('bluebird');
const _ = require('lodash');
const mongoose = require('mongoose');

// own modules
const {Collection, Model, setHandler} = require('../models/cronjob');
const DefaultController = require('./');
const logger = require('../tools/logger');


class CronJobsController extends DefaultController {
  constructor() {
    super(Collection);
    this.logger = logger;
    setHandler(this._handler.bind(this));
    Model.on('mongoose-cron:error', CronJobsController._onError);
    this._cron = Model.createCron().start();
    logger.info('Cron started');
  }
  _handler(doc) {
    const prefix = `Cronjob '${doc.name}':`;
    const cronLogger = {
      debug: msg => logger.debug(`${prefix} ${msg}`),
      error: msg => logger.error(`${prefix} ${msg}`),
      warn: msg => logger.warn(`${prefix} ${msg}`),
      info: msg => logger.info(`${prefix} ${msg}`)
    };
    cronLogger.info('started');
    const {type} = doc.type;
    const defaultHandler = this._handleViewAggregate;
    const handlers = {
      view: this._handleViewAggregate,
      email: this._handleEmail
      // @todo support for more different types..
    };
    const handler = _.get(handlers, type, defaultHandler);
    const startTime = new Date();
    return handler.bind(this)(doc, cronLogger)
      .then(() => {
        const duration = new Date() - startTime;
        cronLogger.info(` took ${duration / 1000} seconds`);
      });
  }
  showView(req, res) {
    const view = _.get(req.cronjobs.toObject(), 'view.view');
    if (!view) {
      return res.status(404).json({message: `View ${view} not found`});
    }
    if (req.cronjobs.view.processing) {
      this.logger.silly(`Requesting processing view: ${req.cronjobs.name}`);
      return res.status(503).json({message: `View ${view} is under processing`});
    }
    const collectionName = CronJobsController._getViewCollection(view);
    return CronJobsController._validCollection(collectionName)
      .then(() => CronJobsController._getQuery(req))
      .then(query => mongoose.connection.db.collection(collectionName).find(query))
      .then(docs => docs.toArray())
      .then(docs => res.json(docs))
      .catch((error) => {
        logger.warn(`showView rejected with: ${error}`);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({error: `${error}`, stack: error.stack});
      });
  }
  static _getQuery(req) {
    if (req.query.q) {
      return CronJobsController.parseJson(req.query.q);
    }
    return {};
  }
  static parseJson(str) {
    return Promise.try(() => JSON.parse(str))
      .catch((error) => {
        _.set(error, 'statusCode', 400); // bad request
        throw error;
      });
  }
  static _getCollectionNames() {
    const pending = mongoose.connection.db.listCollections().toArray();
    return pending.then(colls => _.map(colls, col => col.name));
  }
  static _hasCollection(col) {
    const pending = CronJobsController._getCollectionNames();
    return pending.then(colls => (colls.indexOf(col) >= 0));
  }
  static _validCollection(col) {
    return CronJobsController._hasCollection(col)
      .then((yes) => {
        if (!yes) {
          const error = new Error(`Collection ${col} not found`);
          error.statusCode = 404;
          throw error;
        }
        return col;
      });
  }
  static _getViewCollection(view) {
    return `cronjobs.${view}`;
  }
  _handleViewAggregate(doc, cronLogger) {
    return Promise.try(() => {
      const docJson = doc.toJSON();
      this.logger.debug(`Handle view: ${doc.name}`);
      const {col, aggregate, view} = docJson.view;

      // validate
      if (_.find(mongoose.modelNames(), view) >= 0) {
        const msg = 'Cannot overwrite default collections!';
        cronLogger.warn(msg);
        throw new Error(msg);
      }
      if (!col) {
        throw new Error('view.coll is missing');
      }
      if (!view) {
        throw new Error('view.view is missing');
      }
      if (!aggregate) {
        throw new Error('view.aggregate is missing');
      }
      // all seems to be okay.. -> let processing
      return CronJobsController._hasCollection(col)
        .then(yes => (yes ? Model.db.dropCollection(view) : true))
        .then(() => CronJobsController.parseJson(aggregate))
        .then(json => Model.db.createCollection(
          CronJobsController._getViewCollection(view),
          {viewOn: col, aggregate: json}
        ));
    });
  }
  _handleEmail(doc) {
    const msg = `Cronjob ${doc.name} uses email type but it is not supported yet`;
    this.logger.warn(msg);
    throw new Error(msg);
  }
  static _onError(error, doc) {
    logger.error(`Cronjob '${_.get(doc, 'name')}' error: ${error}`);
    logger.error(error.stack);
  }
}

module.exports = CronJobsController;
