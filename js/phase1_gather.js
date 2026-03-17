// phase1_gather.js — Gathering phase: click/drag over fruits on a tree to harvest

const FRUIT_TYPES = [
  { base: '#e74c3c', mid: '#c0392b', dark: '#922b21' }, // red apple
  { base: '#e67e22', mid: '#d35400', dark: '#a04000' }, // orange
  { base: '#f1c40f', mid: '#d4ac0d', dark: '#9a7d0a' }, // yellow
  { base: '#2ecc71', mid: '#27ae60', dark: '#1e8449' }, // green
  { base: '#9b59b6', mid: '#8e44ad', dark: '#6c3483' }, // plum
];
const FRUIT_RADIUS = 22;
const TIMER_DURATION = 8;

const FONT_MAIN = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

class Fruit {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = FRUIT_RADIUS;
    const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    this.colorBase = type.base;
    this.colorMid = type.mid;
    this.colorDark = type.dark;
    this.harvested = false;
    this.harvestAnim = 0;
    this.scale = 0;
    this.spawnDelay = Math.random() * 0.3;
    this.spawnTime = 0;
  }
}

function drawVolumetricFruit(ctx, x, y, radius, base, mid, dark) {
  // Radial gradient for 3D volume
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
    this.fruits = [];
    this.timer = TIMER_DURATION;
    this.harvested = 0;
    this.isDragging = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.harvestParticles = [];
    this.entered = false;
  }

  enter(canvas) {
    this.fruits = [];
    this.timer = TIMER_DURATION;
    this.harvested = 0;
    this.isDragging = false;
    this.harvestParticles = [];
    this.entered = true;

    const cx = canvas.width / 2;
    const treeTop = canvas.height * 0.12;
    const treeBottom = canvas.height * 0.55;
    const treeWidth = canvas.width * 0.35;

    const count = 12 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rx = (Math.random() * 0.7 + 0.3) * treeWidth / 2;
      const ry = (Math.random() * 0.7 + 0.3) * (treeBottom - treeTop) / 2;
      const fx = cx + Math.cos(angle) * rx;
      const fy = (treeTop + treeBottom) / 2 + Math.sin(angle) * ry * 0.7;
      this.fruits.push(new Fruit(fx, fy));
    }
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
    for (const fruit of this.fruits) {
      if (fruit.harvested) continue;
      const dx = x - fruit.x;
      const dy = y - fruit.y;
      if (dx * dx + dy * dy < (fruit.radius + 10) ** 2) {
        fruit.harvested = true;
        this.harvested++;
        this._spawnParticles(fruit);
      }
    }
  }

  _spawnParticles(fruit) {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
      const speed = 120 + Math.random() * 100;
      this.harvestParticles.push({
        x: fruit.x, y: fruit.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 1,
        color: fruit.colorBase,
        radius: 3 + Math.random() * 4,
      });
    }
  }

  update(dt) {
    this.timer -= dt;

    for (const f of this.fruits) {
      f.spawnTime += dt;
      if (!f.harvested && f.spawnTime > f.spawnDelay) {
        f.scale = Math.min(1, f.scale + dt * 4);
      }
      if (f.harvested) {
        f.harvestAnim = Math.min(1, f.harvestAnim + dt * 5);
      }
    }

    for (const p of this.harvestParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt * 2;
    }
    this.harvestParticles = this.harvestParticles.filter(p => p.life > 0);

    return this.timer <= 0 ? 'done' : null;
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

    // Ground — dark grassy
    const groundGrad = ctx.createLinearGradient(0, h * 0.75, 0, h);
    groundGrad.addColorStop(0, '#1a3a1a');
    groundGrad.addColorStop(1, '#0d1f0d');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
    // Ground edge highlight
    ctx.fillStyle = 'rgba(100,200,100,0.15)';
    ctx.fillRect(0, h * 0.75, w, 3);

    // Tree trunk with bark gradient
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

    // Tree canopy with layered gradients
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

    // Fruits
    for (const f of this.fruits) {
      if (f.harvestAnim >= 1) continue;
      const s = f.harvested ? (1 - f.harvestAnim) * f.scale : f.scale;
      if (s <= 0) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(s, s);
      ctx.globalAlpha = f.harvested ? 1 - f.harvestAnim : 1;

      drawVolumetricFruit(ctx, 0, 0, f.radius, f.colorBase, f.colorMid, f.colorDark);

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Harvest particles — glowing droplets
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

    // Timer
    const timeLeft = Math.max(0, this.timer);
    drawShadowedText(ctx, timeLeft.toFixed(1) + 's', w / 2, 52,
      `bold 38px ${FONT_MAIN}`, '#fff');

    // Harvest count
    drawShadowedText(ctx, 'Harvested: ' + this.harvested, w / 2, 88,
      `bold 24px ${FONT_MAIN}`, '#ffd700');

    // Instruction
    if (this.timer > TIMER_DURATION - 2) {
      const alpha = Math.min(1, (TIMER_DURATION - this.timer) * 2);
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
