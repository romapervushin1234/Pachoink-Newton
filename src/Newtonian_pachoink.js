// =====================================================
// ELITE TRIANGULAR PACHINKO - Ultimate Mobile Edition
// FEATURES: Drag-to-aim, Flick-to-pitch, Skins
// OPTIMIZATIONS: Native Canvas API, Multi-touch safety, 
//                O(N) Spatial Hash Gravity, Plummer Softening
// =====================================================

// --- 1. STRICTLY NATIVE CONSTANTS ---
const STATE_AIM = 0, STATE_FLIGHT = 1, STATE_SETTLE = 2, STATE_FINAL = 3;
const STATE_LEVEL_COMPLETE = 4, STATE_GAMEOVER = 5;

const LAYOUT_TRIANGLE = 0, LAYOUT_INVERTED = 1, LAYOUT_HEX = 2;
const PATTERN_FULL = 0, PATTERN_HONEY = 1, PATTERN_SPIRAL = 2, PATTERN_CHECK = 3;
const PATTERN_GRAD = 4, PATTERN_DIAMOND = 5, PATTERN_WAVE = 6;

const SPECIALS = [
  { name: 'RED', r: 255, g: 80, b: 80, limit: () => Math.floor(Math.random() * 5) + 2 },
  { name: 'GREEN', r: 80, g: 255, b: 80, limit: () => Math.floor(Math.random() * 5) + 2 },
  { name: 'BLUE', r: 80, g: 80, b: 255, limit: () => Math.floor(Math.random() * 5) + 2 },
  { name: 'YELLOW', r: 255, g: 255, b: 80, limit: () => Math.floor(Math.random() * 5) + 2 },
  { name: 'CYAN', r: 0, g: 255, b: 255, limit: () => Math.floor(Math.random() * 5) + 2 },
  { name: 'EMERALD', r: 50, g: 255, b: 150, limit: () => Math.floor(Math.random() * 5) + 2 },
  { name: 'MAGENTA', r: 255, g: 0, b: 255, limit: () => Math.floor(Math.random() * 5) + 2 },
  { name: 'ORANGE', r: 255, g: 140, b: 50, limit: () => 3 },
  { name: 'PURPLE', r: 150, g: 50, b: 255, limit: () => 4 }
];

const BALL_SKINS = [
  { name: 'CYAN',  c1: [0, 245, 255], c2: [200, 255, 255], glow: [0, 200, 255] },
  { name: 'FIRE',  c1: [255, 100, 0], c2: [255, 200, 50],  glow: [255, 150, 0] },
  { name: 'TOXIC', c1: [100, 255, 0], c2: [200, 255, 150], glow: [50, 255, 50] },
  { name: 'VOID',  c1: [150, 0, 255], c2: [200, 100, 255], glow: [100, 0, 200] },
  { name: 'GOLD',  c1: [255, 215, 0], c2: [255, 240, 150], glow: [255, 200, 50] }
];

const MAX_PEGS = 15000;
const MAX_PARTICLES = 1000;
const PEG_SPACING = 24;
const PEG_RADIUS = 5;
const BALL_RADIUS = 4;
const ROW_HEIGHT = PEG_SPACING * 0.866;
const TOP_MARGIN = 100;
const LAUNCH_Y = -130; // 200px higher than original (was 70, now -130)
const CONTAINER_HEIGHT = 70;
const SIDE_MARGIN = 50;
const MAX_BALL_SPEED = 12;

// --- 2. GLOBAL VARIABLES ---
let gameState = STATE_AIM;
let launchMode = 0; 
let level = 1, totalScore = 0.000, levelScore = 0.000, shotsRemaining = 15, maxShots = 15;
let layoutType = LAYOUT_TRIANGLE, hexRadius = 2, numRows = 15, patternType = PATTERN_FULL;
let aimAngle = 0, scored = false, startY = 0, settleTimer = 0, flashTimer = 0;
let runScore = 0, yellowActive = false, chainMult = 1.0;
let currentZoom = 1.0, targetZoom = 1.0, cameraOffsetY = 0, targetOffsetY = 0;
let launchZoomBoost = 0;

// ARCTANGENT CURVE SCORING
let totalBasePegValue = 0;
let maxContainerMult = 1;
let levelScoreK = 1000; 
const MAX_LEVEL_SCORE = 12800.000;

// Screen Shake
let shakeAmount = 0;
const SHAKE_DECAY = 0.85;

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragEnd = { x: 0, y: 0 };
let swipeStartTime = 0;
let activeTouchId = null;

let currentBallSkin = 0;

let pegs = [], pegData = {}, containers = [];
let balls = [], ballPrevPos = [], ballStates = [], ballContainers = [], trailPoints = [];
let containerMultipliers = [];
let boardBounds = { x: 0, y: 0, w: 0, h: 0 }, minZoomToFit = 1.0;
let spatialGrid = {}, GRID_SIZE = PEG_SPACING * 2;
let effectsThisFrame = 0;

let pegHitCounts, pegMaxHits, pegMultipliers, pegSkipMask;
let hitPegIds, removedPegIds, removedPegValues;
let particlePool = [], activeParticleCount = 0;
let glowPegs = {};
let gravityWells = [], slowMotionZones = [], shieldWalls = [];
let invertedGravityBalls = new Set();

let hud = { score: 0, totalHits: 0, pegCount: 0, ballsSettled: 0, ballsTotal: 0, multiplier: 1 };
let modeToggle = { x: 20, y: 85, w: 140, h: 30, visible: true };

// CPU OPTIMIZATION: Removed trail/glow buttons
let settingsBtns = {
  skin: { x: 20, y: 125, w: 90, h: 28 }
};

let responsive = { scale: 1, offsetX: 0, offsetY: 0, boardW: 800, boardH: 900, virtualMouse: { x: 0, y: 0 } };

// --- 3. LIFECYCLE ---
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(1.5, window.devicePixelRatio || 1));
  
  if (typeof document !== 'undefined') {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = '#08081c';
    document.body.style.touchAction = 'none';
  }

  pegHitCounts = new Int16Array(MAX_PEGS);
  pegMaxHits = new Int16Array(MAX_PEGS);
  pegMultipliers = new Float32Array(MAX_PEGS);
  pegMultipliers.fill(1);
  pegSkipMask = new Uint8Array(MAX_PEGS);
  
  hitPegIds = new Set();
  removedPegIds = new Set();
  removedPegValues = {};
  
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particlePool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, r: 0, g: 0, b: 0, size: 1, active: false });
  }
  
  activeParticleCount = 0;
  startNewGame();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitToScreen(responsive.boardW, responsive.boardH);
}

function fitToScreen(w, h) {
  responsive.boardW = w;
  responsive.boardH = h;
  let scaleX = windowWidth / w;
  let scaleY = windowHeight / h;
  responsive.scale = Math.min(scaleX, scaleY);
  responsive.offsetX = (windowWidth - w * responsive.scale) / 2;
  responsive.offsetY = (windowHeight - h * responsive.scale) / 2;
}

function updateMouse(mx, my) {
  responsive.virtualMouse.x = (mx - responsive.offsetX) / responsive.scale;
  responsive.virtualMouse.y = (my - responsive.offsetY) / responsive.scale;
}

function startNewGame() {
  level = 1; 
  totalScore = 0.000;
  levelScore = 0.000;
  shotsRemaining = maxShots;
  generateLevel();
}

function startNextLevel() {
  level++; 
  totalScore = 0.000;
  levelScore = 0.000;
  shotsRemaining = maxShots;
  generateLevel();
}

function generateLevel() {
  layoutType = (level === 1) ? LAYOUT_TRIANGLE : (level % 4 === 0) ? LAYOUT_INVERTED : (level % 4 === 2) ? LAYOUT_HEX : LAYOUT_TRIANGLE;
  
  if (layoutType === LAYOUT_HEX) {
    hexRadius = constrain(2 + floor(level / 4), 2, 20);
  } else {
    numRows = constrain(12 + floor(level * 2.5) + floor(random(-3, 6)), 10, 40);
  }
  
  patternType = (level === 1) ? PATTERN_FULL : floor(random(7));
  
  clearWorld(); resetRoundState(); computeWorldSize(); buildBoard();
  assignSpecialPegs(); buildContainers(); calculateBoardBounds();
  calculateLevelScoreCurve(); 
  
  currentZoom = 1.0; targetZoom = 1.0; cameraOffsetY = 0; targetOffsetY = 0;
  gameState = STATE_AIM; aimAngle = 0; scored = false; levelScore = 0.000; launchZoomBoost = 0;
}

