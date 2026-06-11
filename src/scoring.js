import { MAX_LEVEL_SCORE, CHAOS_HIT_RATIO, CHAOS_MULT, EXPECTED_MULT_RATIO } from './config.js';
import { state } from './state.js';

export function recordPegHit(pegId, pegMultiplier = 1) {
  if (!state.hitPegIds.has(pegId)) {
    state.hitPegIds.add(pegId);
    state.pegHitCounts[pegId]++;
    
    // Peg value increases with hits (diminishing returns)
    let hitBonus = 1 + state.pegHitCounts[pegId] * 0.1;
    let pegValue = 100 * pegMultiplier * hitBonus;
    
    // Apply container multiplier
    let containerMult = state.containerMultipliers[pegId] || 1;
    
    // Chain multiplier increases with consecutive hits
    state.runScore += pegValue * containerMult * state.chainMult;
    state.chainMult += 0.15;
    
    return pegValue * containerMult * state.chainMult;
  }
  return 0;
}

export function computeLevelScore(rawScore) {
  // Arctangent curve: MAX_LEVEL_SCORE * (2/π) * arctan(rawScore/K)
  let ratio = rawScore / state.levelScoreK;
  let arctan = Math.atan(ratio);
  let levelScore = MAX_LEVEL_SCORE * (2 / Math.PI) * arctan;
  return Math.min(levelScore, MAX_LEVEL_SCORE);
}

export function finalizeLevelScore() {
  state.levelScore = computeLevelScore(state.runScore);
  state.totalScore += state.levelScore;
  state.scored = true;
}

export function calculateLevelScoreCurve(numPegs) {
  // Calculate optimal K value based on expected hit count
  let expectedHits = numPegs * EXPECTED_MULT_RATIO;
  let chaosBonus = expectedHits * CHAOS_HIT_RATIO * CHAOS_MULT;
  let expectedRaw = (numPegs * 100) + chaosBonus;
  
  // K should be roughly 1/3 of expected score for good curve
  state.levelScoreK = Math.max(2000, expectedRaw / 3);
  return state.levelScoreK;
}

export function getScorePercentage() {
  return Math.min(100, (state.levelScore / MAX_LEVEL_SCORE) * 100);
}

export function getMultiplierAtScore(rawScore) {
  let ratio = rawScore / state.levelScoreK;
  return 1 + Math.atan(ratio / 2) * 0.5;
}

export function enforcePegRules(wasmPegStates, wasmPegHits) {
  let runScoreRaw = 0, totalHits = 0, uniquePegs = 0;
  for (let i = 0; i < state.pegs.length; i++) {
    let p = state.pegs[i];
    if (!p || !p.active) continue;
    let hits = wasmPegHits[i];
    if (hits > 0) {
      totalHits += hits; uniquePegs++;
      runScoreRaw += p.value * hits;
      if (p.isSpecial) {
        if (hits >= p.maxHits) { p.active = false; wasmPegStates[i] = 0; }
      } else {
        // ARCHITECTURAL TRUTH: Non-special pegs disappear after exactly 5 hits
        if (hits >= 5) { p.active = false; wasmPegStates[i] = 0; }
      }
    }
  }
  return { totalHits, uniquePegs, runScoreRaw };
}

export function computeFinalScore(runScoreRaw, containerMult) {
  let score = MAX_LEVEL_SCORE * (2.0 / Math.PI) * Math.atan(runScoreRaw * containerMult / state.levelScoreK);
  return Math.min(MAX_LEVEL_SCORE, score);
}
