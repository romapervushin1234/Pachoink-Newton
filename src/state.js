import { 
  STATE_AIM, MAX_SHOTS, LAUNCH_Y, MAX_LEVEL_SCORE, LEVEL_SCORE_K_MIN,
  CHAOS_HIT_RATIO, CHAOS_MULT, EXPECTED_MULT_RATIO, SETTLE_TIMER_MAX
} from './config.js';

export const state = {
  // Game progression
  level: 1,
  totalScore: 0.000,
  levelScore: 0.000,
  shotsRemaining: MAX_SHOTS,
  maxShots: MAX_SHOTS,
  gameState: STATE_AIM,
  scored: false,
  
  // Level generation
  layoutType: 0,
  numRows: 15,
  hexRadius: 2,
  patternType: 0,
  
  // World data
  pegs: [],
  containers: [],
  containerMultipliers: [],
  pegHitCounts: new Int16Array(15000),
  pegMaxHits: new Int16Array(15000),
  pegMultipliers: new Float32Array(15000),
  pegSkipMask: new Uint8Array(15000),
  
  // Ball tracking
  activeBallCount: 0,
  ballLaunched: false,
  
  // Physics tracking
  hitPegIds: new Set(),
  removedPegIds: new Set(),
  removedPegValues: {},
  
  // Board bounds
  boardBounds: { x: 0, y: -170, w: 800, h: 1000 },
  startY: 100,
  
  // Scoring
  levelScoreK: 2000,
  totalBasePegValue: 0,
  maxContainerMult: 1,
  runScore: 0,
  chainMult: 1.0,
  
  // Special mechanics
  yellowActive: false,
  glowPegs: {},
  
  // UI state
  flashTimer: 0,
  settleTimer: 0,
  shakeAmount: 0,
  
  // Aiming
  aimAngle: 0,
  launchMode: 0,
  isDragging: false,
  
  // Camera
  currentZoom: 1.0,
  targetZoom: 1.0,
  cameraOffsetY: 0,
  targetOffsetY: 0,
  launchZoomBoost: 0,
  
  // Ball skin
  currentBallSkin: 0,
  
  // Special effects tracking
  gravityWells: [],
  slowMotionZones: [],
  shieldWalls: [],
  invertedGravityBalls: new Set(),
  
  // Request ball launch (called from input)
  requestLaunch() {
    if (this.gameState !== STATE_AIM || this.ballLaunched || this.shotsRemaining <= 0) return false;
    this.ballLaunched = true;
    return true;
  }
};

export function resetRound() {
  state.pegs.forEach(p => { if(p) { p.currentHits = 0; p.active = true; } });
  state.pegHitCounts.fill(0);
  state.scored = false;
  state.levelScore = 0.000;
  state.flashTimer = 0;
  state.settleTimer = 0;
  state.runScore = 0;
  state.chainMult = 1.0;
  state.yellowActive = false;
  state.glowPegs = {};
  state.hitPegIds.clear();
  state.removedPegIds.clear();
  state.removedPegValues = {};
  state.gravityWells = [];
  state.slowMotionZones = [];
  state.shieldWalls = [];
  state.invertedGravityBalls.clear();
  state.ballLaunched = false;
  state.activeBallCount = 0;
}

export function resetGame() {
  state.level = 1;
  state.totalScore = 0;
  state.levelScore = 0;
  state.shotsRemaining = MAX_SHOTS;
  state.pegs = [];
  state.containers = [];
  state.containerMultipliers = [];
  state.pegHitCounts.fill(0);
  state.pegMaxHits.fill(0);
  state.pegMultipliers.fill(1);
  state.pegSkipMask.fill(0);
  state.gameState = STATE_AIM;
  resetRound();
}
