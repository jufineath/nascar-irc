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

var domain, botd, bot, cf;

// leaderboard_data holds the parsed JSON from NASCAR's leaderboard
var leaderboard_data=[], leaderboard_running=[], leaderboard_points=[],
    leaderboard_luckydog=[], leaderboard_speed_last=[],leaderboard_speed_best=[];

// object to hold the strings the bot will use to reply to commands
var responses = {}

// One global filesystem object to avoid memory leaking of creating this every update
var fs=require('fs');

// Error handling domain for the botd runner
domain = require('domain');
botd = domain.create();

// Start the botd runner
botd.run(function(){
  var Client, debug;
  Client = require('irc').Client;
  debug = require('debug')('bot');
  
  // require() in our config the first time, SIGHUP will force re-read also
  cfg = require('../config/config');
  

  // And fire up our IRC bot (note, this is non-blocking, so it will continue on
  //   before it is actually connected to servers and joined to channels
  bot = new Client(cfg.server, cfg.nick, cfg.irc);
  
  
  // Let's get ready to listen for IRC events
  setup_listeners();
  
  // Let's starting regularly reading the leaderboard data
  setInterval(function() {update_leaderboard(); update_responses();}, cfg.nascar.query_interval);

  });
// Generic error handler for this domain, post in channel and console.
botd.on('error', function(err){
  bot.say('#bottestlab', "Error: " + err);
  console.log("Error: " + err);
   throw err;
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
    bot.say(channel, 'Hello, i am ready. PrivMsg HELP for list of commands. (not actually implemented yet - LOL'); //TODO: HELP?
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
}


// Command switcher
var command_handlers = {

  running: function(from,to,message) {
    say_and_log(to,responses.running)
  },

  leader: function(from,to,message) {  
	var driver = leaderboard_data.Passings[leaderboard_running[0].index].Driver.DriverName
    var output = driver + ' is leading the race. ' + lapticker()
    say_and_log(to, output) 
  },
  
  luckydog: function(from,to,message) {  
	var driver = leaderboard_data.Passings[leaderboard_luckydog].Driver.DriverName
	var output = driver + ' is sitting in lucky dog position. ' + lapticker()
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
  }

} // End command_handlers


function parse_command(from, to, message) {
  if(!"length" in leaderboard_data){ console.log("Die, no leadboard."); return;}
  
  if(leaderboard_data.length <= 0) {
    bot.say(to, 'No leaderboard data available.');
    console.log(to, 'No leaderboard data available.');
    return;
  }
    
  if(!"message" in this){ console.log("Die, no message."); return;}

  
  //Execute appropriate function for command
  try {
  command_handlers[message.substring(1, message.length).split(' ')[0]](from,to,message);
  }
  catch (err) {
    console.log('bad command: ' + message);
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
  var order = '', sep='', largest = 10;


  // First we will note the running order
  console.log('Passings: ' + leaderboard_running.length);
  for(var i = 0;i < leaderboard_running.length;i++) {
    //console.log('P' + i + ' : ' + leaderboard_data.Passings[i].CarNo);
    order = order + sep + leaderboard_data.Passings[leaderboard_running[i].index].CarNo;
    sep = ', ';
  }
  responses.running = 'Currently running ' + lapticker() + ': ' + order;
  console.log('Currently running ' + lapticker() + ': ' + order);


  //Next we will note the top 12 by points
  order = ''; sep='';
  largest = 12;
  if(leaderboard_points.length < largest) {largest=leaderboard_points.length;}
  for(var i = 0;i < largest;i++) {
    order = order + sep + leaderboard_data.Passings[leaderboard_points[i].index].LastName;
    if(i==0) {
      //If this is the first driver, then show their total points
      order=order + ' ' + leaderboard_data.Passings[leaderboard_points[i].index].Points;
    }
    else {
      //If this is not the first driver, then show their point delta from leader
      var delta = leaderboard_data.Passings[leaderboard_points[i].index].DeltaLeader
      if(delta>0) {delta = 0-delta;}
      order=order + ' ' + (delta);
    }
    sep = ', ';
  }
  responses.points = 'Point Standings ' + lapticker() + ': ' + order;


  // Next we will note the 12 fastest cars, based on their most recently completed lap
  order = ''; sep='';
  largest = 12;
  if(leaderboard_speed_last.length < largest) {largest=leaderboard_speed_last.length;}
  for(var i = 0;i < largest;i++) {
    order = order + sep + leaderboard_data.Passings[leaderboard_speed_last[i].index].LastName +
         ' ' + (leaderboard_data.Passings[leaderboard_speed_last[i].index].LastLapSpeed) + 'mph';
    sep = ', ';
  }
  responses.fastest_last = 'Fastest ' + lapticker() + ': ' + order;


  // Next we will note the 12 fastest cars, based on their fastest completed lap
  order = ''; sep='';
  largest = 12;
  if(leaderboard_speed_best.length < largest) {largest=leaderboard_speed_best.length;}
  for(var i = 0;i < largest;i++) {
    order = order + sep + leaderboard_data.Passings[leaderboard_speed_best[i].index].LastName +
          ' ' + (leaderboard_data.Passings[leaderboard_speed_best[i].index].BestSpeed) + 'mph';
    sep = ', ';
  }
  responses.fastest_best = 'Fastest Today ' + lapticker() + ': ' + order;

  // Next we will note the 10 lead cars
  // P2-P10 will show delta behind leader
  order = ''; sep='';
  largest = 10;
  if(leaderboard_running.length < largest) {largest=leaderboard_running.length;}
  for(var i = 0;i < largest;i++) {
    order = order + sep + leaderboard_data.Passings[leaderboard_running[i].index].LastName;
    if(i>0) {
      var delta = leaderboard_data.Passings[leaderboard_running[i].index].SFDelta
      if(delta>0) {delta = 0-delta;}
      order=order + ' ' + (delta);
    }
    sep = ', ';
  }
  responses.top10 = 'Top10 ' + lapticker() + ': ' + order;
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





// These are comparators for our leaderboard indexes
// They allow us to sort by a numeric property such as Points, RaceRank
function makeNumericCmp(property) {
    return function (a, b) {
        return parseInt(a[property]) - parseInt(b[property]);
    };
}
function makeNumericCmpRev(property) {
    return function (a, b) {
        return parseInt(b[property]) - parseInt(a[property]);
    };
}



// This method parses the leaderboard JSON, and creates some indexes for us
function update_leaderboard() {
  console.log('update_leaderboard begin');
  var data, err;
  
  // We are currently just reading this from a file because races aren't actually life
  //   24/7 and i haven't yet put the files where i can http GET them. 
  fs.readFile(cfg.nascar.leaderboard_url, 'utf8', function (err, data) {
    if (err) {
      console.log('Error: ' + err);
      return;
    }

    // Store the JSON in the leaderboard_data array
    leaderboard_data = JSON.parse(data);
    
    
    if("length" in leaderboard_data) { console.log('update_leaderboard - bailing, no leaderboard'); return;}

    // Re-initialize the leaderboard_points index
    leaderboard_points = []
    // Loop through leaderboard_data.Passings and note the car number, points,
    //   points position and leaderbaord_data.Passings index
    for(var i=0;i<leaderboard_data.Passings.length;i++) {
      leaderboard_points[i] = {'CarNo' : leaderboard_data.Passings[i].CarNo,
                               'Points' : leaderboard_data.Passings[i].Points,
                               'PointsPosition' : leaderboard_data.Passings[i].PointsPosition,
                               'index' : i};
    }
    // Sort the _points array by the PointsPosition property in order of
    //   1, 2, 3, ..., N
    leaderboard_points.sort(makeNumericCmp('PointsPosition'));



    // Re-initialize the leaderboard_running index
    leaderboard_running = []
    // Loop through leaderboard_data.Passings and note the car number, race rank/position,
    //  and leaderbaord_data.Passings index
    for(var i=0;i<leaderboard_data.Passings.length;i++) {
      leaderboard_running[i] = {'CarNo' : leaderboard_data.Passings[i].CarNo,
                                'RaceRank' : leaderboard_data.Passings[i].RaceRank,
                                'index' : i};
    }
    // Sort the _running array by the RaceRank (running order) property in order of
    //   1, 2, 3, ..., N
    leaderboard_running.sort(makeNumericCmp('RaceRank'));
 

    // Loop through the array of cars and note the first one with an SFDelta = -1
    //   this is the first car NOT on the lead lap, and will be the car eligible
    //   for the Lucky Dog Pass
    // TODO: This should leverage the sorted _running array, not just assume that
    //         Passings is in running order  
    for(var i=0;i<leaderboard_running.length;i++) {
      if(leaderboard_data.Passings[i].SFDelta == -1) {
        leaderboard_luckydog = i;
        break;
      }
    }



    // Capturing each car's speed as of their last completed lap
    //   putting it in _speed_last index, ordered by fastest
    leaderboard_speed_last = []
    for(var i=0;i<leaderboard_data.Passings.length;i++) {
      leaderboard_speed_last[i] = {'CarNo' : leaderboard_data.Passings[i].CarNo, 'LastLapSpeed' : leaderboard_data.Passings[i].LastLapSpeed, 'index' : i};
    }
    leaderboard_speed_last.sort(makeNumericCmpRev('LastLapSpeed'));


    // Capturing each car's speed as of their BEST completed lap
    //   putting it in _speed_best index, ordered by fastest
    leaderboard_speed_best = []
    for(var i=0;i<leaderboard_data.Passings.length;i++) {
      leaderboard_speed_best[i] = {'CarNo' : leaderboard_data.Passings[i].CarNo, 'BestSpeed' : leaderboard_data.Passings[i].BestSpeed, 'index' : i};
    }
    leaderboard_speed_best.sort(makeNumericCmpRev('BestSpeed'));
    // Print data for testing by uncommenting below
    // console.dir(data);

    // TODO: When this is extracted to nascar-lib there should be a property
    //  to allow you to define a callback after each leaderboard refresh
    //  or an 'event', as it were
    //callback();
  });

  
 
  // Commenting this out as it is probably not needed
  // Normal GC should wipe this. Will remove this comment and code at later date
  // 
  // TODO: See comment
  // delete fs; delete err; delete data;

  console.log('update_leaderboard end');
}



// Returns a string identifying (currentlap/totallaps)
// Will return (0/0) if there is an error reading leaderboard data
function lapticker() {
  var ticker = '(0/0)';
  
  try {
    ticker = '(' + leaderboard_data.CurrentLapNumber + '/' +
                        leaderboard_data.LapsInRace + ')';
  } catch (err) {}
  
  return ticker;                      
}