function clearWorld() {
  pegs = []; pegData = {}; containers = [];
  balls = []; ballPrevPos = []; ballStates = []; ballContainers = []; trailPoints = [];
}

function resetRoundState() {
  pegHitCounts.fill(0); pegMaxHits.fill(0); pegMultipliers.fill(1);
  removedPegValues = {}; hitPegIds.clear(); removedPegIds.clear(); glowPegs = {};
  yellowActive = false; activeParticleCount = 0; runScore = 0; settleTimer = 0; flashTimer = 0;
  chainMult = 1.0; gravityWells = []; slowMotionZones = []; shieldWalls = []; invertedGravityBalls.clear();
}

function computeWorldSize() {
  let cw, ch;
  if (layoutType === LAYOUT_HEX) {
    let s = hexRadius * 2 - 1;
    cw = s * PEG_SPACING * 1.1 + SIDE_MARGIN * 2 + 100;
    ch = s * ROW_HEIGHT + TOP_MARGIN + CONTAINER_HEIGHT + 150;
  } else {
    let mw = (numRows - 1) * PEG_SPACING;
    cw = mw + SIDE_MARGIN * 2 + 100;
    ch = (numRows - 1) * ROW_HEIGHT + TOP_MARGIN + CONTAINER_HEIGHT + 150;
  }
  let w = max(800, cw); let h = max(900, ch);
  fitToScreen(w, h);
}

// --- 4. BOARD GENERATION ---
function buildBoard() {
  startY = TOP_MARGIN; pegSkipMask.fill(0); applyPatternToMask();
  if (layoutType === LAYOUT_TRIANGLE) buildStandardTriangle();
  else if (layoutType === LAYOUT_INVERTED) buildInvertedTriangle();
  else if (layoutType === LAYOUT_HEX) buildHexGrid();
}

function applyPatternToMask() {
  let idx = 0;
  if (layoutType !== LAYOUT_HEX) {
    for (let r = 0; r < numRows; r++) {
      let count = (layoutType === LAYOUT_INVERTED) ? numRows - r : r + 1;
      for (let c = 0; c < count; c++) {
        pegSkipMask[idx] = shouldSkipPeg(r, c, numRows) ? 1 : 0; idx++;
      }
    }
  } else {
    let n = hexRadius;
    for (let q = -(n - 1); q <= n - 1; q++) {
      let r1 = max(-(n - 1), -q - (n - 1)); let r2 = min(n - 1, -q + (n - 1));
      for (let r = r1; r <= r2; r++) {
        pegSkipMask[idx] = shouldSkipHex(q, r, n) ? 1 : 0; idx++;
      }
    }
  }
}

function buildStandardTriangle() {
  let idx = 0;
  for (let r = 0; r < numRows; r++) {
    let count = r + 1; let rowW = (count - 1) * PEG_SPACING;
    let ox = responsive.boardW / 2 - rowW / 2; let oy = startY + r * ROW_HEIGHT;
    for (let c = 0; c < count; c++) {
      if (pegSkipMask[idx]) pegs.push(null);
      else createPeg(ox + c * PEG_SPACING, oy, r, c, idx);
      idx++;
    }
  }
}

function buildInvertedTriangle() {
  let idx = 0;
  for (let r = 0; r < numRows; r++) {
    let count = numRows - r; let rowW = (count - 1) * PEG_SPACING;
    let ox = responsive.boardW / 2 - rowW / 2; let oy = startY + r * ROW_HEIGHT;
    for (let c = 0; c < count; c++) {
      if (pegSkipMask[idx]) pegs.push(null);
      else createPeg(ox + c * PEG_SPACING, oy, r, c, idx);
      idx++;
    }
  }
}

function buildHexGrid() {
  let n = hexRadius, idx = 0;
  for (let q = -(n - 1); q <= n - 1; q++) {
    let r1 = max(-(n - 1), -q - (n - 1)); let r2 = min(n - 1, -q + (n - 1));
    for (let r = r1; r <= r2; r++) {
      let sx = responsive.boardW / 2 + PEG_SPACING * (q + r * 0.5); let sy = startY + ROW_HEIGHT * r;
      if (pegSkipMask[idx]) pegs.push(null);
      else createPeg(sx, sy, r + (n - 1), q + (n - 1), idx);
      idx++;
    }
  }
}

function createPeg(x, y, row, col, id) {
  let p = { id: id, row: row, col: col, value: row + 1, x: x, y: y, isSpecial: false, specialIdx: -1, active: true };
  pegs.push(p); pegData[id] = p;
}

function assignSpecialPegs() {
  let valid = [];
  for (let i = 0; i < pegs.length; i++) if (pegs[i] && pegs[i].row > 4) valid.push(i);
  for (let i = valid.length - 1; i > 0; i--) {
    let j = floor(random(i + 1)); let t = valid[i]; valid[i] = valid[j]; valid[j] = t;
  }
  let num = min(SPECIALS.length, valid.length);
  for (let i = 0; i < num; i++) {
    let id = valid[i]; pegs[id].isSpecial = true; pegs[id].specialIdx = i; pegMaxHits[id] = SPECIALS[i].limit();
  }
}

function shouldSkipPeg(row, col, total) {
  if (row < 2) return false;
  switch (patternType) {
    case PATTERN_FULL: return false;
    case PATTERN_HONEY: 
      let cx = col - row / 2, cy = row * 0.866, cs = 3 + floor(level / 4);
      let hx = floor(cx / cs), hy = floor(cy / cs), lx = cx - hx * cs, ly = cy - hy * cs;
      return sqrt(pow(lx - cs / 2, 2) + pow(ly - cs / 2, 2)) < cs * 0.35;
    case PATTERN_SPIRAL:
      let cnt = row + 1, cc = (cnt - 1) / 2, cr = total / 2;
      let dx = col - cc, dy = row - cr, d = sqrt(dx * dx + dy * dy), a = atan2(dy, dx);
      return sin(d * 0.5 - a * 2) > 0.7;
    case PATTERN_CHECK:
      let sz = 2 + floor(level / 5); return (floor(col / sz) + floor(row / sz)) % 2 === 0;
    case PATTERN_GRAD:
      let den = 1 - (row / total) * 0.7; let seed = row * 1000 + col * 7 + level * 13;
      let rn = abs((sin(seed) * 43758.5453) % 1); return rn > den;
    case PATTERN_DIAMOND:
      let cc3 = row / 2, cr3 = total / 2; let ddx = abs(col - cc3), ddy = abs(row - cr3), dd = ddx + ddy * 0.5;
      let rs = 4 + level / 3; return (dd % rs) < rs * 0.4;
    case PATTERN_WAVE:
      let cc4 = row / 2, nc = (col - cc4) / max(cc4, 1);
      let wf = 0.3 + level * 0.05, wa = 2 + level / 4, wo = sin(row * wf) * wa;
      return abs(nc * (row + 1) - wo) < 1.5;
    default: return false;
  }
}

function shouldSkipHex(q, r, n) { return shouldSkipPeg(r + (n - 1), q + (n - 1), n * 2 - 1); }

function buildContainers() {
  let count = floor(numRows / 2) + 3; let bottomY = getBottomY();
  let le = SIDE_MARGIN, re = responsive.boardW - SIDE_MARGIN, tw = re - le;
  containerMultipliers = computeMultipliers(count);
  let widths = computeBinWidths(count, tw); let x = le;
  for (let i = 0; i < count; i++) {
    containers.push({ left: x, right: x + widths[i], cx: x + widths[i] / 2, y: bottomY, w: widths[i] });
    x += widths[i];
  }
}

function getBottomY() {
  return startY + (layoutType === LAYOUT_HEX ? (hexRadius * 2 - 1) * ROW_HEIGHT : (numRows - 1) * ROW_HEIGHT) + 50;
}

