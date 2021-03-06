function Tile(i, j, k) {
	this.i = i; // Position in level.tileArray
	this.j = j; // Position in level.tileArray
	this.k = k; // vertical position in the tileArray, in case there are multiple levels.
	this.type = 0; // 0 means is hasn't been filled by a corridor yet. 1 means it's inaccessible. All tiles in the same corridor have the same type.
	this.upWall = 1;
	this.rightWall = 1;
	this.leftWall = 1;
	this.downWall = 1;
	this.nearbyEnnemies = new Array(); // used to optimize collision detection. Each tile remembers the ennemies that are nearby
	this.isObjective = false; // A robot will win the level when he reaches this tile.

}


Tile.wallType = { NOWALL: 0, SOFT: 1, HARD: 2 }


Tile.prototype.serialize = function() {
	return JSON.stringify({ type: this.type, upWall: this.upWall, downWall: this.downWall, rightWall: this.rightWall, leftWall: this.leftWall, isObjective: this.objective, i: this.i, j: this.j });
}

Tile.deserialize = function(string) {
	var tileData = JSON.parse(string)
    , tile = new Tile(tileData.i, tileData.j, 0);

	tile.type = tileData.type;   // 0 means is hasn't been filled by a corridor yet. 1 means it's inaccessible. All tiles in the same corridor have the same type.
	tile.upWall = tileData.upWall;
	tile.rightWall = tileData.rightWall;
	tile.leftWall = tileData.leftWall;
	tile.downWall = tileData.downWall;
	tile.isObjective = tileData.isObjective;

  return tile;
}


Tile.prototype.makeInnaccessible = function(level) {
	this.upWall = Tile.wallType.HARD;
	this.downWall = Tile.wallType.HARD;
	this.leftWall = Tile.wallType.HARD;
	this.rightWall = Tile.wallType.HARD;
	this.newType(1);
	if (this.i > 0) { level.tileTable[this.i - 1][this.j].rightWall = Tile.wallType.HARD; }
	if (this.i < level.tileTableWidth - 1) { level.tileTable[this.i + 1][this.j].leftWall = Tile.wallType.HARD; }
	if (this.j > 0) { level.tileTable[this.i][this.j - 1].downWall = Tile.wallType.HARD; }
	if (this.j < level.tileTableHeight - 1) { level.tileTable[this.i][this.j+1].upWall = Tile.wallType.HARD; }
}


Tile.prototype.removeEnnemiesFromCorridor = function(level) {
  if (this.visited) { return; }
  else {
    this.visited = true;
    for (var i = 0; i < this.nearbyEnnemies.length ; i++) {
      level.ennemyTable.splice(level.ennemyTable.indexOf(this.nearbyEnnemies[i]),1);
    }
    this.nearbyEnnemies = new Array();
    if (this.upWall === Tile.wallType.NOWALL) { level.tileTable[this.i][this.j - 1].removeEnnemiesFromCorridor(level); }
    if (this.downWall === Tile.wallType.NOWALL) { level.tileTable[this.i][this.j + 1].removeEnnemiesFromCorridor(level); }
    if (this.rightWall === Tile.wallType.NOWALL) { level.tileTable[this.i + 1][this.j].removeEnnemiesFromCorridor(level); }
    if (this.leftWall === Tile.wallType.NOWALL) { level.tileTable[this.i - 1][this.j].removeEnnemiesFromCorridor(level); }

  }
}


Tile.prototype.newType = function (type) {
	this.type = type;
}


Tile.prototype.center = function () {
  return { x: this.i + 1 / 2, y: this.j + 1 / 2 };
};



// Interface for server
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') { module.exports = Tile; }
