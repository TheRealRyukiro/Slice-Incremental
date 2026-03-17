// phase2_slice.js — Slicing phase: launch fruits, slice with mouse drag

import { Body, lineIntersectsCircle } from './physics.js';

// ── Tuning knobs (designed for future upgrade-tree attachment) ──
const SLICE_CONFIG = {
  appleRadius:    24,
  bombRadius:     26,
  maxOnScreen:    3,
  launchInterval: 0.6,
  bombChance:     0.15,
  trailLifetime:  0.25,
  // Launch physics
  launchVyMin:    -850,
  launchVyRange:  -300,
  launchVxRange:  150,
  // In-flight physics
  fruitGravity:   420,
  halfGravity:    550,
  // Bomb explosion
  bombHitstopDuration:  0.5,   // seconds fruits freeze
  bombTransitionDelay:  1.0,   // seconds before moving to Phase 3
  bombParticleCount:    35,
  bombShakeDuration:    0.4,
  bombShakeIntensity:   12,
  // Apple color (red only)
  apple: { base: '#e74c3c', mid: '#c0392b', dark: '#922b21' },
};

const FONT_MAIN = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

class SliceFruit {
  constructor(x, y, vx, vy, isBomb) {
    this.body = new Body(x, y, isBomb ? SLICE_CONFIG.bombRadius : SLICE_CONFIG.appleRadius, {
      vx, vy, gravity: SLICE_CONFIG.fruitGravity, restitution: 0.3,
    });
    this.isBomb = isBomb;
    if (isBomb) {
      this.color = '#2c3e50';
      this.colorBase = '#2c3e50';
      this.colorMid = '#1a252f';
      this.colorDark = '#0d1317';
    } else {
      this.color = SLICE_CONFIG.apple.base;
      this.colorBase = SLICE_CONFIG.apple.base;
      this.colorMid = SLICE_CONFIG.apple.mid;
      this.colorDark = SLICE_CONFIG.apple.dark;
    }
    this.sliced = false;
    this.missed = false;
    this.hidden = false;  // for bomb hide on explosion
    this.rotation = 0;
    this.rotSpeed = (Math.random() - 0.5) * 4;
  }
}

class FruitHalf {
  constructor(x, y, vx, vy, color, colorMid, angle) {
    this.body = new Body(x, y, SLICE_CONFIG.appleRadius * 0.7, {
      vx, vy, gravity: SLICE_CONFIG.halfGravity, restitution: 0.2,
    });
    this.color = color;
    this.colorMid = colorMid;
    this.angle = angle;
    this.fadeTimer = 2.5;
  }
}

class JuiceParticle {
  constructor(x, y, color) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 180;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 100;
    this.life = 1;
    this.color = color;
    this.radius = 2 + Math.random() * 4;
  }
}

