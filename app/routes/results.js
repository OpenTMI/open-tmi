// 3rd party modules
const express = require('express');
const _ = require('lodash');
// application modules
const ResultController = require('./../controllers/results');
const eventBus = require('../tools/eventBus');

function Route(app) {
  const router = express.Router();
  const controller = new ResultController();

  router.param('Result', controller.modelParam.bind(controller));

  router.route('/api/v0/results.:format?')
    .all(controller.all.bind(controller))
    .get(controller.find.bind(controller))
    .post(controller.create.bind(controller));
  router.route('/api/v0/results/junit')
    .post(controller.createFromJunitXml);

  router.route('/api/v0/results/:Result.:format?')
    .all(controller.all.bind(controller))
    .get(controller.get.bind(controller))
    .put(controller.update.bind(controller))
    .delete(controller.remove.bind(controller));

  router.route('/api/v0/results/:Result/builds/:Index/download')
    .all(controller.all.bind(controller))
    .get(ResultController.buildDownload);

  controller.on('create', (result) => {
    eventBus.emit('result.new', _.omit(result, 'logs'));
  });

  app.use(router);
}

module.exports = Route;
