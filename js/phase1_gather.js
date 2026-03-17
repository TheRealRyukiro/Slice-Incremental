// phase1_gather.js — Gathering phase: swipe to detach data nodes from spawner

import { lineIntersectsCircle } from './physics.js';

// ── Tuning knobs (designed for future upgrade-tree attachment) ──
const GATHER_CONFIG = {
  dayDuration:    10,
  growthInterval: 1.5,
  maxApples:      18,
  appleRadius:    18,
  trailLifetime:  0.2,
  fallGravity:    650,
  // Visual
  nodeColor:  '#00e5ff',
  nodeGlow:   '#00b8d4',
  accentDim:  'rgba(0,229,255,0.15)',
};

const BG = '#0D1117';
const FONT = '"SF Mono", "Fira Code", "Cascadia Code", "Consolas", monospace';

class DataNode {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = GATHER_CONFIG.appleRadius;
    this.state = 'tree';   // 'tree' → 'falling' → 'collected' / 'lost'
    this.scale = 0;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.rotSpeed = 0;
    this.pulseOffset = Math.random() * Math.PI * 2;
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

export class Phase1 {
  constructor() {
    this.nodes = [];
    this.dayTimer = 0;
    this.growthTimer = 0;
    this.harvested = 0;
    this.isDragging = false;
    this.prevMouse = null;
    this.trail = [];
    this.cutParticles = [];
    this._spawner = { cx: 0, cy: 0, rx: 0, ry: 0 };
    this._canvasW = 0;
    this._canvasH = 0;
  }

  enter(canvas) {
    this.nodes = [];
    this.dayTimer = GATHER_CONFIG.dayDuration;
    this.growthTimer = 0;
    this.harvested = 0;
    this.isDragging = false;
    this.prevMouse = null;
    this.trail = [];
    this.cutParticles = [];

    const w = canvas.width;
    const h = canvas.height;
    this._canvasW = w;
    this._canvasH = h;

    this._spawner = {
      cx: w / 2,
      cy: h * 0.33,
      rx: w * 0.16,
      ry: h * 0.18,
    };

    for (let i = 0; i < 4; i++) this._spawnNode(true);
  }

  _spawnNode(instant) {
    const onTree = this.nodes.filter(n => n.state === 'tree').length;
    if (onTree >= GATHER_CONFIG.maxApples) return;

    const { cx, cy, rx, ry } = this._spawner;
    const angle = Math.random() * Math.PI * 2;
    const dr = Math.random() * 0.7 + 0.3;
    const n = new DataNode(
      cx + Math.cos(angle) * rx * dr,
      cy + Math.sin(angle) * ry * 0.7 * dr
    );
    if (instant) n.scale = 1;
    this.nodes.push(n);
  }

  onPointerDown(x, y) {
    this.isDragging = true;
    this.prevMouse = { x, y };
    // Check point-hit on tap (no movement yet)
    this._checkPointCut(x, y);
  }

  onPointerMove(x, y) {
    if (this.isDragging && this.prevMouse) {
      this.trail.push({
        x1: this.prevMouse.x, y1: this.prevMouse.y,
        x2: x, y2: y,
        life: GATHER_CONFIG.trailLifetime,
      });
      this._checkCuts(this.prevMouse.x, this.prevMouse.y, x, y);
    }
    this.prevMouse = { x, y };
  }

  onPointerUp() {
    this.isDragging = false;
    this.prevMouse = null;
  }

  _checkPointCut(x, y) {
    for (const n of this.nodes) {
      if (n.state !== 'tree' || n.scale < 0.8) continue;
      const dx = x - n.x;
      const dy = y - n.y;
      if (dx * dx + dy * dy < (n.radius + 8) ** 2) {
        this._detachNode(n, 0, 0);
      }
    }
  }

  _checkCuts(x1, y1, x2, y2) {
    for (const n of this.nodes) {
      if (n.state !== 'tree' || n.scale < 0.8) continue;
      if (lineIntersectsCircle(x1, y1, x2, y2, n.x, n.y, n.radius)) {
        const sdx = x2 - x1;
        const sdy = y2 - y1;
        this._detachNode(n, sdx, sdy);
      }
    }
  }

  _detachNode(n, sdx, sdy) {
    n.state = 'falling';
    n.vx = sdx * 2 + (Math.random() - 0.5) * 30;
    n.vy = sdy * 0.5 + 20;
    n.rotSpeed = (Math.random() - 0.5) * 6;
    // Count as collected immediately on detach
    this.harvested++;
    this._spawnCutParticles(n);
  }

  _spawnCutParticles(node) {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
      const speed = 100 + Math.random() * 100;
      this.cutParticles.push({
        x: node.x, y: node.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 1,
        radius: 1.5 + Math.random() * 2.5,
      });
    }
  }


