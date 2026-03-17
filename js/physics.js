// physics.js — lightweight 2D physics for circles with gravity, collision, and bounds

export class Body {
  constructor(x, y, radius, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.radius = radius;
    this.mass = opts.mass || (radius * radius * Math.PI);
    this.restitution = opts.restitution ?? 0.6;
    this.gravity = opts.gravity ?? 980;       // px/s²
    this.friction = opts.friction ?? 0.999;
    this.isStatic = opts.isStatic || false;
    this.active = true;
  }

  update(dt) {
    if (this.isStatic || !this.active) return;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= this.friction;
    this.vy *= this.friction;
  }

  containIn(w, h) {
    if (!this.active) return;
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx) * this.restitution;
    }
    if (this.x + this.radius > w) {
      this.x = w - this.radius;
      this.vx = -Math.abs(this.vx) * this.restitution;
    }
    if (this.y + this.radius > h) {
      this.y = h - this.radius;
      this.vy = -Math.abs(this.vy) * this.restitution;
    }
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy) * this.restitution;
    }
  }

  isOffScreen(w, h, margin = 100) {
    return this.y > h + margin || this.x < -margin || this.x > w + margin;
  }
}

/**
 * Resolve elastic collision between a dynamic body and a static circle (peg).
 */
export function resolveCircleCollision(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.radius + b.radius;

  if (dist >= minDist || dist === 0) return false;

  // Normal from b -> a
  const nx = dx / dist;
  const ny = dy / dist;

  // Separate
  const overlap = minDist - dist;
  if (b.isStatic) {
    a.x += nx * overlap;
    a.y += ny * overlap;
  } else {
    a.x += nx * overlap * 0.5;
    a.y += ny * overlap * 0.5;
    b.x -= nx * overlap * 0.5;
    b.y -= ny * overlap * 0.5;
  }

  // Relative velocity
  const dvx = a.vx - (b.isStatic ? 0 : b.vx);
  const dvy = a.vy - (b.isStatic ? 0 : b.vy);
  const dvDotN = dvx * nx + dvy * ny;

  // Only resolve if approaching
  if (dvDotN > 0) return true;

  const restitution = Math.min(a.restitution, b.restitution);
  const impulseMag = -(1 + restitution) * dvDotN;

  if (b.isStatic) {
    a.vx += impulseMag * nx;
    a.vy += impulseMag * ny;
  } else {
    const totalMass = a.mass + b.mass;
    a.vx += (impulseMag / totalMass) * b.mass * nx;
    a.vy += (impulseMag / totalMass) * b.mass * ny;
    b.vx -= (impulseMag / totalMass) * a.mass * nx;
    b.vy -= (impulseMag / totalMass) * a.mass * ny;
  }

  return true;
}

/**
 * Check if a line segment (p1->p2) intersects a circle at (cx, cy, r).
 */
export function lineIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;

  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;

  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) ||
         (t1 < 0 && t2 > 1);
}
