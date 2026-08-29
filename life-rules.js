export const CELL_STATE = Object.freeze({
  EMPTY: 0,
  ALIVE: 1,
  REFRACTORY: 2,
  FISH: 1,
  SHARK: 2,
  ROCK: 1,
  PAPER: 2,
  SCISSORS: 3,
});

const CELLULAR_RULES = Object.freeze({
  conway: { birth: [3], survival: [2, 3] },
  highlife: { birth: [3, 6], survival: [2, 3] },
  seeds: { birth: [2], survival: [] },
});

export const MODEL_OPTIONS = Object.freeze([
  {
    id: "conway",
    description: "B3/S23 — 3近傍で誕生、2〜3近傍で生存する標準ルール。",
  },
  {
    id: "wator",
    description: "魚が繁殖し、サメが魚を捕食します。サメは餌がないと餓死します。",
  },
  {
    id: "highlife",
    description: "B36/S23 — Conwayに「6近傍で誕生」を加えた自己複製ルール。",
  },
  {
    id: "seeds",
    description: "B2/S — 2近傍でのみ誕生し、生存セルは次の世代で必ず消えます。",
  },
  {
    id: "brians-brain",
    description: "発火セルは休止状態を経て消滅。死セルは発火セル2近傍で点火します。",
  },
  {
    id: "rock-paper-scissors",
    description: "グー・パー・チョキが互いを循環的に侵食し、波や渦を作ります。",
  },
]);

/**
 * Outer-totalistic cellular automaton.
 *
 * Conway's Life is B3/S23, where B is the neighbour count for birth and S is
 * the neighbour count for survival. HighLife and Seeds use this same engine
 * with different B/S values. The board wraps at each edge.
 */
export class LifeGame {
  constructor(columns, rows, rule = CELLULAR_RULES.conway, modelKey = "conway") {
    this.modelKey = modelKey;
    this.rule = {
      birth: [...rule.birth],
      survival: [...rule.survival],
    };
    this.columns = columns;
    this.rows = rows;
    this.generation = 0;
    this.population = 0;
    this.grid = new Uint8Array(columns * rows);
    this.nextGrid = new Uint8Array(columns * rows);
    this.age = new Uint8Array(columns * rows);
  }

  resize(columns, rows, preserve = true) {
    const oldGrid = this.grid;
    const oldAge = this.age;
    const oldColumns = this.columns;
    const oldRows = this.rows;

    this.columns = columns;
    this.rows = rows;
    this.grid = new Uint8Array(columns * rows);
    this.nextGrid = new Uint8Array(columns * rows);
    this.age = new Uint8Array(columns * rows);
    this.population = 0;

    if (!preserve || !oldGrid) {
      return;
    }

    copyCenteredGrid({
      oldGrid,
      oldAge,
      oldColumns,
      oldRows,
      newGrid: this.grid,
      newAge: this.age,
      newColumns: columns,
      newRows: rows,
      onCopy: () => {
        this.population += 1;
      },
    });
  }

  setCell(x, y, state) {
    if (!isInside(x, y, this.columns, this.rows)) {
      return false;
    }

    const index = y * this.columns + x;
    const value = state ? CELL_STATE.ALIVE : CELL_STATE.EMPTY;

    if (this.grid[index] === value) {
      return false;
    }

    this.grid[index] = value;
    this.age[index] = value;
    this.population += value ? 1 : -1;
    return true;
  }

  clear() {
    this.grid.fill(CELL_STATE.EMPTY);
    this.nextGrid.fill(CELL_STATE.EMPTY);
    this.age.fill(0);
    this.generation = 0;
    this.population = 0;
  }

  randomize(density, margins = {}) {
    const { left = 2, right = 2, top = 3, bottom = 10 } = margins;
    this.clear();

    for (let y = top; y < this.rows - bottom; y += 1) {
      for (let x = left; x < this.columns - right; x += 1) {
        if (Math.random() < density) {
          this.setCell(x, y, CELL_STATE.ALIVE);
        }
      }
    }
  }

