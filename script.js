import {
  CELL_STATE,
  MODEL_OPTIONS,
  createSimulation,
} from "./life-rules.js";

const canvas = document.querySelector("#game");
const context = canvas.getContext("2d", { alpha: false });

const backgroundCanvas = document.createElement("canvas");
const backgroundContext = backgroundCanvas.getContext("2d", { alpha: false });

const cellCanvas = document.createElement("canvas");
const cellContext = cellCanvas.getContext("2d");

const elements = {
  generation: document.querySelector("#generation"),
  population: document.querySelector("#population"),
  populationLabel: document.querySelector("#population-label"),
  fps: document.querySelector("#fps"),
  toast: document.querySelector("#toast"),
  run: document.querySelector("#run"),
  step: document.querySelector("#step"),
  random: document.querySelector("#random"),
  clear: document.querySelector("#clear"),
  speed: document.querySelector("#speed"),
  speedValue: document.querySelector("#speed-value"),
  cellSize: document.querySelector("#cell-size"),
  cellSizeValue: document.querySelector("#cell-size-value"),
  chaos: document.querySelector("#chaos"),
  chaosValue: document.querySelector("#chaos-value"),
  model: document.querySelector("#model"),
  brush: document.querySelector("#brush"),
  modelDescription: document.querySelector("#model-description"),
  modelParameters: document.querySelector("#model-parameters"),
  resetSettings: document.querySelector("#reset-settings"),
  paintHint: document.querySelector("#paint-hint"),
};

const CELL_COLORS = ["#1fa8ff", "#4dfcff", "#8c5cff", "#ff3bd4", "#ffe66d"];
const GLOW_COLORS = [
  "rgba(30, 170, 255, 0.16)",
  "rgba(77, 252, 255, 0.18)",
  "rgba(140, 92, 255, 0.18)",
  "rgba(255, 59, 212, 0.18)",
  "rgba(255, 230, 109, 0.18)",
];

const BRUSH_OPTIONS = {
  conway: [{ value: CELL_STATE.ALIVE, label: "ALIVE" }],
  highlife: [{ value: CELL_STATE.ALIVE, label: "ALIVE" }],
  seeds: [{ value: CELL_STATE.ALIVE, label: "ALIVE" }],
  "brians-brain": [{ value: CELL_STATE.ALIVE, label: "FIRING" }],
  wator: [
    { value: CELL_STATE.FISH, label: "FISH / 魚" },
    { value: CELL_STATE.SHARK, label: "SHARK / サメ" },
  ],
  "rock-paper-scissors": [
    { value: CELL_STATE.ROCK, label: "ROCK / グー" },
    { value: CELL_STATE.PAPER, label: "PAPER / パー" },
    { value: CELL_STATE.SCISSORS, label: "SCISSORS / チョキ" },
  ],
};

const LIFE_PARAMETER_CONTROLS = [
  { key: "birth", label: "BIRTH (B)", type: "text", maxLength: 9 },
  { key: "survival", label: "SURVIVE (S)", type: "text", maxLength: 9 },
];

const PARAMETER_CONTROLS = {
  conway: LIFE_PARAMETER_CONTROLS,
  highlife: LIFE_PARAMETER_CONTROLS,
  seeds: LIFE_PARAMETER_CONTROLS,
  "brians-brain": [
    { key: "birthNeighbours", label: "BIRTH NEIGHBORS", min: 1, max: 8 },
    { key: "refractoryTurns", label: "REST TURNS", min: 1, max: 8 },
  ],
  wator: [
    { key: "fishBreedAge", label: "FISH BREED", min: 1, max: 30 },
    { key: "sharkBreedAge", label: "SHARK BREED", min: 1, max: 30 },
    { key: "sharkStartEnergy", label: "SHARK ENERGY", min: 1, max: 30 },
    { key: "fishEnergy", label: "FOOD ENERGY", min: 1, max: 30 },
  ],
  "rock-paper-scissors": [
    { key: "takeoverThreshold", label: "TAKEOVER", min: 1, max: 8 },
    { key: "mutationRate", label: "MUTATION %", min: 0, max: 10, step: 0.1 },
  ],
};

const DEFAULT_UI_SETTINGS = Object.freeze({
  speed: 12,
  cellSize: 6,
  chaos: 24,
});

let width = window.innerWidth;
let height = window.innerHeight;
let cellSize = Number(elements.cellSize.value);
let speed = Number(elements.speed.value);
let running = true;
let cellsDirty = true;
let lastStepTime = 0;
let lastFrameTime = performance.now();
let smoothedFps = 60;

