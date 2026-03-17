// phase2_slice.js — Slicing phase: launch data nodes, slice with swipe

import { Body, lineIntersectsCircle } from './physics.js';

// ── Tuning knobs (designed for future upgrade-tree attachment) ──
const SLICE_CONFIG = {
  appleRadius:    24,
  bombRadius:     26,
  maxOnScreen:    3,
  launchInterval: 0.6,
  bombChance:     0.15,
  trailLifetime:  0.2,
  launchVyMin:    -850,
  launchVyRange:  -300,
  launchVxRange:  150,
  fruitGravity:   420,
  halfGravity:    550,
  bombHitstopDuration:  0.5,
  bombTransitionDelay:  1.0,
  bombParticleCount:    35,
  bombShakeDuration:    0.4,
  bombShakeIntensity:   12,
  // Visual
  nodeColor:   '#00e5ff',
  nodeGlow:    '#00b8d4',
  bombColor:   '#dc2626',
  bombGlow:    '#ef4444',
};

const BG = '#0D1117';
const FONT = '"SF Mono", "Fira Code", "Cascadia Code", "Consolas", monospace';

class SliceFruit {
  constructor(x, y, vx, vy, isBomb) {
    this.body = new Body(x, y, isBomb ? SLICE_CONFIG.bombRadius : SLICE_CONFIG.appleRadius, {
      vx, vy, gravity: SLICE_CONFIG.fruitGravity, restitution: 0.3,
    });
    this.isBomb = isBomb;
    this.color = isBomb ? SLICE_CONFIG.bombColor : SLICE_CONFIG.nodeColor;
    this.sliced = false;
    this.missed = false;
    this.hidden = false;
    this.rotation = 0;
    this.rotSpeed = (Math.random() - 0.5) * 4;
    this.pulseOffset = Math.random() * Math.PI * 2;
  }
}

