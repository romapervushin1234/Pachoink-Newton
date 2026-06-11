// Game States
export const STATE_AIM = 0, STATE_FLIGHT = 1, STATE_SETTLE = 2, STATE_FINAL = 3;
export const STATE_LEVEL_COMPLETE = 4, STATE_GAMEOVER = 5;

// Layout Types
export const LAYOUT_TRIANGLE = 0, LAYOUT_INVERTED = 1, LAYOUT_HEX = 2;

// Pattern Types
export const PATTERN_FULL = 0, PATTERN_HONEY = 1, PATTERN_SPIRAL = 2, PATTERN_CHECK = 3;
export const PATTERN_GRAD = 4, PATTERN_DIAMOND = 5, PATTERN_WAVE = 6;

// Special Peg Types
export const SPECIALS = [
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

// Ball Skins
export const BALL_SKINS = [
  { name: 'CYAN',  c1: [0, 245, 255], c2: [200, 255, 255], glow: [0, 200, 255] },
  { name: 'FIRE',  c1: [255, 100, 0], c2: [255, 200, 50],  glow: [255, 150, 0] },
  { name: 'TOXIC', c1: [100, 255, 0], c2: [200, 255, 150], glow: [50, 255, 50] },
  { name: 'VOID',  c1: [150, 0, 255], c2: [200, 100, 255], glow: [100, 0, 200] },
  { name: 'GOLD',  c1: [255, 215, 0], c2: [255, 240, 150], glow: [255, 200, 50] }
];

// Physics Constants
export const MAX_PEGS = 15000;
export const MAX_BALLS = 50;
export const MAX_PARTICLES = 1000;
export const PEG_SPACING = 24;
export const PEG_RADIUS = 5;
export const BALL_RADIUS = 4;
export const ROW_HEIGHT = PEG_SPACING * 0.866;
export const TOP_MARGIN = 100;
export const LAUNCH_Y = -130;
export const CONTAINER_HEIGHT = 70;
export const SIDE_MARGIN = 50;
export const MAX_BALL_SPEED = 12;
export const MAX_LEVEL_SCORE = 12800.0;

// Physics parameters (must match WASM)
export const GRAVITY = 0.02;
export const BALL_GRAVITY_RADIUS_MIN = 100;
export const BALL_GRAVITY_RADIUS_MAX = 150;
export const G_CONST = 75.57;
export const EPSILON = 12.0;
export const GRID_SIZE = PEG_SPACING * 2;

// Game parameters
export const MAX_SHOTS = 15;
export const SETTLE_TIMER_MAX = 90;
export const FLASH_TIMER_MAX = 60;
export const SHAKE_DECAY = 0.85;
export const LAUNCH_ZOOM_BOOST = 0.25;

// Camera parameters
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 1.0;
export const SMOOTH_FACTOR_MIN = 0.08;
export const SMOOTH_FACTOR_MAX = 0.18;

// Scoring constants
export const LEVEL_SCORE_K_MIN = 2000;
export const CHAOS_HIT_RATIO = 0.40;
export const CHAOS_MULT = 3.0;
export const EXPECTED_MULT_RATIO = 0.5;

// UI Colors
export const BG_COLOR = [8, 8, 28];
export const WALL_COLOR = [30, 30, 60];
export const CONTAINER_EMPTY_COLOR = [50, 100, 200];
export const CONTAINER_FULL_COLOR = [100, 255, 150];
export const CONTAINER_FLASH_COLOR = [255, 255, 100];
export const DIVIDER_COLOR = [0, 255, 200];
