// main.js — State machine: orchestrates the 3-phase game loop

import { Phase1 } from './phase1_gather.js';
import { Phase2 } from './phase2_slice.js';
import { Phase3 } from './phase3_plinko.js';

const FONT = '"SF Mono", "Fira Code", "Cascadia Code", "Consolas", monospace';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Resize handling ---
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- State machine ---
const PHASES = { GATHER: 1, SLICE: 2, PLINKO: 3 };
let currentPhase = PHASES.GATHER;
let phase = null;
let transitionAlpha = 0;
let transitioning = false;
let transitionTarget = null;
let transitionData = null;
let totalScore = 0;

const phase1 = new Phase1();
const phase2 = new Phase2();
const phase3 = new Phase3();

function startPhase(phaseId, data = {}) {
  currentPhase = phaseId;
  switch (phaseId) {
    case PHASES.GATHER:
      phase = phase1;
      phase1.enter(canvas);
      break;
    case PHASES.SLICE:
      phase = phase2;
      phase2.enter(canvas, data);
      break;
    case PHASES.PLINKO:
      phase = phase3;
      phase3.enter(canvas, data);
      break;
  }
}

function beginTransition(targetPhase, data) {
  transitioning = true;
  transitionTarget = targetPhase;
  transitionData = data;
  transitionAlpha = 0;
}

// --- Input handling ---
function getPos(e) {
  if (e.touches) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

canvas.addEventListener('mousedown', (e) => {
  if (transitioning) return;
  const p = getPos(e);
  phase?.onPointerDown(p.x, p.y);
});

canvas.addEventListener('mousemove', (e) => {
  if (transitioning) return;
  const p = getPos(e);
  phase?.onPointerMove(p.x, p.y);
});

canvas.addEventListener('mouseup', () => {
  if (transitioning) return;
  phase?.onPointerUp();
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (transitioning) return;
  const p = getPos(e);
  phase?.onPointerDown(p.x, p.y);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (transitioning) return;
  const p = getPos(e);
  phase?.onPointerMove(p.x, p.y);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (transitioning) return;
  phase?.onPointerUp();
}, { passive: false });

// --- Game loop ---
let lastTime = 0;

function loop(timestamp) {
  requestAnimationFrame(loop);

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (transitioning) {
    transitionAlpha += dt * 2.5;
    if (transitionAlpha >= 1) {
      startPhase(transitionTarget, transitionData);
      transitioning = false;
      transitionAlpha = 1;
    }
  } else if (transitionAlpha > 0) {
    transitionAlpha -= dt * 2.5;
    if (transitionAlpha < 0) transitionAlpha = 0;
  }

  if (phase && !transitioning) {
    const result = phase.update(dt);
    if (result === 'done') {
      const data = phase.getResult();
      switch (currentPhase) {
        case PHASES.GATHER:
          beginTransition(PHASES.SLICE, data);
          break;
        case PHASES.SLICE:
          beginTransition(PHASES.PLINKO, data);
          break;
        case PHASES.PLINKO:
          totalScore += data.score;
          beginTransition(PHASES.GATHER, {});
          break;
      }
    }
  }

  // Draw
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (phase) {
    phase.draw(ctx, canvas);
  }

  // Total score overlay
  ctx.save();
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Total: ' + totalScore, canvas.width - 15, 25);
  ctx.restore();

  // Phase label
  const phaseNames = { [PHASES.GATHER]: 'GATHER', [PHASES.SLICE]: 'SLICE', [PHASES.PLINKO]: 'PLINKO' };
  ctx.save();
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText(phaseNames[currentPhase], 15, 25);
  ctx.restore();

  // Transition overlay
  if (transitionAlpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, transitionAlpha)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// --- Start ---
startPhase(PHASES.GATHER);
requestAnimationFrame(loop);
