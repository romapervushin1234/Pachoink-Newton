import init, { PhysicsWorld } from '../wasm/pkg/pachinko_physics.js';
import { state, resetRound, resetGame } from './state.js';
import { generateLevel } from './generation.js';
import { recordPegHit, finalizeLevelScore, computeLevelScore, calculateLevelScoreCurve } from './scoring.js';
import { updateCamera } from './camera.js';
import { initRenderer, syncBallsToPixi, syncPegsToPixi, drawAimLine, drawHUD, drawParticles } from './renderer.js';
import { setupInputListeners, resetInputState, input } from './input.js';
import { initParticles, updateParticles, spawnParticles, getActiveParticles } from './particles.js';
import { STATE_AIM, STATE_FLIGHT, STATE_SETTLE, STATE_FINAL, STATE_LEVEL_COMPLETE, STATE_GAMEOVER, MAX_BALLS, SETTLE_TIMER_MAX, FLASH_TIMER_MAX, GRAVITY, MAX_BALL_SPEED, GRID_SIZE, MAX_SHOTS, LAUNCH_Y } from './config.js';
import * as PIXI from 'pixi.js';

let physics, renderer;
let ballSprites = [];
let pegSprites = [];
let frameCount = 0;
const FPS = 60;

async function start() {
  // Initialize WASM physics engine
  await init();
  physics = new PhysicsWorld(15000, 50);
  
  // Initialize renderer
  renderer = await initRenderer();
  
  // Initialize particles
  initParticles();
  
  // Setup input listeners
  setupInputListeners();
  
  // Initialize ball sprites pool
  for (let i = 0; i < MAX_BALLS; i++) {
    const sprite = new PIXI.Sprite(renderer.ballTex);
    sprite.anchor.set(0.5);
    ballSprites.push(sprite);
  }
  
  // Generate first level
  generateLevel(1);
  syncPegsToWasm();
  calculateLevelScoreCurve(state.pegs.length);
  
  // Start game loop
  renderer.app.ticker.add(() => gameLoop());
}

function syncPegsToWasm() {
  // Copy peg positions from state to WASM
  let dataIdx = 0;
  for (let i = 0; i < state.pegs.length; i++) {
    const peg = state.pegs[i];
    physics.peg_data[dataIdx++] = peg.x;
    physics.peg_data[dataIdx++] = peg.y;
    physics.peg_states[i] = peg.active ? 1 : 0;
    physics.peg_hit_counts[i] = 0;
  }
}

function gameLoop() {
  if (!physics || !renderer) return;
  
  frameCount++;
  const dt = 1.0 / FPS;
  
  // STATE MACHINE TRANSITIONS
  switch (state.gameState) {
    case STATE_AIM:
      handleAimState();
      break;
    case STATE_FLIGHT:
      handleFlightState(dt);
      break;
    case STATE_SETTLE:
      handleSettleState();
      break;
    case STATE_FINAL:
      handleFinalState();
      break;
    case STATE_LEVEL_COMPLETE:
      handleLevelCompleteState();
      break;
    case STATE_GAMEOVER:
      handleGameOverState();
      break;
  }
  
  // Physics step
  physics.step(dt, GRAVITY, MAX_BALL_SPEED, GRID_SIZE);
  
  // Update particles
  updateParticles();
  
  // Sync to PIXI
  syncBallsToPixi(renderer.ballContainer, ballSprites, physics.ball_data, physics.ball_states, MAX_BALLS);
  syncPegsToPixi(renderer.pegContainer, pegSprites, renderer.pegTex, physics.peg_data, physics.peg_states, state.pegs.length);
  
  // Draw particles
  drawParticles(renderer.particleLayer, getActiveParticles());
  
  // Update camera
  updateCamera(renderer.app.stage, () => getHighestBallY());
  
  // Draw HUD and UI
  drawHUD(renderer.hudLayer, state);
  
  // Draw aiming visualization in AIM state
  if (state.gameState === STATE_AIM) {
    drawAimLine(renderer.aimLayer, input, state);
  }
}

