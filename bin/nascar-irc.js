/* Copyright (c) 2013 Justin King

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE. */

// For real, or for stable?
var DEBUG = 1;

// require() in our config the first time, SIGHUP will force re-read also
var cfg = require('../config/config');

// require() NASCAR LeaderboardClient library
var LeaderboardClient = require('nascar-stats-scraper').LeaderboardClient;

// Let's get our leaderboard handle,
//   and go ahead and start caching data
var leaderboard = new LeaderboardClient(cfg.nascar.leaderboard_url,
                                        cfg.nascar.query_interval);

// Now that our leaderboard is caching data,
//   let's have it let us know, so we can update our responses.
leaderboard.addListener('updated_board', updateResponses);

//Our help message
var HELP_TEXT = 'Looking for help? Try these commands:' +
                ' !leader, !running, !top10, !luckydog, !p Johnson,' + 
                ' !p 48, !fastlast, !fastbest, !points';

// Error handling domain for the botd runner
var domain = require('domain');
var botd = domain.create();


// This will be the actual IRC client
// Declared outside the runner for appropriate access throughout...
var bot;

// Start the botd runner
botd.run(function() {
  // require() in our IRC Client library
  var Client = require('irc').Client;
  
  // Require in debug
  var debug = require('debug')('bot');

  // And fire up our IRC bot
  // (note, this is non-blocking, so code will continue on immediately)
  bot = new Client(cfg.server, cfg.nick, cfg.irc);

  // Let's get ready to listen for IRC events
  setupListeners();
});

// Generic error handler for this domain, post on console.
botd.on('error', function(err) {
  // TODO: We can't say in a hardcoded channel, get ye to a config
  // sayAndLog('#bottestlab', "Error: " + err);
  console.log("Error: " + err);
  if(DEBUG == 1) {throw err;}
});

// Function to set up listeners for events we care about
function setupListeners() {

  // When we are connected and registered on the server
  bot.addListener('registered', function(message) {
    console.log('Connected to server');
  });

  // When *any* user joins a channel, including us
  bot.addListener('join', function(channel, nick, message) {
    handleJoin(channel, nick, message);
  });

  // When any channel message or user privmsg comes in
  bot.addListener('message', parseMessage);
}

// Respond to a channel join event (from any user)
function handleJoin(channel, nick, message) {
  console.log('Handling join...');

  // If we are the one that joined, then let's let everyone know we're here
  if (nick === bot.nick) {
    sayAndLog(channel, 'Hello, i am ready. PrivMsg HELP for list of commands.');
  }
}

// Parse an incoming message, following a 'message' event
function parseMessage(from, to, message) {
  console.log(from + ' => ' + to + ':' + message)

  // If the message starts with ! then it may be a command, pay attention
  if (message[0] === '!') {
    // If the 'to' is our nick, then this is a privmsg,
    //   let's make to=from so we can msg back to the user with the same code
    //   that sends messages back to the channel
    if (to === bot.nick) {
      to = from;
    }

    //Now we are ready to parse for a command
    parseCommand(from, to, message);
  }

  // If the message was not a command, let's see if it was private message
  //   and if it was a private message, does it seem like they want help?
  if (to === bot.nick && message.toLowerCase().indexOf('help') !== -1) {
    sayAndLog(from, HELP_TEXT);
  }
}


