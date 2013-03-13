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

var domain, botd, bot, cfg;


// require() in our config the first time, SIGHUP will force re-read also
cfg = require('../config/config');

//Let's get a handle on our NASCAR stats scraper
var LeaderboardClient = require('nascar-stats-scraper').LeaderboardClient;
leaderboard = new LeaderboardClient(cfg.nascar.leaderboard_url, cfg.nascar.query_interval);

leaderboard.addListener('updated_board', update_responses);

  
  
// object to hold the strings the bot will use to reply to commands
var responses = {}

// One global filesystem object to avoid memory leaking of creating this every update
var fs=require('fs');



// Error handling domain for the botd runner
domain = require('domain');
botd = domain.create();

//Our help message
var help_message = 'Looking for help? Try these commands: !leader, !running, !top10, !luckydog, !p Johnson, !fastlast, !fastbest, !points';

// Start the botd runner
botd.run(function(){
  var Client, debug;
  Client = require('irc').Client;
  debug = require('debug')('bot');
  
  

  // And fire up our IRC bot (note, this is non-blocking, so it will continue on
  //   before it is actually connected to servers and joined to channels
  bot = new Client(cfg.server, cfg.nick, cfg.irc);
  
  
  // Let's get ready to listen for IRC events
  setup_listeners();
  
  // Let's starting regularly reading the leaderboard data
  /*setInterval(function() {ns.update_leaderboard();
     
     }, cfg.nascar.query_interval);*/

});

// Generic error handler for this domain, post in channel and console.
botd.on('error', function(err){
  // TODO: We can't say in a hardcoded channel, get ye to a config
  // bot.say('#bottestlab', "Error: " + err);
  console.log("Error: " + err);
  // throw err;
});


// To listen to appropriate events
function setup_listeners() {
 
  // When we are connected and registered on the server
  bot.addListener('registered', function (message) {
    console.log('Connected to server');});
  
  // When *any* user joins a channel, including us
  bot.addListener('join',  function(channel, nick, message) {
    handle_join(channel, nick, message);});

  // When any channel message or user privmsg comes in
  bot.addListener('message', parse_message);
}


// Respond to a channel join event (from any user)
function handle_join(channel, nick, message) {
  console.log('Handling join...');
  
  // If we are the one that joined, then let's let everyone know we're here
  if(nick === bot.nick) {
    bot.say(channel, 'Hello, i am ready. PrivMsg HELP for list of commands.');
  }
}


// Handle any channel or user privmsg
function parse_message(from, to, message) {
  console.log(from + ' => ' + to + ':' + message) 
  
  // If the message starts with ! then it may be a command, pay attention
  if(message[0] === '!') {
    // If the to is our nick, then this is a privmsg,
    //   let's make to=from so we can msg back to the user with the same code
    //   that messages back to the channel
    if(to === bot.nick) {to = from;}
    
    //Now we are ready to parse for a command
    parse_command(from, to, message)
  }

  // If the message was not a command, let's see if it was private message
  //   and if it was a private message, does it seem like they want help?
  // TODO: Make this a more informative help screen
  if(to == bot.nick && message.toLowerCase().indexOf('help') != -1) {
    say_and_log(from, help_message)
  }
}


// Command switcher
var command_handlers = {

  help: function(from,to,message) {
  say_and_log(from, help_message);
  },

  running: function(from,to,message) {
    say_and_log(to,responses.running);
  },

  leader: function(from,to,message) {  
  var driver = leaderboard.rawData.Passings[leaderboard.runOrderIndex[0].index].Driver.DriverName;
    var output = driver + ' is leading the race. ' + leaderboard.lapticker();
    say_and_log(to, output) ;
  },
  
  luckydog: function(from,to,message) {  
  var driver = leaderboard.rawData.Passings[leaderboard.luckyDogDriver].Driver.DriverName
  var output = driver + ' is sitting in the lucky dog position. ' + leaderboard.lapticker()
    say_and_log(to, output)
  },
    
  points: function(from,to,message) {
    say_and_log(to,responses.points)
  },
  
  fastlast: function(from,to,message) {
    say_and_log(to, responses.fastest_last)
  },

  fastbest: function(from,to,message) {
    say_and_log(to, responses.fastest_best)
  },

  top10: function(from,to,message) {
    say_and_log(to, responses.top10);
  },

  topten: function(from,to,message) {
    say_and_log(to, responses.top10);
  },

  p: function(from,to,message) {
    var target = message.substring(1, message.length).split(' ')[1];
    for(var i =0;i<leaderboard.rawData.Passings.length;i++){
    if(leaderboard.rawData.Passings[i].Driver.DriverName.toLowerCase().indexOf(target.toLowerCase()) !== -1) {
    var leader_delta = leaderboard.rawData.Passings[i].SFDelta, delta_message = '';
    if(leaderboard.rawData.Passings[i].SFDelta == 0) {
      delta_message = 'in the lead';
    }
    else if(leader_delta > 0) {
      delta_message = leader_delta + " sec behind leader"
    }
    else {
      delta_message = (0 - leader_delta) + ' laps down'
    }
    var output = leaderboard.rawData.Passings[i].FirstName +
                 ' ' + leaderboard.rawData.Passings[i].LastName +
                 ' (' + leaderboard.rawData.Passings[i].CarNo + ') is running p' +
                 leaderboard.rawData.Passings[i].RaceRank + ' at ' +
                 leaderboard.rawData.Passings[i].LastLapSpeed + 'mph (' +
                 leaderboard.rawData.Passings[i].LastLapTime + 'sec) in the ' +
                 leaderboard.rawData.Passings[i].Sponsor + ' car. Currently ' +
                 delta_message + '. ' + leaderboard.lapticker()
    //var output = ''
      say_and_log(to, output)  
    }
    }
    //say_and_log(to, responses.top10);
  }

} // End command_handlers