function computeMultipliers(c) {
  let m = [], h = (c - 1) / 2, mx = 1000 + level * 100, mn = max(1.0, 1.5 - level * 0.03);
  for (let i = 0; i < c; i++) {
    let d = abs(i - h), n = h > 0 ? d / h : 0;
    m.push(round((mn + (mx - mn) * pow(n, 3)) * 10) / 10);
  }
  return m;
}

function computeBinWidths(c, tw) {
  let r = [], h = (c - 1) / 2, s = 0;
  for (let i = 0; i < c; i++) {
    let d = h > 0 ? abs(i - h) / h : 0; let w = 1.4 + (0.5 - 1.4) * d;
    r.push(w); s += w;
  }
  return r.map(v => v / s * tw);
}

function calculateLevelScoreCurve() {
  let activePegsCount = 0;
  totalBasePegValue = 0;
  maxContainerMult = 1;
  
  for (let i = 0; i < pegs.length; i++) {
    if (pegs[i] && pegs[i].active) {
      activePegsCount++;
      totalBasePegValue += pegs[i].value;
    }
  }
  
  for (let i = 0; i < containerMultipliers.length; i++) {
    if (containerMultipliers[i] > maxContainerMult) {
      maxContainerMult = containerMultipliers[i];
    }
  }
  
  if (activePegsCount === 0) activePegsCount = 1;
  
  let expectedChaosHits = activePegsCount * 0.40;
  let avgPegValue = totalBasePegValue / activePegsCount;
  let expectedChaosRaw = expectedChaosHits * avgPegValue * (maxContainerMult * 0.5) * 3.0;
  
  levelScoreK = expectedChaosRaw * 1111;
  if (levelScoreK < 2000) levelScoreK = 2000;
}

// --- 5. PHYSICS & CCD (OPTIMIZED + MUTUAL GRAVITY) ---
function updateBallPhysics() {
  buildSpatialGrid();
  let gravity = 0.02; let dt = 1.0 / 4.0;
  
  for (let step = 0; step < 4; step++) {
    // 1. ELITE MUTUAL GRAVITY (O(N) Spatial Hash)
    if (balls.length >= 2) {
      let ballGrid = {};
      for (let i = 0; i < balls.length; i++) {
        if (ballStates[i] !== 'active') continue;
        let k = ((balls[i].x / GRID_SIZE) | 0) + ',' + ((balls[i].y / GRID_SIZE) | 0);
        if (!ballGrid[k]) ballGrid[k] = [];
        ballGrid[k].push(i);
      }

      let G_const = 75.57; // Weak but obvious
      let epsilon = 12.0;  // Plummer softening to preserve perfectly elastic collisions

      for (let i = 0; i < balls.length; i++) {
        if (ballStates[i] !== 'active') continue;
        let b1 = balls[i];
        let cx = (b1.x / GRID_SIZE) | 0;
        let cy = (b1.y / GRID_SIZE) | 0;

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            let cell = ballGrid[cx + dx + ',' + (cy + dy)];
            if (!cell) continue;
            for (let ci = 0; ci < cell.length; ci++) {
              let j = cell[ci];
              if (i === j) continue;
              let b2 = balls[j];

              let dX = b2.x - b1.x;
              let dY = b2.y - b1.y;
              let d2 = dX * dX + dY * dY;

              if (d2 < b1.gravityRadius * b1.gravityRadius && d2 > 0.1) {
                let d = Math.sqrt(d2);
                let force = G_const / (d2 + epsilon * epsilon);
                
                b1.vx += (dX / d) * force;
                b1.vy += (dY / d) * force;
              }
            }
          }
        }
      }
    }

    // 2. Standard Physics Integration
    for (let i = 0; i < balls.length; i++) {
      if (ballStates[i] !== 'active') continue;
      let b = balls[i];
      ballPrevPos[i].x = b.x; ballPrevPos[i].y = b.y;
      
      let gMod = invertedGravityBalls.has(i) ? -1 : 1;
      let spdMod = isInSlowMotion(i) ? 0.4 : 1.0;
      b.vy += gravity * gMod * dt * spdMod;
      
      for (let gw of gravityWells) {
        let d = dist(b.x, b.y, gw.x, gw.y);
        if (d < gw.radius && d > 1) {
          let f = gw.force * (gw.radius - d) / gw.radius;
          b.vx += (gw.x - b.x) / d * f * dt; b.vy += (gw.y - b.y) / d * f * dt;
        }
      }
      
      for (let sw of shieldWalls) {
        if (b.y + BALL_RADIUS > sw.y && b.y - BALL_RADIUS < sw.y + 5 && b.x > sw.l && b.x < sw.r) {
          b.vy = -abs(b.vy); b.y = sw.y - BALL_RADIUS;
        }
      }
      
      let spd = sqrt(b.vx * b.vx + b.vy * b.vy);
      if (spd > MAX_BALL_SPEED) { b.vx = b.vx / spd * MAX_BALL_SPEED; b.vy = b.vy / spd * MAX_BALL_SPEED; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      
      checkBallPegCollisionsCCD(i);
      checkBallWallCollisions(i);
      checkBallFloorCollision(i);
    }
    
    // 3. Perfectly Elastic Ball-to-Ball Collisions
    handleBallBallCollisions();
  }
}

function buildSpatialGrid() {
  spatialGrid = {};
  for (let i = 0; i < pegs.length; i++) {
    if (!pegs[i] || !pegs[i].active) continue;
    let k = ((pegs[i].x / GRID_SIZE) | 0) + ',' + ((pegs[i].y / GRID_SIZE) | 0);
    if (!spatialGrid[k]) spatialGrid[k] = [];
    spatialGrid[k].push(i);
  }
}

function checkBallPegCollisionsCCD(bi) {
  let b = balls[bi], p = ballPrevPos[bi];
  let cx = (b.x / GRID_SIZE) | 0;
  let cy = (b.y / GRID_SIZE) | 0;
  
  for (let dx = -1; dx <= 1; dx++) {
    let cellX = cx + dx;
    for (let dy = -1; dy <= 1; dy++) {
      let cell = spatialGrid[cellX + ',' + (cy + dy)];
      if (!cell) continue;
      for (let ci = 0; ci < cell.length; ci++) {
        let pid = cell[ci], peg = pegs[pid];
        if (!peg || !peg.active) continue;
        let c = lineCircleIntersection(p.x, p.y, b.x, b.y, peg.x, peg.y, BALL_RADIUS + PEG_RADIUS);
        if (c.hit) {
          b.x = c.x + c.nx * 0.5; b.y = c.y + c.ny * 0.5;
          let dot = b.vx * c.nx + b.vy * c.ny;
          b.vx = b.vx - 2 * dot * c.nx; b.vy = b.vy - 2 * dot * c.ny;
          recordPegHit(pid);
          p.x = b.x; p.y = b.y;
        }
      }
    }
  }
}

function lineCircleIntersection(x1, y1, x2, y2, cx, cy, r) {
  let dx = x2 - x1, dy = y2 - y1, fx = x1 - cx, fy = y1 - cy;
  let a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < 0 || a < 0.0001) return { hit: false };
  disc = sqrt(disc);
  let t1 = (-b - disc) / (2 * a), t2 = (-b + disc) / (2 * a);
  let t = -1;
  if (t1 >= 0 && t1 <= 1) t = t1; else if (t2 >= 0 && t2 <= 1) t = t2;
  if (t < 0) {
    let ds = fx * fx + fy * fy;
    if (ds < r * r) return { hit: true, x: x1, y: y1, nx: fx / sqrt(ds), ny: fy / sqrt(ds), t: 0 };
    return { hit: false };
  }
  let hx = x1 + t * dx, hy = y1 + t * dy, nx = hx - cx, ny = hy - cy, nl = sqrt(nx * nx + ny * ny);
  if (nl < 0.001) nl = 0.001; nx /= nl; ny /= nl;
  return { hit: true, x: hx, y: hy, nx: nx, ny: ny, t: t };
}

