// phase2_slice.js — Slicing phase: launch fruits, slice with mouse drag

import { Body, lineIntersectsCircle } from './physics.js';

const FRUIT_RADIUS = 24;
const BOMB_RADIUS = 26;
const MAX_ON_SCREEN = 3;
const LAUNCH_INTERVAL = 0.6;
const BOMB_CHANCE = 0.15;
const TRAIL_LIFETIME = 0.25;
const FRUIT_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#9b59b6'];

class SliceFruit {
  constructor(x, y, vx, vy, isBomb) {
    this.body = new Body(x, y, isBomb ? BOMB_RADIUS : FRUIT_RADIUS, {
      vx, vy, gravity: 600, restitution: 0.3,
    });
    this.isBomb = isBomb;
    this.color = isBomb ? '#e74c3c' : FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)];
    this.sliced = false;
    this.missed = false;
  }
}

class FruitHalf {
  constructor(x, y, vx, vy, color, angle) {
    this.body = new Body(x, y, FRUIT_RADIUS * 0.7, {
      vx, vy, gravity: 700, restitution: 0.2,
    });
    this.color = color;
    this.angle = angle; // which half: 0 or PI
    this.fadeTimer = 2.5;
  }
}

export class Phase2 {
  constructor() {
    this.totalToLaunch = 0;
    this.launched = 0;
    this.launchTimer = 0;
    this.fruits = [];
    this.halves = [];
    this.trail = [];
    this.isDragging = false;
    this.prevMouse = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.bombSliced = false;
    this.slicedCount = 0;
    this.flashTimer = 0;
    this.sliceFlashes = [];
    this.bombFlash = 0;
  }

  enter(canvas, data) {
    this.totalToLaunch = data.harvested || 5;
    this.launched = 0;
    this.launchTimer = 0.8; // initial delay
    this.fruits = [];
    this.halves = [];
    this.trail = [];
    this.isDragging = false;
    this.prevMouse = null;
    this.bombSliced = false;
    this.slicedCount = 0;
    this.sliceFlashes = [];
    this.bombFlash = 0;
    this.canvas = canvas;
  }

  onPointerDown(x, y) {
    this.isDragging = true;
    this.mouseX = x;
    this.mouseY = y;
    this.prevMouse = { x, y };
  }

  onPointerMove(x, y) {
    this.mouseX = x;
    this.mouseY = y;
    if (this.isDragging && this.prevMouse) {
      // Add trail segment
      this.trail.push({
        x1: this.prevMouse.x, y1: this.prevMouse.y,
        x2: x, y2: y,
        life: TRAIL_LIFETIME,
      });
      // Check slice intersections
      this._checkSlices(this.prevMouse.x, this.prevMouse.y, x, y);
    }
    this.prevMouse = { x, y };
  }

  onPointerUp() {
    this.isDragging = false;
    this.prevMouse = null;
  }

