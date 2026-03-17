// phase1_gather.js — Gathering phase: swipe to cut apples off the tree, collect in funnel

import { lineIntersectsCircle } from './physics.js';

// ── Tuning knobs (designed for future upgrade-tree attachment) ──
const GATHER_CONFIG = {
  dayDuration:    10,    // seconds per day cycle
  growthInterval: 1.5,   // seconds between apple spawns
  maxApples:      18,    // tree capacity
  appleRadius:    22,
  trailLifetime:  0.25,
  // Falling apple physics
  fallGravity:    650,
  // Funnel geometry (fraction of canvas)
  funnelTopWidth:   0.30,
  funnelBotWidth:   0.08,
  funnelTopY:       0.78,
  funnelBotY:       0.92,
  // Apple color (red only)
  apple: { base: '#e74c3c', mid: '#c0392b', dark: '#922b21' },
};

const FONT_MAIN = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

class Apple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = GATHER_CONFIG.appleRadius;
    this.colorBase = GATHER_CONFIG.apple.base;
    this.colorMid  = GATHER_CONFIG.apple.mid;
    this.colorDark = GATHER_CONFIG.apple.dark;
    // States: 'tree' → 'falling' → 'collected' / 'lost'
    this.state = 'tree';
    this.scale = 0;       // grows from 0→1 on spawn
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.rotSpeed = 0;
  }
}

// ── Shared drawing helpers ──

