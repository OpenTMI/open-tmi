// 3rd party modules
const mongoose = require('mongoose');
const _ = require('lodash');
const QueryPlugin = require('mongoose-query');

// application modules
const ResourceAllocationPlugin = require('./plugins/resource-allocator');
const validators = require('../tools/validators');
// Implementation
const {tagsValidator, appsValidator} = validators;
const {Schema} = mongoose;
const {Types} = Schema;
const {ObjectId} = Types;

/**
 * Resource schema
 */
const ResourceSchema = new Schema({
  name: {type: String}, // Resource Name
  type: { // Resource type
    type: String,
    required: true,
    enum: [
      'system',
      'dut',
      'instrument',
      'accessories',
      'computer',
      'room'
    ]},
  item: {
    model: {type: String},
    ref: {type: ObjectId, ref: 'Item'}
  },
  status: {
    value: {
      type: String,
      enum: [
        'active',
        'maintenance',
        'storage',
        'broken'
      ],
      default: 'active'
    },
    note: {
      type: String // e.g. notes why it's in maintenance
    },
    availability: { // @todo fetch this information from loans details
      type: String,
      enum: ['free', 'reserved']
    },
    time: {type: Date, default: Date.now}
  },
  cre: {
    user: {type: ObjectId, ref: 'User'},
    time: {type: Date, default: Date.now}
  },
  mod: {
    user: {type: ObjectId, ref: 'User'},
    timestamp: {type: Date, default: Date.now}
  },
  ownership: {
    corporation: {type: String},
    unit: {type: String},
    division: {type: String},
    department: {type: String},
    cost_center: {type: String},
    author: {type: String},
    purchased: {
      timestamp: {type: Date},
      user: {type: ObjectId, ref: 'User'},
      note: {type: String}
    }
  },
  user_info: {
    corporation: {type: String},
    unit: {type: String},
    division: {type: String},
    department: {type: String},
    author: {type: String},
    cost_center: {type: String}
  },
  usage: {
    type: {
      type: String,
      enum: [
        'automation',
        'shared',
        'manual',
        'unknown'
      ],
      default: 'unknown'
    },
    group: {
      type: String,
      enum: [
        'global',
        'department',
        'unknown'
      ],
      default: 'unknown'
    },
    automation: {
      system: {type: String}
    }
  },
  network: {
    hostname: {type: String},
    domain: {type: String},
    lan: [{
      name: {type: String},
      dhcp: {type: Boolean, default: true},
      ipv4: {type: String}, // IPv4 address
      ipv4netmask: {type: String},
      ipv6: {type: String}, // IPv6 address
      mac: {type: String}
    }],
    remote_connection: {
      protocol: {type: String, enum: ['vnc', 'http', 'https', 'ssh', 'telnet', 'rdm']},
      url: {type: String},
      authentication: {
        username: {type: String},
        password: {type: String}
      }
    }
  },
  location: { // Resource physical location
    site: {type: String, default: 'unknown'},
    country: {type: String},
    city: {type: String},
    adddress: {type: String},
    postcode: {type: String},
    room: {type: String, default: 'unknown'},
    subRoom: {type: String},
    geo: {type: [Number], index: '2d'}
  },
  tags: {
    type: Types.Mixed,
    validate: {
      validator: tagsValidator,
      message: '{VALUE} is not a valid tag!'
    }
  },
  hw: {
    firmware: {
      name: {type: String},
      version: {type: String}
    },
    sn: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
      required: () => (_.findIndex(['dut', 'instrument'], this.type) >= 0)
    }, // ue PSN
    imei: {type: String, match: [/[\d]{15}/, 'Invalid IMEI ({VALUE})']},
    hwid: {type: String},
    components: [{
      type: {type: String, required: true, enum: ['wlan', 'bluetooth', 'modem']},
      sn: {type: String},
      mac: {type: String}
    }]
  },
  installed: {
    os: {
      name: {type: String},
      build: {type: ObjectId, ref: 'Build'}
    },
    apps: {
      type: Types.Mixed,
      validate: {
        validator: appsValidator,
        message: '{VALUE} is not a valid app configuration!'
      }
    }
  },
  /*
  configurations: {
    defaults: {
      testcases: {
        path: [{type: String}]
      },
      logs: {
        path: [{type: String}]
      }
    }
  },
  shield: {
      rf: { type: Boolean }, // RF shield rack
  },
  app: [{
      type: {type: String, enum: ['application', 'plugin','library']},  // optional
      plugin: {
          application: {type: String}
      },
      library:{
          application: {type: String}
      },
      version: {type: String},
      href: {type: String},     // http url to file
      uuid: {type: String}      // or uuid to file
  }]
  change_history: []
  */

  // Child resources
  childs: [{type: ObjectId, ref: 'Resource'}],
  // Parent Resource
  parent: {type: ObjectId, ref: 'Resource'}
});

ResourceSchema.set('toJSON', {
  virtuals: true,
  getters: true,
  minimize: true,
  transform: (doc, ret) => {
    _.unset(ret, 'ip.remote_connection.authentication');
    return ret;
  }
});

/** install Plugins */
ResourceSchema.plugin(QueryPlugin);
ResourceSchema.plugin(ResourceAllocationPlugin);

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Methods
 */

ResourceSchema.method({
  // find route from this resource to HEAD
  solveRoute(cb) {
    const route = [];
    const Resource = mongoose.model('Resource');
    const loop = function (error, resource) {
      if (_.has(resource, 'parent')) {
        route.push(resource.parent);
        Resource.find({_id: resource.parent}, loop);
      } else {
        cb(error, route);
      }
    };
    loop(null, this);
  }
});

/**
 * Statics
 */

// ResourceSchema.static({});

/**
 * Register
 */
const Resource = mongoose.model('Resource', ResourceSchema);
module.exports = {Model: Resource, Collection: 'Resource'};
