import { STATE_AIM, STATE_FLIGHT } from './config.js';
import { state } from './state.js';

export const input = {
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  dragEnd: { x: 0, y: 0 },
  swipeStartTime: 0,
  activeTouchId: null,
  launchMode: 0 // 0 = drag-to-aim, 1 = flick
};

export function setupInputListeners() {
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('touchstart', handleTouchStart, false);
  document.addEventListener('touchmove', handleTouchMove, false);
  document.addEventListener('touchend', handleTouchEnd, false);
}

function handleMouseDown(e) {
  if (state.gameState !== STATE_AIM) return;
  input.isDragging = true;
  input.dragStart = { x: e.clientX, y: e.clientY };
  input.swipeStartTime = Date.now();
}

function handleMouseMove(e) {
  if (!input.isDragging) return;
  input.dragEnd = { x: e.clientX, y: e.clientY };
  updateAimAngle();
}

function handleMouseUp(e) {
  if (!input.isDragging) return;
  input.isDragging = false;
  checkLaunch();
}

function handleTouchStart(e) {
  if (state.gameState !== STATE_AIM || input.activeTouchId !== null) return;
  let touch = e.touches[0];
  input.activeTouchId = touch.identifier;
  input.isDragging = true;
  input.dragStart = { x: touch.clientX, y: touch.clientY };
  input.swipeStartTime = Date.now();
  e.preventDefault();
}

function handleTouchMove(e) {
  if (input.activeTouchId === null) return;
  let touch = null;
  for (let i = 0; i < e.touches.length; i++) {
    if (e.touches[i].identifier === input.activeTouchId) {
      touch = e.touches[i];
      break;
    }
  }
  if (!touch) return;
  input.dragEnd = { x: touch.clientX, y: touch.clientY };
  updateAimAngle();
  e.preventDefault();
}

function handleTouchEnd(e) {
  let touchFound = false;
  for (let i = 0; i < e.touches.length; i++) {
    if (e.touches[i].identifier === input.activeTouchId) {
      touchFound = true;
      break;
    }
  }
  if (!touchFound) {
    input.isDragging = false;
    input.activeTouchId = null;
    checkLaunch();
  }
  e.preventDefault();
}

function updateAimAngle() {
  let dx = input.dragEnd.x - input.dragStart.x;
  let dy = input.dragEnd.y - input.dragStart.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 5) {
    state.aimAngle = Math.atan2(dx, dy);
  }
}

function checkLaunch() {
  if (state.gameState !== STATE_AIM) return;
  let dx = input.dragEnd.x - input.dragStart.x;
  let dy = input.dragEnd.y - input.dragStart.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  let time = Date.now() - input.swipeStartTime;
  let speed = dist / (time + 1);
  
  if (dist > 30 || speed > 0.3) {
    state.requestLaunch();
  }
}

export function resetInputState() {
  input.isDragging = false;
  input.dragStart = { x: 0, y: 0 };
  input.dragEnd = { x: 0, y: 0 };
  input.swipeStartTime = 0;
  input.activeTouchId = null;
}
