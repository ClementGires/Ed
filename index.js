var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var playerSpeed = 0.06 / 30;


app.use(express.static(__dirname, '/client/www'));
//app.use("/scripts", express.static(__dirname + '/client/www/js'));


app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/www/index.html');
});


// TODO: probably should put this is a new file
var playerTable = new Array();
for (var i = 0; i < 5; i++) {
  playerTable.push({occupied: false});
}
var waitingPlayer = 0; //0 is the empty ID
var waitingLevel;

var roomTable = new Array();
for (var i = 0; i < 10; i++) {
  roomTable.push({ waiting: true, numberOfPlayersToStart: 2, playerTable: new Array()});
}


// returns an object containing table size and a table containing symetry
function findTableSizeInRoom(roomID) {
  var symetryTable = [];
  var maxWidth = 100;
  var maxHeight = 100;
  console.log(roomTable[roomID]);
  for (var i = 0; i < roomTable[roomID].playerTable.length; i++) {
    var player = playerTable[roomTable[roomID].playerTable[i]];
    console.log(player);
    var maxDimension = player.maxTileTableWidth;
    var minDimension = player.maxTileTableHeight;
    if (player.maxTileTableWidth < player.maxTileTableHeight) {
      maxDimension = minDimension;
      minDimension = player.maxTileTableWidth;
      symetryTable.push(1);
    } else { symetryTable.push(0); }
    maxWidth = Math.min(maxWidth,maxDimension);
    maxHeight = Math.min(maxHeight,minDimension);
  }
  return { tileTableWidth: maxWidth, tileTableHeight: maxHeight, symetryTable: symetryTable};
}

function playerReady(socket, data) {
  console.log('readyToPlay: ' + socket.playerID);
  var i = 0;
  //first find the first available room
  while (i < roomTable.length && !roomTable[i].waiting) { i++; }
  if (i === roomTable.length) {
    roomTable.push({ waiting: true, numberOfPlayersToStart: 3, playerTable: new Array()});
  }
  roomTable[i].playerTable.push(socket.playerID); // TODO: check that playerID is not already in a room?
  socket.roomID = i;

  playerTable[socket.playerID].maxTileTableWidth = data.maxTileTableWidth;
  playerTable[socket.playerID].maxTileTableHeight = data.maxTileTableHeight;

  console.log("room for this player: " + i);

  if (roomTable[i].playerTable.length < roomTable[i].numberOfPlayersToStart) {
    console.log('not starting yet');
    //roomTable[i].waitingLevel = data.level; // TODO: every player ready sends a level. Innefficient
  }
  else {
    // last player is ready. We can aks the last player to create the game.
    var dimensions = findTableSizeInRoom(i);
    roomTable[i].symetryTable = dimensions.symetryTable;
    console.log(dimensions);
    io.sockets.in(socket.playerID).emit('createLevel', {dimensions: dimensions});
  }
}

function startAGame(roomID, level) {
  console.log("game is starting in room" + roomID);
  var room = roomTable[roomID];
  room.waiting = false;
  //console.log(room.playerTable);
  for (var i = 0; i < room.playerTable.length; i++) {
    console.log(room.playerTable[i]);
    io.sockets.in(room.playerTable[i]).emit('startGame',{ level: level, playerTable: room.playerTable, yourIndex: i, symetry: room.symetryTable[i] });
  }
  var tempo = setInterval(function(){
    for (i = 0; i < room.playerTable.length; i++) {
      io.sockets.in(room.playerTable[i]).emit('tempo');
    }
  }, 1/playerSpeed);
}


function findFirstAvailableID(table) {
  var l = table.length;
  for (var i = 1; i < l; i++) {
    if (!table[i].occupied) {
      table[i].occupied = true;
      return i;
    }
  }
  //if the table is too small, extend it
  table.push({playerID:l, occupied: false, inGameWith: 0});
  return l;
}


// TODO: add error handler on socket
io.on('connection', function(socket){
  var i = findFirstAvailableID(playerTable);
  console.log("a user just connected. ID: " + i);
  socket.join(i);
  socket.playerID = i;
  io.sockets.in(i).emit('playerID',i);

  socket.on('ping', function(data){
    //console.log('ping');
    if (socket.playerID !== 0 ) { io.sockets.in(socket.playerID).emit('pong');}
  });

  socket.on('disconnect', function(){
    console.log('user disconnecting: ' + socket.playerID);
    console.log("socket room ID: " + socket.roomID);
    if (socket.roomID !== undefined) {
      var playerTableInRoom = roomTable[socket.roomID].playerTable;
      var index = playerTableInRoom.indexOf(socket.playerID);
      console.log("disconnecting index: " + index);
      if (index > -1) {
        playerTableInRoom.splice(index,1);
      }
      //warn the other players
      for (var i = 0; i < playerTable.length; i++) {
        io.sockets.in(playerTableInRoom[i]).emit('playerLeft',{playerID: socket.playerID});
      }
    }
    playerTable[socket.playerID].occupied = false;
  });

  socket.on('readyToPlay', function (data) {
    playerReady(socket,data);
  });

  socket.on('levelCreated', function (data) {
    startAGame(socket.roomID, data.level);
  });

  socket.on('startAJump', function(data){
    var room = roomTable[socket.roomID];
    if (room.waiting) { return; }
    for (var i = 0; i < room.playerTable.length; i++) {
      if (room.playerTable[i] !== socket.playerID) { io.sockets.in(room.playerTable[i]).emit('startAJump', data); }
    }
  });

  socket.on('positionUpdate', function(data){
    //console.log('positionUpdate');
    var room = roomTable[socket.roomID];
    if (room.waiting) { return; }
    for (var i = 0; i < room.playerTable.length; i++) {
      if (room.playerTable[i] !== socket.playerID) { io.sockets.in(room.playerTable[i]).emit('positionUpdate', data); }
    }
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