function checkBallWallCollisions(i) {
  let b = balls[i];
  if (b.x - BALL_RADIUS < SIDE_MARGIN) { b.x = SIDE_MARGIN + BALL_RADIUS; b.vx = abs(b.vx); }
  if (b.x + BALL_RADIUS > responsive.boardW - SIDE_MARGIN) { b.x = responsive.boardW - SIDE_MARGIN - BALL_RADIUS; b.vx = -abs(b.vx); }
}

function checkBallFloorCollision(i) {
  let b = balls[i], by = getBottomY();
  if (b.y + BALL_RADIUS > by + CONTAINER_HEIGHT) {
    let c = findContainerAt(b.x); if (c < 0) c = findClosestContainer(b.x);
    ballStates[i] = 'settled'; ballContainers[i] = c;
    spawnEffectParticles(b.x, by + CONTAINER_HEIGHT - 10, 0, 255, 200, 10);
  }
  if (b.y > responsive.boardH + 100 || b.x < -100 || b.x > responsive.boardW + 100) ballStates[i] = 'lost';
}

function handleBallBallCollisions() {
  let len = balls.length;
  for (let i = 0; i < len; i++) {
    if (ballStates[i] !== 'active') continue;
    let b1 = balls[i];
    for (let j = i + 1; j < len; j++) {
      if (ballStates[j] !== 'active') continue;
      let b2 = balls[j];
      let dx = b2.x - b1.x, dy = b2.y - b1.y;
      let d2 = dx * dx + dy * dy;
      let md = b1.radius + b2.radius;
      let md2 = md * md;
      
      if (d2 < md2 && d2 > 0.001) {
        let d = sqrt(d2);
        let nx = dx / d, ny = dy / d;
        let dvx = b1.vx - b2.vx, dvy = b1.vy - b2.vy;
        let dvn = dvx * nx + dvy * ny;
        if (dvn > 0) {
          // Perfectly elastic collision for uniform mass
          b1.vx -= dvn * nx; b1.vy -= dvn * ny;
          b2.vx += dvn * nx; b2.vy += dvn * ny;
          let ov = (md - d) / 2 + 0.5;
          b1.x -= nx * ov; b1.y -= ny * ov;
          b2.x += nx * ov; b2.y += ny * ov;
        }
      }
    }
  }
}

function findContainerAt(x) {
  for (let i = 0; i < containers.length; i++) if (x >= containers[i].left && x <= containers[i].right) return i;
  return -1;
}
function findClosestContainer(x) {
  let b = 0, md = Infinity;
  for (let i = 0; i < containers.length; i++) { let d = abs(x - containers[i].cx); if (d < md) { md = d; b = i; } }
  return b;
}

// --- 6. SPECIAL PEGS & SCORING ---
function recordPegHit(id) {
  if (!pegData[id] || !pegs[id] || !pegs[id].active) return;
  pegHitCounts[id]++; hitPegIds.add(id); glowPegs[id] = 35;
  spawnHitParticles(pegs[id].x, pegs[id].y, pegs[id]);
  
  if (pegs[id].isSpecial) {
    handleSpecialPegHit(pegs[id], id);
  } else {
    if (pegHitCounts[id] >= 5) {
      clearPegWithScoring(id);
    }
  }
}

function handleSpecialPegHit(peg, id) {
  let hc = pegHitCounts[id], mh = pegMaxHits[id];
  if (effectsThisFrame < 8 && hc <= mh) { triggerSpecial(peg.specialIdx, peg); effectsThisFrame++; }
  if (hc >= mh) clearPegWithScoring(id);
}

function triggerSpecial(idx, peg) {
  if (idx === 0) spawnHexBalls(peg.x);
  else if (idx === 1) spawnTriangleBalls();
  else if (idx === 2) removeHexRegion(peg);
  else if (idx === 3) { yellowActive = true; for(let i=0;i<pegs.length;i++) if(pegs[i]&&pegs[i].active) pegMultipliers[pegs[i].id] = random(2, 12); }
  else if (idx === 4) fractalSplit(peg.x, peg.y);
  else if (idx === 5) verticalCascade(peg.col);
  else if (idx === 6) spawnVortexBalls(peg.x);
  else if (idx === 7) spawnEffectParticles(peg.x, peg.y, 255, 140, 50, 15);
  else if (idx === 8) gravityWells.push({ x: peg.x, y: peg.y, radius: 120, force: 0.15, life: 90 }); // Purple peg remains unchanged
}

function spawnHexBalls(cx) {
  let cy = TOP_MARGIN - 20, r = PEG_SPACING * 0.9;
  for (let i = 0; i < 6; i++) { let a = i * Math.PI / 3; createBall(cx + r * cos(a), cy + r * sin(a), random(-2, 2), random(2, 4)); }
  spawnEffectParticles(cx, cy, 255, 80, 80, 25);
}
function spawnTriangleBalls() {
  let cx = random(responsive.boardW * 0.25, responsive.boardW * 0.75), cy = TOP_MARGIN - 20, s = PEG_SPACING * 0.7;
  for (let row = 0; row < 4; row++) {
    let n = row + 1, ox = cx - (n - 1) * s / 2;
    for (let c = 0; c < n; c++) createBall(ox + c * s, cy + row * s * 0.866, random(-1.5, 1.5), random(2, 3.5));
  }
  spawnEffectParticles(cx, cy, 80, 255, 80, 30);
}
function removeHexRegion(centerPeg) {
  let rad = floor(random(2, 6));
  for (let i = 0; i < pegs.length; i++) {
    if (!pegs[i] || !pegs[i].active) continue;
    let q1 = pegs[i].col - floor(pegs[i].row / 2), q2 = centerPeg.col - floor(centerPeg.row / 2);
    let x1 = q1, z1 = pegs[i].row, y1 = -x1 - z1, x2 = q2, z2 = centerPeg.row, y2 = -x2 - z2;
    let d = max(abs(x1 - x2), abs(y1 - y2), abs(z1 - z2));
    if (d <= rad) removePeg(i);
  }
  spawnEffectParticles(centerPeg.x, centerPeg.y, 80, 80, 255, 35);
}
function fractalSplit(x, y) {
  for (let i = 0; i < 4; i++) { let a = i * Math.PI / 2 + random(-0.4, 0.4); createBall(x, y - 15, cos(a) * 4, sin(a) * 3 + 1); }
  spawnEffectParticles(x, y, 0, 255, 255, 20);
}
function verticalCascade(col) {
  for (let i = 0; i < pegs.length; i++) if (pegs[i] && pegs[i].active && pegs[i].col === col) removePeg(i);
}
function spawnVortexBalls(cx) {
  let cy = TOP_MARGIN - 20;
  for (let i = 0; i < 8; i++) {
    let a = i * Math.PI / 4, r = 15 + i * 4;
    createBall(cx + r * cos(a), cy + r * sin(a), cos(a + Math.PI / 2) * 3, sin(a + Math.PI / 2) * 3 + 2);
  }
  spawnEffectParticles(cx, cy, 255, 0, 255, 30);
}

function removePeg(id) {
  if (!pegs[id]) return;
  removedPegValues[id] = pegs[id].value; removedPegIds.add(id);
  spawnRemoveParticles(pegs[id].x, pegs[id].y, false); pegs[id].active = false;
  triggerShake(pegs[id].value * 0.5);
}
function clearPegWithScoring(id) {
  if (!pegs[id] || !pegs[id].active) return;
  removedPegValues[id] = pegs[id].value; removePeg(id);
}

function isInSlowMotion(i) {
  if (slowMotionZones.length === 0) return false;
  for (let z of slowMotionZones) if (dist(balls[i].x, balls[i].y, z.x, z.y) < z.radius) return true;
  return false;
}

// --- 7. CAMERA & ZOOM (DYNAMIC BOUNDING BOX FIT) ---
function calculateBoardBounds() {
  boardBounds.x = SIDE_MARGIN; 
  boardBounds.y = LAUNCH_Y - 40; // ZOOM ACCOUNTING: Extended upward to include the higher launcher
  boardBounds.w = responsive.boardW - SIDE_MARGIN * 2;
  boardBounds.h = getBottomY() + CONTAINER_HEIGHT - boardBounds.y;
  
  let rawZoom = min(responsive.boardW / boardBounds.w, responsive.boardH / boardBounds.h);
  minZoomToFit = min(1.0, rawZoom); 
}