let game = createSimulation(
  elements.model.value,
  Math.ceil(width / cellSize),
  Math.ceil(height / cellSize),
);

const pointer = {
  down: false,
  paintState: CELL_STATE.ALIVE,
};

let particles = [];
let flashes = [];

function resize(preserve = true) {
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = width;
  canvas.height = height;
  cellCanvas.width = width;
  cellCanvas.height = height;

  game.resize(
    Math.ceil(width / cellSize),
    Math.ceil(height / cellSize),
    preserve,
  );

  cellsDirty = true;
  buildBackground();
  updateStatistics();
}

function setCell(x, y, state, showEffect = true) {
  if (!game.setCell(x, y, state)) {
    return;
  }

  cellsDirty = true;

  if (showEffect) {
    spawnParticles(
      (x + 0.5) * cellSize,
      (y + 0.5) * cellSize,
      state === CELL_STATE.EMPTY ? 3 : 5,
      state !== CELL_STATE.EMPTY,
    );
  }
}

function paint(clientX, clientY) {
  const centerX = Math.floor(clientX / cellSize);
  const centerY = Math.floor(clientY / cellSize);
  const radius = pointer.paintState === CELL_STATE.EMPTY ? 1 : 2;

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const isInsideBrush = offsetX ** 2 + offsetY ** 2 <= radius ** 2;

      if (isInsideBrush && Math.random() > 0.12) {
        setCell(centerX + offsetX, centerY + offsetY, pointer.paintState);
      }
    }
  }

  updateStatistics();
}

function advanceGeneration() {
  game.step((x, y, state) => {
    const shouldShowEffect = Math.random() < (
      state === CELL_STATE.EMPTY ? 0.003 : 0.012
    );

    if (shouldShowEffect) {
      spawnParticles((x + 0.5) * cellSize, (y + 0.5) * cellSize, 1);
    }
  });

  cellsDirty = true;
  updateStatistics();
}

function clearGame() {
  game.clear();
  particles = [];
  flashes = [];
  cellsDirty = true;
  updateStatistics();
}

function randomize() {
  const density = Number(elements.chaos.value) / 100;

  clearGame();
  game.randomize(density);
  cellsDirty = true;
  flashes.push({ life: 1, color: "#4dfcff" });
  announce("RANDOM BURST!");
  updateStatistics();
}

function buildBackground() {
  backgroundCanvas.width = width;
  backgroundCanvas.height = height;

  const gradient = backgroundContext.createRadialGradient(
    width * 0.5,
    height * 0.42,
    0,
    width * 0.5,
    height * 0.42,
    Math.max(width, height) * 0.75,
  );
  gradient.addColorStop(0, "#0a1230");
  gradient.addColorStop(0.48, "#050817");
  gradient.addColorStop(1, "#010208");

  backgroundContext.fillStyle = gradient;
  backgroundContext.fillRect(0, 0, width, height);
  backgroundContext.strokeStyle = "rgba(72, 145, 200, 0.075)";
  backgroundContext.lineWidth = 1;
  backgroundContext.beginPath();

  for (let x = 0; x < width; x += cellSize) {
    backgroundContext.moveTo(x, 0);
    backgroundContext.lineTo(x, height);
  }

  for (let y = 0; y < height; y += cellSize) {
    backgroundContext.moveTo(0, y);
    backgroundContext.lineTo(width, y);
  }

  backgroundContext.stroke();
}

function drawGrid() {
  if (!cellsDirty) {
    context.drawImage(cellCanvas, 0, 0);
    return;
  }

  cellsDirty = false;
  cellContext.clearRect(0, 0, width, height);

  const padding = Math.max(1, cellSize * 0.13);
  const renderedSize = cellSize - padding * 2;
  const ageBuckets = Array.from({ length: 5 }, () => []);

  game.forEachLivingCell((x, y, age, state) => {
    const bucketIndex = getColorBucket(state, age);
    ageBuckets[bucketIndex].push(x * cellSize + padding, y * cellSize + padding);
  });

  cellContext.save();
  cellContext.globalCompositeOperation = "lighter";

  ageBuckets.forEach((points, bucketIndex) => {
    cellContext.fillStyle = GLOW_COLORS[bucketIndex];

    for (let index = 0; index < points.length; index += 2) {
      cellContext.fillRect(
        points[index] - 2,
        points[index + 1] - 2,
        renderedSize + 4,
        renderedSize + 4,
      );
    }
  });

  cellContext.globalCompositeOperation = "source-over";

  ageBuckets.forEach((points, bucketIndex) => {
    cellContext.fillStyle = CELL_COLORS[bucketIndex];

    for (let index = 0; index < points.length; index += 2) {
      cellContext.fillRect(
        points[index],
        points[index + 1],
        renderedSize,
        renderedSize,
      );
    }
  });

  cellContext.fillStyle = "rgba(255, 255, 255, 0.36)";

  for (let bucketIndex = 2; bucketIndex < ageBuckets.length; bucketIndex += 1) {
    const points = ageBuckets[bucketIndex];

    for (let index = 0; index < points.length; index += 2) {
      cellContext.fillRect(points[index], points[index + 1], renderedSize, 1);
    }
  }

  cellContext.restore();
  context.drawImage(cellCanvas, 0, 0);
}