  update(dt) {
    this.dayTimer -= dt;

    this.growthTimer += dt;
    if (this.growthTimer >= GATHER_CONFIG.growthInterval) {
      this.growthTimer -= GATHER_CONFIG.growthInterval;
      this._spawnNode(false);
    }

    for (const n of this.nodes) {
      if (n.state === 'tree') {
        if (n.scale < 1) n.scale = Math.min(1, n.scale + dt * 4);
      } else if (n.state === 'falling') {
        n.vy += GATHER_CONFIG.fallGravity * dt;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        n.rotation += n.rotSpeed * dt;
        n.vx *= 0.999;

        // Off screen — mark done (already counted on detach)
        if (n.y > this._canvasH + 60 || n.x < -100 || n.x > this._canvasW + 100) {
          n.state = 'gone';
        }
      }
    }

    this.nodes = this.nodes.filter(n => n.state === 'tree' || n.state === 'falling');

    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter(t => t.life > 0);

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
    const now = Date.now();

    // Solid dark background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // ── Spawner wireframe ──
    this._drawSpawner(ctx, now);

    // ── Data Nodes ──
    for (const n of this.nodes) {
      if (n.state === 'gone') continue;
      const s = n.scale;
      if (s <= 0) continue;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(n.rotation);
      ctx.scale(s, s);

      const pulse = 0.7 + 0.3 * Math.sin(now / 400 + n.pulseOffset);
      const r = n.radius;

      // Outer glow
      ctx.shadowColor = GATHER_CONFIG.nodeColor;
      ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = GATHER_CONFIG.nodeColor;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    // ── Blade trail ──
    if (this.trail.length > 0) {
      ctx.save();
      for (const t of this.trail) {
        const alpha = t.life / GATHER_CONFIG.trailLifetime;
        const thickness = alpha * 6 + 1;

        ctx.globalAlpha = alpha;
        ctx.shadowColor = '#2979ff';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#448aff';
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();

        // Bright core
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Cut particles ──
    ctx.save();
    for (const p of this.cutParticles) {
      ctx.globalAlpha = p.life;
      ctx.shadowColor = GATHER_CONFIG.nodeColor;
      ctx.shadowBlur = 6;
      ctx.fillStyle = GATHER_CONFIG.nodeColor;
      ctx.fillRect(p.x - p.radius / 2, p.y - p.radius / 2, p.radius, p.radius);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── HUD ──
    const dayLeft = Math.max(0, this.dayTimer);
    drawText(ctx, dayLeft.toFixed(1) + 's', w / 2, 48,
      `bold 36px ${FONT}`, '#fff');

    drawText(ctx, 'COLLECTED  ' + this.harvested, w / 2, 82,
      `14px ${FONT}`, GATHER_CONFIG.nodeColor);

    // Growth bar
    const growPct = this.growthTimer / GATHER_CONFIG.growthInterval;
    const barW = 100;
    const barH = 3;
    const barX = w / 2 - barW / 2;
    const barY = 92;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = GATHER_CONFIG.nodeColor;
    ctx.fillRect(barX, barY, barW * growPct, barH);

    // Instruction
    if (this.dayTimer > GATHER_CONFIG.dayDuration - 2.5) {
      const alpha = Math.min(1, (GATHER_CONFIG.dayDuration - this.dayTimer) * 1.5);
      ctx.save();
      ctx.globalAlpha = alpha * (0.4 + 0.4 * Math.sin(now / 300));
      drawText(ctx, 'SWIPE NODES TO COLLECT', w / 2, h - 36,
        `13px ${FONT}`, 'rgba(255,255,255,0.7)');
      ctx.restore();
    }
  }

  _drawSpawner(ctx, now) {
    const s = this._spawner;
    const pulse = 0.5 + 0.2 * Math.sin(now / 600);

    ctx.save();
    ctx.strokeStyle = `rgba(0,229,255,${0.12 * pulse})`;
    ctx.lineWidth = 1;

    // Outer hexagonal wireframe
    const sides = 6;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
      const px = s.cx + Math.cos(a) * s.rx * 1.15;
      const py = s.cy + Math.sin(a) * s.ry * 1.0;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Inner hexagonal wireframe
    ctx.strokeStyle = `rgba(0,229,255,${0.25 * pulse})`;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
      const px = s.cx + Math.cos(a) * s.rx * 0.85;
      const py = s.cy + Math.sin(a) * s.ry * 0.75;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Cross-hair lines
    ctx.strokeStyle = `rgba(0,229,255,0.06)`;
    ctx.beginPath();
    ctx.moveTo(s.cx - s.rx * 1.3, s.cy);
    ctx.lineTo(s.cx + s.rx * 1.3, s.cy);
    ctx.moveTo(s.cx, s.cy - s.ry * 1.2);
    ctx.lineTo(s.cx, s.cy + s.ry * 1.2);
    ctx.stroke();

    // Radial scan line (rotating)
    const scanAngle = (now / 2000) % (Math.PI * 2);
    ctx.strokeStyle = `rgba(0,229,255,0.1)`;
    ctx.beginPath();
    ctx.moveTo(s.cx, s.cy);
    ctx.lineTo(
      s.cx + Math.cos(scanAngle) * s.rx * 1.15,
      s.cy + Math.sin(scanAngle) * s.ry * 1.0
    );
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(0,229,255,0.3)';
    ctx.font = `10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('SPAWNER', s.cx, s.cy - s.ry * 1.1 - 8);

    ctx.restore();
  }

  getResult() {
    return { harvested: this.harvested };
  }
}