function handleAimState() {
  // Check if player requested launch
  if (state.ballLaunched) {
    state.ballLaunched = false;
    
    // Calculate velocity based on aim angle
    let vx = Math.sin(state.aimAngle) * 6;
    let vy = Math.cos(state.aimAngle) * 3.5;
    
    // Spawn ball in physics engine
    physics.spawn_ball(400, LAUNCH_Y, vx, vy);
    
    // Update game state
    state.gameState = STATE_FLIGHT;
    state.pegHitCounts.fill(0);
    state.hitPegIds.clear();
    state.runScore = 0;
    state.chainMult = 1.0;
    state.shotsRemaining--;
    state.launchZoomBoost = 0.25;
    state.settleTimer = 0;
    state.activeBallCount = 1;
    
    resetInputState();
  }
  
  // Smooth camera zoom
  state.launchZoomBoost *= 0.95;
  state.shakeAmount *= 0.9;
  state.targetZoom = 0.65 - state.launchZoomBoost * 0.1;
}

function handleFlightState(dt) {
  // Ball is in motion, check for collisions and peg hits
  let ballCount = physics.ball_count;
  
  // Track peg hits
  for (let i = 0; i < state.pegs.length; i++) {
    let hitCount = physics.peg_hit_counts[i];
    if (hitCount > 0 && state.pegs[i].active) {
      if (!state.hitPegIds.has(i)) {
        state.hitPegIds.add(i);
        let pegVal = state.pegs[i].value || 100;
        let containerMult = state.containerMultipliers[i] || 1;
        state.runScore += pegVal * containerMult * state.chainMult;
        state.chainMult += 0.1;
        spawnParticles(state.pegs[i].x, state.pegs[i].y, 100, 200, 255, 8);
      }
    }
  }
  
  // Check if all balls settled
  let allSettled = true;
  for (let i = 0; i < ballCount; i++) {
    if (physics.ball_states[i] === 1) {
      let vy = physics.ball_data[i * 4 + 3];
      if (Math.abs(vy) > 0.2) allSettled = false;
    }
  }
  
  if (allSettled && frameCount > 120) {
    state.gameState = STATE_SETTLE;
    state.settleTimer = SETTLE_TIMER_MAX;
  }
  
  // Detect if ball left play area
  for (let i = 0; i < ballCount; i++) {
    if (physics.ball_states[i] === 1) {
      let y = physics.ball_data[i * 4 + 1];
      if (y > state.boardBounds.y + state.boardBounds.h) {
        physics.ball_states[i] = 0; // deactivate
      }
    }
  }
}

function handleSettleState() {
  state.settleTimer--;
  if (state.settleTimer <= 0) {
    state.gameState = STATE_FINAL;
    finalizeLevelScore();
    state.flashTimer = FLASH_TIMER_MAX;
  }
}

function handleFinalState() {
  state.flashTimer--;
  if (state.flashTimer <= 0) {
    if (state.shotsRemaining <= 0) {
      state.gameState = STATE_GAMEOVER;
    } else {
      state.gameState = STATE_LEVEL_COMPLETE;
    }
  }
}

function handleLevelCompleteState() {
  if (input.isDragging === false && frameCount > 120) {
    generateLevel(state.level + 1);
    calculateLevelScoreCurve(state.pegs.length);
    syncPegsToWasm();
    resetRound();
    state.gameState = STATE_AIM;
  }
}

function handleGameOverState() {
  // Game over - display final score
  if (frameCount % 60 === 0) {
    // Can reset with space or tap
  }
}

function getHighestBallY() {
  let highest = state.boardBounds.y;
  for (let i = 0; i < physics.ball_count; i++) {
    if (physics.ball_states[i] === 1) {
      let y = physics.ball_data[i * 4 + 1];
      if (y < highest) highest = y;
    }
  }
  return highest;
}

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    if (state.gameState === STATE_AIM) {
      state.requestLaunch();
    } else if (state.gameState === STATE_GAMEOVER) {
      resetGame();
      generateLevel(1);
      syncPegsToWasm();
      state.gameState = STATE_AIM;
    }
  }
});

start();
