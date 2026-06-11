import { MAX_PARTICLES } from './config.js';

export const particles = {
  pool: [],
  activeCount: 0
};

export function initParticles() {
  particles.pool = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.pool.push({
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1,
      r: 0, g: 0, b: 0,
      size: 1,
      active: false
    });
  }
  particles.activeCount = 0;
}

export function spawnParticles(x, y, r, g, b, count) {
  for (let i = 0; i < count && particles.activeCount < MAX_PARTICLES; i++) {
    let angle = Math.random() * Math.PI * 2;
    let speed = 1 + Math.random() * 3;
    let p = particles.pool[particles.activeCount];
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.r = r;
    p.g = g;
    p.b = b;
    p.life = 30 + Math.random() * 20;
    p.maxLife = p.life;
    p.size = 1 + Math.random() * 1.5;
    p.active = true;
    particles.activeCount++;
  }
}

export function updateParticles() {
  for (let i = particles.activeCount - 1; i >= 0; i--) {
    let p = particles.pool[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18; // gravity
    p.life--;
    
    if (p.life <= 0) {
      p.active = false;
      if (i !== particles.activeCount - 1) {
        let temp = particles.pool[i];
        particles.pool[i] = particles.pool[particles.activeCount - 1];
        particles.pool[particles.activeCount - 1] = temp;
      }
      particles.activeCount--;
    }
  }
}

export function getActiveParticles() {
  return particles.pool.slice(0, particles.activeCount);
}

export function resetParticles() {
  particles.activeCount = 0;
}
