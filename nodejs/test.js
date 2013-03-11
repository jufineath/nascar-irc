
var domain, botd, bot, cfg, leaderboard_data=[];
var leaderboard_running=[], leaderboard_points=[], leaderboard_luckydog=[],
    leaderboard_speed_last=[],leaderboard_speed_best=[];
var fs=require('fs');

domain = require('domain');
botd = domain.create();

process.on('SIGHUP', function () {
  console.log('Got SIGHUP, re-reading config');
  cfg = JSON.parse(fs.readFileSync('./config.json'));
});


botd.run(function(){
  var Client, debug;
  Client = require('irc').Client;
  debug = require('debug')('bot');
  cfg = require('./config');
  bot = new Client(cfg.server, cfg.nick, cfg.irc);
  // setTimeout((function() {bot.say('#bottestlab', "your mom"); }), 30000);
  setInterval(update_leaderboard, cfg.nascar.query_interval);
  //setTimeout(test_chat, cfg.nascar.query_interval+3000);
  // setTimeout(setup_listeners, 30000); 
  setup_listeners();
  // botd.addListener('message#bottestlab', parse_message);
  });
botd.on('error', function(err){
  bot.say('#bottestlab', "Error: " + err);
});


function setup_listeners() {
 
  bot.addListener('registered', function (message) {
    console.log('Connected to server');});
  
  bot.addListener('join',  function(channel, nick, message) {
    handle_join(channel, nick, message);});

  bot.addListener('message', parse_message);
}

function handle_join(channel, nick, message) {
  console.log('Handling join...');
  
  if(nick === bot.nick) {
    bot.say(channel, 'Hello, i am ready. PrivMsg HELP for list of commands.');
  }
}

function parse_message(from, to, message) {
  console.log(from + ' => ' + to + ':' + message) 
  
  if(message[0] === '!') {
    if(to === bot.nick) {to = from;}
    parse_command(from, to, message)
  }
}

function parse_command(from, to, message) {
  if(leaderboard_data.length <= 0) {
    bot.say(to, 'No leaderboard data available.');
    console.log(to, 'No leaderboard data available.');
    return;
  }
    

  var lapticker = '(' + leaderboard_data.CurrentLapNumber + '/' +
                        leaderboard_data.LapsInRace + ')';

  if(message.substring(1,7) == 'topten' || message.substring(1,6) == 'top10') {
    var order = '', sep='';
 
    //bot.say(to, leaderboard_data.Passings[leaderboard_running[0].index].Driver.DriverName + ' is leading the race.');
    //console.log(to, leaderboard_data.Passings[leaderboard_running[0].index].Driver.DriverName + ' is leading the race.');
    
    var largest = 10;
    if(leaderboard_running.length < 10) {largest=leaderboard_running.length;}
    for(var i = 0;i < largest;i++) {
      //console.log('P' + i + ' : ' + leaderboard_data.Passings[i].CarNo);
      order = order + sep + leaderboard_data.Passings[leaderboard_running[i].index].LastName;
      if(i>0) {
        var delta = leaderboard_data.Passings[leaderboard_running[i].index].SFDelta
        if(delta>0) {delta = 0-delta;}
        order=order + ' ' + (delta);
      }
      sep = ', ';
    }
    bot.say(to, 'Top10 ' + lapticker + ': ' + order);
    console.log(to, 'Top10 ' + lapticker + ': ' + order);
  }
  
  else if(message.substring(1,7) == 'leader') {  
    bot.say(to, leaderboard_data.Passings[leaderboard_running[0].index].Driver.DriverName + ' is leading the race. ' + lapticker + '')
    console.log(to, leaderboard_data.Passings[leaderboard_running[0].index].Driver.DriverName + ' is leading the race. ' + lapticker + '')
  }
  
  else if(message.substring(1,9) == 'luckydog') {  
    bot.say(to, leaderboard_data.Passings[leaderboard_luckydog].Driver.DriverName + ' is sitting in lucky dog position. ' + lapticker + '')
    console.log(to, leaderboard_data.Passings[leaderboard_luckydog].Driver.DriverName + ' is sitting in lucky dog position. ' + lapticker + '')
  }
  
  
  
  else if(message.substring(1,8) == 'running') {
    var order = '', sep='';
    console.log('Passings: ' + leaderboard_running.length);
    for(var i = 0;i < leaderboard_running.length;i++) {
      //console.log('P' + i + ' : ' + leaderboard_data.Passings[i].CarNo);
      order = order + sep + leaderboard_data.Passings[leaderboard_running[i].index].CarNo;
      sep = ', ';
    }
    bot.say(to, 'Currently running ' + lapticker + ': ' + order);
    console.log(to, 'Currently running ' + lapticker + ': ' + order);
  }
  
  
  
  else if(message.substring(1,7) === 'points') {
    var order = '', sep='';
 
    //bot.say(to, leaderboard_data.Passings[leaderboard_points[0].index].Driver.DriverName + ' is overall points leader');
    //console.log(to, leaderboard_data.Passings[leaderboard_points[0].index].Driver.DriverName + ' is overall points leader');
    
    var largest = 12;
    if(leaderboard_points.length < 12) {largest=leaderboard_points.length;}
    for(var i = 0;i < largest;i++) {
      //console.log('P' + i + ' : ' + leaderboard_data.Passings[i].CarNo);
      order = order + sep + leaderboard_data.Passings[leaderboard_points[i].index].LastName;
      if(i>0) {
        var delta = leaderboard_data.Passings[leaderboard_points[i].index].DeltaLeader
        if(delta>0) {delta = 0-delta;}
        order=order + ' ' + (delta);
      } //+
          //          ' :' + (leaderboard_data.Passings[leaderboard_points[i].index].DeltaLeader);
      sep = ', ';
    }
    bot.say(to, 'Point Standings ' + lapticker + ': ' + order);
    console.log(to, 'Point Standings ' + lapticker + ': ' + order);
  }
  
  else if(message.substring(1,9) === 'fastlast') {
    var order = '', sep='';
 
    //bot.say(to, leaderboard_data.Passings[leaderboard_points[0].index].Driver.DriverName + ' is overall points leader');
    //console.log(to, leaderboard_data.Passings[leaderboard_points[0].index].Driver.DriverName + ' is overall points leader');
    
    var largest = 12;
    if(leaderboard_speed_last.length < 12) {largest=leaderboard_speed_last.length;}
    for(var i = 0;i < largest;i++) {
      //console.log('P' + i + ' : ' + leaderboard_data.Passings[i].CarNo);
      order = order + sep + leaderboard_data.Passings[leaderboard_speed_last[i].index].LastName +
           ' ' + (leaderboard_data.Passings[leaderboard_speed_last[i].index].LastLapSpeed) + 'mph';
      sep = ', ';
    }
    bot.say(to, 'Fastest ' + lapticker + ': ' + order);
    console.log(to, 'Fastest' + lapticker + ': ' + order);
  }



  else if(message.substring(1,9) === 'fastbest') {
    var order = '', sep='';
 
    //bot.say(to, leaderboard_data.Passings[leaderboard_points[0].index].Driver.DriverName + ' is overall points leader');
    //console.log(to, leaderboard_data.Passings[leaderboard_points[0].index].Driver.DriverName + ' is overall points leader');
    
    var largest = 12;
    if(leaderboard_speed_best.length < 12) {largest=leaderboard_speed_best.length;}
    for(var i = 0;i < largest;i++) {
      //console.log('P' + i + ' : ' + leaderboard_data.Passings[i].CarNo);
      order = order + sep + leaderboard_data.Passings[leaderboard_speed_best[i].index].LastName +
           ' ' + (leaderboard_data.Passings[leaderboard_speed_best[i].index].BestSpeed) + 'mph';
      sep = ', ';
    }
    bot.say(to, 'Fastest Today ' + lapticker + ': ' + order);
    console.log(to, 'Fastest Today' + lapticker + ': ' + order);
  }



}
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
// homes.Listings.sort(makeNumericCmp('price'));

