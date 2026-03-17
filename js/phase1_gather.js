// phase1_gather.js — Gathering phase: click/drag over fruits on a tree to harvest

const FRUIT_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#9b59b6'];
const FRUIT_RADIUS = 22;
const TIMER_DURATION = 8; // seconds
const TREE_TRUNK_COLOR = '#8B5E3C';
const TREE_LEAF_COLOR = '#27ae60';

class Fruit {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = FRUIT_RADIUS;
    this.color = FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)];
    this.harvested = false;
    this.harvestAnim = 0; // 0..1 animation progress
    this.scale = 0;
    this.spawnDelay = Math.random() * 0.3;
    this.spawnTime = 0;
  }
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

    // Place fruits in the canopy area
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
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      const speed = 120 + Math.random() * 80;
      this.harvestParticles.push({
        x: fruit.x, y: fruit.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 1,
        color: fruit.color,
        radius: 3 + Math.random() * 3,
      });
    }
  }

  update(dt) {
    this.timer -= dt;

    // Animate fruit spawn-in
    for (const f of this.fruits) {
      f.spawnTime += dt;
      if (!f.harvested && f.spawnTime > f.spawnDelay) {
        f.scale = Math.min(1, f.scale + dt * 4);
      }
      if (f.harvested) {
        f.harvestAnim = Math.min(1, f.harvestAnim + dt * 5);
      }
    }

    // Update particles
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

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(1, '#e0f7fa');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Ground
    ctx.fillStyle = '#6dbf67';
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
    ctx.fillStyle = '#5aad50';
    ctx.fillRect(0, h * 0.75, w, 4);

    // Tree trunk
    const trunkW = 40;
    const trunkTop = h * 0.35;
    const trunkBot = h * 0.78;
    ctx.fillStyle = TREE_TRUNK_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx - trunkW / 2, trunkBot);
    ctx.lineTo(cx - trunkW / 2 + 5, trunkTop);
    ctx.lineTo(cx + trunkW / 2 - 5, trunkTop);
    ctx.lineTo(cx + trunkW / 2, trunkBot);
    ctx.fill();

    // Tree canopy (layered circles)
    ctx.fillStyle = TREE_LEAF_COLOR;
    const canopyCX = cx;
    const canopyCY = h * 0.28;
    const canopyRX = w * 0.18;
    const canopyRY = h * 0.18;
    ctx.beginPath();
    ctx.ellipse(canopyCX, canopyCY, canopyRX, canopyRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.ellipse(canopyCX - canopyRX * 0.4, canopyCY + canopyRY * 0.15, canopyRX * 0.7, canopyRY * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(canopyCX + canopyRX * 0.4, canopyCY + canopyRY * 0.15, canopyRX * 0.7, canopyRY * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.ellipse(canopyCX, canopyCY - canopyRY * 0.25, canopyRX * 0.65, canopyRY * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fruits
    for (const f of this.fruits) {
      if (f.harvestAnim >= 1) continue;
      const s = f.harvested ? (1 - f.harvestAnim) * f.scale : f.scale;
      if (s <= 0) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(s, s);
      ctx.globalAlpha = f.harvested ? 1 - f.harvestAnim : 1;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(2, 2, f.radius, 0, Math.PI * 2);
      ctx.fill();

      // Fruit body
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(-f.radius * 0.3, -f.radius * 0.3, f.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Harvest particles
    for (const p of this.harvestParticles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Timer
    const timeLeft = Math.max(0, this.timer);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    const timerText = timeLeft.toFixed(1) + 's';
    ctx.strokeText(timerText, w / 2, 50);
    ctx.fillText(timerText, w / 2, 50);

    // Harvest count
    ctx.font = 'bold 24px monospace';
    const countText = 'Harvested: ' + this.harvested;
    ctx.strokeText(countText, w / 2, 85);
    ctx.fillText(countText, w / 2, 85);
    ctx.lineWidth = 1;

    // Instruction
    if (this.timer > TIMER_DURATION - 2) {
      const alpha = Math.min(1, (TIMER_DURATION - this.timer) * 2);
      ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(Date.now() / 300));
      ctx.font = '20px monospace';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeText('Click & drag to harvest!', w / 2, h - 40);
      ctx.fillText('Click & drag to harvest!', w / 2, h - 40);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }
  }

  getResult() {
    return { harvested: this.harvested };
  }
}
