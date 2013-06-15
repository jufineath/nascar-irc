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

// require() NASCAR LeaderboardClient
var LeaderboardClient = require('nascar-stats-scraper').LeaderboardClient;

// Let's get our leaderboard handle,
//   and go ahead and start caching data
var leaderboard = new LeaderboardClient(cfg.nascar.leaderboard_url,
                                        cfg.nascar.query_interval);

// Now that our leaderboard is caching data,
//   let's have it let us know, so we can update our responses.
leaderboard.addListener('updated_board', updateResponses);
// Also lets catch any errors
leaderboard.addListener('error', function(message) {
  console.log('leaderboard.error: ' + message);
});
//And in debug let's catch info
if(DEBUG){
  leaderboard.addListener('info', function(message) {
    console.log('leaderboard.info: ' + message);
  });
}

// require() NASCAR LapByLapClient
var LapByLapClient = require('nascar-stats-scraper').LapByLapClient;

// Let's get our LapByLapClient handle,
//   and go ahead and start caching data
var lapByLap = new LapByLapClient(cfg.nascar.lapbylap_url,
                                  cfg.nascar.query_interval,
                                  cfg.nascar.racecachePath);

var ent = require('ent');
// Now that our leaderboard is caching data,
//   let's have it let us know, so we can update our responses.
lapByLap.addListener('lapUpdate',
                     function onLapUpdate(message) {
                       broadcast(ent.decode(message)); } );
// Also lets catch any errors
lapByLap.addListener('error', function(message) {
 console.log('lapByLap.error: '+ message);
});
//And in debug let's catch info
if(DEBUG){
  lapByLap.addListener('info', function(message) {
   console.log('lapByLap.info: ' + message);
  });
}

// require() NASCAR DriverDataClient
var DriverDataClient = require('nascar-stats-scraper').DriverDataClient;

var driverData = new DriverDataClient(cfg.nascar.driverDataURL);
driverData.updateDriverData();
// Also lets catch any errors
driverData.addListener('error', function(message) {
 console.log('driverData.error: '+ message);
});
//And in debug let's catch info
if(DEBUG){
  driverData.addListener('info', function(message) {
   console.log('driverData.info: ' + message);
  });
}

