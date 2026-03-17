// phase3_plinko.js — Plinko phase: drop fruit halves through a pegboard into scoring bins

import { Body, resolveCircleCollision } from './physics.js';

// ── Tuning knobs (designed for future upgrade-tree attachment) ──
const PLINKO_CONFIG = {
  pegRadius:    6,
  halfRadius:   16,    // was 10 → +60 % for visual weight & peg interaction
  pegRows:      8,
  pegCols:      9,
  dropInterval: 0.3,
  binScores:    [1, 3, 5, 10, 25, 10, 5, 3, 1, 1],
  // Board bounding box (fraction of viewport)
  boardWidthPct:  0.55,  // was 0.8 → much tighter
  boardHeightPct: 0.55,  // was 0.7 → shorter
  boardTopPct:    0.12,  // push down slightly
};
const BIN_COUNT = PLINKO_CONFIG.pegCols + 1;

const FONT_MAIN = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

// Neon color palette for pegs
const PEG_GLOW_COLOR = '#00e5ff';
const BIN_GLOW_COLORS = [
  '#546e7a', '#42a5f5', '#29b6f6', '#26c6da',
  '#ffd740', '#26c6da', '#29b6f6', '#42a5f5', '#546e7a', '#546e7a',
];

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

function drawShadowedText(ctx, text, x, y, font, fillColor) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = fillColor;
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
        height: h - binTop - 10,
        score: this.binScores[i] || 1,
        count: 0,
        flash: 0,
      });
    }

    const colors = data.fruitColors || [];
    const halvesCount = data.halvesCount || 0;
    this.toDrop = [];
    for (let i = 0; i < halvesCount; i++) {
      this.toDrop.push(colors[i] || '#e74c3c');
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
      if (piece.scored) continue;
      const b = piece.body;
      b.update(dt);
      piece.rotation += piece.rotSpeed * dt;

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

      const binTop = this.boardTop + this.boardHeight;
      if (b.y + b.radius >= binTop) {
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
        b.vy = 0;
        b.vx = 0;
        b.y = binTop + 5;
      }
    }

    for (const bin of this.bins) {
      if (bin.flash > 0) bin.flash -= dt;
    }

    for (const p of this.scorePopups) {
      p.y -= 40 * dt;
      p.life -= dt;
    }
    this.scorePopups = this.scorePopups.filter(p => p.life > 0);

    if (this.toDrop.length === 0) {
      const allScored = this.pieces.length > 0 && this.pieces.every(p => p.scored);
      if (allScored) {
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

    // Background — deep gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#070b14');
    bg.addColorStop(0.4, '#0d1528');
    bg.addColorStop(1, '#131d35');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Board background — subtle
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(this.boardLeft, this.boardTop, this.boardWidth, this.boardHeight);

    // Board side walls — neon lines
    ctx.save();
    ctx.strokeStyle = 'rgba(0,229,255,0.15)';
    ctx.shadowColor = PEG_GLOW_COLOR;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.boardLeft, this.boardTop);
    ctx.lineTo(this.boardLeft, this.boardTop + this.boardHeight);
    ctx.moveTo(this.boardLeft + this.boardWidth, this.boardTop);
    ctx.lineTo(this.boardLeft + this.boardWidth, this.boardTop + this.boardHeight);
    ctx.stroke();
    ctx.restore();

    // Pegs — neon glowing dots
    ctx.save();
    for (const peg of this.pegs) {
      // Outer glow
      ctx.shadowColor = PEG_GLOW_COLOR;
      ctx.shadowBlur = 12;

      // Glow halo
      const glow = ctx.createRadialGradient(peg.x, peg.y, 0, peg.x, peg.y, peg.radius * 2.5);
      glow.addColorStop(0, 'rgba(0,229,255,0.25)');
      glow.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Solid peg
      const pegGrad = ctx.createRadialGradient(
        peg.x - 1.5, peg.y - 1.5, 0,
        peg.x, peg.y, peg.radius
      );
      pegGrad.addColorStop(0, '#b2ebf2');
      pegGrad.addColorStop(0.5, '#4dd0e1');
      pegGrad.addColorStop(1, '#00838f');
      ctx.fillStyle = pegGrad;
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Bins — sleek semi-transparent with glowing borders
    const binWidth = this.boardWidth / BIN_COUNT;
    const binTop = this.boardTop + this.boardHeight;
    for (let i = 0; i < this.bins.length; i++) {
      const bin = this.bins[i];
      const bx = this.boardLeft + binWidth * i;
      const glowColor = BIN_GLOW_COLORS[i] || '#546e7a';

      // Bin fill — semi-transparent gradient
      const binGrad = ctx.createLinearGradient(bx, binTop, bx, binTop + bin.height);
      const flashBoost = bin.flash > 0 ? bin.flash * 0.3 : 0;
      binGrad.addColorStop(0, `rgba(255,255,255,${0.06 + flashBoost})`);
      binGrad.addColorStop(1, `rgba(255,255,255,${0.02 + flashBoost * 0.5})`);
      ctx.fillStyle = binGrad;
      ctx.fillRect(bx + 1, binTop, binWidth - 2, bin.height);

      // Glowing top border
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = bin.flash > 0 ? 16 : 6;
      ctx.strokeStyle = glowColor;
      ctx.globalAlpha = 0.5 + (bin.flash > 0 ? bin.flash : 0);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx + 1, binTop);
      ctx.lineTo(bx + binWidth - 1, binTop);
      ctx.stroke();
      ctx.restore();

      // Bin dividers
      ctx.fillStyle = 'rgba(0,229,255,0.12)';
      ctx.fillRect(bx, binTop, 1.5, bin.height);

      // Score label
      drawShadowedText(ctx, 'x' + bin.score, bx + binWidth / 2, binTop + bin.height - 8,
        `bold 14px ${FONT_MAIN}`, glowColor);

      // Piece count
      if (bin.count > 0) {
        ctx.save();
        ctx.font = `12px ${FONT_MAIN}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(bin.count.toString(), bx + binWidth / 2, binTop + 18);
        ctx.restore();
      }
    }

    // Pieces — with gradient
    for (const piece of this.pieces) {
      const b = piece.body;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(piece.rotation);
      ctx.globalAlpha = piece.scored ? 0.35 : 1;

      // Half-circle with radial gradient
      const pg = ctx.createRadialGradient(-b.radius * 0.2, 0, 0, 0, 0, b.radius);
      pg.addColorStop(0, piece.color);
      pg.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();

      // Flesh interior edge
      ctx.fillStyle = 'rgba(255,255,230,0.2)';
      ctx.fillRect(-1, -b.radius, 2, b.radius * 2);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Score popups — glowing gold
    ctx.save();
    for (const p of this.scorePopups) {
      ctx.globalAlpha = p.life;
      ctx.shadowColor = '#ffd740';
      ctx.shadowBlur = 8;
      drawShadowedText(ctx, p.text, p.x, p.y,
        `bold 22px ${FONT_MAIN}`, '#ffd740');
    }
    ctx.restore();

    // Score HUD
    drawShadowedText(ctx, 'Score: ' + this.score, w / 2, 45,
      `bold 34px ${FONT_MAIN}`, '#fff');

    // Remaining count
    if (this.toDrop.length > 0) {
      drawShadowedText(ctx, `Dropping: ${this.toDrop.length} remaining`, w / 2, 78,
        `18px ${FONT_MAIN}`, 'rgba(255,255,255,0.6)');
    }
  }

  getResult() {
    return { score: this.score };
  }
}
