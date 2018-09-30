// 3rd party modules
const jwtSimple = require('jwt-simple');
const moment = require('moment');
const config = require('../../../app/tools/config');


function createToken(payload = {
  iat: moment().unix(),
  exp: moment().add(2, 'h').unix()}, webtoken) {
  return jwtSimple.encode(payload, webtoken);
}

function createUserToken({userId, group, webtoken=config.get('webtoken'), expHours = 2}) {
  // Create token for requests
  const payload = {
    _id: userId,
    groups: [group],
    iat: moment().unix(),
    exp: moment().add(expHours, 'h').unix()
  };

  const token = createToken(payload, webtoken);
  const authString = `Bearer ${token}`;
  const query = `token=${token}`;
  return {token, authString, query};
}

const api = 'http://localhost:3000';
const apiV0 = `${api}/api/v0`;


module.exports = {
  createToken,
  createUserToken,
  api,
  apiV0
};