  forEachLivingCell(callback) {
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = y * this.columns + x;

        if (this.grid[index]) {
          callback(x, y, this.age[index], CELL_STATE.ALIVE);
        }
      }
    }
  }

  getStatistics() {
    return { value: this.population, label: "CELLS" };
  }

  getParameter(name) {
    return name === "birth"
      ? this.rule.birth.join("")
      : this.rule.survival.join("");
  }

  setParameter(name, value) {
    if (name === "birth" || name === "survival") {
      this.rule[name] = parseNeighbourCounts(value);
    }
  }

  step(onChange = () => {}) {
    let population = 0;

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = y * this.columns + x;
        const wasAlive = this.grid[index] === CELL_STATE.ALIVE;
        const neighbourCount = this.#countNeighbours(x, y);
        const isAlive = wasAlive
          ? this.rule.survival.includes(neighbourCount)
          : this.rule.birth.includes(neighbourCount);

        this.nextGrid[index] = isAlive ? CELL_STATE.ALIVE : CELL_STATE.EMPTY;

        if (isAlive) {
          population += 1;
          this.age[index] = wasAlive ? Math.min(255, this.age[index] + 1) : 1;
        } else {
          this.age[index] = 0;
        }

        if (isAlive !== wasAlive) {
          onChange(x, y, isAlive ? CELL_STATE.ALIVE : CELL_STATE.EMPTY);
        }
      }
    }

    [this.grid, this.nextGrid] = [this.nextGrid, this.grid];
    this.generation += 1;
    this.population = population;
  }

  #countNeighbours(x, y) {
    let count = 0;

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) {
          continue;
        }

        const neighbourX = (x + offsetX + this.columns) % this.columns;
        const neighbourY = (y + offsetY + this.rows) % this.rows;
        count += this.grid[neighbourY * this.columns + neighbourX];
      }
    }

    return count;
  }
}

/**
 * Brian's Brain: 0 (dead) -> 1 (firing) -> 2 (refractory) -> 0.
 * A dead cell fires when exactly two of its neighbours are firing.
 */
export class BriansBrain {
  constructor(columns, rows, settings = {}) {
    this.modelKey = "brians-brain";
    this.settings = {
      birthNeighbours: settings.birthNeighbours ?? 2,
      refractoryTurns: settings.refractoryTurns ?? 1,
    };
    this.columns = columns;
    this.rows = rows;
    this.generation = 0;
    this.firingCount = 0;
    this.refractoryCount = 0;
    this.grid = new Uint8Array(columns * rows);
    this.nextGrid = new Uint8Array(columns * rows);
    this.age = new Uint8Array(columns * rows);
  }

  resize(columns, rows, preserve = true) {
    const oldGrid = this.grid;
    const oldAge = this.age;
    const oldColumns = this.columns;
    const oldRows = this.rows;

    this.columns = columns;
    this.rows = rows;
    this.grid = new Uint8Array(columns * rows);
    this.nextGrid = new Uint8Array(columns * rows);
    this.age = new Uint8Array(columns * rows);
    this.firingCount = 0;
    this.refractoryCount = 0;

    if (!preserve || !oldGrid) {
      return;
    }

    copyCenteredGrid({
      oldGrid,
      oldAge,
      oldColumns,
      oldRows,
      newGrid: this.grid,
      newAge: this.age,
      newColumns: columns,
      newRows: rows,
      onCopy: (state) => this.#incrementCount(state),
    });
  }

  setCell(x, y, state) {
    if (!isInside(x, y, this.columns, this.rows)) {
      return false;
    }

    const index = y * this.columns + x;
    const value = state ? CELL_STATE.ALIVE : CELL_STATE.EMPTY;
    const oldState = this.grid[index];

    if (oldState === value) {
      return false;
    }

    this.#decrementCount(oldState);
    this.grid[index] = value;
    this.age[index] = value;
    this.#incrementCount(value);
    return true;
  }

  clear() {
    this.grid.fill(CELL_STATE.EMPTY);
    this.nextGrid.fill(CELL_STATE.EMPTY);
    this.age.fill(0);
    this.generation = 0;
    this.firingCount = 0;
    this.refractoryCount = 0;
  }

