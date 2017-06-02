'use strict';

var util = require('util');
var winston = require('winston');
var EventEmitter = require('events').EventEmitter;
/*
  General ontrollers for "Restfull" services 
*/
var DefaultController = function (Model, defaultModelName, docId) {
  var self = this;
  var docId = docId || '_id';

  this.format = () => {
    return function(req, res, next, id) {
      if (req.params.format === 'html') {
        var redirurl = '/#'+req.url.match(/\/api\/v0(.*)\.html/)[1];
        res.redirect(redirurl);
      } else {
        next();
      }
    };
  };

  this.modelParam = (modelname, errorCb, successCb) => {
    //find from db
    modelname = modelname || defaultModelName;

    return (req, res, next, id) => {
      winston.debug('do param ' + JSON.stringify(req.params));
      var find = {};
      find[docId] = req.params[modelname];
      
      Model.findOne(find, (error, data) => {
        if (error) {
          if (errorCb) errorCb(error);
          else res.status(300).json({ error: error });
        } else if (data) {
          if (typeof modelname === 'string') req[modelname] = data;
          if (successCb) successCb();
          else next();
        } else {
          res.status(404).json({ msg: 'not found' });
        }
      });
    };
  };

  this.get = (req, res) => {
    if (req[defaultModelName]) {
      self.emit('get', req[defaultModelName].toObject());
      res.json(req[defaultModelName]);
    } else {
      winston.warn('should not be there!');
      res.status(300).json({ error: 'some strange problemo' });
    }
  };

  this.find = (req, res) => {
    Model.query(req.query, (error, list) => {
      if (error) {
        res.status(300).json({ error: error });
      } else {
        self.emit('find', list);
        res.json(list);
      }
    });
  };

  this.create = (req, res) => {
    var item = new Model(req.body);
    item.save((error) => {
      if (error) {
        winston.warn(error);
        if (res) res.status(300).json({ error: error });
      } else if (res) {
        req.query = req.body;
        self.emit('create', item.toObject());
        res.json(item);
      }
    });
  };

  this.update = (req, res) => {
    delete req.body._id;
    delete req.body.__v;
    winston.debug(req.body);

    Model.findByIdAndUpdate(req.params[defaultModelName], req.body, (error, doc) => {
      if (error) {
        res.status(300).json({ error: error });
      } else {
        self.emit('update', doc.toObject());
        res.json(doc);
      }
    });
  };

  this.remove = (req, res) => {
    var find = {};
    find[docId] = req.params[defaultModelName];
    Model.findByIdAndRemove(find, (error, ok) => {
      if (error) {
        res.status(300).json({ error: error });
      } else {
        self.emit('remove', req.params[defaultModelName]);
        res.json({});
      }
    });
  };

  // extra functions
  this.isEmpty = (cb) => {
    Model.count({}, (error, count) => {
      if (error) cb(error);
      else if (count === 0) cb(true);
      else cb(false);
    });
  };

  this.generateDummyData = (doItem, count, done) => {
    if (count > 0) {
      var o = new Model(doItem(count));
      o.save((err) => {
        if (err) done(err);
        else self.generateDummyData(doItem, count - 1, done);
      });
    } else {
      done();
    }
  };

  this.randomIntInc = (low, high) => Math.floor((Math.random() * (high - low + 1)) + low);
  this.randomText = list => list[self.randomIntInc(0, list.length - 1)];

  EventEmitter.call(this);
  return this;
};

// Inherit functions from `EventEmitter`'s prototype
util.inherits(DefaultController, EventEmitter);

module.exports = DefaultController;
