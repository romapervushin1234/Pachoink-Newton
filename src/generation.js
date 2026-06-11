import { state } from './state.js';
import { LAYOUT_TRIANGLE, LAYOUT_INVERTED, LAYOUT_HEX, PATTERN_FULL, PATTERN_HONEY, PATTERN_SPIRAL, PATTERN_CHECK, PATTERN_GRAD, PATTERN_DIAMOND, PATTERN_WAVE, SPECIALS, PEG_SPACING, ROW_HEIGHT, TOP_MARGIN, SIDE_MARGIN } from './config.js';

export function generateLevel(level) {
  state.level = level;
  state.layoutType = (level === 1) ? LAYOUT_TRIANGLE : (level % 4 === 0) ? LAYOUT_INVERTED : (level % 4 === 2) ? LAYOUT_HEX : LAYOUT_TRIANGLE;
  state.hexRadius = Math.max(2, Math.min(20, 2 + Math.floor(level / 4)));
  state.numRows = Math.max(10, Math.min(40, 12 + Math.floor(level * 2.5) + Math.floor(Math.random() * 9 - 3)));
  state.patternType = (level === 1) ? PATTERN_FULL : Math.floor(Math.random() * 7);
  state.pegs = []; state.containers = []; state.containerMultipliers = [];

  let mask = new Uint8Array(20000), idx = 0;
  const skip = (r, c, total) => {
    if (r < 2) return false;
    if (state.patternType === PATTERN_HONEY) { 
      let cx=c-r/2, cy=r*0.866, cs=3+Math.floor(level/4), hx=Math.floor(cx/cs), hy=Math.floor(cy/cs); 
      return Math.sqrt(Math.pow(cx-hx*cs-cs/2,2)+Math.pow(cy-hy*cs-cs/2,2)) < cs*0.35; 
    }
    if (state.patternType === PATTERN_SPIRAL) { 
      let cnt=r+1, cc=(cnt-1)/2, cr=total/2, dx=c-cc, dy=r-cr, d=Math.sqrt(dx*dx+dy*dy), a=Math.atan2(dy,dx); 
      return Math.sin(d*0.5-a*2)>0.7; 
    }
    if (state.patternType === PATTERN_CHECK) { 
      let sz=2+Math.floor(level/5); return (Math.floor(c/sz)+Math.floor(r/sz))%2===0; 
    }
    if (state.patternType === PATTERN_GRAD) { 
      let den=1-(r/total)*0.7, seed=r*1000+c*7+level*13; 
      return Math.abs((Math.sin(seed)*43758.5453)%1) > den; 
    }
    if (state.patternType === PATTERN_DIAMOND) { 
      let cc3=r/2, cr3=total/2, dd=Math.abs(c-cc3)+Math.abs(r-cr3)*0.5, rs=4+level/3; 
      return (dd%rs)<rs*0.4; 
    }
    if (state.patternType === PATTERN_WAVE) { 
      let cc4=r/2, nc=(c-cc4)/Math.max(cc4,1), wf=0.3+level*0.05, wa=2+level/4; 
      return Math.abs(nc*(r+1)-Math.sin(r*wf)*wa)<1.5; 
    }
    return false;
  };

  if (state.layoutType !== LAYOUT_HEX) {
    for (let r = 0; r < state.numRows; r++) {
      let count = (state.layoutType === LAYOUT_INVERTED) ? state.numRows - r : r + 1;
      let ox = 400 - ((count - 1) * PEG_SPACING) / 2, oy = TOP_MARGIN + r * ROW_HEIGHT;
      for (let c = 0; c < count; c++) {
        if (!skip(r, c, state.numRows)) {
          state.pegs.push({ id: idx, x: ox + c * PEG_SPACING, y: oy, row: r, col: c, value: r + 1, isSpecial: false, specialIdx: -1, maxHits: 0, currentHits: 0, active: true });
        }
        idx++;
      }
    }
  } else {
    let n = state.hexRadius;
    for (let q = -(n - 1); q <= n - 1; q++) {
      let r1 = Math.max(-(n - 1), -q - (n - 1)), r2 = Math.min(n - 1, -q + (n - 1));
      for (let r = r1; r <= r2; r++) {
        if (!skip(r + (n - 1), q + (n - 1), n * 2 - 1)) {
          state.pegs.push({ id: idx, x: 400 + PEG_SPACING * (q + r * 0.5), y: TOP_MARGIN + ROW_HEIGHT * r, row: r + (n - 1), col: q + (n - 1), value: r + n, isSpecial: false, specialIdx: -1, maxHits: 0, currentHits: 0, active: true });
        }
        idx++;
      }
    }
  }

  let valid = state.pegs.filter(p => p.row > 4).map((_, i) => i);
  for (let i = valid.length - 1; i > 0; i--) { 
    let j = Math.floor(Math.random() * (i + 1)); 
    [valid[i], valid[j]] = [valid[j], valid[i]]; 
  }
  for (let i = 0; i < Math.min(SPECIALS.length, valid.length); i++) {
    let p = state.pegs[valid[i]]; 
    p.isSpecial = true; p.specialIdx = i; p.maxHits = SPECIALS[i].limit();
  }

  let count = Math.floor(state.numRows / 2) + 3;
  let bottomY = TOP_MARGIN + (state.layoutType === LAYOUT_HEX ? (state.hexRadius * 2 - 1) * ROW_HEIGHT : (state.numRows - 1) * ROW_HEIGHT) + 50;
  let h = (count - 1) / 2, mx = 1000 + level * 100, mn = Math.max(1.0, 1.5 - level * 0.03);
  let widths = [], s = 0;
  for (let i = 0; i < count; i++) { 
    let d = h > 0 ? Math.abs(i - h) / h : 0; 
    let w = 1.4 + (0.5 - 1.4) * d; 
    widths.push(w); s += w; 
    state.containerMultipliers.push(Math.round((mn + (mx - mn) * Math.pow(d, 3)) * 10) / 10); 
  }
  widths = widths.map(v => v / s * (800 - SIDE_MARGIN * 2));
  let x = SIDE_MARGIN;
  for (let i = 0; i < count; i++) { 
    state.containers.push({ left: x, right: x + widths[i], cx: x + widths[i] / 2, y: bottomY, w: widths[i] }); 
    x += widths[i]; 
  }
  
  state.boardBounds = { y: -170, h: bottomY + 70 - (-170) };
  calculateScoreCurve();
}

function calculateScoreCurve() {
  let active = state.pegs.filter(p => p.active);
  let maxMult = Math.max(1, ...state.containerMultipliers);
  let totalVal = active.reduce((sum, p) => sum + p.value, 0);
  let expectedRaw = (active.length * 0.40) * (totalVal / (active.length || 1)) * (maxMult * 0.5) * 3.0;
  state.levelScoreK = Math.max(2000, expectedRaw * 1.5);
}