function updateCamera() {
  let highestBallY = responsive.boardH + 1000;
  let hasActiveBall = false;
  
  for (let i = 0; i < balls.length; i++) {
    if (ballStates[i] === 'active') {
      if (balls[i].y < highestBallY) highestBallY = balls[i].y;
      hasActiveBall = true;
    }
  }
  
  if (!hasActiveBall) {
    targetZoom = minZoomToFit;
    targetOffsetY = 0; 
  } else {
    let viewTop = highestBallY - 60; 
    let viewBottom = boardBounds.y + boardBounds.h + 60;
    let requiredHeight = viewBottom - viewTop;
    let requiredWidth = boardBounds.w;
    
    let zoomForHeight = responsive.boardH / requiredHeight;
    let zoomForWidth = responsive.boardW / requiredWidth;
    
    targetZoom = min(zoomForHeight, zoomForWidth);
    targetZoom = constrain(targetZoom, 0.35, minZoomToFit);
    
    let viewCenterY = (viewTop + viewBottom) / 2.0;
    let screenCenterY = responsive.boardH / 2.0;
    targetOffsetY = screenCenterY - (viewCenterY * targetZoom);
    
    let hvH = responsive.boardH / (2 * targetZoom);
    let minYA = (boardBounds.y - hvH + 20) * targetZoom - screenCenterY;
    let maxYA = (boardBounds.y + boardBounds.h - hvH - 20) * targetZoom - screenCenterY;
    targetOffsetY = constrain(targetOffsetY, -maxYA, -minYA);
    
    if (launchZoomBoost > 0) { 
      targetZoom = min(minZoomToFit, targetZoom + launchZoomBoost); 
      launchZoomBoost *= 0.85; 
      if (launchZoomBoost < 0.01) launchZoomBoost = 0; 
    }
  }
  
  let activeBall = balls.find((b, i) => ballStates[i] === 'active');
  let ballSpeed = activeBall ? sqrt(activeBall.vx * activeBall.vx + activeBall.vy * activeBall.vy) : 0;
  
  let smoothFactor = lerp(0.08, 0.18, constrain(ballSpeed / MAX_BALL_SPEED, 0, 1));
  currentZoom = lerp(currentZoom, targetZoom, smoothFactor);
  cameraOffsetY = lerp(cameraOffsetY, targetOffsetY, smoothFactor);
}

function triggerShake(amount) {
  shakeAmount = max(shakeAmount, amount);
}

// --- 8. GAME LOOP ---
function updateGame() {
  effectsThisFrame = 0;
  shakeAmount *= SHAKE_DECAY;
  if (shakeAmount < 0.1) shakeAmount = 0;
  
  for (let i = gravityWells.length - 1; i >= 0; i--) { gravityWells[i].life--; if (gravityWells[i].life <= 0) gravityWells.splice(i, 1); }
  for (let i = slowMotionZones.length - 1; i >= 0; i--) { slowMotionZones[i].life--; if (slowMotionZones[i].life <= 0) slowMotionZones.splice(i, 1); }
  for (let i = shieldWalls.length - 1; i >= 0; i--) { shieldWalls[i].life--; if (shieldWalls[i].life <= 0) shieldWalls.splice(i, 1); }
  if (invertedGravityBalls.size > 0 && settleTimer > 0) invertedGravityBalls.clear();
  
  updateGlowTimers(); 
  updateParticles(); 
  
  if (gameState === STATE_FLIGHT || gameState === STATE_SETTLE) { updateBallPhysics(); updateTrails(); updateCamera(); }
  if (gameState === STATE_FLIGHT && checkAllBallsSettled()) { gameState = STATE_SETTLE; settleTimer = 0; }
  if (gameState === STATE_SETTLE) { settleTimer++; if (settleTimer > 90 || checkAllBallsSettled()) finalize(); }
}

function checkAllBallsSettled() {
  if (balls.length === 0) return false;
  for (let i = 0; i < ballStates.length; i++) if (ballStates[i] === 'active') return false;
  return true;
}

function finalize() {
  if (scored) return;
  scored = true; gameState = STATE_FINAL;
  computeRunScore(); 
  
  totalScore += runScore; 
  totalScore = min(MAX_LEVEL_SCORE, totalScore);
  levelScore = totalScore; 
  
  removeHitPegs(); flashTimer = 60; shotsRemaining--;
}

function computeRunScore() {
  let ps = 0, th = 0, up = 0;
  for (let id = 0; id < pegHitCounts.length; id++) {
    let hits = pegHitCounts[id]; if (hits <= 0) continue;
    th += hits; up++;
    let pv = pegData[id] ? pegData[id].value : (removedPegValues[id] || 5);
    ps += pv * hits * pegMultipliers[id] * chainMult;
  }
  
  let cm = 0, sc = 0;
  for (let j = 0; j < ballContainers.length; j++) {
    let c = ballContainers[j]; 
    if (c >= 0 && c < containerMultipliers.length) { cm += containerMultipliers[c]; sc++; }
  }
  
  let rawScore = ps * max(cm, 1);
  let K = levelScoreK;
  runScore = MAX_LEVEL_SCORE * (2.0 / Math.PI) * Math.atan(rawScore / K);
  runScore = min(MAX_LEVEL_SCORE, runScore);
  
  hud.score = runScore; 
  hud.totalHits = th; 
  hud.pegCount = up; 
  hud.ballsSettled = sc; 
  hud.ballsTotal = ballContainers.length; 
  hud.multiplier = round(max(cm, 1) * 10) / 10;
  chainMult = 1.0;
}

function removeHitPegs() {
  hitPegIds.forEach(function(id) {
    if (pegs[id] && pegs[id].active) {
      removedPegValues[id] = pegs[id].value; removedPegIds.add(id);
      spawnRemoveParticles(pegs[id].x, pegs[id].y, false); pegs[id].active = false;
    }
  });
}

function updateGlowTimers() {
  let k = Object.keys(glowPegs);
  for (let i = 0; i < k.length; i++) { glowPegs[k[i]]--; if (glowPegs[k[i]] <= 0) delete glowPegs[k[i]]; }
}