class NodeHalf {
  constructor(x, y, vx, vy, color, angle) {
    this.body = new Body(x, y, SLICE_CONFIG.appleRadius * 0.7, {
      vx, vy, gravity: SLICE_CONFIG.halfGravity, restitution: 0.2,
    });
    this.color = color;
    this.angle = angle;
    this.fadeTimer = 2.5;
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

export class Phase2 {
  constructor() {
    this.totalToLaunch = 0;
    this.launched = 0;
    this.launchTimer = 0;
    this.fruits = [];
    this.halves = [];
    this.trail = [];
    this.sliceParticles = [];
    this.isDragging = false;
    this.prevMouse = null;
    this.bombSliced = false;
    this.slicedCount = 0;
    this.sliceFlashes = [];
    this.explosionParticles = [];
    this.hitstopTimer = 0;
    this.transitionTimer = 0;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  enter(canvas, data) {
    this.totalToLaunch = data.harvested || 5;
    this.launched = 0;
    this.launchTimer = 0.8;
    this.fruits = [];
    this.halves = [];
    this.trail = [];
    this.sliceParticles = [];
    this.isDragging = false;
    this.prevMouse = null;
    this.bombSliced = false;
    this.slicedCount = 0;
    this.sliceFlashes = [];
    this.explosionParticles = [];
    this.hitstopTimer = 0;
    this.transitionTimer = 0;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.canvas = canvas;
  }

  onPointerDown(x, y) {
    this.isDragging = true;
    this.prevMouse = { x, y };
  }

  onPointerMove(x, y) {
    if (this.isDragging && this.prevMouse) {
      this.trail.push({
        x1: this.prevMouse.x, y1: this.prevMouse.y,
        x2: x, y2: y,
        life: SLICE_CONFIG.trailLifetime,
      });
      if (!this.bombSliced) {
        this._checkSlices(this.prevMouse.x, this.prevMouse.y, x, y);
      }
    }
    this.prevMouse = { x, y };
  }

  onPointerUp() {
    this.isDragging = false;
    this.prevMouse = null;
  }

  _checkSlices(x1, y1, x2, y2) {
    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.missed || fruit.hidden) continue;
      const b = fruit.body;
      if (lineIntersectsCircle(x1, y1, x2, y2, b.x, b.y, b.radius)) {
        if (fruit.isBomb) {
          this._triggerBombExplosion(fruit);
          return;
        }
        fruit.sliced = true;
        this.slicedCount++;
        this._splitNode(fruit, x1, y1, x2, y2);
        this._spawnSliceParticles(fruit);
      }
    }
  }

  _triggerBombExplosion(bomb) {
    const b = bomb.body;
    bomb.hidden = true;
    bomb.sliced = true;
    this.bombSliced = true;
    this.hitstopTimer = SLICE_CONFIG.bombHitstopDuration;
    this.transitionTimer = SLICE_CONFIG.bombTransitionDelay;
    this.shakeTimer = SLICE_CONFIG.bombShakeDuration;

    const count = SLICE_CONFIG.bombParticleCount;
    const colors = [SLICE_CONFIG.bombColor, '#ff6b6b', '#ff8a65', '#ef5350'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 200 + Math.random() * 400;
      this.explosionParticles.push({
        x: b.x, y: b.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: 2 + Math.random() * 5,
      });
    }
  }

  _splitNode(fruit, x1, y1, x2, y2) {
    const b = fruit.body;
    const sdx = x2 - x1;
    const sdy = y2 - y1;
    const len = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
    const nx = -sdy / len;
    const ny = sdx / len;
    const splitSpeed = 120;
    const sliceAngle = Math.atan2(sdy, sdx);

    this.halves.push(new NodeHalf(
      b.x + nx * 4, b.y + ny * 4,
      b.vx + nx * splitSpeed, b.vy + ny * splitSpeed - 50,
      fruit.color, sliceAngle,
    ));
    this.halves.push(new NodeHalf(
      b.x - nx * 4, b.y - ny * 4,
      b.vx - nx * splitSpeed, b.vy - ny * splitSpeed - 50,
      fruit.color, sliceAngle + Math.PI,
    ));

    this.sliceFlashes.push({ x: b.x, y: b.y, life: 0.25 });
  }

  _spawnSliceParticles(fruit) {
    const b = fruit.body;
    const count = 12 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      this.sliceParticles.push({
        x: b.x, y: b.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        life: 1,
        radius: 1.5 + Math.random() * 2.5,
      });
    }
  }

  _activeFruitCount() {
    return this.fruits.filter(f => !f.sliced && !f.missed).length;
  }

  update(dt) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Bomb explosion sequencing
    if (this.bombSliced) {
      if (this.shakeTimer > 0) {
        this.shakeTimer -= dt;
        const intensity = SLICE_CONFIG.bombShakeIntensity * (this.shakeTimer / SLICE_CONFIG.bombShakeDuration);
        this.shakeOffsetX = (Math.random() - 0.5) * 2 * intensity;
        this.shakeOffsetY = (Math.random() - 0.5) * 2 * intensity;
      } else {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }

      if (this.hitstopTimer > 0) this.hitstopTimer -= dt;

      for (const p of this.explosionParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 500 * dt;
        p.life -= dt * 1.2;
      }
      this.explosionParticles = this.explosionParticles.filter(p => p.life > 0);

      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) return 'done';

