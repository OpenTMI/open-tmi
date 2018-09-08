/*!
 * Module dependencies
 */

// Third party modules
const mongoose = require('mongoose');
const QueryPlugin = require('mongoose-query');
const logger = require('../tools/logger');
const _ = require('lodash');

// Local components
const FileSchema = require('./extends/file');
const tools = require('../tools');

// Model variables
const {Schema} = mongoose;
const {Types} = Schema;
const {ObjectId, Mixed} = Types;
const {filedb} = tools;
const fileProvider = filedb.provider;
const Build = mongoose.model('Build');

// @Todo justify why file schema is extended here instead of adding to root model
FileSchema.add({
  ref: {
    type: ObjectId,
    ref: 'Resource'
  },
  from: {
    type: String,
    enum: ['dut', 'framework', 'env', 'other']
  }
});

const DutSchemaObj = { // Device(s) Under Test
  type: {type: String, enum: ['hw', 'simulator', 'process']},
  ref: {type: ObjectId, ref: 'Resource'},
  vendor: {type: String},
  model: {type: String},
  ver: {type: String},
  sn: {type: String},
  provider: {
    name: {type: String},
    id: {type: String},
    ver: {type: String}
  }
};
const DutSchema = new Schema(DutSchemaObj);
/**
 * User schema
 */
const ResultSchema = new Schema({
  tcid: {type: String, required: true, index: true},
  tcRef: {type: ObjectId, ref: 'Testcase'},
  job: {
    id: {type: String, default: ''}
  },
  campaign: {type: String, default: '', index: true},
  campaignRef: {type: ObjectId, ref: 'Campaign'},
  cre: {
    time: {type: Date, default: Date.now, index: true},
    user: {type: String},
    userRef: {type: ObjectId, ref: 'User'}
  },
  exec: {
    verdict: {
      type: String,
      required: true,
      enum: ['pass', 'fail', 'inconclusive', 'blocked', 'error', 'skip'],
      index: true
    },
    note: {type: String, default: ''},
    duration: {type: Number}, // seconds
    profiling: {type: Mixed},
    metadata: {type: Mixed},
    metrics: {type: Mixed},
    env: { // environment information
      ref: {type: ObjectId, ref: 'Resource'},
      rackId: {type: String},
      framework: {
        name: {type: String, default: ''},
        ver: {type: String, default: ''}
      }
    },
    sut: { // software under test
      ref: {type: ObjectId, ref: 'Build'},
      gitUrl: {type: String, default: ''},
      buildName: {type: String},
      buildDate: {type: Date},
      buildUrl: {type: String, default: ''},
      buildSha1: {type: String},
      branch: {type: String, default: ''},
      commitId: {type: String, default: ''},
      tag: [{type: String}],
      href: {type: String},
      cut: [{type: String}], // Component Under Test
      fut: [{type: String}] // Feature Under Test
    },
    dut: _.merge({}, DutSchemaObj, {count: {type: Number}}), // Device(s) Under Test
    duts: [DutSchema],
    logs: [FileSchema]
  }
});

ResultSchema.set('toObject', {virtuals: true});

/**
 * Query plugin
 */
ResultSchema.plugin(QueryPlugin); // install QueryPlugin

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Methods
 */
ResultSchema.methods.getBuildRef = function () { // eslint-disable-line func-names
  logger.debug('lookup build..');
  return _.get(this, 'exec.sut.ref', undefined);
};

/**
 * Validation
 */
function linkRelatedBuild(buildChecksum) {
  if (!buildChecksum) {
    return Promise.resolve();
  }

  logger.debug(`Processing result build sha1: ${buildChecksum}`);
  return Build.findOne({'files.sha1': buildChecksum}).then((build) => {
    if (build) {
      logger.debug(`Build found, linking Result: ${this._id} with Build: ${build._id}`);
      this.exec.sut.ref = build._id;
    }
  });
}

ResultSchema.pre('validate', function (next) { // eslint-disable-line func-names
  const logs = _.get(this, 'exec.logs', []);
  const mapFile = (file, i) => {
    file.prepareDataForStorage(i);

    // Decide what to do with file
    if (fileProvider === 'mongodb') {
      file.keepInMongo(i);
      return Promise.resolve();
    } else if (fileProvider) {
      return file.storeInFiledb(filedb, i);
    }

    file.dumpData(i);
    return Promise.resolve();
  };

  // Link related build to this result
  return linkRelatedBuild.bind(this)(_.get(this, 'exec.sut.buildSha1'))
    .then(() => Promise.all(logs.map(mapFile))) // Promise to store all files
    .then(() => next())
    .catch(next);
});

/**
 * Virtuals
 */
/*
ResultSchema.virtual('exec.sut.sha1');
  .get()
  .set(function(v) {
});
*/

/**
 * Statics
 */
/*
ResultSchema.static({

});
*/

/**
 * Register
 */
const Result = mongoose.model('Result', ResultSchema);
module.exports = {Model: Result, Collection: 'Result'};
