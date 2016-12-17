
/*!
 * Module dependencies
 */

var mongoose = require('mongoose');
//var userPlugin = require('mongoose-user');
var Schema = mongoose.Schema;

var QueryPlugin = require('mongoose-query');

/**
 * User schema
 */
var ResultSchema = new Schema({
  tcid: { type: String, required: true },
  tcRef: {type: Schema.Types.ObjectId, ref: 'Testcase' },
  job:{
    id: { type: String, default: ''}
  },
  campaign: {type: String, default: '', index: true},
  campaignRef: {type: Schema.Types.ObjectId, ref: 'Campaign' },
  cre: {
    time: {type: Date, default: Date.now, index: true},
    user: {type: String},
    userRef: {type: Schema.Types.ObjectId, ref: 'User' } 
  },  
  exec: {
    verdict: { type: String, required: true, enum: ['pass', 'fail', 'inconclusive', 'blocked', 'error'] },
    note: {type: String, default: ''},
    duration: {type: Number}, //seconds
    env: { //environment information
      ref: {type: Schema.Types.ObjectId, ref: 'Resource' },
      rackId: {type: String},
      framework: {
        name: {type: String, default: ''},
        ver: {type: String, default: ''},
      },
    },
    sut: { // software under test
      ref: {type: Schema.Types.ObjectId, ref: 'Build' },
      gitUrl: {type: String, default: ''},
      buildName: {type: String},
      buildDate: {type: Date},
      buildUrl: {type: String, default: ''},
      branch: {type: String, default: ''},
      commitId: {type: String, default: ''},
      tag: [{type: String}],
      href: {type: String},
      cut: [{type: String}], // Component Under Test
      fut: [{type: String}], // Feature Under Test
    },
    dut: {  //device(s) under test
      count: {type: Number},
      type: {type: String, enum: ['hw','simulator', 'process'], default: 'hw'},
      ref: {type: Schema.Types.ObjectId, ref: 'Resource' },
      vendor: {type: String},
      model: {type: String},
      ver: {type: String},
      sn: {type: String}
    },
    logs: [
      {
        ref: {type: Schema.Types.ObjectId, ref: 'Resource' },
        from: {type: String, enum: ['dut', 'framework', 'env', 'other']},
        filename: {type: String},
        filesize: {type: Number},
        refs: {type: String},
        data: {type: Buffer},
      }
    ]
  }
});

/**
 * Query plugin
 */
ResultSchema.plugin( QueryPlugin ); //install QueryPlugin

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Methods
 */

ResultSchema.method({

});

/**
 * Statics
 */

ResultSchema.static({

});

/**
 * Register
 */
mongoose.model('Result', ResultSchema);
