/* eslint-disable func-names, prefer-arrow-callback, no-unused-expressions */

// Third party components
const jwtSimple = require('jwt-simple');
const nconf = require('../../config');
const moment = require('moment');
const superagent = require('superagent');
const chai = require('chai');
const logger = require('winston');

// Setup
logger.level = 'error';

// Test variables
const expect = chai.expect;
const api = 'http://localhost:3000/api/v0';


describe('Basic cluster tests', function () {
  const testUserId = '5825bb7afe7545132c88c761';
  let authString;
  // Create fresh DB
  before(function (done) {
    this.timeout(5000);
    // Create token for requests
    const payload = {
      sub: testUserId,
      group: 'admins',
      iat: moment().unix(),
      exp: moment().add(2, 'h').unix()
    };

    const token = jwtSimple.encode(payload, nconf.get('webtoken'));
    authString = `Bearer ${token}`;
    done();
  });
  it('basic rest call works', function (done) {
    superagent.get(api)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        done();
      });
  });
  it('clusters api gives response', function (done) {
    // this request goes worker->master->worker->client
    superagent.get(`${api}/clusters`)
      .set('authorization', authString)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.be.a('Object');
        // @todo fix for missing body is coing in another PR
        done();
      });
  });
});
