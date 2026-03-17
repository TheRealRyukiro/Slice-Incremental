// phase3_plinko.js — Plinko phase: drop fruit halves through a pegboard into scoring bins

import { Body, resolveCircleCollision } from './physics.js';

// ── Tuning knobs (designed for future upgrade-tree attachment) ──
const PLINKO_CONFIG = {
  pegRadius:    6,
  halfRadius:   24,    // was 16 → another +50 % for visual weight
  pegRows:      8,
  pegCols:      9,
  dropInterval: 0.3,
  binScores:    [1, 3, 5, 10, 25, 10, 5, 3, 1, 1],
  // Board bounding box (fraction of viewport)
  boardWidthPct:  0.55,
  boardHeightPct: 0.55,
  boardTopPct:    0.12,
  // Apple color for slice rendering
  apple: { base: '#e74c3c', mid: '#c0392b', dark: '#922b21' },
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

// Draw a proper apple-half slice with radial gradient, flat edge, and seed
function drawAppleSlice(ctx, r) {
  const { base, mid, dark } = PLINKO_CONFIG.apple;

  // Outer skin — semi-circle with red radial gradient
  const skinGrad = ctx.createRadialGradient(-r * 0.2, 0, r * 0.1, 0, 0, r);
  skinGrad.addColorStop(0, '#fff');
  skinGrad.addColorStop(0.12, base);
  skinGrad.addColorStop(0.55, mid);
  skinGrad.addColorStop(1, dark);
  ctx.fillStyle = skinGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fill();

  // Flat edge (flesh) — light creamy color
  ctx.fillStyle = '#ffecd2';
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.lineTo(-3, r);
  ctx.lineTo(-3, -r);
  ctx.closePath();
  ctx.fill();

  // Flesh gradient on flat side
  const fleshGrad = ctx.createLinearGradient(0, 0, -r * 0.35, 0);
  fleshGrad.addColorStop(0, 'rgba(255,236,210,0.7)');
  fleshGrad.addColorStop(1, 'rgba(255,236,210,0)');
  ctx.fillStyle = fleshGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(0, r);
  ctx.lineTo(0, -r);
  ctx.closePath();
  ctx.fill();

  // Seed — small dark teardrop in the center
  ctx.save();
  ctx.fillStyle = '#4e2a04';
  ctx.beginPath();
  ctx.ellipse(r * 0.2, 0, r * 0.08, r * 0.16, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Seed highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(r * 0.18, -r * 0.04, r * 0.03, r * 0.06, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Specular highlight on skin
  const specGrad = ctx.createRadialGradient(
    r * 0.15, -r * 0.3, 0,
    r * 0.15, -r * 0.3, r * 0.35
  );
  specGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(r * 0.15, -r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
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
      if (piece.scored && piece.body.y > h + 100) continue; // off-screen, skip physics
      const b = piece.body;
      b.update(dt);
      piece.rotation += piece.rotSpeed * dt;

      // Peg collisions (only above the bin line)
      if (!piece.scored) {
        for (const peg of this.pegs) {
          resolveCircleCollision(b, peg);
        }
      }

      // Side-wall containment (only while in the board zone)
      if (!piece.scored) {
        if (b.x - b.radius < this.boardLeft) {
          b.x = this.boardLeft + b.radius;
          b.vx = Math.abs(b.vx) * 0.5;
        }
        if (b.x + b.radius > this.boardLeft + this.boardWidth) {
          b.x = this.boardLeft + this.boardWidth - b.radius;
          b.vx = -Math.abs(b.vx) * 0.5;
        }
      }

      // ── Bin trigger zone (transparent — score but keep falling) ──
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
        // Do NOT stop the piece — let it fall through
      }
    }

    // Prune pieces that have fallen well off the bottom
    this.pieces = this.pieces.filter(p => p.body.y < h + 200);

    for (const bin of this.bins) {
      if (bin.flash > 0) bin.flash -= dt;
    }

    for (const p of this.scorePopups) {
      p.y -= 40 * dt;
      p.life -= dt;
    }
    this.scorePopups = this.scorePopups.filter(p => p.life > 0);

    // Done when all dropped and all scored or off-screen
    if (this.toDrop.length === 0 && this.pieces.length > 0) {
      const allScored = this.pieces.every(p => p.scored);
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

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#070b14');
    bg.addColorStop(0.4, '#0d1528');
    bg.addColorStop(1, '#131d35');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Board background
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(this.boardLeft, this.boardTop, this.boardWidth, this.boardHeight);

    // Board side walls
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

    // Pegs
    ctx.save();
    for (const peg of this.pegs) {
      ctx.shadowColor = PEG_GLOW_COLOR;
      ctx.shadowBlur = 12;

      const glow = ctx.createRadialGradient(peg.x, peg.y, 0, peg.x, peg.y, peg.radius * 2.5);
      glow.addColorStop(0, 'rgba(0,229,255,0.25)');
      glow.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

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

    // ── Bins — transparent trigger zones ──
    const binWidth = this.boardWidth / BIN_COUNT;
    const binTop = this.boardTop + this.boardHeight;
    for (let i = 0; i < this.bins.length; i++) {
      const bin = this.bins[i];
      const bx = this.boardLeft + binWidth * i;
      const glowColor = BIN_GLOW_COLORS[i] || '#546e7a';

      // Subtle transparent fill (no solid wall)
      const flashBoost = bin.flash > 0 ? bin.flash * 0.4 : 0;
      ctx.fillStyle = `rgba(255,255,255,${0.03 + flashBoost})`;
      ctx.fillRect(bx + 1, binTop, binWidth - 2, 30);

      // Glowing trigger line at the bin threshold
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = bin.flash > 0 ? 18 : 6;
      ctx.strokeStyle = glowColor;
      ctx.globalAlpha = 0.4 + (bin.flash > 0 ? bin.flash : 0);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(bx + 1, binTop);
      ctx.lineTo(bx + binWidth - 1, binTop);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Dividers
      ctx.fillStyle = 'rgba(0,229,255,0.12)';
      ctx.fillRect(bx, binTop, 1.5, 30);

      // Score label
      drawShadowedText(ctx, 'x' + bin.score, bx + binWidth / 2, binTop + 22,
        `bold 14px ${FONT_MAIN}`, glowColor);

      // Piece count
      if (bin.count > 0) {
        ctx.save();
        ctx.font = `12px ${FONT_MAIN}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(bin.count.toString(), bx + binWidth / 2, binTop + 36);
        ctx.restore();
      }
    }

    // ── Pieces — proper apple-slice rendering ──
    for (const piece of this.pieces) {
      const b = piece.body;
      if (b.y > h + 100) continue; // off-screen
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(piece.rotation);

      // Fade slightly once scored (falling away)
      if (piece.scored) {
        const fadeProgress = Math.min(1, (b.y - (this.boardTop + this.boardHeight)) / 150);
        ctx.globalAlpha = Math.max(0, 1 - fadeProgress * 0.7);
      }

      drawAppleSlice(ctx, b.radius);

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Score popups
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
