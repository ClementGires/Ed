if (typeof require !== 'undefined') {
  var Tile = require('./tile');
  var Robot = require('./robot');
}

function Level(_opts) {
  this.tileTableHeight = 0;
  this.tileTableWidth = 0;
  this.tileTable = [];
  this.playerTable = [];
  this.ennemyTable = [];
  this.ennemySpeed = 0.02 / 30;
  this.playerSpeed = 0.06 / 30;
  this.currentTime = 0;

  this.ennemyDifficulty = 0;   // Higher means more ennemies will appear. Harder. Standard=0.1
  this.maxEnnemyPerRow = 4;   // Number of ennemies per corridors. Higher is harder. standard=2
  this.lengthDifficulty = 0.05;   // Higher means shorter corridors. Harder. standard= 0.05
  this.switchDifficulty = 0.4;   // Higher means more tortuous corridors. Easier. standard=0.4

  this.blockOffSingleTiles = true; // There are two ways of dealing with single tile. The alternative is to open them

  this.startingTile;

  this.listeners = {};

  var opts = _opts || {};

  if (opts.tileTableWidth) { this.tileTableWidth = opts.tileTableWidth; }
  if (opts.tileTableHeight) { this.tileTableHeight = opts.tileTableHeight; }
}


Level.deserialize = function(string) {
  var levelData = JSON.parse(string)
    , level = new Level({ tileTableWidth: levelData.tileTableWidth, tileTableHeight: levelData.tileTableHeight });

  level.tileTable = [];
	for (var i = 0; i < level.tileTableWidth; i++) {
		level.tileTable[i] = [];
		for (var j = 0; j < level.tileTableHeight; j++) {
			level.tileTable[i][j] = Tile.deserialize(levelData.tileTable[i][j].serializedTile);
      if (levelData.tileTable[i][j].ennemy) {
        var ennemy = new Robot(level.tileTable[i][j], level, level.ennemySpeed, true);
        level.ennemyTable.push(ennemy);
        level.tileTable[i][j].nearbyEnnemies.push(ennemy);
      }
		}
	}

  level.updateStartingTile();
  level.updateObjectiveTile();

  return level;
}


Level.prototype.serialize = function() {
	var serialTileTable = [];
	for (var i = 0; i < this.tileTableWidth; i++) {
    serialTileTable[i] = [];
		for (var j = 0; j < this.tileTableHeight; j++) {
      serialTileTable[i][j] = { serializedTile: this.tileTable[i][j].serialize(), ennemy: this.tileHasEnnemy(this.tileTable[i][j]) };
		}
	}

	return JSON.stringify({ tileTableHeight: this.tileTableHeight, tileTableWidth: this.tileTableWidth, tileTable: serialTileTable });
}


Level.prototype.tileHasEnnemy = function(tile) {
	for (var n = 0; n < this.ennemyTable.length; n++) {
		if (Math.floor(this.ennemyTable[n].x) === tile.i && Math.floor(this.ennemyTable[n].y) === tile.j) {
			return true;
		}
	}
	return false;
}


// TODO: externalize in a config object
Level.maxTimeGapStep = 20;   // In ms, the maximum time gap with which level.update can ba called.
                             // If higher, the gap is broken down in smaller steps to avoid bad robot positioning
                             // A continuous approach would be better but much harder to implement IMO


Level.prototype.on = function(evt, listener) {
  if (!this.listeners[evt]) { this.listeners[evt] = []; }
  this.listeners[evt].push(listener);
};


// Sometimes levels cannot be finished because there are too many ennemies in the ending corner.
Level.prototype.removeEnnemiesFromTheEnd = function() {
  //maybe this should go inside the code that creates the end.
}



Level.prototype.emit = function (evt, message) {
  if (this.listeners[evt]) {
    this.listeners[evt].forEach(function (fn) { fn(message); });
  }
};


Level.prototype.nextDifficulty = function() {
  this.createNewLevel();
}


Level.prototype.addNewPlayer = function(_id) {
  var newPlayer = new Robot(this.startingTile,this,this.playerSpeed,false); // creates a new player on the origin tile
  newPlayer.id = _id || Math.random().toString();
  newPlayer.reposition(this.startingTile);
  this.playerTable.push(newPlayer);
  newPlayer.on('win', function () { this.nextDifficulty(); });

  return newPlayer;
}


Level.prototype.getPlayerById = function (id) {
  for (var i = 0; i < this.playerTable.length; i += 1) {
    if (this.playerTable[i].id === id) { return this.playerTable[i]; }
  }

  return null;
};


Level.prototype.resetPlayers = function() {
  for (var i = 0; i < this.playerTable.length; i++) {
    this.playerTable[i].reposition(this.startingTile);
  }
}


