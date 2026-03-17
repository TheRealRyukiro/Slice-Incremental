// phase3_plinko.js — Plinko phase: drop node halves through a pegboard

import { Body, resolveCircleCollision } from './physics.js';

// ── Tuning knobs (designed for future upgrade-tree attachment) ──
const PLINKO_CONFIG = {
  pegRadius:    5,
  halfRadius:   24,
  pegRows:      8,
  pegCols:      9,
  dropInterval: 0.3,
  binScores:    [1, 3, 5, 10, 25, 10, 5, 3, 1, 1],
  boardWidthPct:  0.55,
  boardHeightPct: 0.55,
  boardTopPct:    0.12,
  // Visual
  nodeColor: '#00e5ff',
  binHeight: 40,
};
const BIN_COUNT = PLINKO_CONFIG.pegCols + 1;

const BG = '#0D1117';
const FONT = '"SF Mono", "Fira Code", "Cascadia Code", "Consolas", monospace';

class PlinkoHalf {
  constructor(x, y, color) {
    this.body = new Body(x, y, PLINKO_CONFIG.halfRadius, {
      vx: (Math.random() - 0.5) * 40,
      vy: 0,
      gravity: 500,
      restitution: 0.4,
      friction: 0.998,
    });
    this.color = color;
    this.scored = false;
    this.bin = -1;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 8;
  }
}