  randomize(density, margins = {}) {
    const { left = 2, right = 2, top = 3, bottom = 10 } = margins;
    this.clear();

    for (let y = top; y < this.rows - bottom; y += 1) {
      for (let x = left; x < this.columns - right; x += 1) {
        if (Math.random() < density) {
          this.setCell(x, y, CELL_STATE.ALIVE);
        }
      }
    }
  }

  forEachLivingCell(callback) {
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = y * this.columns + x;
        const state = this.grid[index];

        if (state !== CELL_STATE.EMPTY) {
          callback(x, y, this.age[index], state);
        }
      }
    }
  }

  getStatistics() {
    return {
      value: `${this.firingCount}/${this.refractoryCount}`,
      label: "FIRE/REST",
    };
  }

  getParameter(name) {
    return this.settings[name];
  }

  setParameter(name, value) {
    if (name === "birthNeighbours") {
      this.settings.birthNeighbours = clampNumber(value, 1, 8);
    } else if (name === "refractoryTurns") {
      this.settings.refractoryTurns = clampNumber(value, 1, 8);
    }
  }

  step(onChange = () => {}) {
    let firingCount = 0;
    let refractoryCount = 0;

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = y * this.columns + x;
        const oldState = this.grid[index];
        let newState = CELL_STATE.EMPTY;

        if (oldState === CELL_STATE.ALIVE) {
          newState = CELL_STATE.REFRACTORY;
        } else if (
          oldState === CELL_STATE.REFRACTORY
          && this.age[index] < this.settings.refractoryTurns
        ) {
          newState = CELL_STATE.REFRACTORY;
        } else if (
          oldState === CELL_STATE.EMPTY
          && this.#countFiringNeighbours(x, y) === this.settings.birthNeighbours
        ) {
          newState = CELL_STATE.ALIVE;
        }

        this.nextGrid[index] = newState;
        if (newState === CELL_STATE.EMPTY) {
          this.age[index] = 0;
        } else if (oldState === CELL_STATE.ALIVE) {
          this.age[index] = 1;
        } else {
          this.age[index] += 1;
        }

        if (newState === CELL_STATE.ALIVE) {
          firingCount += 1;
        } else if (newState === CELL_STATE.REFRACTORY) {
          refractoryCount += 1;
        }

        if (newState !== oldState) {
          onChange(x, y, newState);
        }
      }
    }

    [this.grid, this.nextGrid] = [this.nextGrid, this.grid];
    this.generation += 1;
    this.firingCount = firingCount;
    this.refractoryCount = refractoryCount;
  }

  #countFiringNeighbours(x, y) {
    let count = 0;

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) {
          continue;
        }

        const neighbourX = (x + offsetX + this.columns) % this.columns;
        const neighbourY = (y + offsetY + this.rows) % this.rows;
        const index = neighbourY * this.columns + neighbourX;
        count += this.grid[index] === CELL_STATE.ALIVE ? 1 : 0;
      }
    }

    return count;
  }

  #incrementCount(state) {
    if (state === CELL_STATE.ALIVE) {
      this.firingCount += 1;
    } else if (state === CELL_STATE.REFRACTORY) {
      this.refractoryCount += 1;
    }
  }

  #decrementCount(state) {
    if (state === CELL_STATE.ALIVE) {
      this.firingCount -= 1;
    } else if (state === CELL_STATE.REFRACTORY) {
      this.refractoryCount -= 1;
    }
  }
}

const WATOR_SETTINGS = Object.freeze({
  fishBreedAge: 6,
  sharkBreedAge: 10,
  sharkStartEnergy: 7,
  fishEnergy: 5,
  fishShare: 0.78,
});

/**
 * Wa-Tor predator-prey model.
 *
 * Fish move to an adjacent empty cell and reproduce after six turns. Sharks
 * prefer adjacent fish, lose one energy per turn, gain energy by eating, and
 * reproduce after ten turns. Movement uses the four orthogonal neighbours.
 */
