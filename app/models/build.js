
/*!
 * Module dependencies
 */
// native modules
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

// 3rd party modules
var winston = require('winston');
var _ = require('lodash');
var uuid = require('node-uuid');
var mongoose = require('mongoose');
var QueryPlugin = require('mongoose-query');
var mime = require('mime');
var nconf = require('nconf');


function checksum (str, algorithm, encoding) {
    return crypto
        .createHash(algorithm || 'sha1')
        .update(str, 'binary')
        .digest(encoding || 'hex')
}

var Schema = mongoose.Schema;

var filedb = nconf.get('filedb');


/**
 * Location schema
 */
var Location = new Schema({
  url: {type: String }, // fs://... or http://... or ftp://... or sft://...
  auth: {
    usr: { type: String },
    pwd: { type: String }
  }
});

/**
 * Issue schema
 */
var Issue = new Schema({
  time: {type: Date, default: Date.now},
  type: { type: String, enum: ['github', 'jira'] },
  url: { type: String }
});

/**
 * Build schema
 */
var BuildSchema = new Schema({
  name: {type: String, required: true },
  type: { type: String, enum: ['app', 'lib'], default: 'app'},
  cre: {
    user: {type: String},
    time: {type: Date, default: Date.now}
  },
  mod: {
    user: {type: String},
    time: {type: Date, default: Date.now}
  },
  uuid: { type: String, default: uuid.v4, index: true },
  vcs: [
    new Schema({
      name: { type: String }, //e.g. "github"
      system: { type: String, enum: ['git','SVN', 'CSV'], default: 'git' },
      type: {type: String, enum: ['PR']},

      commitId: { type: String },
      branch: { type: String },

      base_branch: {type: String},
      base_commit: {type: String},
      pr_number: {type: String},
      url: { type: String },
      clean_wa: { type: Boolean }
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
  compiledBy: { type: String, enum: ['CI', 'manual'] },
  changeId: {type: String}, // e.g. when gerrit build
  meta_info: {
    compiler: {type: String},
    version: {type: String},
    toolchain: {type: String},
    machine: {type: String}
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
  files: [{
    //buffer limit 16MB when attached to document!
    name: { type: String },
    mime_type: { type: String },
    data: { type: Buffer },
    size: { type: Number },
    sha1: { type: String },
    sha256: { type: String }
  }],
  issues: [ Issue ],
  // build target device
  target: {
    type: { type: String, enum: ['simulate','hardware'], default: 'hardware', required: true},
    os: { type: String, enum: ['win32', 'win64', 'unix32', 'unix64', 'mbedOS', 'unknown'] },
    simulator: {
      bt: { type: String },
      network: { type: String }
    },
    hw: {
      vendor: { type: String },
      model: {type: String},
      rev: { type: String },
      meta: { type: String }
    }
  }
});
BuildSchema.set('toObject', { virtuals: true });
//BuildSchema.set('toJSON', { virtuals: true });


/**
 * Build plugin
 */
BuildSchema.plugin( QueryPlugin ); //install QueryPlugin

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

BuildSchema.pre('validate', function (next) {
  var err;
  if( _.isArray(this.files) ) {
    for(i=0;i<this.files.length;i++) {
      var file = this.files[i];
      if( !file.name) {
          err = new Error('file['+i+'].name missing');
          break;
      }
      if(file.data) {
        file.size = file.data.length;
        //file.type = mimetype(file.name(
        file.sha1 = checksum(file.data, 'sha1');
        file.sha256 = checksum(file.data, 'sha256');
        if( filedb === 'mongodb') {
          //use mongodb document
          winston.warn('store file %s to mongodb', file.name);
        }  else if( filedb ) {
          // store to filesystem
          var target = path.join(filedb, file.sha1);
          var fileData = file.data;
          delete file.data;
          fs.exists(target, function(exists){
            if(exists) {
              winston.warn('File %s exists already (filename: %s)', file.name, file.sha1);
              return;
            }
            winston.warn('Store file %s (filename: %s)', file.name, file.sha1);
            fs.writeFile(target, fileData, function(err){
              if(err) {
                winston.warn(err);
              }
            });
          });
        } else {
          //do not store at all..
          delete file.data;
          winston.warn('filedb is not configured');
        }
      }
    }
  }
  if( err ) {
      return next(err);
  }
  if( _.get(this, 'target.type') === 'simulate' ){
    if( !_.get(this, 'target.simulator' ))
        err = new Error('simulator missing');
  } else if( _.get(this, 'target.type') === 'hardware' ){
    if( !_.get(this, 'target.hw') )
        err = new Error('target.hw missing');
    else if(!_.get(this, 'target.hw.model'))
        err = new Error('target.hw.model missing');
  }
  next(err);
 });

/**
 * Methods
 */
BuildSchema.methods.download = function(index, expressResponse) {
  index = index || 0;
  var cb = function(err, file) {
    var res = expressResponse;
    if(err) {
      return res.status(500).json(err);
    }
    if(file.data) {
      var mimetype = mime.lookup(file.name);
      res.writeHead(200, {
          'Content-Type': mimetype,
          'Content-disposition': 'attachment;filename=' + file.name,
          'Content-Length': file.data.length
      });
      res.end( file.data );
    } else {
      res.status(404).json(build);
    }
  };
  if( _.get(this.files, index)) {
    var file = _.get(this.files, index);
    if(file.data) {
      return cb(null, file);
    }
    var source = path.join(filedb, file.sha1);
    winston.debug('downloading source: ', source);
    fs.readfile(source, function(err, data) {
      winston.debug('data: ', data);
      cb(err, data?_.merge({}, file, {data: data}):null);
    });
  } else {
    cb({error: 'file not found'});
  }
};

BuildSchema.virtual('file').get(
  function() {
      if(this.files.length === 1) {
        var href;
        if( filedb && filedb !== 'mongodb' && this.files[0].sha1) {
          href = path.join(filedb, this.files[0].sha1);
        }
      }
      return href;
  });

/**
 * Statics
 */
//BuildSchema.static({});

/**
 * Register
 */
mongoose.model('Build', BuildSchema);
