/* eslint-disable func-names, prefer-arrow-callback, no-unused-expressions */

// Third party components
const _ = require('lodash');
const superagentPromise = require('superagent-promise');
const superagent = superagentPromise(require('superagent'), Promise);
const chai = require('chai');
const logger = require('winston');


// application modules
const {apiV0, getTestUserToken} = require('./tools/helpers');

// Setup
logger.level = 'error';
const api = apiV0;

// Test variables
const {expect} = chai;

const getResource = resourceId => superagent.get(`${api}/resources/${resourceId}`)
  .type('json')
  .then(function (res) {
    if (res.status !== 200) {
      throw new Error(`invalid status code ${res ? res.status : ''}`);
    }
    return res.body;
  });

function createResource({sn}) {
  const body = {name: 'dev1', type: 'dut', hw: {sn}};
  return superagent.post(`${api}/resources`).send(body);
}

describe('Resource', function () {
  let resourceId;

  let authString;
  before(function () {
    authString = getTestUserToken();
  });
  beforeEach(async function () {
    const {body} = await createResource({sn: 'SerialNumber'});
    resourceId = body._id;
  });
  afterEach(async function () {
    await superagent.del(`${api}/resources/${resourceId}`);
    resourceId = null;
  });

  it('add resource', async function () {
    const res = await createResource({sn: 'SerialNumber2'})
    expect(res).to.be.a('Object');
    expect(res).to.have.property('status', 200);
    expect(res.body).to.have.property('name');
    expect(res.body).to.have.property('type');
    expect(res.body).to.have.property('_id');
    expect(res.body._id).to.be.an('string');
    expect(res.body.name).to.equal('dev1');
    expect(res.body.type).to.equal('dut');

    await superagent.del(`${api}/resources/${res.body._id}`);
  });

  it('get resource', function () {
    return superagent.get(`${api}/resources/${resourceId}`)
      .type('json')
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.have.property('name');
        expect(res.body).to.have.property('type');
        expect(res.body).to.have.property('_id');
        expect(res.body._id).to.be.an('string');
        expect(res.body.name).to.equal('dev1');
        expect(res.body.type).to.equal('dut');
      });
  });

  it('update resource', function () {
    const body = {'status.value': 'active'};
    return superagent.put(`${api}/resources/${resourceId}`)
      .send(body)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.have.property('status');
        expect(res.body.status).to.have.property('value');
        expect(res.body.status.value).to.be.equal('active');
      });
  });
  it('update resource with valid version key', function () {
    const body = {'status.value': 'storage'};
    const doUpdate = resource => superagent.put(`${api}/resources/${resourceId}`)
      .send(_.defaults({__v: resource.__v}, body))
      .then((res) => {
        expect(res).to.be.a('Object');
        expect(res).to.have.property('status', 200);
        expect(res.body).to.have.property('status');
        expect(res.body.__v).to.be.equal(resource.__v + 1);
        expect(res.body.status).to.have.property('value');
        expect(res.body.status.value).to.be.equal('storage');
      });
    return getResource(resourceId)
      .then(doUpdate);
  });
  it('update resource with valid version key', function () {
    const body = {'status.value': 'broken'};
    const doUpdate = resource => superagent.put(`${api}/resources/${resourceId}`)
      .send(_.defaults({__v: resource.__v - 1}, body))
      .then(() => {
        throw new Error('Should not pass');
      })
      .catch((error) => {
        expect(error.status).to.be.equal(409);
      });
    return getResource(resourceId)
      .then(doUpdate);
  });
  it('update resource with invalid resource id', function () {
    const body = {'status.value': 'broken'};
    const doUpdate = resource => superagent.put(`${api}/resources/1234567ee135fe6b99dccb43`)
      .send(_.defaults({__v: resource.__v}, body))
      .then(() => {
        throw new Error('Should not pass');
      })
      .catch((error) => {
        expect(error.status).to.be.equal(404);
      });
    return getResource(resourceId)
      .then(doUpdate);
  });
  it('remove resource', async function () {
    const {body} = await createResource({sn: '1'})
    const {_id} = body
    return superagent.del(`${api}/resources/${_id}`)
      .end(function (error, res) {
        expect(error).to.equal(null);
        expect(res).to.be.a('Object');
        expect(res.status).to.be.equal(200);
      });
  });
  describe('events', function () {

    it('events', function () {
      return superagent
        .get(`${api}/resources/${resourceId}/events`)
        .set('authorization', authString)
        .end()
        .then((res) => {
          expect(res.status).to.be.equal(200);
        });
    });
    it('utilization', function () {
      return superagent
        .get(`${api}/resources/${resourceId}/utilization`)
        .set('authorization', authString)
        .end()
        .then(() => new Error('Should not pass'))
        .catch((res) => {
          expect(res.status).to.be.equal(404);
        });
    });
    it('statistics', function () {
      return superagent
        .get(`${api}/resources/${resourceId}/statistics`)
        .set('authorization', authString)
        .end()
        .then((res) => {
          expect(res.status).to.be.equal(200);
        });
    });
  });
  describe('allocation', function () {
    it('allocate and release', async function () {
      let url = `${api}/resources/${resourceId}/allocate`;
      await superagent.put(url).send({});

      url = `${api}/resources/${resourceId}/release`;
      await superagent.put(url).send({});
    });
  });
});
