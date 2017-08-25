/* eslint-disable func-names, prefer-arrow-callback, no-unused-expressions */

// Third party components
require('colors');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const mongoose = require('mongoose');
const Mockgoose = require('mockgoose').Mockgoose;
const logger = require('winston');
const Promise = require('bluebird');

// Local components
require('./../../app/models/campaign.js');
const CampaignController = require('./../../app/controllers/campaigns.js');

// Setup
logger.level = 'error';
mongoose.Promise = Promise;
chai.use(chaiSubset);

// Test variables
const mockgoose = new Mockgoose(mongoose);
const expect = chai.expect;
let controller = null;

describe('controllers/campaigns.js', () => {
  // Create fresh DB
  before(function () {
    mockgoose.helper.setDbVersion('3.2.1');

    logger.debug('[Before] Preparing storage'.gray);
    return mockgoose.prepareStorage().then(() => {
      logger.debug('[Before] Connecting to mongo\n'.gray);
      return mongoose.connect('mongodb://testmock.com/TestingDB');
    });
  });

  beforeEach(function () {
    return mockgoose.helper.reset();
  });

  after((done) => {
    logger.debug('[After] Closing mongoose connection'.gray);
    mongoose.disconnect();
    done();
  });

  it('constructor', (done) => {
    // Create controller to test
    controller = new CampaignController();
    expect(controller).to.exist; // eslint-disable-line no-unused-expressions
    done();
  });
});