function test_chat() {
  parse_command('jufineath', 'jufineath', '!leader')
  parse_command('jufineath', 'jufineath', '!running')
  parse_command('jufineath', 'jufineath', '!points');
  parse_command('jufineath', 'jufineath', '!running')
  parse_command('jufineath', 'jufineath', '!leader')
}

function update_leaderboard() {
  console.log('update_leaderboard begin');
  var data, err;
  fs.readFile(cfg.nascar.leaderboard_url, 'utf8', function (err, data) {
    if (err) {
      console.log('Error: ' + err);
      return;
    }

    leaderboard_data = JSON.parse(data);
    // console.dir(data);
  });

  leaderboard_points = []
  for(var i=0;i<leaderboard_data.Passings.length;i++) {
    //console.log('adding ' + leaderboard_data.Passings[i].CarNo + ' : ' + leaderboard_data.Passings[i].Points);
    leaderboard_points[i] = {'CarNo' : leaderboard_data.Passings[i].CarNo,
                             'Points' : leaderboard_data.Passings[i].Points,
                             'PointsPosition' : leaderboard_data.Passings[i].PointsPosition,
                             'index' : i};
  }
  leaderboard_points.sort(makeNumericCmp('PointsPosition'));
  
  

  leaderboard_running = []
  for(var i=0;i<leaderboard_data.Passings.length;i++) {
    //console.log('adding ' + leaderboard_data.Passings[i].CarNo + ' : ' + leaderboard_data.Passings[i].Points);
    leaderboard_running[i] = {'CarNo' : leaderboard_data.Passings[i].CarNo, 'RaceRank' : leaderboard_data.Passings[i].RaceRank, 'index' : i};
  }
  leaderboard_running.sort(makeNumericCmp('RaceRank'));
   //console.dir(leaderboard_points);

  for(var i=0;i<leaderboard_running.length;i++) {
    if(leaderboard_data.Passings[i].SFDelta == -1) {
      leaderboard_luckydog = i;
      break;
    }
  }
  
  
  

  leaderboard_speed_last = []
  for(var i=0;i<leaderboard_data.Passings.length;i++) {
    //console.log('adding ' + leaderboard_data.Passings[i].CarNo + ' : ' + leaderboard_data.Passings[i].Points);
    leaderboard_speed_last[i] = {'CarNo' : leaderboard_data.Passings[i].CarNo, 'LastLapSpeed' : leaderboard_data.Passings[i].LastLapSpeed, 'index' : i};
  }
  leaderboard_speed_last.sort(makeNumericCmpRev('LastLapSpeed'));
  
  leaderboard_speed_best = []
  for(var i=0;i<leaderboard_data.Passings.length;i++) {
    //console.log('adding ' + leaderboard_data.Passings[i].CarNo + ' : ' + leaderboard_data.Passings[i].Points);
    leaderboard_speed_best[i] = {'CarNo' : leaderboard_data.Passings[i].CarNo, 'BestSpeed' : leaderboard_data.Passings[i].BestSpeed, 'index' : i};
  }
  leaderboard_speed_best.sort(makeNumericCmpRev('BestSpeed'));
   //console.dir(leaderboard_points);


  delete fs; delete err; delete data;

  // setTimeout(this.update_leaderboard, 5000);
  console.log('update_leaderboard end');
}