function getColorBucket(state, age) {
  if (game.modelKey === "wator") {
    return state === CELL_STATE.FISH ? 1 : 3;
  }

  if (game.modelKey === "brians-brain") {
    return state === CELL_STATE.ALIVE ? 4 : 2;
  }

  if (game.modelKey === "rock-paper-scissors") {
    const speciesColors = {
      [CELL_STATE.ROCK]: 1,
      [CELL_STATE.PAPER]: 4,
      [CELL_STATE.SCISSORS]: 3,
    };
    return speciesColors[state];
  }

  return Math.min(4, Math.floor(age / 5));
}

function spawnParticles(x, y, amount = 4, highEnergy = false) {
  if (particles.length > 480) {
    return;
  }

  for (let index = 0; index < amount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = (0.3 + Math.random() * 2.7) * (highEnergy ? 1.7 : 1);

    particles.push({
      x,
      y,
      velocityX: Math.cos(angle) * velocity,
      velocityY: Math.sin(angle) * velocity,
      life: 1,
      size: 1 + Math.random() * 3,
      color: CELL_COLORS[Math.floor(Math.random() * CELL_COLORS.length)],
    });
  }
}

function drawEffects(deltaTime) {
  context.save();
  context.globalCompositeOperation = "lighter";

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.x += particle.velocityX * deltaTime * 0.06;
    particle.y += particle.velocityY * deltaTime * 0.06;
    particle.velocityX *= 0.98;
    particle.velocityY *= 0.98;
    particle.life -= deltaTime * 0.0022;

    if (particle.life <= 0) {
      particles.splice(index, 1);
      continue;
    }

    context.globalAlpha = particle.life;
    context.fillStyle = particle.color;
    context.fillRect(
      particle.x,
      particle.y,
      particle.size * particle.life + 1,
      particle.size * particle.life + 1,
    );
  }

  context.restore();

  for (let index = flashes.length - 1; index >= 0; index -= 1) {
    const flash = flashes[index];
    flash.life -= deltaTime * 0.004;

    if (flash.life <= 0) {
      flashes.splice(index, 1);
      continue;
    }

    context.fillStyle = flash.color;
    context.globalAlpha = flash.life * 0.12;
    context.fillRect(0, 0, width, height);
  }

  context.globalAlpha = 1;
}

function render(currentTime) {
  const deltaTime = Math.min(50, currentTime - lastFrameTime);
  lastFrameTime = currentTime;
  smoothedFps = smoothedFps * 0.92 + (1000 / Math.max(1, deltaTime)) * 0.08;
  elements.fps.textContent = Math.round(smoothedFps);

  if (running && currentTime - lastStepTime > 1000 / speed) {
    advanceGeneration();
    lastStepTime = currentTime;
  }

  context.drawImage(backgroundCanvas, 0, 0);
  drawGrid();
  drawEffects(deltaTime);
  requestAnimationFrame(render);
}

function updateStatistics() {
  const statistics = game.getStatistics();
  const populationText = typeof statistics.value === "number"
    ? String(statistics.value).padStart(4, "0")
    : statistics.value;

  elements.generation.textContent = String(game.generation).padStart(4, "0");
  elements.population.textContent = populationText;
  elements.population.classList.toggle(
    "compact",
    typeof statistics.value !== "number",
  );
  elements.populationLabel.textContent = statistics.label;
}

function setRunning(nextRunning) {
  running = nextRunning;
  elements.run.textContent = running ? "▶ RUN" : "Ⅱ PAUSED";
  elements.run.classList.toggle("active", running);
  elements.run.setAttribute("aria-pressed", String(running));
}

function announce(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("show");
  void elements.toast.offsetWidth;
  elements.toast.classList.add("show");
}

function renderBrushOptions() {
  const options = BRUSH_OPTIONS[game.modelKey] ?? BRUSH_OPTIONS.conway;
  const optionElements = options.map(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  });

  elements.brush.replaceChildren(...optionElements);
  pointer.paintState = Number(elements.brush.value);
}

