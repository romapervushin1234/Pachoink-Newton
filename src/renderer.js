import * as PIXI from 'pixi.js';
import { STATE_AIM } from './config.js';

export async function initRenderer() {
  const app = new PIXI.Application();
  await app.init({ width: window.innerWidth, height: window.innerHeight, background: 0x08081c, antialias: true });
  document.body.appendChild(app.canvas);
  
  const pegTex = createCircleTexture(5, [180, 180, 280]);
  const ballTex = createCircleTexture(4, [0, 245, 255]);
  
  const pegContainer = new PIXI.Container();
  const ballContainer = new PIXI.Container();
  const aimLayer = new PIXI.Container();
  const particleLayer = new PIXI.Container();
  const hudLayer = new PIXI.Container();
  
  app.stage.addChild(pegContainer, ballContainer, particleLayer, aimLayer, hudLayer);
  
  return { 
    app, pegContainer, ballContainer, aimLayer, particleLayer, hudLayer, 
    pegTex, ballTex 
  };
}

function createCircleTexture(radius, color) {
  const c = document.createElement('canvas');
  c.width = radius * 2;
  c.height = radius * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();
  return PIXI.Texture.from(c);
}

export function syncBallsToPixi(ballContainer, ballSprites, wasmBallData, wasmBallStates, maxBalls) {
  for (let i = 0; i < maxBalls; i++) {
    if (wasmBallStates[i] === 1) {
      ballSprites[i].x = wasmBallData[i * 4];
      ballSprites[i].y = wasmBallData[i * 4 + 1];
      if (ballSprites[i].parent !== ballContainer) {
        ballContainer.addChild(ballSprites[i]);
      }
    } else if (ballSprites[i] && ballSprites[i].parent === ballContainer) {
      ballContainer.removeChild(ballSprites[i]);
    }
  }
}

export function syncPegsToPixi(pegContainer, pegSprites, pegTex, wasmPegData, wasmPegStates, maxPegs) {
  for (let i = 0; i < maxPegs; i++) {
    if (wasmPegStates[i] === 1) {
      if (!pegSprites[i]) {
        pegSprites[i] = new PIXI.Sprite(pegTex);
        pegSprites[i].anchor.set(0.5);
      }
      pegSprites[i].x = wasmPegData[i * 2];
      pegSprites[i].y = wasmPegData[i * 2 + 1];
      if (pegSprites[i].parent !== pegContainer) {
        pegContainer.addChild(pegSprites[i]);
      }
    } else if (pegSprites[i] && pegSprites[i].parent === pegContainer) {
      pegContainer.removeChild(pegSprites[i]);
    }
  }
}

export function drawAimLine(layer, input, state) {
  // Clear previous aim line
  layer.removeChildren();
  
  if (input.isDragging) {
    // Draw line from drag start to current position
    const line = new PIXI.Graphics();
    line.lineStyle(2, 0x00FF88, 0.7);
    line.moveTo(input.dragStart.x, input.dragStart.y);
    line.lineTo(input.dragEnd.x, input.dragEnd.y);
    
    // Draw aim indicator circle at start
    line.lineStyle(0);
    line.beginFill(0x00FF88, 0.3);
    line.drawCircle(input.dragStart.x, input.dragStart.y, 15);
    line.endFill();
    
    layer.addChild(line);
  }
}

export function drawHUD(layer, state) {
  layer.removeChildren();
  
  const text = new PIXI.Text(
    `Score: ${Math.round(state.levelScore)} | Level: ${state.level} | Shots: ${state.shotsRemaining}`,
    { fontFamily: 'Arial', fontSize: 18, fill: 0xFFFFFF }
  );
  text.position.set(10, 10);
  layer.addChild(text);
}

export function drawParticles(layer, particles) {
  layer.removeChildren();
  
  const graphics = new PIXI.Graphics();
  for (let p of particles) {
    graphics.beginFill((p.r << 16) | (p.g << 8) | p.b);
    graphics.drawCircle(p.x, p.y, p.size * (p.life / p.maxLife));
    graphics.endFill();
  }
  
  layer.addChild(graphics);
}