function drawText(ctx, text, x, y, font, color) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export class Phase3 {
  constructor() {
    this.pegs = [];
    this.pieces = [];
    this.bins = [];
    this.toDrop = [];
    this.dropTimer = 0;
    this.settleTimer = 0;
    this.score = 0;
    this.binScores = [];
    this.boardTop = 0;
    this.boardLeft = 0;
    this.boardWidth = 0;
    this.boardHeight = 0;
    this.scorePopups = [];
  }

  enter(canvas, data) {
    this.pegs = [];
    this.pieces = [];
    this.score = 0;
    this.settleTimer = 0;
    this.scorePopups = [];
    this.canvas = canvas;

    const w = canvas.width;
    const h = canvas.height;

    this.boardWidth = w * PLINKO_CONFIG.boardWidthPct;
    this.boardLeft = (w - this.boardWidth) / 2;
    this.boardTop = h * PLINKO_CONFIG.boardTopPct;
    this.boardHeight = h * PLINKO_CONFIG.boardHeightPct;

    const rowSpacing = this.boardHeight / (PLINKO_CONFIG.pegRows + 1);
    const colSpacing = this.boardWidth / PLINKO_CONFIG.pegCols;

    for (let row = 0; row < PLINKO_CONFIG.pegRows; row++) {
      const y = this.boardTop + rowSpacing * (row + 1);
      const offset = (row % 2 === 0) ? 0 : colSpacing / 2;
      const cols = (row % 2 === 0) ? PLINKO_CONFIG.pegCols : PLINKO_CONFIG.pegCols - 1;
      for (let col = 0; col < cols; col++) {
        const x = this.boardLeft + colSpacing / 2 + col * colSpacing + offset;
        this.pegs.push(new Body(x, y, PLINKO_CONFIG.pegRadius, {
          isStatic: true,
          restitution: 0.6,
        }));
      }
    }

    this.binScores = PLINKO_CONFIG.binScores.slice(0, BIN_COUNT);
    this.bins = [];
    const binWidth = this.boardWidth / BIN_COUNT;
    const binTop = this.boardTop + this.boardHeight;
    for (let i = 0; i < BIN_COUNT; i++) {
      this.bins.push({
        x: this.boardLeft + binWidth * i,
        y: binTop,
        width: binWidth,
        height: PLINKO_CONFIG.binHeight,
        score: this.binScores[i] || 1,
        count: 0,
        flash: 0,
      });
    }

    const colors = data.fruitColors || [];
    const halvesCount = data.halvesCount || 0;
    this.toDrop = [];
    for (let i = 0; i < halvesCount; i++) {
      this.toDrop.push(colors[i] || PLINKO_CONFIG.nodeColor);
    }
    this.dropTimer = 0.5;
  }

  onPointerDown() {}
  onPointerMove() {}
  onPointerUp() {}

  update(dt) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.dropTimer -= dt;
    if (this.dropTimer <= 0 && this.toDrop.length > 0) {
      const color = this.toDrop.shift();
      const dropX = w / 2 + (Math.random() - 0.5) * 60;
      this.pieces.push(new PlinkoHalf(dropX, this.boardTop - 20, color));
      this.dropTimer = PLINKO_CONFIG.dropInterval;
    }

    for (const piece of this.pieces) {
      if (piece.scored && piece.body.y > h + 100) continue;
      const b = piece.body;
      b.update(dt);
      piece.rotation += piece.rotSpeed * dt;

      if (!piece.scored) {
        for (const peg of this.pegs) {
          resolveCircleCollision(b, peg);
        }

        if (b.x - b.radius < this.boardLeft) {
          b.x = this.boardLeft + b.radius;
          b.vx = Math.abs(b.vx) * 0.5;
        }
        if (b.x + b.radius > this.boardLeft + this.boardWidth) {
          b.x = this.boardLeft + this.boardWidth - b.radius;
          b.vx = -Math.abs(b.vx) * 0.5;
        }
      }

      const binTop = this.boardTop + this.boardHeight;
      if (!piece.scored && b.y >= binTop) {
        const relX = b.x - this.boardLeft;
        const binIdx = Math.floor(relX / (this.boardWidth / BIN_COUNT));
        const clampedIdx = Math.max(0, Math.min(BIN_COUNT - 1, binIdx));
        piece.scored = true;
        piece.bin = clampedIdx;
        const bin = this.bins[clampedIdx];
        bin.count++;
        bin.flash = 0.4;
        const pts = bin.score;
        this.score += pts;
        this.scorePopups.push({
          x: b.x, y: binTop - 10,
          text: '+' + pts,
          life: 1.0,
        });
      }
    }

    this.pieces = this.pieces.filter(p => p.body.y < h + 200);

    for (const bin of this.bins) {
      if (bin.flash > 0) bin.flash -= dt;
    }

    for (const p of this.scorePopups) {
      p.y -= 40 * dt;
      p.life -= dt;
    }
    this.scorePopups = this.scorePopups.filter(p => p.life > 0);

    if (this.toDrop.length === 0 && this.pieces.length > 0) {
      if (this.pieces.every(p => p.scored)) {
        this.settleTimer += dt;
        if (this.settleTimer > 1.5) return 'done';
      }
    }

    if (this.toDrop.length === 0 && this.pieces.length === 0) {
      this.settleTimer += dt;
      if (this.settleTimer > 1) return 'done';
    }

    return null;
  }

  draw(ctx, canvas) {
    const w = canvas.width;
    const h = canvas.height;

    // Solid dark background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // ── Board walls — thin cyan wireframe ──
    ctx.save();
    ctx.strokeStyle = 'rgba(0,229,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.boardLeft, this.boardTop);
    ctx.lineTo(this.boardLeft, this.boardTop + this.boardHeight);
    ctx.moveTo(this.boardLeft + this.boardWidth, this.boardTop);
    ctx.lineTo(this.boardLeft + this.boardWidth, this.boardTop + this.boardHeight);
    ctx.stroke();
    ctx.restore();

    // ── Pegs — small glowing white dots ──
    ctx.save();
    for (const peg of this.pegs) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── Bins — wireframe boxes with cyan borders ──
    const binWidth = this.boardWidth / BIN_COUNT;
    const binTop = this.boardTop + this.boardHeight;
    for (let i = 0; i < this.bins.length; i++) {
      const bin = this.bins[i];
      const bx = this.boardLeft + binWidth * i;
      const flashAlpha = bin.flash > 0 ? bin.flash : 0;

      // Semi-transparent fill
      ctx.fillStyle = `rgba(0,229,255,${0.02 + flashAlpha * 0.08})`;
      ctx.fillRect(bx + 1, binTop, binWidth - 2, bin.height);

      // Wireframe border
      ctx.save();
      ctx.strokeStyle = `rgba(0,229,255,${0.25 + flashAlpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 1, binTop, binWidth - 2, bin.height);
      ctx.restore();

      // Multiplier label
      drawText(ctx, 'x' + bin.score, bx + binWidth / 2, binTop + bin.height / 2 + 4,
        `bold 12px ${FONT}`, `rgba(0,229,255,${0.5 + flashAlpha * 0.5})`);

      // Count
      if (bin.count > 0) {
        drawText(ctx, bin.count.toString(), bx + binWidth / 2, binTop + bin.height - 4,
          `10px ${FONT}`, 'rgba(255,255,255,0.3)');
      }
    }

    // ── Pieces — glowing cyan semi-circles ──
    for (const piece of this.pieces) {
      const b = piece.body;
      if (b.y > h + 100) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(piece.rotation);

      if (piece.scored) {
        const fadeProgress = Math.min(1, (b.y - binTop) / 150);
        ctx.globalAlpha = Math.max(0, 1 - fadeProgress * 0.7);
      }

      // Glowing semi-circle
      ctx.shadowColor = piece.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = piece.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();

      // Flat edge
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(-1, -b.radius, 2, b.radius * 2);

      // Core highlight
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = (piece.scored ? 0.1 : 0.2);
      ctx.beginPath();
      ctx.arc(b.radius * 0.2, 0, b.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Score popups ──
    ctx.save();
    for (const p of this.scorePopups) {
      ctx.globalAlpha = p.life;
      drawText(ctx, p.text, p.x, p.y,
        `bold 20px ${FONT}`, PLINKO_CONFIG.nodeColor);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── HUD ──
    drawText(ctx, this.score.toString(), w / 2, 45,
      `bold 34px ${FONT}`, '#fff');

    drawText(ctx, 'SCORE', w / 2, 64,
      `11px ${FONT}`, 'rgba(255,255,255,0.3)');

    if (this.toDrop.length > 0) {
      drawText(ctx, `${this.toDrop.length} REMAINING`, w / 2, 82,
        `11px ${FONT}`, 'rgba(0,229,255,0.4)');
    }
  }

  getResult() {
    return { score: this.score };
  }
}
