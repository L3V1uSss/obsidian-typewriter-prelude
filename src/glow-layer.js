// Adapted from Typewriter Nocturne's MIT-licensed glow-layer.ts.
const {lightAmount} = require('./light-model');

const hash = n => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const MOTES = Array.from({length: 110}, (_, i) => ({
  x: hash(i * 3.1),
  y: hash(i * 7.7),
  z: hash(i * 1.9),
  phase: hash(i * 5.3) * 100,
  size: 0.5 + hash(i * 9.1) * 1.6
}));
const wrap = value => ((value % 1) + 1) % 1;
const POOL_COLUMNS = 192;

function poolStrength(frame) {
  if (frame.appearance === 'dark') return 1;
  if (frame.rig.source === 'moonlight') return 0.2;
  return frame.rig.source === 'desk-lamp' ? 0.1 : 0;
}

class GlowLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.pool = document.createElement('canvas');
    this.soft = document.createElement('canvas');
    this.bloom = document.createElement('canvas');
    this.poolKey = '';
    this.sprite = document.createElement('canvas');
    this.sprite.width = 32;
    this.sprite.height = 32;
    const spriteContext = this.sprite.getContext('2d');
    if (spriteContext) {
      const gradient = spriteContext.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.22, 'rgba(255,255,255,0.6)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      spriteContext.fillStyle = gradient;
      spriteContext.fillRect(0, 0, 32, 32);
    }
  }

  resize(width, height, pixelRatio) {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.canvas.width = Math.max(1, Math.round(width * pixelRatio));
    this.canvas.height = Math.max(1, Math.round(height * pixelRatio));
  }

  ensurePool(rig, rgb, rect) {
    const key = JSON.stringify([rig, rgb, rect]);
    if (key === this.poolKey) return;
    this.poolKey = key;
    const columns = POOL_COLUMNS;
    const rows = Math.max(8, Math.round(columns * rect.height / Math.max(1, rect.width)));
    const [r, g, b] = rgb.split(',').map(Number);
    for (const canvas of [this.pool, this.soft, this.bloom]) {
      canvas.width = columns;
      canvas.height = rows;
    }
    const poolContext = this.pool.getContext('2d');
    const softContext = this.soft.getContext('2d');
    const bloomContext = this.bloom.getContext('2d');
    if (!poolContext || !softContext || !bloomContext) return;
    const image = poolContext.createImageData(columns, rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const lit = lightAmount(rig, ((i + 0.5) / columns) * rect.width, ((j + 0.5) / rows) * rect.height);
        const index = (j * columns + i) * 4;
        image.data[index] = r;
        image.data[index + 1] = g;
        image.data[index + 2] = b;
        image.data[index + 3] = Math.round(Math.min(1, lit) * 255);
      }
    }
    poolContext.putImageData(image, 0, 0);
    softContext.filter = 'blur(1px)';
    softContext.drawImage(this.pool, 0, 0);
    softContext.filter = 'none';
    bloomContext.filter = 'blur(6px)';
    bloomContext.drawImage(this.pool, 0, 0);
    bloomContext.filter = 'none';
  }

  render(frame) {
    const context = this.context;
    if (!context) return;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    if (!frame.lamp || !frame.rect || frame.rect.width <= 0 || frame.rect.height <= 0) return;
    const {rig} = frame;
    const seconds = frame.time;
    const rect = frame.rect;
    context.save();
    context.beginPath();
    context.rect(rect.x, rect.y, rect.width, rect.height);
    context.clip();

    const pool = poolStrength(frame);
    if (pool > 0) {
      this.ensurePool(rig, frame.poolRgb, rect);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.globalAlpha = pool;
      context.drawImage(this.soft, rect.x, rect.y, rect.width, rect.height);
      context.globalAlpha = pool * (frame.appearance === 'dark' ? 0.4 : 0.8);
      context.drawImage(this.bloom, rect.x, rect.y, rect.width, rect.height);
      context.globalAlpha = 1;
    }

    if (rig.source === 'desk-lamp') {
      const [localX, localY] = rig.position;
      const x = rect.x + localX;
      const y = rect.y + localY;
      const radius = Math.max(1, this.height * 0.55);
      const spill = context.createRadialGradient(x, y, 0, x, y, radius);
      spill.addColorStop(0, `rgba(${frame.rgb}, ${frame.appearance === 'light' ? 0.1 : 0.16})`);
      spill.addColorStop(1, `rgba(${frame.rgb}, 0)`);
      context.fillStyle = spill;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    if (frame.particles > 0) {
      const count = Math.round(MOTES.length * frame.particles);
      const strength = frame.appearance === 'light' ? 0.5 : 0.9;
      for (let i = 0; i < count; i++) {
        const mote = MOTES[i];
        const speed = 0.4 + mote.z;
        const drift = Math.sin(seconds * 0.05 * speed + mote.phase) * 0.04 + seconds * 0.004 * (mote.z - 0.5);
        const fall = -seconds * 0.006 * speed + Math.cos(seconds * 0.07 + mote.phase) * 0.03;
        const localX = wrap(mote.x + drift) * rect.width;
        const localY = wrap(mote.y + fall) * rect.height;
        const x = rect.x + localX;
        const y = rect.y + localY;
        const lit = lightAmount(rig, localX, localY);
        if (lit < 0.05) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(seconds * (0.8 + mote.z * 2.2) + mote.phase);
        const size = mote.size * (1 + mote.z * 1.6);
        context.globalAlpha = Math.min(1, lit * twinkle * strength);
        context.drawImage(this.sprite, x - size * 2, y - size * 2, size * 4, size * 4);
      }
      context.globalAlpha = 1;
    }

    if (rig.source === 'carriage') {
      const [localX, localY] = rig.position;
      const x = rect.x + localX;
      const y = rect.y + localY;
      const radius = Math.max(1, 110 * frame.intensity);
      const glare = context.createRadialGradient(x, y, 0, x, y, radius);
      glare.addColorStop(0, `rgba(${frame.rgb}, ${frame.appearance === 'light' ? 0.26 : 0.45})`);
      glare.addColorStop(1, `rgba(${frame.rgb}, 0)`);
      context.fillStyle = glare;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    if (frame.cursor && frame.cursorGlow > 0) {
      const {x, y} = frame.cursor;
      const glow = context.createRadialGradient(x, y, 0, x, y, 34);
      glow.addColorStop(0, `rgba(${frame.rgb}, ${(0.4 * frame.cursorGlow).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${frame.rgb}, 0)`);
      context.fillStyle = glow;
      context.fillRect(x - 34, y - 34, 68, 68);
    }
    context.restore();
  }
}

module.exports = {GlowLayer};