function updateParticles() {
  for (let i = activeParticleCount - 1; i >= 0; i--) {
    let p = particlePool[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life--;
    if (p.life <= 0) {
      p.active = false;
      if (i !== activeParticleCount - 1) {
        let temp = particlePool[i];
        particlePool[i] = particlePool[activeParticleCount - 1];
        particlePool[activeParticleCount - 1] = temp;
      }
      activeParticleCount--;
    }
  }
}

function updateTrails() {
  // Kept for internal logic consistency, but drawing is disabled for CPU optimization
  for (let i = 0; i < balls.length; i++) {
    if (ballStates[i] !== 'active') continue;
    if (!trailPoints[i]) trailPoints[i] = [];
    trailPoints[i].push({ x: balls[i].x, y: balls[i].y, life: 25 });
    if (trailPoints[i].length > 30) trailPoints[i].shift();
  }
  for (let j = 0; j < trailPoints.length; j++) {
    if (!trailPoints[j]) continue;
    for (let k = trailPoints[j].length - 1; k >= 0; k--) {
      trailPoints[j][k].life--; if (trailPoints[j][k].life <= 0) trailPoints[j].splice(k, 1);
    }
  }
}

function launchBall() {
  if (gameState !== STATE_AIM || balls.length > 0 || shotsRemaining <= 0) return;
  balls = []; ballPrevPos = []; ballStates = []; ballContainers = []; trailPoints = [];
  pegHitCounts.fill(0); hitPegIds.clear(); scored = false; runScore = 0;
  
  let sx = responsive.boardW / 2;
  let sy = LAUNCH_Y; // 200px higher
  
  if (launchMode === 0) {
    createBall(sx, sy, aimAngle * 6, 3.5);
  } else {
    let a = random(Math.PI/2 - 0.8, Math.PI/2 + 0.8);
    createBall(sx, sy, cos(a) * 5, sin(a) * 5);
  }
  
  gameState = STATE_FLIGHT; settleTimer = 0; launchZoomBoost = 0.25; shotsRemaining--;
}

function createBall(x, y, vx, vy) {
  balls.push({ 
    x: x, y: y, vx: vx, vy: vy, radius: BALL_RADIUS, 
    gravityRadius: random(100, 150) // Interaction cutoff
  });
  ballPrevPos.push({ x: x, y: y });
  ballStates.push('active');
  ballContainers.push(-1);
  trailPoints.push([]);
  return balls[balls.length - 1];
}

// --- 9. DRAWING (CPU OPTIMIZED) ---
function draw() {
  background(8, 8, 28);
  updateGame();
  
  push();
  translate(responsive.offsetX, responsive.offsetY);
  scale(responsive.scale);
  
  push();
  if (shakeAmount > 0) {
    translate(random(-shakeAmount, shakeAmount), random(-shakeAmount, shakeAmount));
  }
  translate(0, cameraOffsetY);
  scale(currentZoom);
  
  drawPegs(); drawContainers(); drawBalls(); drawParticles(); drawWalls();
  // drawTrails() intentionally omitted for CPU optimization
  pop();
  
  drawHUD();
  if (launchMode === 0 || isDragging) drawAim();
  drawStateInfo();
  drawZoomIndicator();
  pop();
}

function drawPegs() { for (let i = 0; i < pegs.length; i++) if (pegs[i] && pegs[i].active) drawPeg(pegs[i], i); }
function drawPeg(pg, id) {
  let hc = pegHitCounts[id] || 0;
  // drawPegGlow intentionally omitted for CPU optimization
  drawPegBody(pg, id, hc); drawPegHitInfo(pg, hc, id);
}

function drawPegBody(pg, id, hc) {
  noStroke();
  let col = pg.isSpecial ? SPECIALS[pg.specialIdx] : (hc > 0 ? { r: 255, g: 150, b: 50 } : { r: map(pg.row, 0, numRows, 140, 280) % 256, g: 180, b: 255 });
  fill(col.r, col.g, col.b);
  ellipse(pg.x, pg.y, PEG_RADIUS * 2);
  fill(255, 255, 255, 160);
  ellipse(pg.x - 1.2, pg.y - 1.2, PEG_RADIUS * 0.75);
  if (yellowActive && pegMultipliers[id]) {
    fill(255, 255, 0); noStroke(); textSize(7); textAlign(CENTER, CENTER);
    text(round(pegMultipliers[id]) + 'x', pg.x, pg.y + PEG_RADIUS * 2.8);
  }
}

function drawPegHitInfo(pg, hc, id) {
  if (hc <= 0 && !pg.isSpecial) return;
  fill(255, 255, 255); noStroke(); textSize(8); textAlign(CENTER, CENTER);
  if (hc > 1) text('x' + hc, pg.x, pg.y);
  if (pg.isSpecial) {
    let mh = pegMaxHits[id], r = mh - hc;
    if (r > 0) { fill(255, 100, 100); textSize(6); text(r, pg.x + 10, pg.y - 6); }
  }
}

function drawContainers() {
  let by = getBottomY();
  for (let i = 0; i < containers.length; i++) drawContainer(containers[i], i, by);
  drawContainerDividers(by);
}
function drawContainer(c, idx, by) {
  let sh = countBallsInContainer(idx), ia = sh > 0;
  noStroke();
  let m = containerMultipliers[idx], it = map(log(m + 1), log(2), log(2000), 30, 220);
  if (ia && flashTimer > 0) fill(255, 255, 100, 150 + sin(flashTimer * 0.5) * 100);
  else if (ia) fill(100, 255, 150, 130);
  else fill(it, 50, 220 - it, 85);
  rect(c.left, by, c.w, CONTAINER_HEIGHT);
  fill(255); noStroke(); textAlign(CENTER, CENTER); textSize(max(8, min(12, 650 / containers.length * 0.24)));
  let txt = m >= 1000 ? (m / 1000).toFixed(1) + 'K' : (m >= 10 ? round(m * 10) / 10 + 'x' : m.toFixed(1) + 'x');
  text(txt, c.cx, by + CONTAINER_HEIGHT / 2);
  if (sh > 0) { fill(255, 255, 0); textSize(11); text(sh, c.cx, by + 14); }
}
function countBallsInContainer(idx) { let c = 0; for (let i = 0; i < ballContainers.length; i++) if (ballContainers[i] === idx) c++; return c; }
function drawContainerDividers(by) {
  stroke(0, 255, 200, 160); strokeWeight(2);
  for (let i = 0; i < containers.length - 1; i++) { let x = containers[i].right; line(x, by, x, by + CONTAINER_HEIGHT); }
  line(SIDE_MARGIN, by, SIDE_MARGIN, by + CONTAINER_HEIGHT);
  line(responsive.boardW - SIDE_MARGIN, by, responsive.boardW - SIDE_MARGIN, by + CONTAINER_HEIGHT);
}

function drawBalls() { for (let i = 0; i < balls.length; i++) if (ballStates[i] === 'active') drawBall(balls[i]); }
function drawBall(b) {
  let skin = BALL_SKINS[currentBallSkin];
  noStroke();
  // CPU OPTIMIZATION: Removed glow layers
  fill(skin.c1[0], skin.c1[1], skin.c1[2]); 
  ellipse(b.x, b.y, BALL_RADIUS * 2);
  fill(skin.c2[0], skin.c2[1], skin.c2[2], 230); 
  ellipse(b.x - 1.2, b.y - 1.2, BALL_RADIUS * 0.65);
}

function drawParticles() {
  if (activeParticleCount === 0) return;
  let ctx = drawingContext;
  ctx.save();
  for (let i = 0; i < activeParticleCount; i++) {
    let p = particlePool[i];
    let al = p.life / p.maxLife; 
    ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${al})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.5, 0, 6.2831853);
    ctx.fill();
  }
  ctx.restore();
}

function drawWalls() {
  noStroke(); fill(30, 30, 60, 200);
  rect(0, 0, SIDE_MARGIN, responsive.boardH / responsive.scale);
  rect(responsive.boardW - SIDE_MARGIN, 0, SIDE_MARGIN, responsive.boardH / responsive.scale);
}

function drawHUD() {
  noStroke(); fill(0, 0, 0, 200); rect(0, 0, responsive.boardW, 160);
  fill(0, 255, 200); textSize(12); textAlign(LEFT, CENTER);
  let lname = layoutType === LAYOUT_TRIANGLE ? 'TRI' : (layoutType === LAYOUT_INVERTED ? 'INV' : 'HEX');
  let pname = ['FULL','HONEY','SPIRAL','CHECK','GRAD','DIAMOND','WAVE'][patternType] || '?';
  text('LVL ' + level + ' | ' + lname + ' | ' + pname, 14, 16);
  textAlign(RIGHT, CENTER); fill(255, 200, 50); text('SHOTS: ' + shotsRemaining + '/' + maxShots, responsive.boardW - 14, 16);
  fill(255, 200, 50); textSize(14); textAlign(LEFT, CENTER); text('TOTAL: ' + totalScore.toFixed(3), 14, 45);
  textAlign(CENTER, CENTER); fill(200); textSize(11);
  let act = 0; for(let i=0;i<ballStates.length;i++) if(ballStates[i]==='active') act++;
  text('BALLS: ' + act + ' | HITS: ' + getTotalHits(), responsive.boardW / 2, 45);
  textAlign(RIGHT, CENTER); fill(0, 255, 200); textSize(14); text('RUN: +' + runScore.toFixed(3), responsive.boardW - 14, 45);
  
  drawModeToggle();
  drawSettingsButtons();
  
  fill(180, 220, 255); textSize(10); textAlign(LEFT, CENTER); 
  text(launchMode === 0 ? 'MODE: DRAG TO AIM' : 'MODE: FLICK TO PITCH', 14, 62);
}

