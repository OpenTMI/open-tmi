var express = require('express');
var mongoose = require('mongoose');

var Route = function(app, passport){

  var router = express.Router();
  
  router.route('/api/v0/addons.:format?')
    .all( function(req, res, next){
      next();
    })
    .get( function(req, res){
      res.json( global.AddonManager.AvailableModules() );
    })
    
    app.use( router );
}

module.exports = Route;