// Command switcher object
// Each property should be an anonymous fucntion which defines and sends
// our repsonse to the command. Most responses should be cached in the
// responses{} object and updated by the updateResponses method. We don't
// need to calculate this stuff every time.
var commandHandlers = {

  help: function(from, to, message) {
    sayAndLog(from, HELP_TEXT);
  },

  running: function(from, to, message) {
    sayAndLog(to, responses.running);
  },

  leader: function(from, to, message) {
    var index = leaderboard.runOrderIndex[0].index
    var driver = leaderboard.rawData.Passings[index].Driver.DriverName;
    var output = driver + ' is leading the race. ' + leaderboard.lapticker();
    sayAndLog(to, output);
  },

  luckydog: function(from, to, message) {
    var index = leaderboard.luckyDogDriverIndex
    var driver = leaderboard.rawData.Passings[index].Driver.DriverName
    var output = driver + ' is sitting in the lucky dog position. ' +
                 leaderboard.lapticker()
    sayAndLog(to, output)
  },

  points: function(from, to, message) {
    sayAndLog(to, responses.points)
  },

  fastlast: function(from, to, message) {
    sayAndLog(to, responses.fastest_last)
  },

  fastbest: function(from, to, message) {
    sayAndLog(to, responses.fastest_best)
  },

  top10: function(from, to, message) {
    sayAndLog(to, responses.top10);
  },

  topten: function(from, to, message) {
    sayAndLog(to, responses.top10);
  },

  p: function(from, to, message) {
    // Grab the search target from the message
    // We only allow one search term
    var search = message.substring(1, message.length).split(' ')[1];
    
    var driverIndexes = leaderboard.findDriverIndex(search)
    
    for (var index = 0; index < driverIndexes.length; index++) {
      var targetDriver = driverIndexes[index];
      var output = driverStatusString(targetDriver);
      sayAndLog(to, output);
    }
  }

} // End commandHandlers


function parseCommand(from, to, message) {
/*if(!"length" in rawData){ console.log("Die, no leadboard."); return;}
  
  if(rawData.length <= 0) {
    sayAndLog(to, 'No leaderboard data available.');
    return;
  }
    
  if(!"message" in this){ console.log("Die, no message."); return;}
*/

  //Execute appropriate function for command
  try {
    commandHandlers[message.substring(1, message.length).split(' ')[0]](from, to, message);
  } catch (err) {
    console.log('bad command: ' + message);
  }


}


function sayAndLog(to, message) {
  bot.say(to, message);
  console.log(to, message);
}


// object to hold the strings the bot will use to reply to commands
var responses = {}

//This is bot-code, not NASCAR API code, that will update the bot's
//  response strings. (most of our responses can be pre-fabbed)
// this makes responding faster as it's all pre-calculated

function updateResponses() {
  //console.log('reponses updated'); console.log(leaderboard.lapticker());return;
  var order = '',
      sep = '',
      largest = 10;

  // Used to check if leaderbaord.pointsOrderIndex has data, so we know something worked
  //console.dir(leaderboard.pointsOrderIndex);
  // First we will note the running order
  console.log('Passings: ' + leaderboard.runOrderIndex.length);
  for (var i = 0; i < leaderboard.runOrderIndex.length; i++) {
    //console.log('P' + i + ' : ' + rawData.Passings[i].CarNo);
    order = order + sep + leaderboard.rawData.Passings[leaderboard.runOrderIndex[i].index].CarNo;
    sep = ', ';
  }
  responses.running = 'Currently running ' + leaderboard.lapticker() + ': ' + order;

  //Next we will note the top 12 by points
  order = '';
  sep = '';
  largest = 12;
  if (leaderboard.pointsOrderIndex.length < largest) {
    largest = leaderboard.pointsOrderIndex.length;
  }
  for (var i = 0; i < largest; i++) {
    order = order + sep + leaderboard.rawData.Passings[leaderboard.pointsOrderIndex[i].index].LastName;
    if (i == 0) {
      //If this is the first driver, then show their total points
      order = order + ' ' + leaderboard.rawData.Passings[leaderboard.pointsOrderIndex[i].index].Points;
    } else {
      //If this is not the first driver, then show their point delta from leader
      var delta = leaderboard.rawData.Passings[leaderboard.pointsOrderIndex[i].index].DeltaLeader
      if (delta > 0) {
        delta = 0 - delta;
      }
      order = order + ' ' + (delta);
    }
    sep = ', ';
  }
  responses.points = 'Point Standings ' + leaderboard.lapticker() + ': ' + order;


  // Next we will note the 12 fastest cars, based on their most recently completed lap
  order = '';
  sep = '';
  largest = 12;
  if (leaderboard.lastLapSpeedIndex.length < largest) {
    largest = leaderboard.lastLapSpeedIndex.length;
  }
  for (var i = 0; i < largest; i++) {
    order = order + sep + leaderboard.rawData.Passings[leaderboard.lastLapSpeedIndex[i].index].LastName + ' ' + (leaderboard.rawData.Passings[leaderboard.lastLapSpeedIndex[i].index].LastLapSpeed) + 'mph';
    sep = ', ';
  }
  responses.fastest_last = 'Fastest ' + leaderboard.lapticker() + ': ' + order;


  // Next we will note the 12 fastest cars, based on their fastest completed lap
  order = '';
  sep = '';
  largest = 12;
  if (leaderboard.bestLapSpeedIndex.length < largest) {
    largest = leaderboard.bestLapSpeedIndex.length;
  }
  for (var i = 0; i < largest; i++) {
    order = order + sep + leaderboard.rawData.Passings[leaderboard.bestLapSpeedIndex[i].index].LastName + ' ' + (leaderboard.rawData.Passings[leaderboard.bestLapSpeedIndex[i].index].BestSpeed) + 'mph';
    sep = ', ';
  }
  responses.fastest_best = 'Fastest Today ' + leaderboard.lapticker() + ': ' + order;

  // Next we will note the 10 lead cars
  // P2-P10 will show delta behind leader
  order = '';
  sep = '';
  largest = 10;
  if (leaderboard.runOrderIndex.length < largest) {
    largest = leaderboard.runOrderIndex.length;
  }
  for (var i = 0; i < largest; i++) {
    order = order + sep + leaderboard.rawData.Passings[leaderboard.runOrderIndex[i].index].LastName;
    if (i > 0) {
      var delta = leaderboard.rawData.Passings[leaderboard.runOrderIndex[i].index].SFDelta
      if (delta > 0) {
        delta = 0 - delta;
      }
      order = order + ' ' + (delta);
    }
    sep = ', ';
  }
  responses.top10 = 'Top10 ' + leaderboard.lapticker() + ': ' + order;
}