function renderParameterControls() {
  const definitions = PARAMETER_CONTROLS[game.modelKey] ?? [];
  const controls = definitions.map((definition) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    label.className = "parameter-control";
    label.append(`${definition.label} `);

    input.type = definition.type ?? "number";
    input.value = game.getParameter(definition.key);
    input.setAttribute("aria-label", definition.label);

    if (definition.type === "text") {
      input.inputMode = "numeric";
      input.maxLength = definition.maxLength;
      input.pattern = "[0-8]*";
      input.addEventListener("change", () => {
        game.setParameter(definition.key, input.value);
        input.value = game.getParameter(definition.key);
      });
    } else {
      input.min = definition.min;
      input.max = definition.max;
      input.step = definition.step ?? 1;
      input.addEventListener("input", () => {
        game.setParameter(definition.key, input.value);
      });
    }

    label.append(input);
    return label;
  });

  elements.modelParameters.replaceChildren(...controls);
}

function resetSettings() {
  const defaultModel = createSimulation(game.modelKey, 1, 1);
  const definitions = PARAMETER_CONTROLS[game.modelKey] ?? [];

  for (const { key } of definitions) {
    game.setParameter(key, defaultModel.getParameter(key));
  }

  speed = DEFAULT_UI_SETTINGS.speed;
  elements.speed.value = speed;
  elements.speedValue.textContent = speed;

  elements.chaos.value = DEFAULT_UI_SETTINGS.chaos;
  elements.chaosValue.textContent = `${DEFAULT_UI_SETTINGS.chaos}%`;

  const sizeChanged = cellSize !== DEFAULT_UI_SETTINGS.cellSize;
  cellSize = DEFAULT_UI_SETTINGS.cellSize;
  elements.cellSize.value = cellSize;
  elements.cellSizeValue.textContent = cellSize;

  renderParameterControls();

  if (sizeChanged) {
    resize(true);
  }
}

function changeModel(modelKey) {
  game = createSimulation(
    modelKey,
    Math.ceil(width / cellSize),
    Math.ceil(height / cellSize),
  );

  const modelOption = MODEL_OPTIONS.find((option) => option.id === modelKey);
  elements.modelDescription.textContent = modelOption?.description ?? "";
  elements.paintHint.textContent = "SELECT BRUSH ・ DRAG TO PAINT ・ RIGHT DRAG TO ERASE";
  renderBrushOptions();
  renderParameterControls();

  particles = [];
  flashes = [];
  cellsDirty = true;
  randomize();
}

function bindEvents() {
  canvas.addEventListener("pointerdown", (event) => {
    pointer.down = true;
    pointer.paintState = event.button === 2
      ? CELL_STATE.EMPTY
      : Number(elements.brush.value);
    canvas.setPointerCapture(event.pointerId);
    paint(event.clientX, event.clientY);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (pointer.down) {
      paint(event.clientX, event.clientY);
    }
  });

  canvas.addEventListener("pointerup", () => {
    pointer.down = false;
  });

  canvas.addEventListener("pointercancel", () => {
    pointer.down = false;
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  elements.run.addEventListener("click", () => setRunning(!running));

  elements.step.addEventListener("click", () => {
    setRunning(false);
    advanceGeneration();
  });

  elements.random.addEventListener("click", randomize);
  elements.clear.addEventListener("click", () => {
    clearGame();
    announce("PURGED");
  });

  elements.model.addEventListener("change", (event) => {
    changeModel(event.target.value);
  });

  elements.brush.addEventListener("change", (event) => {
    pointer.paintState = Number(event.target.value);
  });

  elements.resetSettings.addEventListener("click", resetSettings);

  elements.speed.addEventListener("input", (event) => {
    speed = Number(event.target.value);
    elements.speedValue.textContent = speed;
  });

  elements.chaos.addEventListener("input", (event) => {
    elements.chaosValue.textContent = `${event.target.value}%`;
  });

  elements.cellSize.addEventListener("change", (event) => {
    cellSize = Number(event.target.value);
    elements.cellSizeValue.textContent = cellSize;
    resize(true);
  });

  window.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select, button")) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      setRunning(!running);
    } else if (event.key.toLowerCase() === "r") {
      randomize();
    } else if (event.key.toLowerCase() === "c") {
      clearGame();
    }
  });

  window.addEventListener("resize", () => resize(true));
}

bindEvents();
resize(false);
changeModel(elements.model.value);
requestAnimationFrame(render);