export class WaTorGame {
  constructor(columns, rows, settings = WATOR_SETTINGS) {
    this.modelKey = "wator";
    this.settings = { ...WATOR_SETTINGS, ...settings };
    this.columns = columns;
    this.rows = rows;
    this.generation = 0;
    this.fishCount = 0;
    this.sharkCount = 0;
    this.grid = new Uint8Array(columns * rows);
    this.age = new Uint16Array(columns * rows);
    this.energy = new Int16Array(columns * rows);
  }

  resize(columns, rows, preserve = true) {
    const oldGrid = this.grid;
    const oldAge = this.age;
    const oldEnergy = this.energy;
    const oldColumns = this.columns;
    const oldRows = this.rows;

    this.columns = columns;
    this.rows = rows;
    this.grid = new Uint8Array(columns * rows);
    this.age = new Uint16Array(columns * rows);
    this.energy = new Int16Array(columns * rows);
    this.fishCount = 0;
    this.sharkCount = 0;

    if (!preserve || !oldGrid) {
      return;
    }

    const offsetX = Math.trunc((columns - oldColumns) / 2);
    const offsetY = Math.trunc((rows - oldRows) / 2);

    for (let y = 0; y < oldRows; y += 1) {
      for (let x = 0; x < oldColumns; x += 1) {
        const oldIndex = y * oldColumns + x;
        const state = oldGrid[oldIndex];
        const newX = x + offsetX;
        const newY = y + offsetY;

        if (state === CELL_STATE.EMPTY || !isInside(newX, newY, columns, rows)) {
          continue;
        }

        const newIndex = newY * columns + newX;
        this.grid[newIndex] = state;
        this.age[newIndex] = oldAge[oldIndex];
        this.energy[newIndex] = oldEnergy[oldIndex];
        this.#incrementCount(state);
      }
    }
  }

  setCell(x, y, state) {
    if (!isInside(x, y, this.columns, this.rows)) {
      return false;
    }

    const index = y * this.columns + x;
    const value = [CELL_STATE.FISH, CELL_STATE.SHARK].includes(state)
      ? state
      : CELL_STATE.EMPTY;
    const oldState = this.grid[index];

    if (oldState === value) {
      return false;
    }

    this.#decrementCount(oldState);
    this.grid[index] = value;
    this.age[index] = 0;
    this.energy[index] = value === CELL_STATE.SHARK
      ? this.settings.sharkStartEnergy
      : 0;
    this.#incrementCount(value);
    return true;
  }

  clear() {
    this.grid.fill(CELL_STATE.EMPTY);
    this.age.fill(0);
    this.energy.fill(0);
    this.generation = 0;
    this.fishCount = 0;
    this.sharkCount = 0;
  }

  randomize(density, margins = {}) {
    const { left = 2, right = 2, top = 3, bottom = 10 } = margins;
    this.clear();

    for (let y = top; y < this.rows - bottom; y += 1) {
      for (let x = left; x < this.columns - right; x += 1) {
        if (Math.random() >= density) {
          continue;
        }

        const state = Math.random() < this.settings.fishShare
          ? CELL_STATE.FISH
          : CELL_STATE.SHARK;
        this.setCell(x, y, state);
      }
    }
  }

