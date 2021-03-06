var readyToJump = true;
var renderer = new Renderer();

var level = new Level({tileTableWidth: 30, tileTableHeight: 20});
level.createNewLevel();
var p = level.addNewPlayer();


// Remains to be seen: should we render a new frame every time the physics engine is updated?
level.on('positions.updated', function () { renderer.drawNewFrame(level); });
level.on('background.updated', function () { renderer.newBackground(); });


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

  if (e.keyCode !== 32) { return }   // Uncomment to avoid noise during debugging
	e.preventDefault(); // preventing the touch from sliding the screen on mobile.
  if (readyToJump) {
	  p.startJump();
    readyToJump = false;
  }
}


var endTouch = function(e) {
	e.preventDefault();
	readyToJump = true;
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
  lastTime = Date.now();
  intervalId = setInterval(main, 20);
}

function pause () {
  clearInterval(intervalId);
  intervalId = undefined;
}



level.update(0);
pause();
