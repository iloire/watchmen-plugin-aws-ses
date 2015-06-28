var _ = require('lodash');
var moment = require('moment');
var validator = require('validator');
var debug = require('debug')('notifications');
var awsFactory = require('./lib/aws-ses.js');

var EMAIL_SUBJECT_PREFIX = '[watchmen]';

var config = {
  from: process.env.WATCHMEN_AWS_FROM,
  region: process.env.WATCHMEN_AWS_REGION,
  AWS_KEY: process.env.WATCHMEN_AWS_KEY,
  AWS_SECRET: process.env.WATCHMEN_AWS_SECRET
};

function sendNotificationIfPeopleSubscribed(service, options){
  var rcpts = getRecipients(service);
  if (rcpts.length) {
    var aws = new awsFactory(config);
    var options = {
      to: rcpts,
      title: options.title,
      body: options.body
    };
    aws.send(options, function (err, data) {
      if (err) {
        console.log('error sending notification for ' + service.name);
        console.error(err);
      } else {
        console.log('notification sent successfully to ' + rcpts + ' for ' + service.name);
      }
    });
  }
}

var eventHandlers = {

  /**
   * On a new outage
   * @param service
   * @param outage
   */

  onNewOutage: function (service, outage) {
    debug('triggering "onNewOutage" notification');
    sendNotificationIfPeopleSubscribed(service, {
      title: EMAIL_SUBJECT_PREFIX + ' ' + service.name + ' is down!',
      body: service.name + ' is down!. Reason: ' + JSON.stringify(outage.error)
    })
  },

  /**
   * Service is back up online
   * @param service
   * @param lastOutage
   */

  onServiceBack: function (service, lastOutage) {
    debug('triggering "onServiceBack" notification');
    sendNotificationIfPeopleSubscribed(service, {
      title: EMAIL_SUBJECT_PREFIX + ' ' + service.name + ' is back!',
      body: service.name + ' down for ' + moment.duration(lastOutage.downtime).humanize() +
      '. Error: ' + JSON.stringify(lastOutage.error)
    });
  }

};

function getRecipients(service){
  function parseEmailStringsToArray (commaSeparatedEmails){
    var emails = (commaSeparatedEmails || "").split(',');
    return emails.map(function(s){ return s.trim()}).filter(function(i){return validator.isEmail(i)});
  }
  return _.union(
      parseEmailStringsToArray(service.alertTo),
      parseEmailStringsToArray(process.env.WATCHMEN_NOTIFICATIONS_ALWAYS_ALERT_TO)
  );
}

function AwsSesPlugin (watchmen){
  watchmen.on('new-outage', eventHandlers.onNewOutage);
  watchmen.on('service-back', eventHandlers.onServiceBack);
}

exports = module.exports = AwsSesPlugin;