function drawVolumetricFruit(ctx, r, base, mid, dark) {
  const grad = ctx.createRadialGradient(
    -r * 0.3, -r * 0.3, r * 0.1,
    0, 0, r
  );
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.15, base);
  grad.addColorStop(0.6, mid);
  grad.addColorStop(1, dark);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight
  const specGrad = ctx.createRadialGradient(
    -r * 0.35, -r * 0.35, 0,
    -r * 0.35, -r * 0.35, r * 0.45
  );
  specGrad.addColorStop(0, 'rgba(255,255,255,0.65)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.35, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Stem
  ctx.save();
  ctx.translate(0, -r + 1);
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(3, -7, 1, -12);
  ctx.stroke();
  ctx.fillStyle = '#4caf50';
  ctx.beginPath();
  ctx.ellipse(4, -8, 4.5, 2, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBomb(ctx, r, time) {
  const grad = ctx.createRadialGradient(
    -r * 0.25, -r * 0.25, r * 0.1,
    0, 0, r
  );
  grad.addColorStop(0, '#5c6370');
  grad.addColorStop(0.4, '#3a3f47');
  grad.addColorStop(0.8, '#1e2228');
  grad.addColorStop(1, '#0a0c0e');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(150,160,180,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 1, -Math.PI * 0.7, -Math.PI * 0.2);
  ctx.stroke();

  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.45);
  const pulse = 0.4 + 0.3 * Math.sin(time / 100);
  coreGrad.addColorStop(0, `rgba(255,60,30,${pulse})`);
  coreGrad.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#8d6e63';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(6, -r - 8, 3, -r - 16);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = '#ffab00';
  ctx.shadowBlur = 12;
  const sparkPulse = 0.5 + 0.5 * Math.sin(time / 60);
  ctx.fillStyle = `rgba(255,200,50,${sparkPulse})`;
  ctx.beginPath();
  ctx.arc(3, -r - 16, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,200,${sparkPulse * 0.8})`;
  ctx.beginPath();
  ctx.arc(3, -r - 16, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = `rgba(200,50,50,${0.5 + 0.2 * Math.sin(time / 150)})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-7, -6); ctx.lineTo(7, 6);
  ctx.moveTo(7, -6); ctx.lineTo(-7, 6);
  ctx.stroke();
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

export class Phase2 {
  constructor() {
    this.totalToLaunch = 0;
    this.launched = 0;
    this.launchTimer = 0;
    this.fruits = [];
    this.halves = [];
    this.trail = [];
    this.juiceParticles = [];
    this.isDragging = false;
    this.prevMouse = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.bombSliced = false;
    this.slicedCount = 0;
    this.sliceFlashes = [];
    // Bomb explosion state
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
    this.juiceParticles = [];
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
    this.mouseX = x;
    this.mouseY = y;
    this.prevMouse = { x, y };
  }

  onPointerMove(x, y) {
    this.mouseX = x;
    this.mouseY = y;
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
        this._splitFruit(fruit, x1, y1, x2, y2);
        this._spawnJuice(fruit);
      }
    }
  }

  _triggerBombExplosion(bomb) {
    const b = bomb.body;
    bomb.hidden = true;
    bomb.sliced = true;
    this.bombSliced = true;

    // Start hitstop (freeze)
    this.hitstopTimer = SLICE_CONFIG.bombHitstopDuration;
    this.transitionTimer = SLICE_CONFIG.bombTransitionDelay;
    this.shakeTimer = SLICE_CONFIG.bombShakeDuration;

    // Spawn explosion particles
    const count = SLICE_CONFIG.bombParticleCount;
    const colors = ['#ff9800', '#ff5722', '#ffeb3b', '#ffc107', '#ff6f00', '#fff176'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 200 + Math.random() * 400;
      this.explosionParticles.push({
        x: b.x, y: b.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: 3 + Math.random() * 7,
      });
    }
  }

  _splitFruit(fruit, x1, y1, x2, y2) {
    const b = fruit.body;
    const sdx = x2 - x1;
    const sdy = y2 - y1;
    const len = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
    const nx = -sdy / len;
    const ny = sdx / len;

    const splitSpeed = 120;
    const sliceAngle = Math.atan2(sdy, sdx);

    this.halves.push(new FruitHalf(
      b.x + nx * 4, b.y + ny * 4,
      b.vx + nx * splitSpeed, b.vy + ny * splitSpeed - 50,
      fruit.color, fruit.colorMid, sliceAngle,
    ));
    this.halves.push(new FruitHalf(
      b.x - nx * 4, b.y - ny * 4,
      b.vx - nx * splitSpeed, b.vy - ny * splitSpeed - 50,
      fruit.color, fruit.colorMid, sliceAngle + Math.PI,
    ));

    this.sliceFlashes.push({ x: b.x, y: b.y, life: 0.3 });
  }

  _spawnJuice(fruit) {
    const count = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      this.juiceParticles.push(
        new JuiceParticle(fruit.body.x, fruit.body.y, fruit.color)
      );
    }
  }

  _activeFruitCount() {
    return this.fruits.filter(f => !f.sliced && !f.missed).length;
  }

  update(dt) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // ── Bomb explosion sequencing ──
    if (this.bombSliced) {
      // Screen shake
      if (this.shakeTimer > 0) {
        this.shakeTimer -= dt;
        const intensity = SLICE_CONFIG.bombShakeIntensity * (this.shakeTimer / SLICE_CONFIG.bombShakeDuration);
        this.shakeOffsetX = (Math.random() - 0.5) * 2 * intensity;
        this.shakeOffsetY = (Math.random() - 0.5) * 2 * intensity;
      } else {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }

      // Hitstop countdown (fruits frozen during this)
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      }

      // Explosion particles always update
      for (const p of this.explosionParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 500 * dt;
        p.life -= dt * 1.2;
      }
      this.explosionParticles = this.explosionParticles.filter(p => p.life > 0);

      // Transition delay
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) return 'done';

      // During hitstop, skip fruit physics but still update trail/juice
      if (this.hitstopTimer > 0) {
        this._updateTrailAndJuice(dt);
        return null;
      }
    }

    // ── Normal phase logic ──
    this.launchTimer -= dt;
    if (this.launchTimer <= 0 && this.launched < this.totalToLaunch && this._activeFruitCount() < SLICE_CONFIG.maxOnScreen) {
      this._launchFruit(w, h);
      this.launchTimer = SLICE_CONFIG.launchInterval;
    }

    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.missed) continue;
      fruit.body.update(dt);
      fruit.rotation += fruit.rotSpeed * dt;
      if (fruit.body.y > h + 80) {
        fruit.missed = true;
      }
    }

    for (const half of this.halves) {
      half.body.update(dt);
      half.fadeTimer -= dt;
    }
    this.halves = this.halves.filter(h => h.fadeTimer > 0 && !h.body.isOffScreen(w, this.canvas.height));

    this._updateTrailAndJuice(dt);

    for (const f of this.sliceFlashes) {
      f.life -= dt;
    }
    this.sliceFlashes = this.sliceFlashes.filter(f => f.life > 0);

    const allLaunched = this.launched >= this.totalToLaunch;
    const allResolved = this.fruits.every(f => f.sliced || f.missed);
    if (allLaunched && allResolved) return 'done';

    return null;
  }

  _updateTrailAndJuice(dt) {
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter(t => t.life > 0);

    for (const p of this.juiceParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      p.life -= dt * 1.8;
    }
    this.juiceParticles = this.juiceParticles.filter(p => p.life > 0);
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

    // Apply screen shake
    ctx.save();
    if (this.shakeTimer > 0) {
      ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    }

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0b0e17');
    bg.addColorStop(0.5, '#101828');
    bg.addColorStop(1, '#162038');
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, w + 40, h + 40); // oversized to cover shake

    // --- Blade trail ---
    if (this.trail.length > 0) {
      ctx.save();
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const t of this.trail) {
        const alpha = t.life / SLICE_CONFIG.trailLifetime;
        const thickness = alpha * 8 + 2;
        const dx = t.x2 - t.x1;
        const dy = t.y2 - t.y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const headW = thickness;
        const tailW = thickness * 0.15;

        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = `rgba(200,250,255,${alpha * 0.85})`;
        ctx.beginPath();
        ctx.moveTo(t.x1 + nx * tailW, t.y1 + ny * tailW);
        ctx.lineTo(t.x2 + nx * headW, t.y2 + ny * headW);
        ctx.lineTo(t.x2 - nx * headW, t.y2 - ny * headW);
        ctx.lineTo(t.x1 - nx * tailW, t.y1 - ny * tailW);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Slice flash effects
    for (const f of this.sliceFlashes) {
      const p = f.life / 0.3;
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(255, 255, 220, ${p * 0.5})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 40 * (1 - p) + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Juice particles
    ctx.save();
    for (const p of this.juiceParticles) {
      ctx.globalAlpha = p.life * 0.9;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * Math.max(0.3, p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Fruits
    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.missed || fruit.hidden) continue;
      const b = fruit.body;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(fruit.rotation);

      if (fruit.isBomb) {
        drawBomb(ctx, b.radius, now);
      } else {
        drawVolumetricFruit(ctx, b.radius, fruit.colorBase, fruit.colorMid, fruit.colorDark);
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

      const hg = ctx.createRadialGradient(-b.radius * 0.2, 0, 0, 0, 0, b.radius);
      hg.addColorStop(0, half.color);
      hg.addColorStop(1, half.colorMid);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,230,0.25)';
      ctx.fillRect(-1, -b.radius, 3, b.radius * 2);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Explosion particles ──
    ctx.save();
    for (const p of this.explosionParticles) {
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * Math.max(0.3, p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // HUD
    drawShadowedText(ctx, `Sliced: ${this.slicedCount} / ${this.totalToLaunch}`,
      w / 2, 42, `bold 28px ${FONT_MAIN}`, '#fff');

    // End shake transform
    ctx.restore();
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
