import { STATE_AIM, STATE_FLIGHT, STATE_SETTLE, STATE_FINAL, MAX_LEVEL_SCORE } from './config.js';

export const hud = {
  score: 0,
  totalHits: 0,
  pegCount: 0,
  ballsSettled: 0,
  ballsTotal: 0,
  multiplier: 1,
  flashTimer: 0,
  shakeAmount: 0
};

export const hudState = {
  totalScore: 0,
  level: 1,
  shotsRemaining: 15,
  maxShots: 15,
  levelScore: 0
};

export function updateHUD(gameState, physics) {
  // Updated by main game loop
}

export function drawStateInfo(ctx, gameState, screenW, screenH) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  
  let stateText = '';
  switch(gameState) {
    case STATE_AIM:
      stateText = 'AIM - Drag to angle, release to launch';
      break;
    case STATE_FLIGHT:
      stateText = 'FLIGHT - Ball in motion...';
      break;
    case STATE_SETTLE:
      stateText = 'SETTLING - Balls settling...';
      break;
    case STATE_FINAL:
      stateText = `FINAL - Score: ${Math.round(hud.score)}`;
      break;
    default:
      stateText = '';
  }
  
  ctx.fillText(stateText, 20, screenH - 20);
  
  // Score display
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`Score: ${Math.round(hudState.totalScore)}`, 20, 40);
  
  // Level and shots
  ctx.font = '14px Arial';
  ctx.fillText(`Level: ${hudState.level}  |  Shots: ${hudState.shotsRemaining}/${hudState.maxShots}`, 20, 65);
  
  ctx.restore();
}

export function formatScore(score) {
  if (score >= 1000000) return (score / 1000000).toFixed(1) + 'M';
  if (score >= 1000) return (score / 1000).toFixed(1) + 'K';
  return Math.round(score).toString();
}

export function getZoomIndicator(zoom) {
  return Math.round(zoom * 100) + '%';
}
