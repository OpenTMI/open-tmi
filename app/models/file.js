// native modules
const path = require('path');

// 3rd party modules
const logger = require('winston');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const nconf = require('../../config');
const fileProvider = nconf.get('filedb');

// local module
const checksum = require('../tools/checksum.js');

const FileSchema = new Schema({
  // buffer limit 16MB when attached to document!
  name: { type: String },
  mime_type: { type: String },
  base64: { type: String },
  data: { type: Buffer },
  size: { type: Number },
  sha1: { type: String },
  sha256: { type: String }
});
FileSchema.set('toObject', { virtuals: true });

FileSchema.virtual('hrefs').get(function () {
  return (fileProvider && fileProvider !== 'mongodb' && this.sha1) ? path.join(fileProvider, this.sha1) : undefined;
});

FileSchema.methods.prepareDataForStorage = function () {
  logger.info(`preparing file (name: ${this.name}) for storage`);
  if (this.base64) {
    this.data = new Buffer(this.base64, 'base64');
    this.base64 = undefined;
  }

  if (this.data) {
    this.size = this.data.length;
    // file.type = mimetype(file.name(
    this.sha1 = checksum(this.data, 'sha1');
    this.sha256 = checksum(this.data, 'sha256');
  }
};

FileSchema.methods.storeInFileDB = function () {
  // filedb is reuired here because it causes a circular dependency otherwise
  const filedb = require('../tools/filedb.js'); // eslint-disable-line
  return filedb.storeFile(this).catch((error) => {
    logger.error(`Could not save file to filedb, reason: ${error.message}.`);
    throw error;
  });
};

FileSchema.methods.retrieveFromFileDB = function () {
  // filedb is reuired here because it causes a circular dependency otherwise
  const filedb = require('../tools/filedb.js'); // eslint-disable-line
  return filedb.readFile(this).catch((error) => {
    logger.error(`Could not read file from filedb, reason: ${error.message}.`);
    throw error;
  });
};

FileSchema.methods.checksum = function () {
  if (!this.sha1) {
    logger.warn('file without sha1 checksum processed, prepareData not called?');

    if (this.data) {
      this.sha1 = checksum(this.data, 'sha1');
    } else {
      logger.warn('could not calculate checksum for file without data');
      return null;
    }
  }

  return this.sha1;
};

mongoose.model('File', FileSchema);
module.exports = FileSchema;