Level.prototype.reset = function() {
  this.tileTable = new Array();
	for (var i = 0; i < this.tileTableWidth; i++) {
		this.tileTable[i] = new Array();
		for (var j = 0; j < this.tileTableHeight; j++) {
			this.tileTable[i][j] = new Tile(i, j, 0);
			if (i === 0) { this.tileTable[i][j].leftWall = Tile.wallType.HARD; }
			if (i === this.tileTableWidth - 1) { this.tileTable[i][j].rightWall = Tile.wallType.HARD; }
			if (j === 0) { this.tileTable[i][j].upWall = Tile.wallType.HARD; }
			if (j === this.tileTableHeight - 1) { this.tileTable[i][j].downWall = Tile.wallType.HARD; }
		}
	}
	ennemyTable = new Array();
}


Level.prototype.removeSquareFromTileTable = function(mini, maxi, minj, maxj) {
  if (mini >= maxi || minj >= maxj) { return; }
  for (var i = mini; i <= maxi; i++) {
    for (var j = minj; j <= maxj; j++) {
      this.tileTable[i][j].makeInnaccessible(this);
    }
  }
}


Level.prototype.removeEverythingButSquareFromTileTable = function(mini, maxi, minj, maxj) {
  if (mini > maxi || minj > maxj) { return; }
  for (var i = 0; i < this.tileTableWidth; i++) {
    for (var j = 0; j < this.tileTableHeight; j++) {
      if (i < mini || i > maxi || j < minj || j > maxj) {
        this.tileTable[i][j].makeInnaccessible(this);
      }
    }
  }
}


Level.prototype.createNewLevel = function() {
  this.reset();

  //the following line makes a single line in the middle of the screen. Could be useful for tutorial
  //this.removeEverythingButSquareFromTileTable(Math.floor(this.tileTableWidth / 6), this.tileTableWidth - Math.floor(this.tileTableWidth / 6), Math.floor(this.tileTableHeight / 2), Math.floor(this.tileTableHeight / 2));

  for (var i = 0; i < this.tileTableWidth; i++) {
		for (var j = 0; j < this.tileTableHeight; j++) {
			var XX=0;
			var YY=0;
      // first need to decide the direction in which this corridor will start, then we create a new corridor.
			var rand=Math.random();
			if (rand<0.25) { XX = 1; }
			else if (rand<0.5) { XX = -1; }
			else if (rand<0.75) { YY = 1; }
			else YY = -1;
			var ennemyLeft = this.maxEnnemyPerRow;
			if (i === 0 && j === 0) ennemyLeft=0; // Makes sure you don't meet an ennemy in the very first path
			this.createPath(this.tileTable[i][j], this.lengthDifficulty, this.switchDifficulty, this.ennemyDifficulty, 1, 0, Math.floor(Math.random()*4)+2, 0, ennemyLeft);
		}
	}
  if (this.blockOffSingleTiles) { this.makeSingleTilesInaccessible(); }
  else {this.makeSingleTilesOpen(); }

  this.updateStartingTile();
  this.updateObjectiveTile();
  this.resetPlayers();
  this.emit('background.updated');
}


// selects the first tile (alphabetically) that has an open wall as the starting point for robots. Also removes all the ennemies from the corresponding corridor
Level.prototype.updateStartingTile = function() {
  for (var i = 0; i < this.tileTableWidth; i++) {
    for (var j = 0; j < this.tileTableHeight; j++) {
      var t = this.tileTable[i][j];
      if (t.upWall === Tile.wallType.NOWALL || t.rightWall === Tile.wallType.NOWALL || t.downWall === Tile.wallType.NOWALL || t.leftWall === Tile.wallType.NOWALL) {
        this.startingTile = t;
        t.removeEnnemiesFromCorridor(this);
        return;
      }
    }
  }
}


Level.prototype.updateObjectiveTile = function() {
  //this.tileTable[3][0].isObjective = true;
  //return;
  var counter = 0;
  var maxCounter = 1;
  for (var i = this.tileTableWidth - 1; i >= 0; i--) {
    for (var j = this.tileTableHeight - 1; j >= 0; j--) {
      var t = this.tileTable[i][j];
      if (t.upWall === Tile.wallType.NOWALL || t.rightWall === Tile.wallType.NOWALL || t.downWall === Tile.wallType.NOWALL || t.leftWall === Tile.wallType.NOWALL) {
        if (counter === maxCounter) {
          t.isObjective = true;
          t.removeEnnemiesFromCorridor(this);
          return;
        }
        counter++;
      }
    }
  }
}


