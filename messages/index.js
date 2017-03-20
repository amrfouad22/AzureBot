/*-----------------------------------------------------------------------------
This template demonstrates how to use Waterfalls to collect input from a user using a sequence of steps.
For a complete walkthrough of creating this type of bot see the article at
https://docs.botframework.com/en-us/node/builder/chat/dialogs/#waterfall
-----------------------------------------------------------------------------*/
"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var constants=require('./constants');
var azure=require('./azureDeploy');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

bot.dialog('/', [
  function (session) {    
    builder.Prompts.text(session, 'Hello There '+session.message.address.user.name+' My name is Alfred ...\r\n I\'m here to deploy your VM :), I\'ll need some infomation from you. What will be your username');
  },
  function (session, results) {
    session.userData.username = results.response;
    builder.Prompts.text(session,'I need a password for this VM');
  },
  function (session, results) {
    session.userData.password = results.response;
    builder.Prompts.text(session,'chould you confirm this password?');    
  },
  function (session, results,next) {
    if(results.response!=session.userData.password){
      session.userData.back=true;
      session.send("Wrong confirm password");
      next({ resumed: builder.ResumeReason.back,response:session.userData.password });
    }
    else{
      session.userData.confirmpassword = results.response;
      builder.Prompts.text(session,'A value of a DNS Label will be great ;)');
    }
  },
  function (session, results) {
session.userData.dnsLabel = results.response;
    session.send('Got it... I\'m going to provisioning a Machine ' + session.userData.dnsLabel +
            ' and your user name will be :"' + session.userData.username+'"'+
            ' and this will be your password: "' + session.userData.password + '"');
   azure.deployTemplate(session.userData.username,session.userData.password,session.userData.dnsLabel,session.message.address,function(err,response){
      if(!err){
        session.send('Your virtual machine has been created');
      }
      else{
        session.send('Sorry Could\'nt create your VM :( #epicfail #uselessbot #tryagainlater');
      }
   });
  }
]);

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());  
    server.post('/api/proactive', function (req, res) {
    var msg = new builder.Message()
      .address(req.body.address)
      .text(req.body.message);
    bot.send(msg);
    res.send(200);
});
} else {
    module.exports = { default: connector.listen() }
}