function drawModeToggle() {
  if (!modeToggle.visible) return;
  let h = isOverRect(modeToggle.x, modeToggle.y, modeToggle.w, modeToggle.h, responsive.virtualMouse.x, responsive.virtualMouse.y);
  noStroke(); fill(h ? color(0, 200, 255) : color(0, 120, 180)); rect(modeToggle.x, modeToggle.y, modeToggle.w, modeToggle.h, 6);
  stroke(255, 255, 255, 150); strokeWeight(1); noFill(); rect(modeToggle.x, modeToggle.y, modeToggle.w, modeToggle.h, 6);
  noStroke(); fill(255); textSize(11); textAlign(CENTER, CENTER);
  text(launchMode === 0 ? 'AIM MODE' : 'PITCH MODE', modeToggle.x + modeToggle.w / 2, modeToggle.y + modeToggle.h / 2);
}

function drawSettingsButtons() {
  let sBtn = settingsBtns.skin;
  let sHov = isOverRect(sBtn.x, sBtn.y, sBtn.w, sBtn.h, responsive.virtualMouse.x, responsive.virtualMouse.y);
  noStroke(); fill(sHov ? color(100, 100, 200) : color(50, 50, 150)); 
  rect(sBtn.x, sBtn.y, sBtn.w, sBtn.h, 5);
  fill(255); textSize(10); textAlign(CENTER, CENTER); 
  text('SKIN: ' + BALL_SKINS[currentBallSkin].name, sBtn.x + sBtn.w/2, sBtn.y + sBtn.h/2);
}

function drawZoomIndicator() {
  if (abs(currentZoom - 1.0) > 0.1) {
    fill(255, 255, 255, 180); noStroke(); textSize(10); textAlign(RIGHT, BOTTOM);
    text('ZOOM: ' + round(currentZoom * 100) + '%', responsive.boardW - 10, responsive.boardH - 10);
  }
}

function drawAim() {
  if (gameState !== STATE_AIM) return;
  let sx = responsive.boardW / 2;
  let sy = LAUNCH_Y; // 200px higher
  
  if (isDragging) {
    stroke(255, 255, 0, 150); strokeWeight(3);
    line(sx, sy, dragEnd.x, dragEnd.y);
    
    let angle, power;
    if (launchMode === 0) {
      angle = aimAngle + Math.PI/2;
      power = 5; 
    } else {
      let dx = dragEnd.x - dragStart.x;
      let dy = dragEnd.y - dragStart.y;
      angle = atan2(dy, dx);
      let dist = sqrt(dx*dx + dy*dy);
      power = map(dist, 0, 300, 0, MAX_BALL_SPEED, true);
    }
    
    stroke(255, 255, 255, 100); strokeWeight(2);
    let len = power * 20;
    line(sx, sy, sx + cos(angle) * len, sy + sin(angle) * len);
    
    fill(255, 255, 0, 210); noStroke();
    ellipse(sx, sy, BALL_RADIUS * 4);
  } else {
    let ax = sx + aimAngle * 120;
    let ay = sy;
    stroke(255, 255, 0, 190); strokeWeight(2.5);
    line(ax, ay, ax + aimAngle * 50, ay + 25);
    noStroke(); fill(255, 255, 0, 210);
    ellipse(ax, ay, BALL_RADIUS * 4);
  }
  
  fill(255, 255, 255, 210); textAlign(CENTER, CENTER); textSize(14);
  let msg = isDragging ? 'RELEASE TO LAUNCH' : (launchMode === 0 ? 'DRAG TO AIM' : 'FLICK TO PITCH');
  text(msg, responsive.boardW / 2, responsive.boardH - 25);
}

function drawStateInfo() {
  if (gameState === STATE_FINAL) drawShotResult();
  if (gameState === STATE_LEVEL_COMPLETE) drawLevelComplete();
  if (gameState === STATE_GAMEOVER) drawGameOver();
  if (flashTimer > 0) flashTimer--;
}

function drawShotResult() {
  drawOverlayBox(360, 280);
  noStroke(); fill(0, 255, 200); textAlign(CENTER, CENTER); textSize(24);
  text('RUN SCORE: +' + runScore.toFixed(3), responsive.boardW / 2, responsive.boardH / 2 - 105);
  fill(255, 200, 50); textSize(16); text('TOTAL: ' + totalScore.toFixed(3), responsive.boardW / 2, responsive.boardH / 2 - 75);
  fill(200); textSize(12); text('Hits: ' + hud.totalHits + ' | Pegs: ' + hud.pegCount, responsive.boardW / 2, responsive.boardH / 2 - 50);
  fill(150); text('Shots: ' + shotsRemaining, responsive.boardW / 2, responsive.boardH / 2 + 10);
  drawContinueButton();
}
function drawOverlayBox(w, h) {
  noStroke(); fill(0, 0, 0, 220); rect(responsive.boardW / 2 - w / 2, responsive.boardH / 2 - h / 2, w, h, 12);
  stroke(0, 255, 200, 180); strokeWeight(2); noFill(); rect(responsive.boardW / 2 - w / 2, responsive.boardH / 2 - h / 2, w, h, 12);
}
function drawContinueButton() {
  let bx = responsive.boardW / 2 - 65, by = responsive.boardH / 2 + 55, bw = 130, bh = 38;
  let h = isOverRect(bx, by, bw, bh, responsive.virtualMouse.x, responsive.virtualMouse.y);
  noStroke(); fill(h ? color(0, 255, 200) : color(0, 180, 150)); rect(bx, by, bw, bh, 8);
  fill(0); textSize(14); textAlign(CENTER, CENTER); text(shotsRemaining > 0 ? 'CONTINUE' : 'RESULTS', responsive.boardW / 2, by + bh / 2);
}
function drawLevelComplete() {
  drawOverlayBox(360, 280);
  noStroke(); fill(100, 255, 150); textAlign(CENTER, CENTER); textSize(28);
  text('LEVEL ' + level + ' COMPLETE!', responsive.boardW / 2, responsive.boardH / 2 - 100);
  fill(255, 200, 50); textSize(16); text('Lvl Score: ' + levelScore.toFixed(3), responsive.boardW / 2, responsive.boardH / 2 - 65);
  fill(0, 255, 200); textSize(22); text('TOTAL: ' + totalScore.toFixed(3), responsive.boardW / 2, responsive.boardH / 2 - 35);
  drawLevelCompleteButtons();
}
function drawLevelCompleteButtons() {
  let bw = 120, gap = 15, bx1 = responsive.boardW / 2 - bw - gap / 2, bx2 = responsive.boardW / 2 + gap / 2, by = responsive.boardH / 2 + 40;
  noStroke(); fill(isOverRect(bx1, by, bw, 38, responsive.virtualMouse.x, responsive.virtualMouse.y) ? color(0, 255, 200) : color(0, 180, 150)); rect(bx1, by, bw, 38, 8);
  fill(isOverRect(bx2, by, bw, 38, responsive.virtualMouse.x, responsive.virtualMouse.y) ? color(255, 100, 100) : color(200, 80, 80)); rect(bx2, by, bw, 38, 8);
  fill(0); textSize(13); textAlign(CENTER, CENTER); text('NEXT LEVEL', bx1 + bw / 2, by + 19);
  fill(255); text('END RUN', bx2 + bw / 2, by + 19);
}
function drawGameOver() {
  drawOverlayBox(380, 300);
  noStroke(); fill(255, 100, 80); textAlign(CENTER, CENTER); textSize(32); text('GAME OVER', responsive.boardW / 2, responsive.boardH / 2 - 110);
  fill(255); textSize(16); text('Final Lvl: ' + level, responsive.boardW / 2, responsive.boardH / 2 - 75);
  fill(255, 200, 50); textSize(18); text('FINAL SCORE', responsive.boardW / 2, responsive.boardH / 2 - 45);
  fill(0, 255, 200); textSize(48); text(totalScore.toFixed(3), responsive.boardW / 2, responsive.boardH / 2 + 5);
  drawPlayAgainButton();
}
function drawPlayAgainButton() {
  let bx = responsive.boardW / 2 - 75, by = responsive.boardH / 2 + 60, bw = 150, bh = 42;
  let h = isOverRect(bx, by, bw, bh, responsive.virtualMouse.x, responsive.virtualMouse.y);
  noStroke(); fill(h ? color(255, 120, 80) : color(220, 90, 60)); rect(bx, by, bw, bh, 8);
  fill(255); textSize(16); textAlign(CENTER, CENTER); text('PLAY AGAIN', responsive.boardW / 2, by + bh / 2);
}