  forEachLivingCell(callback) {
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = y * this.columns + x;
        const state = this.grid[index];

        if (state !== CELL_STATE.EMPTY) {
          callback(x, y, this.age[index], state);
        }
      }
    }
  }

  getStatistics() {
    return {
      value: `${this.fishCount}/${this.sharkCount}`,
      label: "FISH/SHARK",
    };
  }

  getParameter(name) {
    return this.settings[name];
  }

  setParameter(name, value) {
    const ranges = {
      fishBreedAge: [1, 30],
      sharkBreedAge: [1, 30],
      sharkStartEnergy: [1, 30],
      fishEnergy: [1, 30],
    };

    if (ranges[name]) {
      this.settings[name] = clampNumber(value, ...ranges[name]);
    }
  }

  step(onChange = () => {}) {
    const occupiedCells = [];
    const processed = new Uint8Array(this.grid.length);

    for (let index = 0; index < this.grid.length; index += 1) {
      if (this.grid[index] !== CELL_STATE.EMPTY) {
        occupiedCells.push(index);
      }
    }

    shuffle(occupiedCells);

    for (const index of occupiedCells) {
      if (processed[index] || this.grid[index] === CELL_STATE.EMPTY) {
        continue;
      }

      if (this.grid[index] === CELL_STATE.FISH) {
        this.#updateFish(index, processed, onChange);
      } else {
        this.#updateShark(index, processed, onChange);
      }
    }

    this.generation += 1;
  }

  #updateFish(origin, processed, onChange) {
    const nextAge = this.age[origin] + 1;
    const emptyNeighbours = this.#neighboursWithState(origin, CELL_STATE.EMPTY);

    if (emptyNeighbours.length === 0) {
      this.age[origin] = nextAge;
      processed[origin] = 1;
      return;
    }

    const destination = pickRandom(emptyNeighbours);
    const reproduces = nextAge >= this.settings.fishBreedAge;

    this.grid[destination] = CELL_STATE.FISH;
    this.energy[destination] = 0;
    processed[destination] = 1;

    if (reproduces) {
      this.age[origin] = 0;
      this.age[destination] = 0;
      this.fishCount += 1;
      processed[origin] = 1;
      onChange(this.#x(destination), this.#y(destination), CELL_STATE.FISH);
      return;
    }

    this.grid[origin] = CELL_STATE.EMPTY;
    this.age[origin] = 0;
    this.energy[origin] = 0;
    this.age[destination] = nextAge;
    processed[origin] = 1;
    onChange(this.#x(origin), this.#y(origin), CELL_STATE.EMPTY);
    onChange(this.#x(destination), this.#y(destination), CELL_STATE.FISH);
  }

  #updateShark(origin, processed, onChange) {
    const fishNeighbours = this.#neighboursWithState(origin, CELL_STATE.FISH);
    const emptyNeighbours = this.#neighboursWithState(origin, CELL_STATE.EMPTY);
    const ateFish = fishNeighbours.length > 0;
    const destination = ateFish
      ? pickRandom(fishNeighbours)
      : pickRandom(emptyNeighbours);
    const nextAge = this.age[origin] + 1;
    const nextEnergy = this.energy[origin] - 1
      + (ateFish ? this.settings.fishEnergy : 0);

    if (nextEnergy <= 0) {
      this.grid[origin] = CELL_STATE.EMPTY;
      this.age[origin] = 0;
      this.energy[origin] = 0;
      this.sharkCount -= 1;
      processed[origin] = 1;
      onChange(this.#x(origin), this.#y(origin), CELL_STATE.EMPTY);
      return;
    }

    if (destination === undefined) {
      this.age[origin] = nextAge;
      this.energy[origin] = nextEnergy;
      processed[origin] = 1;
      return;
    }

    const reproduces = nextAge >= this.settings.sharkBreedAge;

    if (ateFish) {
      this.fishCount -= 1;
    }

    this.grid[destination] = CELL_STATE.SHARK;
    this.age[destination] = reproduces ? 0 : nextAge;
    this.energy[destination] = nextEnergy;
    processed[destination] = 1;

    if (reproduces) {
      this.grid[origin] = CELL_STATE.SHARK;
      this.age[origin] = 0;
      this.energy[origin] = this.settings.sharkStartEnergy;
      this.sharkCount += 1;
    } else {
      this.grid[origin] = CELL_STATE.EMPTY;
      this.age[origin] = 0;
      this.energy[origin] = 0;
    }

    processed[origin] = 1;
    onChange(this.#x(origin), this.#y(origin), this.grid[origin]);
    onChange(this.#x(destination), this.#y(destination), CELL_STATE.SHARK);
  }

  #neighboursWithState(index, state) {
    const x = this.#x(index);
    const y = this.#y(index);
    const neighbours = [
      y * this.columns + ((x - 1 + this.columns) % this.columns),
      y * this.columns + ((x + 1) % this.columns),
      ((y - 1 + this.rows) % this.rows) * this.columns + x,
      ((y + 1) % this.rows) * this.columns + x,
    ];

    return neighbours.filter((neighbour) => this.grid[neighbour] === state);
  }

  #x(index) {
    return index % this.columns;
  }

  #y(index) {
    return Math.floor(index / this.columns);
  }

  #incrementCount(state) {
    if (state === CELL_STATE.FISH) {
      this.fishCount += 1;
    } else if (state === CELL_STATE.SHARK) {
      this.sharkCount += 1;
    }
  }

  #decrementCount(state) {
    if (state === CELL_STATE.FISH) {
      this.fishCount -= 1;
    } else if (state === CELL_STATE.SHARK) {
      this.sharkCount -= 1;
    }
  }
}