//Our help message
var HELP_TEXT = 'Looking for help? Try these commands:' +
                ' !leader, !running, !top10, !luckydog, !d Johnson,' +
                ' !d 48, !fastlast, !fastbest, !points, !team';

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

  raceinfo: function(from, to, message) {
    sayAndLog(to, responses.raceInfo);
  },

  raceweather: function(from, to, message) {
    sayAndLog(to, responses.raceWeather);
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

  d: function(from, to, message) {
    // Grab the search target from the message
    // We only allow one search term
    var search = message.substring(1, message.length).split(' ')[1];
    
    var driverIndexes = leaderboard.findDriverIndex(search)
    
    for (var index = 0; index < driverIndexes.length; index++) {
      var targetDriver = driverIndexes[index];
      var output = driverStatusString(targetDriver);
      sayAndLog(to, output);
    }
  },

  team: function(from, to, message) {
    // Grab the search target from the message
    // We only allow one search term
    var search = message.substring(1, message.length).split(' ')[1];

    sayAndLog(to, buildTeamStringFromSearch(search));
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

// Says a message to all channels current joined
function broadcast(message) {
  for ( var channame in bot.chans ) {
    bot.say(channame, message);
  }
  console.log('broadcast:' + message);
}
// Says a message to one receipient (either nick or #chan)
function sayAndLog(to, message) {
  bot.say(to, message);
  console.log(to + ' : ' + message);
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

  // Build a response with basic raceinfo
  responses.raceInfo = leaderboard.rawData.RunName + ' at '
                     + leaderboard.rawData.TrackName + ' ('
                     + leaderboard.rawData.TrackLength + 'mi). '
                     + leaderboard.rawData.LapsToGo + ' laps to go of '
                     + leaderboard.rawData.LapsInRace + '. '
  if (leaderboard.rawData.NumberOfCautionSegments > 0) {
    responses.raceInfo += 'There have been ' + leaderboard.rawData.NumberOfCautionSegments
                       + ' caution segments covering '
                       + leaderboard.rawData.NumberOfCautions + ' laps. '
  }
  if (leaderboard.rawData.NumberOfLeadChanges > 1) {
    responses.raceInfo += 'There have been ' + leaderboard.rawData.NumberOfLeadChanges
    + ' lead changes between '
    + leaderboard.rawData.NumberOfLeaders + ' leaders. '
  }

  // Build a response with basic raceinfo
  responses.raceWeather = 'Current weather at '
                     + leaderboard.rawData.TrackName + ': '
                     + leaderboard.rawData.weatherInfo.weather + ' and '
                     + leaderboard.rawData.weatherInfo.temp_f + ' degrees. ('
                     + leaderboard.rawData.weatherInfo.ob_url + ').'
}


// Format driver's current status response
function driverStatusString(driverId) {

  
  // Capture the variables we need to display our output
  // TODO: This should be an API, we shouldn't be accessing rawData
  var driverName = leaderboard.rawData.Passings[driverId].Driver.DriverName;
  var driverHistID = leaderboard.rawData.Passings[driverId].Driver.HistoricalDriverID;
  var carNo = leaderboard.rawData.Passings[driverId].CarNo;
  var position = leaderboard.rawData.Passings[driverId].RaceRank;
  var lastLapSpeed = leaderboard.rawData.Passings[driverId].LastLapSpeed;
  var lastLapTime = leaderboard.rawData.Passings[driverId].LastLapTime;
  var sponsor = leaderboard.rawData.Passings[driverId].Sponsor;
  var isOnTrack = leaderboard.rawData.Passings[driverId].is_on_track;
  var leaderDelta = leaderboard.rawData.Passings[driverId].SFDelta;
  var carMake = leaderboard.rawData.Passings[driverId].CarMake;
  var team = driverData.rawData.info[driverHistID].team;
  
  // Determine the long value of the car make, to show in post
  var carMakeLong = carMake;
  for (var key in cfg.nascar.carMakeMap){
    if (cfg.nascar.carMakeMap.hasOwnProperty(key)){
        if (key == carMake)
          carMakeLong = cfg.nascar.carMakeMap[key];
      }
  }
  var currentLap = leaderboard.rawData.CurrentLapNumber;

  // Create an appropriate message based on driver's delta
  var deltaMessage = '';
  if (leaderDelta == 0) {
  // If leaderDelta shows 0, they're in the lead or waiting.
    if (position == 1) {
      deltaMessage = 'in the lead';    
    }
    else if(currentLap == 0) {
      deltaMessage = 'waiting for the race to start';
    }
    else {
      deltaMessage = 'i don\'t know';
    }
  } else if (leaderDelta > 0) {
    // If leaderDelta shows >0, show seconds back.
    deltaMessage = '-' + leaderDelta + ' sec from leader';
  } else {
    // If leaderDelta <0, we're laps back.
    deltaMessage = (0 - leaderDelta) + ' laps down';
  }
  if(isOnTrack == false){
    deltaMessage += ' (not on track)'
  }
  
  var teamString = '';
  if(team) {
    teamString = team + ' ';
  }
  
  // Build our output string
  var output = driverName + ' (' + teamString + '#' + carNo + ') ' + 
              'is running p' + position +
              ' at ' + lastLapSpeed + 'mph (' + lastLapTime + 'sec) in the ' +
              sponsor + ' ' + carMakeLong + '. Currently ' + 
              deltaMessage + '. ' + leaderboard.lapticker();
              
  return output;
}

function buildTeamStringFromSearch(search) {

  var teams = [];
  teams = driverData.findTeams(search);

  for (var tIndex = 0; tIndex < teams.length; tIndex++) {
    var team = teams[tIndex];
    
    var drivers = [];
    for (var dIndex = 0; dIndex < driverData.teamDrivers[team].length; dIndex++){
      var driverID =  driverData.teamDrivers[team][dIndex].DriverID;
      var driverIndex = leaderboard.findDriverIndexByID(driverID);
      if(!(typeof driverIndex === 'undefined')) { drivers.push(driverIndex); }
    }
    if(drivers.length > 0) {
      var teamString = buildTeamString(team, drivers)
      return teamString;
    }
  }
}

function buildTeamString(team, drivers) {
  
  var output = team + ' ' + leaderboard.lapticker() + ': ';
  var sep =''
  
  for (i=0; i < drivers.length; i++) {
    var driverId = drivers[i];

    // Capture the variables we need to display our output
    // TODO: This should be an API, we shouldn't be accessing rawData
    var driverName = leaderboard.rawData.Passings[driverId].Driver.DriverName;
    var carNo = leaderboard.rawData.Passings[driverId].CarNo;
    var position = leaderboard.rawData.Passings[driverId].RaceRank;

    // Append driver to our output string
    output = output + sep + driverName + ' (#' + carNo + ') ' + 
    ' p' + position;
    
    sep = ", "
  }
  
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