function isOverRect(rx, ry, rw, rh, vx, vy) { return vx > rx && vx < rx + rw && vy > ry && vy < ry + rh; }

function getTotalHits() { 
  let t = 0; 
  for (let i = 0; i < pegHitCounts.length; i++) t += pegHitCounts[i]; 
  return t; 
}

function spawnHitParticles(x, y, p) {
  let c = p.isSpecial ? 12 : 6;
  let col = p.isSpecial ? SPECIALS[p.specialIdx] : { r: 255, g: 100, b: 50 };
  for (let i = 0; i < c; i++) {
    let idx = getFreeParticle(); if (idx < 0) break;
    let p2 = particlePool[idx]; p2.active = true; p2.x = x; p2.y = y;
    p2.vx = random(-3.5, 3.5); p2.vy = random(-4.5, 1);
    p2.life = p2.maxLife = random(18, 35);
    p2.r = col.r; p2.g = col.g; p2.b = col.b; p2.size = random(2.5, 5.5);
  }
}
function spawnRemoveParticles(x, y, ig) {
  let c = ig ? 18 : 10, r = ig ? 255 : 255, g = ig ? 215 : 150, b = ig ? 0 : 50;
  for (let i = 0; i < c; i++) {
    let idx = getFreeParticle(); if (idx < 0) break;
    let p = particlePool[idx]; p.active = true; p.x = x; p.y = y;
    p.vx = random(-5, 5); p.vy = random(-6, 0);
    p.life = p.maxLife = random(22, 45);
    p.r = r; p.g = g; p.b = b; p.size = random(3.5, 8);
  }
}
function spawnEffectParticles(x, y, r, g, b, n) {
  for (let i = 0; i < n; i++) {
    let idx = getFreeParticle(); if (idx < 0) break;
    let p = particlePool[idx]; p.active = true; p.x = x; p.y = y;
    p.vx = random(-6, 6); p.vy = random(-6, 4);
    p.life = p.maxLife = random(22, 45);
    p.r = r; p.g = g; p.b = b; p.size = random(3.5, 8);
  }
}

function getFreeParticle() {
  if (activeParticleCount >= MAX_PARTICLES) return -1;
  let idx = activeParticleCount;
  activeParticleCount++;
  return idx;
}

function continueAfterShot() {
  if (shotsRemaining <= 0) {
    gameState = STATE_LEVEL_COMPLETE;
  } else if (countRemainingPegs() === 0) {
    let clearBonus = 500.00;
    totalScore += clearBonus;
    totalScore = min(MAX_LEVEL_SCORE, totalScore);
    levelScore = totalScore;
    gameState = STATE_LEVEL_COMPLETE;
  } else {
    prepareNextShot();
  }
}

function countRemainingPegs() { 
  let c = 0; 
  for (let i = 0; i < pegs.length; i++) if (pegs[i] && pegs[i].active) c++; 
  return c; 
}

function prepareNextShot() {
  pegHitCounts.fill(0); hitPegIds.clear(); scored = false; runScore = 0;
  balls = []; ballPrevPos = []; ballStates = []; ballContainers = []; trailPoints = [];
  gameState = STATE_AIM;
}

// --- 10. INPUT (ROBUST MOBILE & DRAG SUPPORT) ---
function mousePressed() {
  updateMouse(mouseX, mouseY);
  let mx = responsive.virtualMouse.x, my = responsive.virtualMouse.y;
  
  if (modeToggle.visible && isOverRect(modeToggle.x, modeToggle.y, modeToggle.w, modeToggle.h, mx, my)) { toggleLaunchMode(); return; }
  if (isOverRect(settingsBtns.skin.x, settingsBtns.skin.y, settingsBtns.skin.w, settingsBtns.skin.h, mx, my)) { currentBallSkin = (currentBallSkin + 1) % BALL_SKINS.length; return; }
  
  if (gameState === STATE_AIM && shotsRemaining > 0) {
    isDragging = true;
    dragStart.x = mx; dragStart.y = my;
    dragEnd.x = mx; dragEnd.y = my;
    swipeStartTime = millis();
    return;
  }
  
  if (gameState === STATE_FINAL && isOverRect(responsive.boardW / 2 - 65, responsive.boardH / 2 + 55, 130, 38, mx, my)) { continueAfterShot(); }
  else if (gameState === STATE_LEVEL_COMPLETE) handleLevelCompleteClick(mx, my);
  else if (gameState === STATE_GAMEOVER && isOverRect(responsive.boardW / 2 - 75, responsive.boardH / 2 + 60, 150, 42, mx, my)) startNewGame();
}

function mouseDragged() {
  updateMouse(mouseX, mouseY);
  if (isDragging && gameState === STATE_AIM) {
    dragEnd.x = responsive.virtualMouse.x;
    dragEnd.y = responsive.virtualMouse.y;
    
    if (launchMode === 0) {
      let dx = dragEnd.x - responsive.boardW / 2;
      aimAngle = constrain(map(dx, -200, 200, -0.6, 0.6), -0.6, 0.6);
    }
  }
}

function mouseReleased() {
  if (isDragging && gameState === STATE_AIM) {
    isDragging = false;
    
    if (launchMode === 0) {
      launchBall();
    } else if (launchMode === 1) {
      let dx = dragEnd.x - dragStart.x;
      let dy = dragEnd.y - dragStart.y;
      let dist = sqrt(dx*dx + dy*dy);
      
      if (dist > 15) {
        let normalizedPower = constrain(dist / 300, 0, 1);
        let power = Math.pow(normalizedPower, 1.5) * MAX_BALL_SPEED;
        power = max(power, 3);
        
        let angle = atan2(dy, dx);
        let vx = cos(angle) * power;
        let vy = sin(angle) * power;
        
        if (vy < 1.5) vy = 1.5; 
        
        let sx = responsive.boardW / 2;
        let sy = LAUNCH_Y; // 200px higher
        createBall(sx, sy, vx, vy);
        
        gameState = STATE_FLIGHT;
        settleTimer = 0;
        launchZoomBoost = 0.25;
        shotsRemaining--;
        spawnEffectParticles(sx, sy, 255, 150, 0, 15);
      }
    }
  }
}

function touchStarted(event) {
  if (activeTouchId === null && event.touches.length > 0) {
    activeTouchId = event.touches[0].identifier;
    mouseX = event.touches[0].canvasX;
    mouseY = event.touches[0].canvasY;
    mousePressed();
  }
  return false;
}

function touchMoved(event) {
  if (activeTouchId !== null) {
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === activeTouchId) {
        mouseX = event.changedTouches[i].canvasX;
        mouseY = event.changedTouches[i].canvasY;
        mouseDragged();
        break;
      }
    }
  }
  return false;
}

function touchEnded(event) {
  if (activeTouchId !== null) {
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === activeTouchId) {
        mouseX = event.changedTouches[i].canvasX;
        mouseY = event.changedTouches[i].canvasY;
        mouseReleased();
        activeTouchId = null;
        break;
      }
    }
  }
  return false;
}

function toggleLaunchMode() {
  launchMode = (launchMode + 1) % 2;
  if (launchMode === 0) { aimAngle = 0; }
}

function handleLevelCompleteClick(mx, my) {
  let bw = 120, gap = 15, bx1 = responsive.boardW / 2 - bw - gap / 2, bx2 = responsive.boardW / 2 + gap / 2, by = responsive.boardH / 2 + 40;
  if (isOverRect(bx1, by, bw, 38, mx, my)) startNextLevel();
  else if (isOverRect(bx2, by, bw, 38, mx, my)) gameState = STATE_GAMEOVER;
}

function keyPressed() {
  if (key === 'r' || key === 'R') startNewGame();
  if (key === ' ') {
    if (gameState === STATE_AIM) launchBall();
    else if (gameState === STATE_FINAL) continueAfterShot();
    else if (gameState === STATE_LEVEL_COMPLETE) startNextLevel();
    else if (gameState === STATE_GAMEOVER) startNewGame();
  }
  if (key === 'm' || key === 'M') toggleLaunchMode();
}