/**
 * Cyclic Rock-Paper-Scissors cellular automaton.
 *
 * Paper invades rock, scissors invade paper, and rock invades scissors. A cell
 * changes when enough predator cells are present in its Moore neighbourhood.
 */
export class RockPaperScissorsGame {
  constructor(columns, rows, settings = {}) {
    this.modelKey = "rock-paper-scissors";
    this.settings = {
      takeoverThreshold: settings.takeoverThreshold ?? 3,
      mutationRate: settings.mutationRate ?? 0,
    };
    this.columns = columns;
    this.rows = rows;
    this.generation = 0;
    this.counts = new Uint32Array(4);
    this.grid = new Uint8Array(columns * rows);
    this.nextGrid = new Uint8Array(columns * rows);
    this.age = new Uint8Array(columns * rows);
  }

  resize(columns, rows, preserve = true) {
    const oldGrid = this.grid;
    const oldAge = this.age;
    const oldColumns = this.columns;
    const oldRows = this.rows;

    this.columns = columns;
    this.rows = rows;
    this.grid = new Uint8Array(columns * rows);
    this.nextGrid = new Uint8Array(columns * rows);
    this.age = new Uint8Array(columns * rows);
    this.counts = new Uint32Array(4);

    if (!preserve || !oldGrid) {
      return;
    }

    copyCenteredGrid({
      oldGrid,
      oldAge,
      oldColumns,
      oldRows,
      newGrid: this.grid,
      newAge: this.age,
      newColumns: columns,
      newRows: rows,
      onCopy: (state) => {
        this.counts[state] += 1;
      },
    });
  }

  setCell(x, y, state) {
    if (!isInside(x, y, this.columns, this.rows)) {
      return false;
    }

    const index = y * this.columns + x;
    const value = [CELL_STATE.ROCK, CELL_STATE.PAPER, CELL_STATE.SCISSORS].includes(state)
      ? state
      : CELL_STATE.EMPTY;
    const oldState = this.grid[index];

    if (oldState === value) {
      return false;
    }

    this.counts[oldState] -= oldState === CELL_STATE.EMPTY ? 0 : 1;
    this.grid[index] = value;
    this.age[index] = value === CELL_STATE.EMPTY ? 0 : 1;
    this.counts[value] += value === CELL_STATE.EMPTY ? 0 : 1;
    return true;
  }

  clear() {
    this.grid.fill(CELL_STATE.EMPTY);
    this.nextGrid.fill(CELL_STATE.EMPTY);
    this.age.fill(0);
    this.counts.fill(0);
    this.generation = 0;
  }

  randomize(chaos, margins = {}) {
    const { left = 2, right = 2, top = 3, bottom = 10 } = margins;
    this.clear();

    for (let y = top; y < this.rows - bottom; y += 1) {
      for (let x = left; x < this.columns - right; x += 1) {
        let state;

        if (x > left && Math.random() >= chaos) {
          state = this.grid[y * this.columns + x - 1];
        } else if (y > top && Math.random() >= chaos) {
          state = this.grid[(y - 1) * this.columns + x];
        } else {
          state = 1 + Math.floor(Math.random() * 3);
        }

        this.setCell(x, y, state);
      }
    }
  }

