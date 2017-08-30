/*!
 * Module dependencies
 */
// Native modules
const path = require('path');

// Third party modules
const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const mongoose = require('mongoose');
const QueryPlugin = require('mongoose-query');
const mime = require('mime');

// Local modules
const logger = require('../tools/logger');
const FileSchema = require('./extends/file');
const tools = require('../tools');

const filedb = tools.filedb;
const fileProvider = filedb.provider;
const Schema = mongoose.Schema;

/**
 * Location schema
 */
const Location = new Schema({
  url: {type: String}, // fs://... or http://... or ftp://... or sft://...
  auth: {
    usr: {type: String},
    pwd: {type: String}
  }
});

/**
 * Issue schema
 */
const Issue = new Schema({
  time: {type: Date, default: Date.now},
  type: {type: String, enum: ['github', 'jira']},
  url: {type: String}
});

/**
 * Build schema
 */
const BuildSchema = new Schema({
  name: {type: String, required: true},
  type: {type: String, enum: ['app', 'lib', 'test'], default: 'app'},
  cre: {
    user: {type: String},
    time: {type: Date, default: Date.now},
    host: {type: String}
  },
  mod: {
    user: {type: String},
    time: {type: Date, default: Date.now}
  },
  uuid: {type: String, default: uuidv4, index: true},
  vcs: [
    new Schema({
      name: {type: String}, // e.g. "github"
      system: {type: String, enum: ['git', 'SVN', 'CSV'], default: 'git'},
      type: {type: String, enum: ['PR']},
      commitId: {type: String},
      branch: {type: String},
      base_branch: {type: String},
      base_commit: {type: String},
      pr_number: {type: String},
      url: {type: String},
      clean_wa: {type: Boolean}
    })
  ],
  ci: {
    system: {type: String, enum: ['Jenkins', 'travisCI', 'circleCI']},
    location: Location,
    job: {
      name: {type: String},
      number: {type: String}
    }
  },
  compiledBy: {type: String, enum: ['CI', 'manual']},
  changeId: {type: String}, // e.g. when gerrit build
  configuration: {
    name: {type: String},
    compiler: {
      name: {type: String},
      version: {type: String},
      macros: [{
        key: {type: String},
        value: {type: String}
      }],
      flags: [{
        key: {type: String},
        value: {type: String}
      }]
    },
    linker: {
      name: {type: String},
      version: {type: String},
      flags: [{
        key: {type: String},
        value: {type: String}
      }]
    },
    toolchain: {
      name: {type: String},
      version: {type: String}
    }
  },
  memory: {
    summary: {
      heap: {type: Number},
      static_ram: {type: Number},
      total_flash: {type: Number},
      stack: {type: Number},
      total_ram: {type: Number}
    }
  },
  files: [FileSchema],
  issues: [Issue],
  // build target device
  target: {
    type: {type: String, enum: ['simulate', 'hardware'], default: 'hardware', required: true},
    os: {type: String, enum: ['win32', 'win64', 'unix32', 'unix64', 'mbedOS', 'unknown']},
    simulator: {
      bt: {type: String},
      network: {type: String}
    },
    hw: {
      vendor: {type: String},
      model: {type: String},
      rev: {type: String},
      meta: {type: String}
    }
  }
});
BuildSchema.set('toObject', {virtuals: true});
// BuildSchema.set('toJSON', { virtuals: true });


/**
 * Build plugin
 */
BuildSchema.plugin(QueryPlugin); // install QueryPlugin

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/*
 BuildSchema.path('location').validate(function (value, respond) {
 if( value.length === 0 ) respond(false);
 else  respond(true);
 }, '{PATH} missing');
 */


BuildSchema.pre('validate', function validate(next) {
  let error;
  if (_.isArray(this.files)) {
    this.files.forEach((file) => {
      file.prepareDataForStorage();
      if (fileProvider === 'mongodb') {
        // use mongodb document
        logger.warn('storing file %s to mongodb', file.name);
      } else if (fileProvider) {
        // store data to filesystem
        logger.debug('storing file %s into filesystem', file.name);
        filedb.storeFile(file)
          .then(() => {
            logger.silly(`File ${file.name} stored`);
          })
          .catch((storeError) => {
            logger.warn(storeError);
          });

        // stored data seperately, unassign data from schema
        file.data = undefined; // eslint-disable-line no-param-reassign
      } else {
        // do not store at all..
        logger.warn('filedb is not configured, ignoring data');
        file.data = undefined; // eslint-disable-line no-param-reassign
      }
    });
  }

  if (error) {
    return next(error);
  }
  if (_.get(this, 'target.type') === 'simulate') {
    if (!_.get(this, 'target.simulator')) {
      error = new Error('simulator missing');
    }
  } else if (_.get(this, 'target.type') === 'hardware') {
    if (!_.get(this, 'target.hw')) {
      error = new Error('target.hw missing');
    } else if (!_.get(this, 'target.hw.model')) {
      error = new Error('target.hw.model missing');
    }
  }

  return next(error);
});

/**
 * Methods
 */
BuildSchema.methods.download = function download(index, res) {
  const editedIndex = index || 0;
  const cb = function (err, file) {
    const editedRes = res;
    if (file.data) {
      const mimetype = mime.lookup(file.name);
      editedRes.writeHead(200, {
        'Content-Type': mimetype,
        'Content-disposition': `attachment;filename=${file.name}`,
        'Content-Length': file.data.length
      });
      editedRes.send(file.data);
    } else {
      editedRes.status(404).send('not found');
    }
    return undefined;
  };

  if (_.get(this.files, editedIndex)) {
    const file = _.get(this.files, editedIndex);
    if (file.data) {
      return cb(null, file);
    }
    filedb.readFile(file)
      .then((data) => { cb(null, data); })
      .catch((error) => { cb(error); });
  } else {
    return res.status(500).json({error: 'file not found'});
  }

  return undefined;
};

BuildSchema.virtual('file').get(function getFile() {
  if (this.files.length === 1) {
    if (fileProvider && fileProvider !== 'mongodb' && this.files[0].sha1) {
      return path.join(fileProvider, this.files[0].sha1);
    }
  }
  return undefined;
});

/**
 * Statics
 */
// BuildSchema.static({});

/**
 * Register
 */
const Build = mongoose.model('Build', BuildSchema);
module.exports = {Model: Build, Collection: 'Build'};
