// phase3_plinko.js — Plinko phase: drop fruit halves through a pegboard into scoring bins

import { Body, resolveCircleCollision } from './physics.js';

const PEG_RADIUS = 6;
const HALF_RADIUS = 10;
const PEG_ROWS = 8;
const PEG_COLS = 9;
const BIN_COUNT = PEG_COLS + 1;
const BIN_SCORES = [1, 3, 5, 10, 25, 10, 5, 3, 1, 1];
const DROP_INTERVAL = 0.3;
const SETTLE_TIME = 3; // seconds after last drop to auto-finish

class PlinkoHalf {
  constructor(x, y, color) {
    this.body = new Body(x, y, HALF_RADIUS, {
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

    // Board dimensions
    this.boardWidth = w * 0.8;
    this.boardLeft = (w - this.boardWidth) / 2;
    this.boardTop = h * 0.1;
    this.boardHeight = h * 0.7;

    // Create pegs
    const rowSpacing = this.boardHeight / (PEG_ROWS + 1);
    const colSpacing = this.boardWidth / PEG_COLS;

    for (let row = 0; row < PEG_ROWS; row++) {
      const y = this.boardTop + rowSpacing * (row + 1);
      const offset = (row % 2 === 0) ? 0 : colSpacing / 2;
      const cols = (row % 2 === 0) ? PEG_COLS : PEG_COLS - 1;
      for (let col = 0; col < cols; col++) {
        const x = this.boardLeft + colSpacing / 2 + col * colSpacing + offset;
        this.pegs.push(new Body(x, y, PEG_RADIUS, {
          isStatic: true,
          restitution: 0.6,
        }));
      }
    }

    // Create bins
    this.binScores = BIN_SCORES.slice(0, BIN_COUNT);
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

    // Queue the fruit halves to drop
    const colors = data.fruitColors || [];
    const halvesCount = data.halvesCount || 0;
    this.toDrop = [];
    for (let i = 0; i < halvesCount; i++) {
      this.toDrop.push(colors[i] || '#e67e22');
    }
    this.dropTimer = 0.5;
  }

  onPointerDown() {}
  onPointerMove() {}
  onPointerUp() {}

  update(dt) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Drop pieces
    this.dropTimer -= dt;
    if (this.dropTimer <= 0 && this.toDrop.length > 0) {
      const color = this.toDrop.shift();
      const dropX = w / 2 + (Math.random() - 0.5) * 60;
      this.pieces.push(new PlinkoHalf(dropX, this.boardTop - 20, color));
      this.dropTimer = DROP_INTERVAL;
    }

    // Update pieces
    for (const piece of this.pieces) {
      if (piece.scored) continue;
      const b = piece.body;
      b.update(dt);
      piece.rotation += piece.rotSpeed * dt;

      // Peg collisions
      for (const peg of this.pegs) {
        resolveCircleCollision(b, peg);
      }

      // Wall bounds (board sides)
      if (b.x - b.radius < this.boardLeft) {
        b.x = this.boardLeft + b.radius;
        b.vx = Math.abs(b.vx) * 0.5;
      }
      if (b.x + b.radius > this.boardLeft + this.boardWidth) {
        b.x = this.boardLeft + this.boardWidth - b.radius;
        b.vx = -Math.abs(b.vx) * 0.5;
      }

      // Check bins
      const binTop = this.boardTop + this.boardHeight;
      if (b.y + b.radius >= binTop) {
        // Find which bin
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

        // Rest the piece in the bin
        b.vy = 0;
        b.vx = 0;
        b.y = binTop + 5;
      }
    }

    // Update bin flash
    for (const bin of this.bins) {
      if (bin.flash > 0) bin.flash -= dt;
    }

    // Update score popups
    for (const p of this.scorePopups) {
      p.y -= 40 * dt;
      p.life -= dt;
    }
    this.scorePopups = this.scorePopups.filter(p => p.life > 0);

    // Settle check: done when all dropped and all scored
    if (this.toDrop.length === 0) {
      const allScored = this.pieces.length > 0 && this.pieces.every(p => p.scored);
      if (allScored) {
        this.settleTimer += dt;
        if (this.settleTimer > 1.5) return 'done';
      }
    }

    // Edge case: nothing to drop at all
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
    bg.addColorStop(0, '#0f3460');
    bg.addColorStop(1, '#16213e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Board background
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(this.boardLeft, this.boardTop, this.boardWidth, this.boardHeight);

    // Board side walls
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.boardLeft, this.boardTop);
    ctx.lineTo(this.boardLeft, this.boardTop + this.boardHeight);
    ctx.moveTo(this.boardLeft + this.boardWidth, this.boardTop);
    ctx.lineTo(this.boardLeft + this.boardWidth, this.boardTop + this.boardHeight);
    ctx.stroke();

    // Pegs
    for (const peg of this.pegs) {
      ctx.fillStyle = '#a0a0b0';
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      ctx.fill();
      // Peg highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(peg.x - 1.5, peg.y - 1.5, peg.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bins
    const binWidth = this.boardWidth / BIN_COUNT;
    const binTop = this.boardTop + this.boardHeight;
    for (let i = 0; i < this.bins.length; i++) {
      const bin = this.bins[i];
      const bx = this.boardLeft + binWidth * i;

      // Bin background
      const brightness = bin.flash > 0 ? 0.15 + bin.flash * 0.4 : 0.08;
      ctx.fillStyle = `rgba(255,255,255,${brightness})`;
      ctx.fillRect(bx + 1, binTop, binWidth - 2, bin.height);

      // Bin divider
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(bx, binTop, 2, bin.height);

      // Bin score label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('x' + bin.score, bx + binWidth / 2, binTop + bin.height - 8);

      // Piece count in bin
      if (bin.count > 0) {
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(bin.count.toString(), bx + binWidth / 2, binTop + 18);
      }
    }

    // Pieces
    for (const piece of this.pieces) {
      const b = piece.body;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(piece.rotation);
      ctx.globalAlpha = piece.scored ? 0.4 : 1;
      ctx.fillStyle = piece.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(-1, -b.radius, 2, b.radius * 2);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Score popups
    for (const p of this.scorePopups) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // Score HUD
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    const scoreText = 'Score: ' + this.score;
    ctx.strokeText(scoreText, w / 2, 45);
    ctx.fillText(scoreText, w / 2, 45);
    ctx.lineWidth = 1;

    // Remaining count
    if (this.toDrop.length > 0) {
      ctx.font = '18px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`Dropping: ${this.toDrop.length} remaining`, w / 2, 75);
    }
  }

  getResult() {
    return { score: this.score };
  }
}