      if (this.hitstopTimer > 0) {
        this._updateTrailAndParticles(dt);
        return null;
      }
    }

    this.launchTimer -= dt;
    if (this.launchTimer <= 0 && this.launched < this.totalToLaunch && this._activeFruitCount() < SLICE_CONFIG.maxOnScreen) {
      this._launchFruit(w, h);
      this.launchTimer = SLICE_CONFIG.launchInterval;
    }

    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.missed) continue;
      fruit.body.update(dt);
      fruit.rotation += fruit.rotSpeed * dt;
      if (fruit.body.y > h + 80) fruit.missed = true;
    }

    for (const half of this.halves) {
      half.body.update(dt);
      half.fadeTimer -= dt;
    }
    this.halves = this.halves.filter(h => h.fadeTimer > 0 && !h.body.isOffScreen(w, this.canvas.height));

    this._updateTrailAndParticles(dt);

    for (const f of this.sliceFlashes) f.life -= dt;
    this.sliceFlashes = this.sliceFlashes.filter(f => f.life > 0);

    const allLaunched = this.launched >= this.totalToLaunch;
    const allResolved = this.fruits.every(f => f.sliced || f.missed);
    if (allLaunched && allResolved) return 'done';

    return null;
  }

  _updateTrailAndParticles(dt) {
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter(t => t.life > 0);

    for (const p of this.sliceParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      p.life -= dt * 2;
    }
    this.sliceParticles = this.sliceParticles.filter(p => p.life > 0);
  }

  _launchFruit(w, h) {
    const isBomb = Math.random() < SLICE_CONFIG.bombChance;
    const x = w * 0.2 + Math.random() * w * 0.6;
    const vx = (Math.random() - 0.5) * SLICE_CONFIG.launchVxRange;
    const vy = SLICE_CONFIG.launchVyMin + Math.random() * SLICE_CONFIG.launchVyRange;
    this.fruits.push(new SliceFruit(x, h + 40, vx, vy, isBomb));
    this.launched++;
  }

  draw(ctx, canvas) {
    const w = canvas.width;
    const h = canvas.height;
    const now = Date.now();

    ctx.save();
    if (this.shakeTimer > 0) {
      ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    }

    // Solid dark background
    ctx.fillStyle = BG;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    // ── Blade trail — electric blue ribbon ──
    if (this.trail.length > 0) {
      ctx.save();
      for (const t of this.trail) {
        const alpha = t.life / SLICE_CONFIG.trailLifetime;
        const thickness = alpha * 6 + 1;

        // Outer glow
        ctx.globalAlpha = alpha * 0.8;
        ctx.shadowColor = '#2979ff';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#448aff';
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();

        // White core
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Slice flashes ──
    for (const f of this.sliceFlashes) {
      const p = f.life / 0.25;
      ctx.save();
      ctx.globalAlpha = p * 0.5;
      ctx.shadowColor = SLICE_CONFIG.nodeColor;
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 30 * (1 - p) + 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Slice pixel particles ──
    ctx.save();
    for (const p of this.sliceParticles) {
      ctx.globalAlpha = p.life;
      ctx.shadowColor = SLICE_CONFIG.nodeColor;
      ctx.shadowBlur = 4;
      ctx.fillStyle = SLICE_CONFIG.nodeColor;
      ctx.fillRect(p.x - p.radius / 2, p.y - p.radius / 2, p.radius, p.radius);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── Data nodes (whole) ──
    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.missed || fruit.hidden) continue;
      const b = fruit.body;
      const pulse = 0.7 + 0.3 * Math.sin(now / 400 + fruit.pulseOffset);

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(fruit.rotation);

      // Glow + fill
      ctx.shadowColor = fruit.color;
      ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = fruit.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Bomb icon — X in center
      if (fruit.isBomb) {
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 120);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(8, 8);
        ctx.moveTo(8, -8); ctx.lineTo(-8, 8);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Node halves — crisp geometric semi-circles ──
    for (const half of this.halves) {
      const b = half.body;
      const alpha = Math.min(1, half.fadeTimer);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(half.angle);
      ctx.globalAlpha = alpha;

      ctx.shadowColor = half.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = half.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();

      // Flat edge
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(-1, -b.radius, 2, b.radius * 2);

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Explosion particles ──
    ctx.save();
    for (const p of this.explosionParticles) {
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.radius / 2, p.y - p.radius / 2, p.radius, p.radius);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── HUD ──
    drawText(ctx, `${this.slicedCount} / ${this.totalToLaunch}`,
      w / 2, 42, `bold 28px ${FONT}`, '#fff');

    drawText(ctx, 'SLICED',
      w / 2, 62, `11px ${FONT}`, 'rgba(255,255,255,0.35)');

    ctx.restore(); // end shake
  }

  getResult() {
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