function drawVolumetricFruit(ctx, x, y, radius, base, mid, dark) {
  const grad = ctx.createRadialGradient(
    x - radius * 0.3, y - radius * 0.3, radius * 0.1,
    x, y, radius
  );
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.15, base);
  grad.addColorStop(0.6, mid);
  grad.addColorStop(1, dark);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight
  const specGrad = ctx.createRadialGradient(
    x - radius * 0.35, y - radius * 0.35, 0,
    x - radius * 0.35, y - radius * 0.35, radius * 0.45
  );
  specGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Stem
  ctx.save();
  ctx.translate(x, y - radius + 1);
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(3, -8, 1, -13);
  ctx.stroke();
  // Tiny leaf
  ctx.fillStyle = '#4caf50';
  ctx.beginPath();
  ctx.ellipse(4, -9, 5, 2.5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

export class Phase1 {
  constructor() {
    this.apples = [];
    this.dayTimer = GATHER_CONFIG.dayDuration;
    this.growthTimer = 0;
    this.harvested = 0;
    this.isDragging = false;
    this.prevMouse = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.trail = [];
    this.cutParticles = [];
    this._canopy = { cx: 0, cy: 0, rx: 0, ry: 0 };
    this._funnel = { lx1: 0, rx1: 0, lx2: 0, rx2: 0, topY: 0, botY: 0 };
  }

  enter(canvas) {
    this.apples = [];
    this.dayTimer = GATHER_CONFIG.dayDuration;
    this.growthTimer = 0;
    this.harvested = 0;
    this.isDragging = false;
    this.prevMouse = null;
    this.trail = [];
    this.cutParticles = [];

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const treeTop = h * 0.12;
    const treeBottom = h * 0.55;
    const treeWidth = w * 0.35;

    this._canopy = {
      cx,
      cy: (treeTop + treeBottom) / 2,
      rx: treeWidth / 2,
      ry: (treeBottom - treeTop) / 2,
    };

    // Precompute funnel geometry
    const ftw = w * GATHER_CONFIG.funnelTopWidth;
    const fbw = w * GATHER_CONFIG.funnelBotWidth;
    this._funnel = {
      lx1: cx - ftw / 2,
      rx1: cx + ftw / 2,
      lx2: cx - fbw / 2,
      rx2: cx + fbw / 2,
      topY: h * GATHER_CONFIG.funnelTopY,
      botY: h * GATHER_CONFIG.funnelBotY,
    };

    // Seed initial apples
    for (let i = 0; i < 4; i++) {
      this._spawnApple(true);
    }
  }

  _spawnApple(instant) {
    const onTree = this.apples.filter(a => a.state === 'tree').length;
    if (onTree >= GATHER_CONFIG.maxApples) return;

    const { cx, cy, rx, ry } = this._canopy;
    const angle = Math.random() * Math.PI * 2;
    const dr = Math.random() * 0.7 + 0.3;
    const fx = cx + Math.cos(angle) * rx * dr;
    const fy = cy + Math.sin(angle) * ry * 0.7 * dr;

    const a = new Apple(fx, fy);
    if (instant) a.scale = 1;
    this.apples.push(a);
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
        life: GATHER_CONFIG.trailLifetime,
      });
      this._checkSwipeCuts(this.prevMouse.x, this.prevMouse.y, x, y);
    }
    this.prevMouse = { x, y };
  }

  onPointerUp() {
    this.isDragging = false;
    this.prevMouse = null;
  }

  _checkSwipeCuts(x1, y1, x2, y2) {
    for (const apple of this.apples) {
      if (apple.state !== 'tree') continue;
      if (apple.scale < 0.8) continue; // don't cut while still growing
      if (lineIntersectsCircle(x1, y1, x2, y2, apple.x, apple.y, apple.radius)) {
        // Cut it free — give it velocity from the swipe direction
        apple.state = 'falling';
        const sdx = x2 - x1;
        const sdy = y2 - y1;
        apple.vx = sdx * 2 + (Math.random() - 0.5) * 30;
        apple.vy = sdy * 0.5 + 20; // gentle downward bias
        apple.rotSpeed = (Math.random() - 0.5) * 6;
        this._spawnCutParticles(apple);
      }
    }
  }

  _spawnCutParticles(apple) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      const speed = 80 + Math.random() * 80;
      this.cutParticles.push({
        x: apple.x, y: apple.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 1,
        color: '#4caf50', // leaf-green sparks
        radius: 2 + Math.random() * 3,
      });
    }
  }

  _isInsideFunnel(x, y) {
    const f = this._funnel;
    if (y < f.topY || y > f.botY) return false;
    const t = (y - f.topY) / (f.botY - f.topY);
    const leftEdge = f.lx1 + (f.lx2 - f.lx1) * t;
    const rightEdge = f.rx1 + (f.rx2 - f.rx1) * t;
    return x >= leftEdge && x <= rightEdge;
  }

  update(dt) {
    const canvasH = this._funnel.botY + 60; // approximate canvas height

    // Day timer countdown
    this.dayTimer -= dt;

    // Growth timer
    this.growthTimer += dt;
    if (this.growthTimer >= GATHER_CONFIG.growthInterval) {
      this.growthTimer -= GATHER_CONFIG.growthInterval;
      this._spawnApple(false);
    }

    // Update apples
    for (const a of this.apples) {
      if (a.state === 'tree') {
        if (a.scale < 1) a.scale = Math.min(1, a.scale + dt * 4);
      } else if (a.state === 'falling') {
        // Apply gravity
        a.vy += GATHER_CONFIG.fallGravity * dt;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.rotation += a.rotSpeed * dt;
        a.vx *= 0.999;

        // Check funnel collection
        if (a.y + a.radius >= this._funnel.topY && this._isInsideFunnel(a.x, a.y)) {
          // Guide apple toward funnel center
          const f = this._funnel;
          const t = Math.min(1, (a.y - f.topY) / (f.botY - f.topY));
          const centerX = (f.lx1 + f.rx1) / 2;
          a.vx += (centerX - a.x) * 2 * dt;

          // Collected when past bottom of funnel
          if (a.y >= f.botY) {
            a.state = 'collected';
            this.harvested++;
          }
        }

        // Lost if off screen
        if (a.y > canvasH + 100 || a.x < -100 || a.x > (this._funnel.rx1 * 2 / GATHER_CONFIG.funnelTopWidth) + 100) {
          a.state = 'lost';
        }
      }
    }

    // Prune collected/lost apples
    this.apples = this.apples.filter(a => a.state === 'tree' || a.state === 'falling');

    // Trail
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter(t => t.life > 0);

    // Cut particles
    for (const p of this.cutParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt * 2.5;
    }
    this.cutParticles = this.cutParticles.filter(p => p.life > 0);

    return this.dayTimer <= 0 ? 'done' : null;
  }

  draw(ctx, canvas) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;

    // Dark night sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b0e17');
    sky.addColorStop(0.5, '#121a2e');
    sky.addColorStop(1, '#1a2740');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Subtle stars
    ctx.save();
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.508) % w);
      const sy = ((i * 97.31 + 50) % (h * 0.6));
      const brightness = 0.15 + 0.15 * Math.sin(Date.now() / 800 + i);
      ctx.fillStyle = `rgba(255,255,255,${brightness})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Ground
    const groundGrad = ctx.createLinearGradient(0, h * 0.75, 0, h);
    groundGrad.addColorStop(0, '#1a3a1a');
    groundGrad.addColorStop(1, '#0d1f0d');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
    ctx.fillStyle = 'rgba(100,200,100,0.15)';
    ctx.fillRect(0, h * 0.75, w, 3);

    // Tree trunk
    const trunkW = 44;
    const trunkTop = h * 0.35;
    const trunkBot = h * 0.78;
    const trunkGrad = ctx.createLinearGradient(cx - trunkW / 2, 0, cx + trunkW / 2, 0);
    trunkGrad.addColorStop(0, '#3e2723');
    trunkGrad.addColorStop(0.3, '#6d4c41');
    trunkGrad.addColorStop(0.7, '#5d4037');
    trunkGrad.addColorStop(1, '#3e2723');
    ctx.fillStyle = trunkGrad;
    ctx.beginPath();
    ctx.moveTo(cx - trunkW / 2, trunkBot);
    ctx.lineTo(cx - trunkW / 2 + 5, trunkTop);
    ctx.lineTo(cx + trunkW / 2 - 5, trunkTop);
    ctx.lineTo(cx + trunkW / 2, trunkBot);
    ctx.fill();

    // Tree canopy
    const canopyCX = cx;
    const canopyCY = h * 0.28;
    const canopyRX = w * 0.18;
    const canopyRY = h * 0.18;

    const drawCanopyBlob = (bx, by, rx, ry, colorA, colorB) => {
      const cg = ctx.createRadialGradient(bx, by - ry * 0.3, 0, bx, by, Math.max(rx, ry));
      cg.addColorStop(0, colorA);
      cg.addColorStop(1, colorB);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    drawCanopyBlob(canopyCX, canopyCY, canopyRX, canopyRY, '#2ecc71', '#145a32');
    drawCanopyBlob(canopyCX - canopyRX * 0.4, canopyCY + canopyRY * 0.15,
      canopyRX * 0.7, canopyRY * 0.75, '#27ae60', '#0e4025');
    drawCanopyBlob(canopyCX + canopyRX * 0.4, canopyCY + canopyRY * 0.15,
      canopyRX * 0.7, canopyRY * 0.75, '#27ae60', '#0e4025');
    drawCanopyBlob(canopyCX, canopyCY - canopyRY * 0.25,
      canopyRX * 0.65, canopyRY * 0.6, '#34d67a', '#1a6b3a');

    // ── Funnel ──
    this._drawFunnel(ctx, w, h);

    // Apples (both on-tree and falling)
    for (const a of this.apples) {
      if (a.state === 'collected' || a.state === 'lost') continue;
      const s = a.scale;
      if (s <= 0) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);
      ctx.scale(s, s);
      drawVolumetricFruit(ctx, 0, 0, a.radius, a.colorBase, a.colorMid, a.colorDark);
      ctx.restore();
    }

    // ── Blade trail ──
    if (this.trail.length > 0) {
      ctx.save();
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const t of this.trail) {
        const alpha = t.life / GATHER_CONFIG.trailLifetime;
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

    // Cut particles
    ctx.save();
    for (const p of this.cutParticles) {
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── HUD ──
    const dayLeft = Math.max(0, this.dayTimer);
    drawShadowedText(ctx, 'Day: ' + dayLeft.toFixed(1) + 's', w / 2, 52,
      `bold 38px ${FONT_MAIN}`, '#fff');

    drawShadowedText(ctx, 'Collected: ' + this.harvested, w / 2, 88,
      `bold 24px ${FONT_MAIN}`, '#ffd700');

    // Growth timer bar
    const growPct = this.growthTimer / GATHER_CONFIG.growthInterval;
    const barW = 120;
    const barH = 6;
    const barX = w / 2 - barW / 2;
    const barY = 96;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = 'rgba(76,175,80,0.7)';
    ctx.fillRect(barX, barY, barW * growPct, barH);

    // Instruction
    if (this.dayTimer > GATHER_CONFIG.dayDuration - 2) {
      const alpha = Math.min(1, (GATHER_CONFIG.dayDuration - this.dayTimer) * 2);
      ctx.save();
      ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(Date.now() / 300));
      drawShadowedText(ctx, 'Swipe to cut apples into the funnel!', w / 2, h - 40,
        `20px ${FONT_MAIN}`, '#fff');
      ctx.restore();
    }
  }

  _drawFunnel(ctx, w, h) {
    const f = this._funnel;

    // Metallic funnel body
    ctx.save();
    const funnelGrad = ctx.createLinearGradient(f.lx1, f.topY, f.rx1, f.topY);
    funnelGrad.addColorStop(0, '#3a3a3a');
    funnelGrad.addColorStop(0.15, '#6a6a6a');
    funnelGrad.addColorStop(0.3, '#888');
    funnelGrad.addColorStop(0.5, '#aaa');
    funnelGrad.addColorStop(0.7, '#888');
    funnelGrad.addColorStop(0.85, '#6a6a6a');
    funnelGrad.addColorStop(1, '#3a3a3a');
    ctx.fillStyle = funnelGrad;

    ctx.beginPath();
    ctx.moveTo(f.lx1, f.topY);
    ctx.lineTo(f.rx1, f.topY);
    ctx.lineTo(f.rx2, f.botY);
    ctx.lineTo(f.lx2, f.botY);
    ctx.closePath();
    ctx.fill();

    // Rim highlight
    ctx.strokeStyle = 'rgba(200,200,220,0.6)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f.lx1, f.topY);
    ctx.lineTo(f.rx1, f.topY);
    ctx.stroke();

    // Inner shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(f.lx1 + 6, f.topY + 4);
    ctx.lineTo(f.rx1 - 6, f.topY + 4);
    ctx.lineTo(f.rx2, f.botY);
    ctx.lineTo(f.lx2, f.botY);
    ctx.closePath();
    ctx.fill();

    // Bolts / rivets (decorative)
    const rivetY = f.topY + 8;
    for (let i = 0; i < 4; i++) {
      const rx = f.lx1 + (f.rx1 - f.lx1) * ((i + 0.5) / 4);
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(rx, rivetY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(rx - 0.5, rivetY - 0.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  getResult() {
    return { harvested: this.harvested };
  }
}
