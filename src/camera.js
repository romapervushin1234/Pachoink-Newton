import { state } from './state.js';
export function updateCamera(stage, getHighestBallY) {
  let highestY = getHighestBallY();
  if (state.gameState !== 'FLIGHT' || highestY > 1500) {
    stage.scale.set(1.0); stage.y = 0; return;
  }
  const progress = Math.max(0, Math.min(1, (highestY - state.boardBounds.y) / state.boardBounds.h));
  const baseZoom = 1.3 - 0.6 * progress;
  const currentZoom = Math.max(0.35, Math.min(1.0, baseZoom));
  stage.scale.set(currentZoom);
  const screenCenter = 900 / 2;
  const targetY = (state.boardBounds.y + state.boardBounds.h / 2) + (progress * state.boardBounds.h * 0.2);
  stage.y = screenCenter - (targetY * currentZoom);
}