function parse_command(from, to, message) {
  /*if(!"length" in rawData){ console.log("Die, no leadboard."); return;}
  
  if(rawData.length <= 0) {
    say_and_log(to, 'No leaderboard data available.');
    return;
  }
    
  if(!"message" in this){ console.log("Die, no message."); return;}
*/
  
  //Execute appropriate function for command
  try {
  command_handlers[message.substring(1, message.length).split(' ')[0]](from,to,message);
  }
  catch (err) {
    console.log('bad command: ' + message);
    throw err;
  }


}


function say_and_log(to, message) {
  bot.say(to, message);
  console.log(to, message);
}


//This is bot-code, not NASCAR API code, that will update the bot's
//  response strings. (most of our responses can be pre-fabbed)
// this makes responding faster as it's all pre-calculated
function update_responses() {
  //console.log('reponses updated'); console.log(leaderboard.lapticker());return;
  var order = '', sep='', largest = 10;

  // Used to check if leaderbaord.pointsOrderIndex has data, so we know something worked
  //console.dir(leaderboard.pointsOrderIndex);

  // First we will note the running order
  console.log('Passings: ' + leaderboard.runOrderIndex.length);
  for(var i = 0;i < leaderboard.runOrderIndex.length;i++) {
    //console.log('P' + i + ' : ' + rawData.Passings[i].CarNo);
    order = order + sep + leaderboard.rawData.Passings[leaderboard.runOrderIndex[i].index].CarNo;
    sep = ', ';
  }
  responses.running = 'Currently running ' + leaderboard.lapticker() + ': ' + order;

  //Next we will note the top 12 by points
  order = ''; sep='';
  largest = 12;
  if(leaderboard.pointsOrderIndex.length < largest) {largest=leaderboard.pointsOrderIndex.length;}
  for(var i = 0;i < largest;i++) {
    order = order + sep + leaderboard.rawData.Passings[leaderboard.pointsOrderIndex[i].index].LastName;
    if(i==0) {
      //If this is the first driver, then show their total points
      order=order + ' ' + leaderboard.rawData.Passings[leaderboard.pointsOrderIndex[i].index].Points;
    }
    else {
      //If this is not the first driver, then show their point delta from leader
      var delta = leaderboard.rawData.Passings[leaderboard.pointsOrderIndex[i].index].DeltaLeader
      if(delta>0) {delta = 0-delta;}
      order=order + ' ' + (delta);
    }
    sep = ', ';
  }
  responses.points = 'Point Standings ' + leaderboard.lapticker() + ': ' + order;
  

  // Next we will note the 12 fastest cars, based on their most recently completed lap
  order = ''; sep='';
  largest = 12;
  if(leaderboard.lastLapSpeedIndex.length < largest) {largest=leaderboard.lastLapSpeedIndex.length;}
  for(var i = 0;i < largest;i++) {
    order = order + sep + leaderboard.rawData.Passings[leaderboard.lastLapSpeedIndex[i].index].LastName +
         ' ' + (leaderboard.rawData.Passings[leaderboard.lastLapSpeedIndex[i].index].LastLapSpeed) + 'mph';
    sep = ', ';
  }
  responses.fastest_last = 'Fastest ' + leaderboard.lapticker() + ': ' + order;


  // Next we will note the 12 fastest cars, based on their fastest completed lap
  order = ''; sep='';
  largest = 12;
  if(leaderboard.bestLapSpeedIndex.length < largest) {largest=leaderboard.bestLapSpeedIndex.length;}
  for(var i = 0;i < largest;i++) {
    order = order + sep + leaderboard.rawData.Passings[leaderboard.bestLapSpeedIndex[i].index].LastName +
          ' ' + (leaderboard.rawData.Passings[leaderboard.bestLapSpeedIndex[i].index].BestSpeed) + 'mph';
    sep = ', ';
  }
  responses.fastest_best = 'Fastest Today ' + leaderboard.lapticker() + ': ' + order;

  // Next we will note the 10 lead cars
  // P2-P10 will show delta behind leader
  order = ''; sep='';
  largest = 10;
  if(leaderboard.runOrderIndex.length < largest) {largest=leaderboard.runOrderIndex.length;}
  for(var i = 0;i < largest;i++) {
    order = order + sep + leaderboard.rawData.Passings[leaderboard.runOrderIndex[i].index].LastName;
    if(i>0) {
      var delta = leaderboard.rawData.Passings[leaderboard.runOrderIndex[i].index].SFDelta
      if(delta>0) {delta = 0-delta;}
      order=order + ' ' + (delta);
    }
    sep = ', ';
  }
  responses.top10 = 'Top10 ' + leaderboard.lapticker() + ': ' + order;
}



// TODO: This is a unit test, should be fixed or removed
function test_chat() {
  parse_command('jufineath', 'jufineath', '!leader')
  parse_command('jufineath', 'jufineath', '!running')
  parse_command('jufineath', 'jufineath', '!points');
  parse_command('jufineath', 'jufineath', '!running')
  parse_command('jufineath', 'jufineath', '!leader')
}




// Capture SIGHUP and re-read the config
// Right now this will really only work for URL changes
process.on('SIGHUP', function () {
  console.log('Got SIGHUP, re-reading config');
  cfg = JSON.parse(fs.readFileSync('../config/config.json'));
});