  _checkSlices(x1, y1, x2, y2) {
    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.missed) continue;
      const b = fruit.body;
      if (lineIntersectsCircle(x1, y1, x2, y2, b.x, b.y, b.radius)) {
        if (fruit.isBomb) {
          this.bombSliced = true;
          this.bombFlash = 0.5;
          return;
        }
        fruit.sliced = true;
        this.slicedCount++;
        this._splitFruit(fruit, x1, y1, x2, y2);
      }
    }
  }

  _splitFruit(fruit, x1, y1, x2, y2) {
    const b = fruit.body;
    // Slice direction
    const sdx = x2 - x1;
    const sdy = y2 - y1;
    const len = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
    // Normal to slice direction
    const nx = -sdy / len;
    const ny = sdx / len;

    const splitSpeed = 120;
    const sliceAngle = Math.atan2(sdy, sdx);

    // Two halves fly apart along the normal
    this.halves.push(new FruitHalf(
      b.x + nx * 4, b.y + ny * 4,
      b.vx + nx * splitSpeed, b.vy + ny * splitSpeed - 50,
      fruit.color, sliceAngle,
    ));
    this.halves.push(new FruitHalf(
      b.x - nx * 4, b.y - ny * 4,
      b.vx - nx * splitSpeed, b.vy - ny * splitSpeed - 50,
      fruit.color, sliceAngle + Math.PI,
    ));

    // Slice flash effect
    this.sliceFlashes.push({ x: b.x, y: b.y, life: 0.3 });
  }

  _activeFruitCount() {
    return this.fruits.filter(f => !f.sliced && !f.missed).length;
  }

  update(dt) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Launch fruits
    this.launchTimer -= dt;
    if (this.launchTimer <= 0 && this.launched < this.totalToLaunch && this._activeFruitCount() < MAX_ON_SCREEN) {
      this._launchFruit(w, h);
      this.launchTimer = LAUNCH_INTERVAL;
    }

    // Update fruits
    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.missed) continue;
      fruit.body.update(dt);
      if (fruit.body.y > h + 80) {
        fruit.missed = true;
      }
    }

    // Update halves
    for (const half of this.halves) {
      half.body.update(dt);
      half.fadeTimer -= dt;
    }
    this.halves = this.halves.filter(h => h.fadeTimer > 0 && !h.body.isOffScreen(w, this.canvas.height));

    // Update trail
    for (const t of this.trail) {
      t.life -= dt;
    }
    this.trail = this.trail.filter(t => t.life > 0);

    // Update effects
    for (const f of this.sliceFlashes) {
      f.life -= dt;
    }
    this.sliceFlashes = this.sliceFlashes.filter(f => f.life > 0);
    if (this.bombFlash > 0) this.bombFlash -= dt;

    // Check done
    if (this.bombSliced && this.bombFlash <= 0) return 'done';
    const allLaunched = this.launched >= this.totalToLaunch;
    const allResolved = this.fruits.every(f => f.sliced || f.missed);
    if (allLaunched && allResolved) return 'done';

    return null;
  }

  _launchFruit(w, h) {
    const isBomb = Math.random() < BOMB_CHANCE;
    const x = w * 0.2 + Math.random() * w * 0.6;
    const vx = (Math.random() - 0.5) * 150;
    const vy = -550 - Math.random() * 200;
    this.fruits.push(new SliceFruit(x, h + 40, vx, vy, isBomb));
    this.launched++;
  }

  draw(ctx, canvas) {
    const w = canvas.width;
    const h = canvas.height;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a1a2e');
    bg.addColorStop(1, '#16213e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Bomb flash overlay
    if (this.bombFlash > 0) {
      ctx.fillStyle = `rgba(255, 50, 50, ${this.bombFlash})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Slice trail
    for (const t of this.trail) {
      const alpha = t.life / TRAIL_LIFETIME;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.lineWidth = 3 + alpha * 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }

    // Slice flash effects
    for (const f of this.sliceFlashes) {
      const p = f.life / 0.3;
      ctx.fillStyle = `rgba(255, 255, 200, ${p * 0.6})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 40 * (1 - p) + 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fruits
    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.missed) continue;
      const b = fruit.body;
      ctx.save();
      ctx.translate(b.x, b.y);

      if (fruit.isBomb) {
        // Bomb body
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
        // Fuse highlight
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -b.radius);
        ctx.lineTo(4, -b.radius - 10);
        ctx.stroke();
        // Spark
        ctx.fillStyle = `rgba(255, 200, 50, ${0.5 + 0.5 * Math.sin(Date.now() / 80)})`;
        ctx.beginPath();
        ctx.arc(4, -b.radius - 12, 4, 0, Math.PI * 2);
        ctx.fill();
        // X marks
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(8, 8);
        ctx.moveTo(8, -8); ctx.lineTo(-8, 8);
        ctx.stroke();
      } else {
        // Fruit shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(2, 2, b.radius, 0, Math.PI * 2);
        ctx.fill();
        // Fruit body
        ctx.fillStyle = fruit.color;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(-b.radius * 0.3, -b.radius * 0.3, b.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Fruit halves
    for (const half of this.halves) {
      const b = half.body;
      const alpha = Math.min(1, half.fadeTimer);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(half.angle);
      ctx.globalAlpha = alpha;
      // Draw half circle
      ctx.fillStyle = half.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      // Flat edge
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(-1, -b.radius, 2, b.radius * 2);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // HUD
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    const hudText = `Sliced: ${this.slicedCount} / ${this.totalToLaunch}`;
    ctx.strokeText(hudText, w / 2, 40);
    ctx.fillText(hudText, w / 2, 40);
    ctx.lineWidth = 1;
  }

  getResult() {
    // Count surviving halves (those from non-bomb slices)
    // Each sliced fruit produced 2 halves
    return {
      slicedCount: this.slicedCount,
      halvesCount: this.slicedCount * 2,
      fruitColors: this._getSlicedColors(),
      bombHit: this.bombSliced,
    };
  }

  _getSlicedColors() {
    const colors = [];
    for (const fruit of this.fruits) {
      if (fruit.sliced && !fruit.isBomb) {
        colors.push(fruit.color, fruit.color);
      }
    }
    return colors;
  }
}
