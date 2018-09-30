/* eslint-disable func-names, prefer-arrow-callback, no-unused-expressions */

// Third party components
const superagent = require('superagent');
const chai = require('chai');
const logger = require('winston');

const {createUserToken} = require('./tools/helpers');

// Setup
logger.level = 'error';

// Test variables
const {expect} = chai;
const api = 'http://localhost:3000/api/v0';
const testUserId = '5825bb7afe7545132c88c761';
let authString;

describe('Basic Get API', function () {
  // Create fresh DB
  before(function () {
    // Create token for requests
    const payload = {
      userId: testUserId,
      group: 'admins',
    };
    authString = createUserToken(payload).authString;
  });

  it('get api version', function (done) {
    superagent.get(api)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.deep.equal({apiVersion: 'v0'});
        expect(res.body).to.not.be.empty;
        done();
      });
  });
  it('get server version', function (done) {
    superagent.get(`${api}/version`)
      .set('authorization', authString)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.have.a('Object');
        expect(res.body).to.not.be.empty;
        expect(res.body.commitId).to.have.a('string');
        expect(res.body.OpenTMI).to.have.a('string');
        expect(res.body.dependencies).to.not.exist;
        done();
      });
  });
  it('get server version deep', function (done) {
    this.timeout(10000);
    superagent.get(`${api}/version?deep=true`)
      .set('authorization', authString)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.have.a('Object');
        expect(res.body.commitId).to.have.a('string');
        expect(res.body.dependencies).to.have.a('Object');
        done();
      });
  });

  it('get testcases', function (done) {
    superagent.get(`${api}/testcases`)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.be.instanceof(Array);
        done();
      });
  });

  it('get campaigns', function (done) {
    superagent.get(`${api}/campaigns`)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.be.instanceof(Array);
        done();
      });
  });

  it('get resources', function (done) {
    superagent.get(`${api}/resources`)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.be.instanceof(Array);
        done();
      });
  });

  it('get results', function (done) {
    superagent.get(`${api}/results`)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.be.instanceof(Array);
        done();
      });
  });

  it('get builds', function (done) {
    superagent.get(`${api}/duts/builds`)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.be.instanceof(Array);
        done();
      });
  });

  it('get users', function (done) {
    superagent.get(`${api}/users`)
      .set('authorization', authString)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.be.instanceof(Array);
        expect(res.body).not.to.be.empty;
        done();
      });
  });

  it('get items', function (done) {
    superagent.get(`${api}/items`)
      .set('authorization', authString)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.be.instanceof(Array);
        done();
      });
  });

  it('get loans', function (done) {
    superagent.get(`${api}/loans`)
      .set('authorization', authString)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.be.instanceof(Array);
        done();
      });
  });
});
