// Internal modules
var EventEmitter = require('events');

const eventBus = new EventEmitter();
module.exports = eventBus;
global.pubsub = eventBus; // backward compatible reason
