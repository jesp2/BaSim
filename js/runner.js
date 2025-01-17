//{ RunnerRNG - rng
const rngSOUTH = 0;
const rngWEST = 1;
const rngEAST = 2;

function rngRunnerRNG(forcedMovements = -1) {
    this.forcedMovements = forcedMovements;
    this.forcedMovementsIndex = 0;
}
rngRunnerRNG.prototype.rollMovement = function () {
    if (this.forcedMovements.length > this.forcedMovementsIndex) {
        let movement = this.forcedMovements.charAt(this.forcedMovementsIndex++);
        if (movement === "s") {
            return rngSOUTH;
        }
        if (movement === "w") {
            return rngWEST;
        }
        if (movement === "e") {
            return rngEAST;
        }
    }
    let rnd = Math.floor(Math.random() * 6);
    if (rnd < 4) {
        return rngSOUTH;
    }
    if (rnd === 4) {
        return rngWEST;
    }
    return rngEAST;
}
//}

//{ Runner - ru
function ruInit(sniffDistance) {
    sim.ruSniffDistance = sniffDistance;
}
function ruRunner(x = -1, y = -1, runnerRNG = -1, isWave10 = -1, id = -1) { // TODO: healers re-aggro if runner dies
    this.x = x;
    this.y = y;
    this.destinationX = x;
    this.destinationY = y;
    this.cycleTick = 1;
    this.targetState = 0;
    this.foodTarget = null;
    this.blughhhhCountdown = 0;
    this.standStillCounter = 0;
    this.despawnCountdown = -1;
    this.isDying = false;
    this.diedThisTick = false; // Hacky solution to 1t longer despawn after urghh if stand still.
    this.runnerRNG = runnerRNG;
    this.isWave10 = isWave10;
    this.id = id;
    this.chat = "";
}
ruRunner.prototype.isRendered = function () {
    if (!sim.ToggleRender.checked) {
        return true;
    }
    for (let i = 0; i < pl.RenderArea.length; ++i) {
        let renderCoordinate = pl.RenderArea[i];
        if (renderCoordinate[0] == this.x && renderCoordinate[1] == this.y) {
            return true;
        }
    }
    return false;
}
ruRunner.prototype.renderUpdateTargetState = function () {
    if (this.targetState === 0) {
        return;
    }
    if (this.cycleTick >= 3 && this.cycleTick <= 5) {
        ++this.targetState;
        if (this.targetState > 3) {
            this.targetState = 1;
        }
    }
}
ruRunner.prototype.tick = function () {
    this.chat = "";
    if (++this.cycleTick > 10) {
        this.cycleTick = 1;
    }
    ++this.standStillCounter;
    if (this.despawnCountdown !== -1) {
        if (--this.despawnCountdown === 0) {
            ba.RunnersToRemove.push(this);
            if (!this.isDying) {
                --ba.RunnersAlive;
            } else {
                if (baIsNearEastTrap(this.x, this.y)) {
                    if (ba.EastTrapCharges > 0) --ba.EastTrapCharges;
                }
                if (baIsNearWestTrap(this.x, this.y)) {
                    if (ba.WestTrapCharges > 0) --ba.WestTrapCharges;
                }
            }
        }
    } else {
        if (!this.isDying) {
            if (!this.isRendered()) {
                this.renderUpdateTargetState();
            }
            switch (this.cycleTick) {
                case 1:
                    this.doTick1();
                    break;
                case 2:
                    this.doTick2Or5();
                    break;
                case 3:
                    this.doTick3();
                    break;
                case 4:
                    this.doTick4();
                    break;
                case 5:
                    this.doTick2Or5();
                    break;
                case 6:
                    this.doTick6();
                    break;
                case 7:
                case 8:
                case 9:
                case 10:
                    this.doTick7To10();
                    break;
            }
        }
        if (this.isDying) {
            if (this.standStillCounter > 2) {
                ++ba.RunnersKilled;
                --ba.RunnersAlive;
                this.print("Urghhh!");
                if (this.diedThisTick) {
                    this.despawnCountdown = 3;
                } else {
                    this.despawnCountdown = 2;
                }
            }
            if (this.diedThisTick) {
                this.diedThisTick = false;
            }
        }
    }
}
ruRunner.prototype.doMovement = function () { // TODO: Doesn't consider diagonal movement block flags
    let startX = this.x;
    if (this.destinationX > startX) {
        if (!baTileBlocksPenance(startX + 1, this.y) && mCanMoveEast(startX, this.y)) {
            ++this.x;
            this.standStillCounter = 0;
        }
    } else if (this.destinationX < startX && !baTileBlocksPenance(startX - 1, this.y) && mCanMoveWest(startX, this.y)) {
        --this.x;
        this.standStillCounter = 0;
    }
    if (this.destinationY > this.y) {
        if (!baTileBlocksPenance(startX, this.y + 1) && !baTileBlocksPenance(this.x, this.y + 1) && mCanMoveNorth(startX, this.y) && mCanMoveNorth(this.x, this.y)) {
            ++this.y;
            this.standStillCounter = 0;
        }
    } else if (this.destinationY < this.y && !baTileBlocksPenance(startX, this.y - 1) && !baTileBlocksPenance(this.x, this.y - 1) && mCanMoveSouth(startX, this.y) && mCanMoveSouth(this.x, this.y)) {
        --this.y;
        this.standStillCounter = 0;
    }
}
ruRunner.prototype.tryTargetFood = function () {
    if (!this.isRendered()) {
        return;
    }
    let xZone = this.x >> 3;
    let yZone = this.y >> 3;
    let firstFoodFound = null;
    let endXZone = Math.max(xZone - 1, 0);
    let endYZone = Math.max(yZone - 1, 0);
    for (let x = Math.min(xZone + 1, m.mItemZonesWidth - 1); x >= endXZone; --x) {
        for (let y = Math.min(yZone + 1, m.mItemZonesHeight - 1); y >= endYZone; --y) {
            let itemZone = mGetItemZone(x, y);
            itemZone = itemZone.filter(item => item.isGood !== undefined);
            for (let foodIndex = itemZone.length - 1; foodIndex >= 0; --foodIndex) {
                let food = itemZone[foodIndex];
                if (!mHasLineOfSight(this.x, this.y, food.x, food.y)) {
                    continue;
                }
                if (firstFoodFound === null) {
                    firstFoodFound = food;
                }
                if (Math.max(Math.abs(this.x - food.x), Math.abs(this.y - food.y)) <= sim.ruSniffDistance) {
                    this.foodTarget = firstFoodFound;
                    this.destinationX = firstFoodFound.x;
                    this.destinationY = firstFoodFound.y;
                    this.targetState = 0;
                    return;
                }
            }
        }
    }
}
ruRunner.prototype.tryEatAndCheckTarget = function () {
    if (this.foodTarget !== null) {
        let itemZone = mGetItemZone(this.foodTarget.x >>> 3, this.foodTarget.y >>> 3);
        let foodIndex = itemZone.map(food => food.id).indexOf(this.foodTarget.id);
        if (foodIndex === -1) {
            this.foodTarget = null;
            this.targetState = 0;
            return true;
        } else if (this.x === this.foodTarget.x && this.y === this.foodTarget.y) {
            if (this.foodTarget.isGood) {
                this.print("Chomp, chomp.");
                if (
                    baIsNearEastTrap(this.x, this.y) && ba.EastTrapCharges > 0 ||
                    baIsNearWestTrap(this.x, this.y) && ba.WestTrapCharges > 0
                ) {
                    this.diedThisTick = true;
                    this.isDying = true;
                }
            } else {
                this.print("Blughhhh.");
                this.blughhhhCountdown = 3;
                this.targetState = 0;
                if (this.cycleTick > 5) {
                    this.cycleTick -= 5;
                }
                this.setDestinationBlughhhh();
            }
            itemZone.splice(foodIndex, 1);
            return true;
        }
    }
    return false;
}
ruRunner.prototype.cancelDestination = function () {
    this.destinationX = this.x;
    this.destinationY = this.y;
}
ruRunner.prototype.setDestinationBlughhhh = function () {
    this.destinationX = this.x;
    if (this.isWave10) {
        this.destinationY = baEAST_TRAP_Y - 4;
    } else {
        this.destinationY = baEAST_TRAP_Y + 4;
    }
}
ruRunner.prototype.setDestinationRandomWalk = function () {
    if (this.x <= 27) { // TODO: These same for wave 10?
        if (this.y === 8 || this.y === 9) {
            this.destinationX = 30;
            this.destinationY = 8;
            return;
        } else if (this.x === 25 && this.y === 7) {
            this.destinationX = 26;
            this.destinationY = 8;
            return;
        }
    } else if (this.x <= 32) {
        if (this.y <= 8) {
            this.destinationX = 30;
            this.destinationY = 6;
            return;
        }
    } else if (this.y === 7 || this.y === 8) {
        this.destinationX = 31;
        this.destinationY = 8;
        return;
    }
    let direction = this.runnerRNG.rollMovement();
    if (direction === rngSOUTH) {
        this.destinationX = this.x;
        this.destinationY = this.y - 5;
    } else if (direction === rngWEST) {
        this.destinationX = this.x - 5;
        if (this.destinationX < baWEST_TRAP_X - 1) { // TODO: Same for wave 10?
            this.destinationX = baWEST_TRAP_X - 1;
        }
        this.destinationY = this.y;
    } else {
        this.destinationX = this.x + 5;
        if (this.isWave10) {
            if (this.destinationX > baEAST_TRAP_X - 1) {
                this.destinationX = baEAST_TRAP_X - 1;
            }
        } else if (this.destinationX > baEAST_TRAP_X) {
            this.destinationX = baEAST_TRAP_X;
        }
        this.destinationY = this.y;
    }
}
ruRunner.prototype.doTick1 = function () {
    if (this.y === 6) {
        this.despawnCountdown = 3;
        this.print("Raaa!");
        return;
    }
    if (this.blughhhhCountdown > 0) {
        --this.blughhhhCountdown;
    } else {
        ++this.targetState;
        if (this.targetState > 3) {
            this.targetState = 1;
        }
    }
    let ateOrTargetGone = this.tryEatAndCheckTarget();
    if (this.blughhhhCountdown === 0 && this.foodTarget === null) { // Could make this line same as tick 6 without any difference?
        this.cancelDestination();
    }
    if (!ateOrTargetGone) {
        this.doMovement();
    }
}
ruRunner.prototype.doTick2Or5 = function () {
    if (this.targetState === 2) {
        this.tryTargetFood();
    }
    this.doTick7To10();
}
ruRunner.prototype.doTick3 = function () {
    if (this.targetState === 3) {
        this.tryTargetFood();
    }
    this.doTick7To10();
}
ruRunner.prototype.doTick4 = function () {
    if (this.targetState === 1) {
        this.tryTargetFood();
    }
    this.doTick7To10();
}
ruRunner.prototype.doTick6 = function () {
    if (this.y === 6) {
        this.despawnCountdown = 3;
        this.print("Raaa!");
        return;
    }
    if (this.blughhhhCountdown > 0) {
        --this.blughhhhCountdown;
    }
    if (this.targetState === 3) {
        this.tryTargetFood();
    }
    let ateOrTargetGone = this.tryEatAndCheckTarget();
    if (this.blughhhhCountdown === 0 && (this.foodTarget === null || ateOrTargetGone)) {
        this.setDestinationRandomWalk();
    }
    if (!ateOrTargetGone) {
        this.doMovement();
    }
}
ruRunner.prototype.doTick7To10 = function () {
    let ateOrTargetGone = this.tryEatAndCheckTarget();
    if (!ateOrTargetGone) {
        this.doMovement();
    }
}
ruRunner.prototype.print = function (string) {
    console.log(ba.TickCounter + ": Runner " + this.id + ": " + string);
    this.chat = string;
}
//}