// This solve the issue of tiles that find themselves alone in the corridor after the maze creation
Level.prototype.makeSingleTilesInaccessible = function() {
  for (var i = 0; i < this.tileTableWidth; i++) {
    for (var j = 0; j < this.tileTableHeight; j++) {
      var t = this.tileTable[i][j];
      if (t.upWall !== Tile.wallType.NOWALL && t.rightWall !== Tile.wallType.NOWALL && t.downWall !== Tile.wallType.NOWALL && t.leftWall !== Tile.wallType.NOWALL) {
        //It is a corridor made of a single tile
        this.tileTable[i][j].makeInnaccessible(this);
      }
    }
  }
}


// A second solution for the lonely tile problem. This time we make them open. This may require that the player always turn right when possible
Level.prototype.makeSingleTilesOpen = function() {
  for (var i = 0; i < this.tileTableWidth; i++) {
    for (var j = 0; j < this.tileTableHeight; j++) {
      var t = this.tileTable[i][j];

      if (t.upWall !== Tile.wallType.NOWALL && t.rightWall !== Tile.wallType.NOWALL && t.downWall !== Tile.wallType.NOWALL && t.leftWall !== Tile.wallType.NOWALL) {
        if (t.upWall != Tile.wallType.HARD) {
          t.upWall = Tile.wallType.NOWALL;
          this.tileTable[i][j - 1].downWall = Tile.wallType.NOWALL;
          t.newType(this.tileTable[i][j - 1].type);
        }
        else if (t.downWall != Tile.wallType.HARD) {
          t.downWall = Tile.wallType.NOWALL;
          this.tileTable[i][j + 1].upWall = Tile.wallType.NOWALL;
          t.newType(this.tileTable[i][j + 1].type);
        }
        else if (t.rightWall != Tile.wallType.HARD) {
          t.rightWall = Tile.wallType.NOWALL;
          this.tileTable[i + 1][j].leftWall = Tile.wallType.NOWALL;
          t.newType(this.tileTable[i + 1][j].type);
        }
        else if (t.leftWall != Tile.wallType.HARD) {
          t.leftWall = Tile.wallType.NOWALL;
          this.tileTable[i - 1][j].rightWall = Tile.wallType.NOWALL;
          t.newType(this.tileTable[i - 1][j].type);
        }
      }
    }
  }
}


/**
 * Recursive function used to create all the corridors in a new level
 * The code could probably be made shorter, but this works
 */
Level.prototype.createPath = function(startTile,lengthProba,switchbacksProba,ennemyProba,currentX,currentY,currentType,currentLength,maxNumberEnnemy) {
	if ( startTile.type !== 0) return; // Means you've ended on a tile that has already been filed up
	startTile.newType(currentType);
	var ennemyLeft = maxNumberEnnemy;

	if (Math.random() < ennemyProba && ennemyLeft > 0 && currentLength > 2) {
    //add an ennemy on this tile
		var ennemy = new Robot(startTile, this, this.ennemySpeed, true);
    this.ennemyTable.push(ennemy);
    startTile.nearbyEnnemies.push(ennemy);
		ennemyLeft--;
	}

	var X = currentX; //current direction of the corridor being built
	var Y = currentY;
	var i = startTile.i;
	var j = startTile.j;
	var nextTile;

	if (Math.random() > lengthProba || currentLength < 2) {
		//we don't stop right there
		var switchback = false;
		if (Math.random() < switchbacksProba) switchback=true;
		if (X > 0 && (i >= this.tileTableWidth-1 || this.tileTable[i+1][j].type > 0 || switchback)) {
			//cannot move to the right as planned
				if (Math.random() > 0.5 && j < this.tileTableHeight-1 && this.tileTable[i][j+1].type === 0) {
					//move down
					X = 0;
					Y = 1;
				}
				else if (j > 0 && this.tileTable[i][j-1].type === 0) {
					//move up
					X = 0;
					Y = -1;
				}
				else if (j < this.tileTableHeight-1 && this.tileTable[i][j+1].type === 0) {
					//move down
					X = 0;
					Y = 1;
				}
				else {
					X = 0;
					Y = 0;
				}
		}
		else if (X < 0 && (i === 0 || this.tileTable[i-1][j].type > 0 || switchback)) {
			//cannot move to the left as planned
				if (Math.random() > 0.5 && j < this.tileTableHeight-1 && this.tileTable[i][j+1].type === 0) {
					//move down
					X = 0;
					Y = 1;
				}
				else if (j > 0 && this.tileTable[i][j-1].type === 0) {
					//move up
					X = 0;
					Y = -1;
				}
				else if (j < this.tileTableHeight-1 && this.tileTable[i][j+1].type === 0) {
					//move down
					X = 0;
					Y = 1;
				}
				else {
					X = 0;
					Y = 0;
				}
		}
		else if (Y > 0 && (j >= this.tileTableHeight-1 || this.tileTable[i][j+1].type > 0 || switchback)) {
			//cannot move down as planned
				if (Math.random() > 0.5 && i < this.tileTableWidth-1 && this.tileTable[i+1][j].type === 0) {
					//move right
					X = 1;
					Y = 0;
				}
				else if (i > 0 && this.tileTable[i-1][j].type === 0 ) {
					//move left
					X = -1;
					Y = 0;
				}
				else if (i < this.tileTableWidth-1 && this.tileTable[i+1][j].type === 0) {
					//move right
					X = 1;
					Y = 0;
				}
				else {
					X = 0;
					Y = 0;
				}
		}
		else if (Y < 0 && (j === 0 || this.tileTable[i][j-1].type > 0 || switchback)) {
			//cannot move up as planned
				if (Math.random() > 0.5 && i < this.tileTableWidth-1 && this.tileTable[i+1][j].type === 0) {
					//move right
					X = 1;
					Y = 0;
				}
				else if (i > 0 && this.tileTable[i-1][j].type === 0 ) {
					//move left
					X = -1;
					Y = 0;
				}
				if (i < this.tileTableWidth-1 && this.tileTable[i+1][j].type === 0) {
					//move right
					X = 1;
					Y = 0;
				}
				else {
					X = 0;
					Y = 0;
				}
		}
		nextTile = this.tileTable[i+X][j+Y];
		if (X > 0) {
			startTile.rightWall = Tile.wallType.NOWALL;
			nextTile.leftWall = Tile.wallType.NOWALL;
		}
		else if (X < 0) {
			startTile.leftWall = Tile.wallType.NOWALL;
			nextTile.rightWall = Tile.wallType.NOWALL;
		}
		else if (Y > 0) {
			startTile.downWall = Tile.wallType.NOWALL;
			nextTile.upWall = Tile.wallType.NOWALL;
		}
		else if (Y < 0) {
			startTile.upWall = Tile.wallType.NOWALL;
			nextTile.downWall = Tile.wallType.NOWALL;
		}
		if (X !== 0 || Y !== 0) this.createPath(nextTile,lengthProba,switchbacksProba,ennemyProba,X,Y,currentType,currentLength+1,ennemyLeft);
	}
}


