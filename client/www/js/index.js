var renderer = new Renderer();

var currentKyu = 25;

var readyToPlay = false;
var inAGame = false;

if (localStorage.getItem('EdKyu')) {
	currentKyu = JSON.parse(localStorage.getItem('EdKyu'));
	currentKyu = 20;
}
else {
	localStorage.setItem( 'EdKyu', JSON.stringify(25)); // By default starts at 25 kyu
}

var socket = io('10.0.0.2:3000');
var thePlayerID = 0;
var pingPong = 0;
var lastPingSent = Date.now();
var isMaster = false;

function pinging () {
	lastPingSent = Date.now();
	socket.emit('ping');
}

var pingIntervalID = setInterval(pinging, 1000);

socket.on('pong', function(msg){
	pingPong = Date.now() - lastPingSent;
	if (thePlayerID !== 0 && !readyToPlay) {
		var levelCreated = new Level({tileTableWidth: renderer.tileTableWidth, tileTableHeight: renderer.tileTableHeight});
		levelCreated.createNewLevel();
		readyToPlay = true;
		socket.emit('readyToPlay',{level: levelCreated.serialize() });
	}
});

socket.on('playerID', function(msg){
	thePlayerID = msg;
});

socket.on('startAJum', function(msg){
	console.log('startingAJump');
	var delay = (msg.pingPong + pingPong) / 2;
	pause();
	level.update(- delay);
	level.playerTable[1].startAJump();
	level.update(delay);
	start();
});

socket.on('endGame', function(msg){
	//need to interrupt the game here
});


var level = new Level();
level.on('positions.updated', function () { renderer.drawNewFrame(level); });
level.on('background.updated', function () { renderer.newBackground(); });
level.on('startAJump', function () {
	socket.emit('startAJump', {pingPong: pingPong});
});



socket.on('startGame', function(msg){
	level.deserialize(msg.level);
	player = level.addANewPlayer();
	opponent = level.addANewPlayer();
	inAGame = true;
	isMaster = msg.isMaster;
	setTimeout(start, 1000 - pingPong);
});


function sendPositionUpdate () {
	socket.emit('positionUpdate', {masterPlayer: level.playerTable[0].miniSerialize(), otherPlayer: level.playerTable[1].miniSerialize(), ping: pingPong/2});
}


// TODO: we use the controlPoint array from the slave to update slave position, but it might be wrong.
// solution: during pings, record ennemy ping, master sends the future position of slave.
socket.on('positionUpdate', function(msg){
	if (!isMaster) {
		level.playerTable[0].miniDeserialize(msg.otherPlayer);
		level.playerTable[1].miniDeserialize(msg.masterPlayer);
		level.update(msg.ping + pingPong / 2);
	}
});

//level.addANewPlayer();
//var theAI = new AI(level,level.playerTable[1]);



// Should this next line be in the AI constructor?
//level.playerTable[1].on('justPassedIntersection', function () { theAI.makeDecisionOnNextJump(); });



var startTouch = function(e) {
  // If F5 or i is pressed, trigger default action (reload page or launch dev tools)
  if (e.keyCode && (e.keyCode === 116 || e.keyCode === 73)) { return; }

  // Start/pause
  if (e.keyCode === 27) {
    if (intervalId !== undefined) { pause(); } else { start(); }
    return;
  }

	// Go back in time
	if (e.keyCode === 13) {
		timeDirection *= -1;
		return;
	}

	// Increase/decrease speed
	if (e.keyCode === 38) {
		speedBoost *= 1.1;
		return;
	}
	if (e.keyCode === 40) {
		speedBoost /= 1.1;
		return;
	}

	//if (e.keyCode !== 32) { return }   // Uncomment to avoid noise during debugging
	e.preventDefault(); // preventing the touch from sliding the screen on mobile.
	level.startTouch();

	return;
}


var endTouch = function(e) {
	e.preventDefault();
	level.endTouch();
}


document.onkeydown = startTouch;
document.onkeyup = endTouch;

document.onmousedown = startTouch;
document.onmouseup = endTouch;

document.ontouchstart = startTouch;
document.ontouchend = endTouch;



/**
 * Main loop
 */
var lastTime
  , intervalId = undefined
  , timeDirection = 1
  , speedBoost = 1
  ;

function main () {
  var newTime = Date.now();
  var timeGap = (newTime - lastTime);
  lastTime = newTime;
	level.update(speedBoost * timeDirection * timeGap);
}

function start () {
	playing = true;
  lastTime = Date.now();
	level.update(0);
	if (isMaster) {
		positionUpdateIntervalId = setInterval(sendPositionUpdate, 500);
	}
  intervalId = setInterval(main, 20);
}

function pause () {
	playing = false;
  clearInterval(intervalId);
  intervalId = undefined;
}