// Format driver's current status response
function driverStatusString(driverId) {
  //Get the driver's delta from the leader
  var leaderDelta = leaderboard.rawData.Passings[driverId].SFDelta;
  
  // Create an appropriate message based on driver's delta
  var deltaMessage = '';  
  if (leaderboard.rawData.Passings[driverId].SFDelta == 0) {
    deltaMessage = 'in the lead';
  } else if (leaderDelta > 0) {
    deltaMessage = leaderDelta + " sec behind leader";
  } else {
    deltaMessage = (0 - leaderDelta) + ' laps down';
  }
  
  // Capture the variables we need to display our output
  // TODO: This should be an API, we shouldn't be accessing rawData
  var driverName = leaderboard.rawData.Passings[driverId].Driver.DriverName;
  var carNo = leaderboard.rawData.Passings[driverId].CarNo;
  var position = leaderboard.rawData.Passings[driverId].RaceRank;
  var lastLapSpeed = leaderboard.rawData.Passings[driverId].LastLapSpeed;
  var lastLapTime = leaderboard.rawData.Passings[driverId].LastLapTime;
  var sponsor = leaderboard.rawData.Passings[driverId].Sponsor;
  
  // Build our output string
  var output = driverName + ' (' + carNo + ') is running p' + position +
              ' at ' + lastLapSpeed + 'mph (' + lastLapTime + 'sec) in the ' +
              sponsor + ' car. Currently ' + deltaMessage + '. ' +
              leaderboard.lapticker();
              
  return output;
}

// TODO: This is a unit test, should be fixed or removed
function test_chat() {
  parseCommand('jufineath', 'jufineath', '!leader')
  parseCommand('jufineath', 'jufineath', '!running')
  parseCommand('jufineath', 'jufineath', '!points');
  parseCommand('jufineath', 'jufineath', '!running')
  parseCommand('jufineath', 'jufineath', '!leader')
}

// require() in filesystem
var fs = require('fs');

// Capture SIGHUP and re-read the config
// Right now this will really only work for URL changes
// and leaderboard changes
process.on('SIGHUP', function sighupHandler() {
  console.log('Got SIGHUP, re-reading config');
  cfg = JSON.parse(fs.readFileSync('./config/config.json'));
  leaderboard.updateInterval(cfg.nascar.query_interval)
});