/**
 * Move game forward by timeGap ms
 * @param {Number} timeGap How much to move time forward
 * @param {Boolean} dontUpdate Optional, if set to true don't update rest of the world (usually to avoid useless and time consuming redraws)
 */
Level.prototype.update = function (timeGap, dontUpdate) {
  if (timeGap > 1.01 * Level.maxTimeGapStep) {   // The 1.01 here is to avoid possible infinite recursion due to floating point math errors
    var fullSteps = Math.floor(timeGap / Level.maxTimeGapStep);
    timeGap -= fullSteps * Level.maxTimeGapStep;
    for (var i = 0; i < fullSteps; i += 1) {
      this.update(Level.maxTimeGapStep, true);
    }
    this.update(timeGap);
    return;
  } else {
    this.currentTime += timeGap;
  }

  for (var i = 0; i < this.ennemyTable.length; i++) { this.ennemyTable[i].updatePosition(timeGap); }
  for (var i = 0; i < this.playerTable.length; i++) { this.playerTable[i].updatePosition(timeGap); }
  if (! dontUpdate) { this.emit('positions.updated'); }
}


/**
 * Move game in time to given local clock time
 */
//Level.prototype.moveToLocalTime = function (localTime) {
  //if (this.currentTime === undefined) { this.currentTime = this.startTime; }
  //var now = Date.now(), gap = now - this.currentTime;
  //this.currentTime = now;
  //this.update(gap);
//};


/**
 * Move game in time to given game time
 */
//Level.prototype.moveToGameTime = function (gameTime) {
  //this.update(gameTime - this.getGameTime());
  //this.currentTime = this.startTime + gameTime;
//};


/**
 * Get game's time, 0 being when robots begin to move, in ms
 */
Level.prototype.getGameTime = function () {
  return Date.now() - this.startTime;
};


/**
 * Get the idea game time, i.e. the internal currentTime
 */
Level.prototype.getIdealGameTime = function () {
  return this.currentTime;
};


/**
 * Log a message with the level's actual and ideal game times
 */
Level.prototype.log = function (message, logAbsoluteTime) {
  var m = 'LEVEL - ' + message + ' - actual: ' + this.getGameTime() + ' - ideal: ' + this.getIdealGameTime();
  if (logAbsoluteTime) { m += ' - absolute: ' + Date.now(); }
  console.log(m);
};


/**
 * Set game start time (in local time)
 */
//Level.prototype.setStartTime = function (startTime) {
  //this.startTime = startTime;
//};



// Interface for Node.js server
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') { module.exports = Level; }
