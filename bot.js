//REQUIRE LIBRARIES
var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
var express = require('express');
var passport = require('passport');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var util = require('util');

//Configure express
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});
var app = express();
app.use(cookieParser());
app.use(session({ secret: 'blizzard',
                  saveUninitialized: true,
                  resave: true }));

// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());

// Configure logger settings
console.log('INITIALIZING...');
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client();


//BNET OAUTH FLOW
var BnetStrategy = require('passport-bnet').Strategy;
var BNET_ID = auth.bnetid;
var BNET_SECRET = auth.bnetsecret;

// Use the BnetStrategy within Passport.
passport.use(new BnetStrategy({
    clientID: BNET_ID,
    clientSecret: BNET_SECRET,
    callbackURL: "https://localhost:3000/auth/bnet/callback",
    region: "us"
}, function(accessToken, refreshToken, profile, done) {
    console.warn(profile);
    return done(null, profile);
}));

//BNET TEST
app.get('/auth/bnet',
        passport.authenticate('bnet'));

app.get('/auth/bnet/callback',
        passport.authenticate('bnet', { failureRedirect: '/' }),
        function(req, res){
          res.redirect('/');
          console.log(res);
        });
app.get('/', function(req, res) {
  if(req.isAuthenticated()) {
    var output = '<h1>Express OAuth Test</h1>' + req.user.id + '<br>';
    if(req.user.battletag) {
      output += req.user.battletag + '<br>';
    }
    output += '<a href="/logout">Logout</a>';
    res.send(output);
  } else {
    res.send('<h1>Express OAuth Test</h1>' +
             '<a href="/auth/github">Login with Github</a><br>' +
             '<a href="/auth/bnet">Login with Bnet</a>');
  }
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

//BOT READY

bot.on('ready', function (evt) {
    logger.info('CONNECTED');
    logger.info('LOGGED IN AS: ' + bot.user.tag);
});

//BOT FUNCTIONS

bot.on('message', message => {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.content.substring(0, 1) == '!') {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);
        switch(cmd) {
            case 'ping':
                console.log(bot.channels);
                message.reply('pong');
            case 'userinfo':
                console.log(args);
                message.reply(getAccountInfo(args[0]));
            break;
            // Just add any case commands if you want to..
         }
     }
});

//create text channel and role when voice channel is added
bot.on('channelCreate', function (channel){
    console.log(JSON.stringify(channel));
    //check if voice channel created
    if(channel.type == 2){
        //add some kind of name check
        if(channel.name.includes('synced')){
            console.log("CREATE NEW SYNCED TEXT CHANNEL");

        }
    }
});

//update text channel and role name when voice channel is changed
bot.on('channelUpdate', function (oldChannel, newChannel){
    console.log(JSON.stringify(oldChannel));
    console.log(JSON.stringify(newChannel));
});

//delete role and text channel when voice channel is deleted
bot.on('channelDelete', function (channel){
    console.log(JSON.stringify(channel));
    if(channel.type == 2){
        //add some kind of name check
        if(channel.name.includes('synced')){
            console.log("DELETE SYNCED TEXT CHANNEL");
        }
    }
});

//API FUNCTIONS
function getAccountInfo(battletag){
    console.log('SEARCHING FOR BATTLETAG: ' + battletag);

    passport.use(new BnetStrategy({
        clientID: BNET_ID,
        clientSecret: BNET_SECRET,
        callbackURL: "https://localhost:3000/auth/bnet/callback",
        region: "us"
    }, function(accessToken, refreshToken, profile, done) {
        console.warn(profile);
        axios({
          method: 'get',
          url: 'https://us.api.battle.net/d3/profile/' + battletag,
          headers: { 'Authorization': 'Bearer ' + accessToken }
        })
        .then(response => {
          // Info about the user
          console.log(response.data);
          // User's characters
          console.log(response.data.characters);
          return done(null, profile);
        })
        .catch(err => {
           return done(err);
        });
    }));

    return 'placeholder';
}

bot.login(auth.token);
var server = app.listen(3000, function() {
  console.log('Listening on port %d', server.address().port);
});