  forEachLivingCell(callback) {
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = y * this.columns + x;
        const state = this.grid[index];

        if (state !== CELL_STATE.EMPTY) {
          callback(x, y, this.age[index], state);
        }
      }
    }
  }

  getStatistics() {
    return {
      value: `${this.counts[CELL_STATE.ROCK]}/${this.counts[CELL_STATE.PAPER]}/${this.counts[CELL_STATE.SCISSORS]}`,
      label: "R/P/S",
    };
  }

  getParameter(name) {
    return this.settings[name];
  }

  setParameter(name, value) {
    if (name === "takeoverThreshold") {
      this.settings.takeoverThreshold = clampNumber(value, 1, 8);
    } else if (name === "mutationRate") {
      this.settings.mutationRate = clampNumber(value, 0, 10);
    }
  }

  step(onChange = () => {}) {
    const nextCounts = new Uint32Array(4);

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = y * this.columns + x;
        const oldState = this.grid[index];
        let newState = oldState;

        if (oldState !== CELL_STATE.EMPTY) {
          const predator = this.#predatorOf(oldState);
          const predatorCount = this.#countNeighboursWithState(x, y, predator);

          if (predatorCount >= this.settings.takeoverThreshold) {
            newState = predator;
          }

          if (Math.random() * 100 < this.settings.mutationRate) {
            newState = 1 + Math.floor(Math.random() * 3);
          }
        }

        this.nextGrid[index] = newState;
        this.age[index] = newState === CELL_STATE.EMPTY
          ? 0
          : newState === oldState
            ? Math.min(255, this.age[index] + 1)
            : 1;

        if (newState !== CELL_STATE.EMPTY) {
          nextCounts[newState] += 1;
        }

        if (newState !== oldState) {
          onChange(x, y, newState);
        }
      }
    }

    [this.grid, this.nextGrid] = [this.nextGrid, this.grid];
    this.counts = nextCounts;
    this.generation += 1;
  }

  #predatorOf(state) {
    if (state === CELL_STATE.ROCK) {
      return CELL_STATE.PAPER;
    }

    if (state === CELL_STATE.PAPER) {
      return CELL_STATE.SCISSORS;
    }

    return CELL_STATE.ROCK;
  }

  #countNeighboursWithState(x, y, state) {
    let count = 0;

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) {
          continue;
        }

        const neighbourX = (x + offsetX + this.columns) % this.columns;
        const neighbourY = (y + offsetY + this.rows) % this.rows;
        const index = neighbourY * this.columns + neighbourX;
        count += this.grid[index] === state ? 1 : 0;
      }
    }

    return count;
  }
}

export function createSimulation(modelKey, columns, rows) {
  switch (modelKey) {
    case "wator":
      return new WaTorGame(columns, rows);
    case "highlife":
      return new LifeGame(columns, rows, CELLULAR_RULES.highlife, "highlife");
    case "seeds":
      return new LifeGame(columns, rows, CELLULAR_RULES.seeds, "seeds");
    case "brians-brain":
      return new BriansBrain(columns, rows);
    case "rock-paper-scissors":
      return new RockPaperScissorsGame(columns, rows);
    case "conway":
    default:
      return new LifeGame(columns, rows, CELLULAR_RULES.conway, "conway");
  }
}

function copyCenteredGrid({
  oldGrid,
  oldAge,
  oldColumns,
  oldRows,
  newGrid,
  newAge,
  newColumns,
  newRows,
  onCopy,
}) {
  const offsetX = Math.trunc((newColumns - oldColumns) / 2);
  const offsetY = Math.trunc((newRows - oldRows) / 2);

  for (let y = 0; y < oldRows; y += 1) {
    for (let x = 0; x < oldColumns; x += 1) {
      const oldIndex = y * oldColumns + x;
      const state = oldGrid[oldIndex];
      const newX = x + offsetX;
      const newY = y + offsetY;

      if (state === CELL_STATE.EMPTY || !isInside(newX, newY, newColumns, newRows)) {
        continue;
      }

      const newIndex = newY * newColumns + newX;
      newGrid[newIndex] = state;
      newAge[newIndex] = oldAge[oldIndex];
      onCopy(state);
    }
  }
}

function isInside(x, y, columns, rows) {
  return x >= 0 && x < columns && y >= 0 && y < rows;
}

function parseNeighbourCounts(value) {
  return [...new Set(
    String(value)
      .split("")
      .map(Number)
      .filter((count) => Number.isInteger(count) && count >= 0 && count <= 8),
  )].sort((a, b) => a - b);
}

function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

function pickRandom(items) {
  if (items.length === 0) {
    return undefined;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
}
