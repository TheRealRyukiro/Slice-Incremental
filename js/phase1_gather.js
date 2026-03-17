// phase1_gather.js — Gathering phase: click/drag over apples on a tree to harvest

// ── Tuning knobs (designed for future upgrade-tree attachment) ──
const GATHER_CONFIG = {
  dayDuration:    10,    // seconds per day cycle
  growthInterval: 1.5,   // seconds between apple spawns
  maxApples:      18,    // tree capacity
  appleRadius:    22,
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
    this.harvested = false;
    this.harvestAnim = 0;
    this.scale = 0;       // grows from 0→1 on spawn
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
    this.mouseX = 0;
    this.mouseY = 0;
    this.harvestParticles = [];
    // Cached canopy bounds for spawning
    this._canopy = { cx: 0, cy: 0, rx: 0, ry: 0 };
  }

  enter(canvas) {
    this.apples = [];
    this.dayTimer = GATHER_CONFIG.dayDuration;
    this.growthTimer = 0;
    this.harvested = 0;
    this.isDragging = false;
    this.harvestParticles = [];

    const cx = canvas.width / 2;
    const treeTop = canvas.height * 0.12;
    const treeBottom = canvas.height * 0.55;
    const treeWidth = canvas.width * 0.35;

    this._canopy = {
      cx,
      cy: (treeTop + treeBottom) / 2,
      rx: treeWidth / 2,
      ry: (treeBottom - treeTop) / 2,
    };

    // Seed some initial apples
    const startCount = 4;
    for (let i = 0; i < startCount; i++) {
      this._spawnApple(true);
    }
  }

  _spawnApple(instant) {
    const living = this.apples.filter(a => !a.harvested).length;
    if (living >= GATHER_CONFIG.maxApples) return;

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
    this._tryHarvest(x, y);
  }

  onPointerMove(x, y) {
    this.mouseX = x;
    this.mouseY = y;
    if (this.isDragging) {
      this._tryHarvest(x, y);
    }
  }

  onPointerUp() {
    this.isDragging = false;
  }

  _tryHarvest(x, y) {
    for (const apple of this.apples) {
      if (apple.harvested) continue;
      const dx = x - apple.x;
      const dy = y - apple.y;
      if (dx * dx + dy * dy < (apple.radius + 10) ** 2) {
        apple.harvested = true;
        this.harvested++;
        this._spawnParticles(apple);
      }
    }
  }

  _spawnParticles(apple) {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
      const speed = 120 + Math.random() * 100;
      this.harvestParticles.push({
        x: apple.x, y: apple.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 1,
        color: apple.colorBase,
        radius: 3 + Math.random() * 4,
      });
    }
  }

  update(dt) {
    // Day timer countdown
    this.dayTimer -= dt;

    // Growth timer — spawn a new apple periodically
    this.growthTimer += dt;
    if (this.growthTimer >= GATHER_CONFIG.growthInterval) {
      this.growthTimer -= GATHER_CONFIG.growthInterval;
      this._spawnApple(false);
    }

    // Animate apple grow-in
    for (const a of this.apples) {
      if (!a.harvested && a.scale < 1) {
        a.scale = Math.min(1, a.scale + dt * 4);
      }
      if (a.harvested) {
        a.harvestAnim = Math.min(1, a.harvestAnim + dt * 5);
      }
    }

    // Prune fully-animated harvested apples
    this.apples = this.apples.filter(a => a.harvestAnim < 1 || !a.harvested);

    // Update particles
    for (const p of this.harvestParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt * 2;
    }
    this.harvestParticles = this.harvestParticles.filter(p => p.life > 0);

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

    // Apples
    for (const a of this.apples) {
      if (a.harvestAnim >= 1) continue;
      const s = a.harvested ? (1 - a.harvestAnim) * a.scale : a.scale;
      if (s <= 0) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.scale(s, s);
      ctx.globalAlpha = a.harvested ? 1 - a.harvestAnim : 1;
      drawVolumetricFruit(ctx, 0, 0, a.radius, a.colorBase, a.colorMid, a.colorDark);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Harvest particles
    ctx.save();
    for (const p of this.harvestParticles) {
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── HUD ──

    // Day Timer (top center)
    const dayLeft = Math.max(0, this.dayTimer);
    drawShadowedText(ctx, 'Day: ' + dayLeft.toFixed(1) + 's', w / 2, 52,
      `bold 38px ${FONT_MAIN}`, '#fff');

    // Harvest count
    drawShadowedText(ctx, 'Harvested: ' + this.harvested, w / 2, 88,
      `bold 24px ${FONT_MAIN}`, '#ffd700');

    // Growth timer bar (small, below harvest count)
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
      drawShadowedText(ctx, 'Click & drag to harvest!', w / 2, h - 40,
        `20px ${FONT_MAIN}`, '#fff');
      ctx.restore();
    }
  }

  getResult() {
    return { harvested: this.harvested };
  }
}
