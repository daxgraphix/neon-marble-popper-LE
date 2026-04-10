/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Trophy, Skull, Zap, Bomb, Clock, Shield, ChevronRight, Gamepad2, Sun, Moon, Settings, X, Volume2, VolumeX, Home, Pause, Lock } from 'lucide-react';

// --- Constants & Types ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const MARBLE_RADIUS = 15;
const MARBLE_DIAMETER = MARBLE_RADIUS * 2;
const SHOOTER_RADIUS = 30;
const PROJECTILE_SPEED = 16;
const COLORS = [
  { name: 'ruby', fill: '#FF2D55', glow: '#FF2D55' },
  { name: 'cyan', fill: '#00FBFF', glow: '#00FBFF' },
  { name: 'emerald', fill: '#00FF95', glow: '#00FF95' },
  { name: 'amber', fill: '#FFCC00', glow: '#FFCC00' },
  { name: 'violet', fill: '#AF52FF', glow: '#AF52FF' },
  { name: 'orange', fill: '#FF9500', glow: '#FF9500' },
  { name: 'magenta', fill: '#FF00FF', glow: '#FF00FF' },
  { name: 'gold', fill: '#FFD700', glow: '#FFD700' },
];

type Color = typeof COLORS[0];
type PowerUpType = 'bomb' | 'lightning' | 'slow' | null;

interface Point {
  x: number;
  y: number;
}

interface LevelConfig {
  id: number;
  name: string;
  baseSpeed: number;
  spawnRate: number;
  maxMarbles: number;
  colors: Color[];
  pathType: 'spiral' | 's-curve' | 'loop' | 'zigzag' | 'heart' | 'circular' | 'curvy';
  obstacles: ObstacleConfig[];
  challenge: {
    targetScore: number;
    description: string;
  };
}

interface ObstacleConfig {
  x: number;
  y: number;
  radius: number;
  type: 'static' | 'rotating' | 'breakable' | 'moving' | 'magnetic' | 'portal' | 'platform' | 'barrier';
  speed?: number;
  health?: number;
  moveRange?: number;
  strength?: number;
  pullRadius?: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_bomb', name: 'Pyromaniac', description: 'Use your first bomb power-up.', icon: '💣', unlocked: false },
  { id: 'level_10', name: 'Zone Veteran', description: 'Clear Zone 10.', icon: '🎖️', unlocked: false },
  { id: 'high_score', name: 'Score Master', description: 'Reach 50,000 points in a single zone.', icon: '🔥', unlocked: false },
  { id: 'max_combo', name: 'Combo King', description: 'Reach a 10x combo.', icon: '👑', unlocked: false },
  { id: 'streak_5', name: 'Unstoppable', description: 'Reach a 5-zone win streak.', icon: '🚀', unlocked: false },
];

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  type: 'spark' | 'smoke' | 'glow' | 'ring' | 'streak';
  gravity: number;
  friction: number;
  rotation: number = 0;
  rotationSpeed: number = 0;
  decayRate: number;

  constructor(x: number, y: number, color: string, type: 'spark' | 'smoke' | 'glow' | 'ring' | 'streak' = 'spark') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.decayRate = type === 'smoke' ? 0.015 : (type === 'ring' ? 0.025 : (type === 'streak' ? 0.04 : 0.028));
    
    const angle = Math.random() * Math.PI * 2;
    const baseSpeed = type === 'spark' ? Math.random() * 8 + 4 : (type === 'ring' ? 6 : (type === 'streak' ? 12 : Math.random() * 3 + 1));
    this.vx = Math.cos(angle) * baseSpeed;
    this.vy = Math.sin(angle) * baseSpeed;
    this.life = 1.0;
    this.color = color;
    this.size = type === 'smoke' ? Math.random() * 14 + 10 : (type === 'ring' ? 30 + Math.random() * 20 : (type === 'streak' ? 8 + Math.random() * 6 : Math.random() * 5 + 3));
    this.gravity = type === 'smoke' ? -0.04 : (type === 'streak' ? 0.08 : 0.18);
    this.friction = type === 'smoke' ? 0.97 : (type === 'ring' ? 0.92 : 0.94);
    this.rotationSpeed = (Math.random() - 0.5) * 0.4;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.life -= this.decayRate;
    this.rotation += this.rotationSpeed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = Math.min(1, this.life * 1.5);
    
    if (this.type === 'glow') {
      ctx.shadowBlur = 25;
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * this.life, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'ring') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3 * this.life;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * (1.2 - this.life), 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'streak') {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, -this.size);
      ctx.lineTo(this.size * 0.4, 0);
      ctx.lineTo(0, this.size);
      ctx.lineTo(-this.size * 0.4, 0);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'smoke') {
      const currentSize = this.size * (1.2 - this.life * 0.5);
      const alpha = Math.floor(this.life * 180);
      const alphaHex = alpha.toString(16).padStart(2, '0');
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentSize);
      const r = this.color.startsWith('rgba') ? this.color : this.color.startsWith('#') ? this.color : '#' + this.color;
      const isRgba = r.startsWith('rgba');
      const colorVal = isRgba ? r.replace(/[\d.]+\)$/, (this.life * 0.7).toFixed(2) + ')') : (() => {
        const hex = r.startsWith('#') ? r.slice(1) : r;
        const hr = parseInt(hex.slice(0, 2), 16) || 0;
        const hg = parseInt(hex.slice(2, 4), 16) || 0;
        const hb = parseInt(hex.slice(4, 6), 16) || 0;
        return `rgba(${hr}, ${hg}, ${hb}, ${(this.life * 0.7).toFixed(2)})`;
      })();
      grad.addColorStop(0, colorVal);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * this.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Marble {
  id: string;
  color: Color;
  distance: number; // Distance along path in pixels
  powerUp: PowerUpType;

  constructor(color: Color, distance: number, powerUp: PowerUpType = null) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.color = color;
    this.distance = distance;
    this.powerUp = powerUp;
  }
}

class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: Color;
  trail: { x: number, y: number, alpha: number }[] = [];
  gravity: number = 0.18;
  lastPortalId: string | null = null;
  rotation: number = 0;
  spinSpeed: number = 0.4;
  impactScale: number = 1;
  lastTrailTime: number = 0;
  arcHeight: number = 0;
  impactFlash: number = 0;

  constructor(x: number, y: number, angle: number, color: Color) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * PROJECTILE_SPEED;
    this.vy = Math.sin(angle) * PROJECTILE_SPEED;
    this.color = color;
    this.arcHeight = Math.sin(angle) * 0.3;
  }

  update(time: number) {
    if (time - this.lastTrailTime > 20) {
      this.trail.unshift({ x: this.x, y: this.y, alpha: 1.0 });
      this.lastTrailTime = time;
    }
    if (this.trail.length > 22) this.trail.pop();
    this.trail.forEach(t => t.alpha *= 0.85);

    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.997;
    this.rotation += this.spinSpeed;
    this.impactScale = Math.max(1, this.impactScale - 0.08);
    this.impactFlash = Math.max(0, this.impactFlash - 0.15);
  }

  triggerImpactEffect() {
    this.impactScale = 1.5;
    this.impactFlash = 1;
  }

  isOffScreen() {
    return (
      this.x < -100 ||
      this.x > CANVAS_WIDTH + 100 ||
      this.y < -100 ||
      this.y > CANVAS_HEIGHT + 100
    );
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.trail.forEach((p, i) => {
      const sizeMult = 1 - (i / this.trail.length);
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, MARBLE_RADIUS * sizeMult);
      gradient.addColorStop(0, this.color.fill);
      gradient.addColorStop(0.5, this.color.fill + '80');
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = p.alpha * 0.5;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, MARBLE_RADIUS * sizeMult * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.impactScale, this.impactScale);
    
    if (this.impactFlash > 0) {
      ctx.shadowBlur = 40;
      ctx.shadowColor = `rgba(255, 255, 255, ${this.impactFlash})`;
    } else {
      ctx.shadowBlur = 25;
      ctx.shadowColor = this.color.glow;
    }
    
    const texture = getMarbleTexture(this.color);
    ctx.drawImage(texture, -texture.width / 2, -texture.height / 2);
    
    ctx.fillStyle = 'white';
    ctx.globalAlpha = 0.4 * this.impactScale;
    ctx.beginPath();
    ctx.arc(MARBLE_RADIUS * 0.25, -MARBLE_RADIUS * 0.25, MARBLE_RADIUS * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = this.color.glow;
    ctx.beginPath();
    ctx.arc(0, 0, MARBLE_RADIUS * 1.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

class Obstacle {
  x: number;
  y: number;
  radius: number;
  type: 'static' | 'rotating' | 'breakable' | 'moving' | 'magnetic' | 'portal' | 'platform' | 'barrier';
  angle: number = 0;
  speed: number;
  destroyed: boolean = false;
  health: number;
  maxHealth: number;
  initialX: number;
  initialY: number;
  moveRange: number;
  strength: number;
  pullRadius: number;
  pulse: number = 0;
  destructionAnim: number = 0;
  hitFlash: number = 0;

  constructor(config: ObstacleConfig) {
    this.x = config.x;
    this.y = config.y;
    this.initialX = config.x;
    this.initialY = config.y;
    this.radius = config.radius;
    this.type = config.type;
    this.speed = config.speed || 0;
    this.health = config.health || 1;
    this.maxHealth = this.health;
    this.moveRange = config.moveRange || 0;
    this.strength = config.strength || 0.05;
    this.pullRadius = config.pullRadius || 150;
  }

  update() {
    if (this.destroyed) {
      this.destructionAnim = Math.min(1, this.destructionAnim + 0.08);
      return;
    }
    this.pulse += 0.05;
    this.hitFlash = Math.max(0, this.hitFlash - 0.15);
    
    if (this.type === 'rotating') {
      this.angle += this.speed;
    } else if (this.type === 'moving' || this.type === 'platform') {
      this.angle += this.speed;
      this.x = this.initialX + Math.cos(this.angle) * this.moveRange;
      this.y = this.initialY + Math.sin(this.angle) * this.moveRange;
    }
  }

  hit(isPowerUp: boolean = false) {
    this.hitFlash = 1;
    if (this.type === 'breakable') {
      const damage = isPowerUp ? 3 : 1;
      this.health -= damage;
      if (this.health <= 0) this.destroyed = true;
      return true;
    }
    if (this.type === 'barrier') {
      if (!isPowerUp) return false;
      const damage = 3;
      this.health -= damage;
      if (this.health <= 0) this.destroyed = true;
      return true;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, theme: 'light' | 'dark') {
    if (this.destroyed && this.destructionAnim >= 1) return;
    const pos = this.getPos();
    ctx.save();
    ctx.translate(pos.x, pos.y);

    if (this.destroyed) {
      ctx.globalAlpha = 1 - this.destructionAnim;
      ctx.scale(1 + this.destructionAnim * 0.5, 1 + this.destructionAnim * 0.5);
    }

    if (this.type === 'platform') {
      ctx.rotate(this.angle);
      const w = this.radius * 2.5;
      const h = 15;
      
      if (this.hitFlash > 0) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = `rgba(0, 229, 255, ${this.hitFlash})`;
      }
      
      const grad = ctx.createLinearGradient(-w/2, 0, w/2, 0);
      grad.addColorStop(0, theme === 'dark' ? '#1a1a1a' : '#999');
      grad.addColorStop(0.5, theme === 'dark' ? '#333' : '#ccc');
      grad.addColorStop(1, theme === 'dark' ? '#1a1a1a' : '#999');
      ctx.fillStyle = grad;
      ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : '#00e5ff';
      ctx.lineWidth = 2 + (this.hitFlash * 2);
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2, w, h, 5);
      ctx.fill();
      ctx.stroke();
      
      ctx.shadowBlur = 15 + Math.sin(this.pulse) * 10;
      ctx.shadowColor = '#00e5ff';
      ctx.stroke();
      
      for (let i = 0; i < 3; i++) {
        const cx = -w/3 + i * w/3;
        ctx.fillStyle = '#00e5ff';
        ctx.globalAlpha = 0.3 + Math.sin(this.pulse * 2 + i) * 0.2;
        ctx.beginPath();
        ctx.arc(cx, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'barrier') {
      const sides = 6;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const r = this.radius * (0.85 + Math.sin(this.pulse + i) * 0.15) * (this.destroyed ? (1 - this.destructionAnim) : 1);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      
      const healthRatio = this.health / this.maxHealth;
      const baseAlpha = 0.15 + healthRatio * 0.35;
      ctx.fillStyle = `rgba(255, 0, 255, ${baseAlpha + this.hitFlash * 0.3})`;
      ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : '#ff00ff';
      ctx.lineWidth = 2 + healthRatio * 2 + this.hitFlash * 3;
      ctx.fill();
      ctx.stroke();
      
      ctx.shadowBlur = 15 + healthRatio * 10;
      ctx.shadowColor = '#ff00ff';
      ctx.stroke();
      
      ctx.fillStyle = '#ff00ff';
      ctx.globalAlpha = 0.4 * healthRatio;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + this.pulse;
        const r = this.radius * 0.5 * healthRatio;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'magnetic') {
      // Pulsating magnetic field
      const pulseSize = this.pullRadius * (0.8 + Math.sin(this.pulse) * 0.1);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseSize);
      grad.addColorStop(0, 'rgba(0, 255, 255, 0.2)');
      grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#00ffff';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + Math.sin(this.pulse * 2) * 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'portal') {
      // Swirling portal
      ctx.rotate(this.pulse * 2);
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI * 2 / 3);
        ctx.strokeStyle = i === 0 ? '#ff00ff' : '#00ffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Default circle for static/rotating/breakable
      ctx.fillStyle = this.type === 'breakable' ? '#666' : '#444';
      ctx.strokeStyle = this.type === 'breakable' ? '#ff4400' : '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      if (this.type === 'breakable') {
        // Cracks based on health
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        for (let i = 0; i < (this.maxHealth - this.health) * 2; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo((Math.random() - 0.5) * this.radius * 2, (Math.random() - 0.5) * this.radius * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  getPos(): Point {
    if (this.type === 'rotating') {
      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2;
      const dist = getDistance({ x: this.x, y: this.y }, { x: centerX, y: centerY });
      return {
        x: centerX + dist * Math.cos(this.angle),
        y: centerY + dist * Math.sin(this.angle),
      };
    }
    return { x: this.x, y: this.y };
  }
}

// --- Audio Synthesizer ---

class SoundEngine {
  ctx: AudioContext | null = null;
  enabled: boolean = true;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  playShoot() {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playMatch() {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playExplosion() {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playGameOver() {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(55, this.ctx.currentTime + 1);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1);
  }

  playLevelComplete() {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, this.ctx.currentTime);
    osc.frequency.setValueAtTime(659, this.ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(784, this.ctx.currentTime + 0.2);
    osc.frequency.setValueAtTime(1047, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  playAchievement() {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587, this.ctx.currentTime);
    osc.frequency.setValueAtTime(784, this.ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(1047, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }
}

const sounds = new SoundEngine();

// --- Story & Narrative ---

interface StoryBeat {
  title: string;
  description: string;
  quote?: string;
}

const STORY_BEATS: Record<number, StoryBeat> = {
  1: { title: "The Awakening", description: "Your journey begins in the Neon Realm. Master the basics of marble matching.", quote: "Every legend starts with a single spark..." },
  2: { title: "First Challenge", description: "The spiral path reveals itself. Feel the rhythm of the marbles.", quote: "Movement is the essence of life." },
  3: { title: "The Curve", description: "S-curves test your precision. Trust your aim.", quote: "Not all paths are straight, but they all lead forward." },
  4: { title: "Breaking Through", description: "Breakable obstacles appear. Use them to your advantage.", quote: "Some barriers exist to be destroyed." },
  5: { title: "The Loop", description: "Marbles move in loops. Learn to predict their path.", quote: "What goes around comes around." },
  6: { title: "Magnetic Fields", description: "Magnetic obstacles now pull your marbles. Fight the attraction.", quote: "The pull of destiny can be resisted." },
  7: { title: "The Zigzag", description: "A zigzag path divides the realm. Stay focused.", quote: "Zig when others zag. That's the way." },
  8: { title: "Rotation", description: "Rotating barriers spin faster. Adapt quickly.", quote: "In a world of change, be the constant." },
  9: { title: "The Heart", description: "The heart pattern pulses. Feel its rhythm.", quote: "The heart of the game beats within you." },
  10: { title: "Midnight Zone", description: "The central arena opens. All obstacles converge.", quote: "Halfway there. The real challenge begins." },
  11: { title: "Portal Nexus", description: "Portals teleport marbles unpredictably. Track them carefully.", quote: "Reality bends. Space is fluid here." },
  12: { title: "The Spiral Deepens", description: "The spiral tightens. Speed increases.", quote: "Deeper into the spiral. Deeper into yourself." },
  13: { title: "Storm Warning", description: "Multiple obstacle types together. Stay calm.", quote: "In the eye of the storm, find your center." },
  14: { title: "The Curvy Road", description: "Curvy paths require quick reflexes.", quote: "Flow like water. Adapt like wind." },
  15: { title: "Heart of Fire", description: "The heart burns bright. Matching becomes crucial.", quote: "Where there's a will, there's a way." },
  16: { title: "The Final Spiral", description: "The ultimate spiral test. Precision matters.", quote: "One more turn. One more chance." },
  17: { title: "Chaos Theory", description: "Maximum chaos. Everything fights against you.", quote: "Embrace the chaos. Become the storm." },
  18: { title: "The Ring", description: "Circular patterns surround you. Break free.", quote: "The circle of life continues. Break the cycle." },
  19: { title: "Heart of Light", description: "Light emerges from darkness. Victory is near.", quote: "Even in darkness, light finds a way." },
  20: { title: "Neon Ascendant", description: "The final zone. Become the master of the Neon Realm!", quote: "You've conquered the Neon Realm. You are legend." },
};

// --- Level Configuration ---

interface LevelConfig {
  id: number;
  name: string;
  story: StoryBeat;
  baseSpeed: number;
  spawnRate: number;
  maxMarbles: number;
  colors: Color[];
  pathType: 'spiral' | 's-curve' | 'loop' | 'zigzag' | 'heart' | 'circular' | 'curvy';
  obstacles: ObstacleConfig[];
  challenge: {
    targetScore: number;
    description: string;
    bonusPoints?: number;
  };
  tips: string[];
}

// Hand-crafted levels with story progression
const LEVEL_CONFIGS: Omit<LevelConfig, 'id'>[] = [
  // Level 1: Tutorial
  {
    story: STORY_BEATS[1],
    baseSpeed: 0.0003,
    spawnRate: 1200,
    maxMarbles: 15,
    colors: COLORS.slice(0, 3),
    pathType: 'spiral',
    obstacles: [],
    challenge: { targetScore: 2000, description: "Match 3 marbles to clear them. Simple!" },
    tips: ["Click to shoot marbles", "Match 3 or more of the same color", "Clear all marbles to win"]
  },
  // Level 2: Introduction to movement
  {
    story: STORY_BEATS[2],
    baseSpeed: 0.0004,
    spawnRate: 1100,
    maxMarbles: 18,
    colors: COLORS.slice(0, 3),
    pathType: 'spiral',
    obstacles: [
      { x: 400, y: 300, radius: 20, type: 'static' }
    ],
    challenge: { targetScore: 2500, description: "Marbles move faster now. Keep up!" },
    tips: ["Marbles move along the spiral path", "Static obstacles block shots", "Plan your shots ahead"]
  },
  // Level 3: S-curve introduction
  {
    story: STORY_BEATS[3],
    baseSpeed: 0.00045,
    spawnRate: 1000,
    maxMarbles: 20,
    colors: COLORS.slice(0, 4),
    pathType: 's-curve',
    obstacles: [
      { x: 300, y: 250, radius: 18, type: 'static' },
      { x: 500, y: 350, radius: 18, type: 'static' }
    ],
    challenge: { targetScore: 3000, description: "The S-curve path tests your precision." },
    tips: ["The path curves - aim carefully", "Plan shots to create chains", "Watch the marble chain"]
  },
  // Level 4: Breakable obstacles
  {
    story: STORY_BEATS[4],
    baseSpeed: 0.0005,
    spawnRate: 950,
    maxMarbles: 22,
    colors: COLORS.slice(0, 4),
    pathType: 's-curve',
    obstacles: [
      { x: 350, y: 280, radius: 22, type: 'breakable', health: 2 },
      { x: 450, y: 350, radius: 22, type: 'breakable', health: 2 }
    ],
    challenge: { targetScore: 3500, description: "Breakable obstacles can be destroyed!", bonusPoints: 500 },
    tips: ["Hit breakable obstacles 3 times to destroy them", "Destroyed obstacles grant bonus points", "Use bombs to destroy faster"]
  },
  // Level 5: Loop path
  {
    story: STORY_BEATS[5],
    baseSpeed: 0.00055,
    spawnRate: 900,
    maxMarbles: 24,
    colors: COLORS.slice(0, 4),
    pathType: 'loop',
    obstacles: [
      { x: 300, y: 200, radius: 20, type: 'rotating', speed: 0.02 },
      { x: 500, y: 400, radius: 20, type: 'rotating', speed: -0.02 }
    ],
    challenge: { targetScore: 4000, description: "The loop path changes direction!" },
    tips: ["Rotating obstacles push marbles away", "The push strength depends on rotation speed", "Time your shots carefully"]
  },
  // Level 6: Magnetic introduction
  {
    story: STORY_BEATS[6],
    baseSpeed: 0.0006,
    spawnRate: 850,
    maxMarbles: 25,
    colors: COLORS.slice(0, 4),
    pathType: 'loop',
    obstacles: [
      { x: 200, y: 300, radius: 25, type: 'magnetic', strength: 0.04, pullRadius: 120 },
      { x: 600, y: 300, radius: 25, type: 'magnetic', strength: 0.04, pullRadius: 120 }
    ],
    challenge: { targetScore: 4500, description: "Magnetic obstacles pull marbles toward them!", bonusPoints: 750 },
    tips: ["Magnetic obstacles pull nearby marbles", "Adjust your aim to compensate", "Stronger pull when closer"]
  },
  // Level 7: Zigzag
  {
    story: STORY_BEATS[7],
    baseSpeed: 0.00065,
    spawnRate: 800,
    maxMarbles: 27,
    colors: COLORS.slice(0, 5),
    pathType: 'zigzag',
    obstacles: [
      { x: 200, y: 200, radius: 20, type: 'static' },
      { x: 600, y: 400, radius: 20, type: 'static' },
      { x: 400, y: 300, radius: 18, type: 'breakable', health: 3 }
    ],
    challenge: { targetScore: 5000, description: "Zigzag paths require quick reflexes!" },
    tips: ["Zigzag has sharp turns", "Use power-ups to clear big groups", "Don't let the chain reach the end"]
  },
  // Level 8: Rotation increases
  {
    story: STORY_BEATS[8],
    baseSpeed: 0.0007,
    spawnRate: 750,
    maxMarbles: 28,
    colors: COLORS.slice(0, 5),
    pathType: 'zigzag',
    obstacles: [
      { x: 250, y: 250, radius: 22, type: 'rotating', speed: 0.03 },
      { x: 550, y: 350, radius: 22, type: 'rotating', speed: 0.035 },
      { x: 400, y: 300, radius: 20, type: 'magnetic', strength: 0.05, pullRadius: 100 }
    ],
    challenge: { targetScore: 5500, description: "Faster rotation = stronger push!" },
    tips: ["Faster rotation pushes harder", "Magnetic + rotating combo creates chaos", "Stay alert!"]
  },
  // Level 9: Heart pattern
  {
    story: STORY_BEATS[9],
    baseSpeed: 0.00075,
    spawnRate: 700,
    maxMarbles: 30,
    colors: COLORS.slice(0, 5),
    pathType: 'heart',
    obstacles: [
      { x: 400, y: 200, radius: 25, type: 'static' },
      { x: 300, y: 400, radius: 20, type: 'rotating', speed: 0.025 },
      { x: 500, y: 400, radius: 20, type: 'rotating', speed: -0.025 }
    ],
    challenge: { targetScore: 6000, description: "The heart pattern pulses with energy!" },
    tips: ["Heart shape is symmetrical", "Use the center to create chains", "Watch both sides"]
  },
  // Level 10: Midpoint challenge
  {
    story: STORY_BEATS[10],
    baseSpeed: 0.0008,
    spawnRate: 650,
    maxMarbles: 32,
    colors: COLORS.slice(0, 5),
    pathType: 'circular',
    obstacles: [
      { x: 200, y: 200, radius: 22, type: 'magnetic', strength: 0.06, pullRadius: 130 },
      { x: 600, y: 200, radius: 22, type: 'magnetic', strength: 0.06, pullRadius: 130 },
      { x: 200, y: 400, radius: 22, type: 'rotating', speed: 0.04 },
      { x: 600, y: 400, radius: 22, type: 'rotating', speed: -0.04 }
    ],
    challenge: { targetScore: 7000, description: "Halfway point! All obstacles converge!", bonusPoints: 1000 },
    tips: ["All obstacle types now active", "Multiple threats at once", "Prioritize threats"]
  },
  // Level 11: Portals
  {
    story: STORY_BEATS[11],
    baseSpeed: 0.00085,
    spawnRate: 600,
    maxMarbles: 33,
    colors: COLORS.slice(0, 5),
    pathType: 'circular',
    obstacles: [
      { x: 150, y: 150, radius: 30, type: 'portal' },
      { x: 650, y: 450, radius: 30, type: 'portal' },
      { x: 400, y: 300, radius: 20, type: 'static' }
    ],
    challenge: { targetScore: 7500, description: "Portals teleport marbles to unexpected places!" },
    tips: ["Portals teleport marbles", "Track where marbles reappear", "Use portals strategically"]
  },
  // Level 12: Tight spiral
  {
    story: STORY_BEATS[12],
    baseSpeed: 0.0009,
    spawnRate: 550,
    maxMarbles: 35,
    colors: COLORS.slice(0, 6),
    pathType: 'spiral',
    obstacles: [
      { x: 300, y: 250, radius: 20, type: 'rotating', speed: 0.045 },
      { x: 500, y: 350, radius: 20, type: 'rotating', speed: -0.045 },
      { x: 400, y: 150, radius: 18, type: 'magnetic', strength: 0.07, pullRadius: 110 },
      { x: 400, y: 450, radius: 18, type: 'magnetic', strength: 0.07, pullRadius: 110 }
    ],
    challenge: { targetScore: 8000, description: "The spiral tightens. Speed increases!" },
    tips: ["Tighter paths need precision", "Chain reactions are key", "Use power-ups wisely"]
  },
  // Level 13: Storm
  {
    story: STORY_BEATS[13],
    baseSpeed: 0.00095,
    spawnRate: 500,
    maxMarbles: 37,
    colors: COLORS.slice(0, 6),
    pathType: 's-curve',
    obstacles: [
      { x: 150, y: 200, radius: 22, type: 'breakable', health: 4 },
      { x: 350, y: 300, radius: 25, type: 'magnetic', strength: 0.08, pullRadius: 140 },
      { x: 550, y: 400, radius: 22, type: 'rotating', speed: 0.05 },
      { x: 650, y: 200, radius: 20, type: 'static' }
    ],
    challenge: { targetScore: 8500, description: "Storm conditions! Multiple threats!", bonusPoints: 1500 },
    tips: ["Multiple obstacle types active", "Prioritize dangerous obstacles", "Keep the chain short"]
  },
  // Level 14: Curvy
  {
    story: STORY_BEATS[14],
    baseSpeed: 0.001,
    spawnRate: 480,
    maxMarbles: 38,
    colors: COLORS.slice(0, 6),
    pathType: 'curvy',
    obstacles: [
      { x: 200, y: 180, radius: 20, type: 'moving', speed: 0.03, moveRange: 80 },
      { x: 600, y: 420, radius: 20, type: 'moving', speed: -0.03, moveRange: 80 },
      { x: 400, y: 300, radius: 25, type: 'barrier', health: 8 }
    ],
    challenge: { targetScore: 9000, description: "Moving obstacles add chaos!" },
    tips: ["Moving obstacles patrol the path", "Barriers need power-ups to destroy", "Time your shots to gaps"]
  },
  // Level 15: Heart of Fire
  {
    story: STORY_BEATS[15],
    baseSpeed: 0.00105,
    spawnRate: 460,
    maxMarbles: 40,
    colors: COLORS.slice(0, 6),
    pathType: 'heart',
    obstacles: [
      { x: 400, y: 250, radius: 30, type: 'magnetic', strength: 0.09, pullRadius: 150 },
      { x: 280, y: 380, radius: 22, type: 'rotating', speed: 0.055 },
      { x: 520, y: 380, radius: 22, type: 'rotating', speed: -0.055 },
      { x: 400, y: 480, radius: 18, type: 'breakable', health: 4 }
    ],
    challenge: { targetScore: 9500, description: "The heart burns! Maximum intensity!", bonusPoints: 2000 },
    tips: ["Multiple magnetic sources create complex pull", "Center is most dangerous", "Quick decisions needed"]
  },
  // Level 16: Final Spiral
  {
    story: STORY_BEATS[16],
    baseSpeed: 0.0011,
    spawnRate: 440,
    maxMarbles: 42,
    colors: COLORS.slice(0, 7),
    pathType: 'spiral',
    obstacles: [
      { x: 300, y: 200, radius: 22, type: 'rotating', speed: 0.06 },
      { x: 500, y: 400, radius: 22, type: 'rotating', speed: -0.06 },
      { x: 200, y: 350, radius: 20, type: 'magnetic', strength: 0.1, pullRadius: 120 },
      { x: 600, y: 250, radius: 20, type: 'magnetic', strength: 0.1, pullRadius: 120 }
    ],
    challenge: { targetScore: 10000, description: "The ultimate spiral test!" },
    tips: ["Precision is everything", "Chain reactions essential", "Stay calm"]
  },
  // Level 17: Chaos
  {
    story: STORY_BEATS[17],
    baseSpeed: 0.00115,
    spawnRate: 420,
    maxMarbles: 44,
    colors: COLORS.slice(0, 7),
    pathType: 'loop',
    obstacles: [
      { x: 150, y: 150, radius: 20, type: 'magnetic', strength: 0.11, pullRadius: 130 },
      { x: 650, y: 450, radius: 20, type: 'magnetic', strength: 0.11, pullRadius: 130 },
      { x: 250, y: 450, radius: 18, type: 'rotating', speed: 0.065 },
      { x: 550, y: 150, radius: 18, type: 'rotating', speed: -0.065 },
      { x: 400, y: 300, radius: 22, type: 'breakable', health: 5 },
      { x: 400, y: 200, radius: 20, type: 'static' }
    ],
    challenge: { targetScore: 11000, description: "Maximum chaos! Everything fights against you!", bonusPoints: 2500 },
    tips: ["Full chaos mode", "Every obstacle type active", "Use power-ups freely"]
  },
  // Level 18: The Ring
  {
    story: STORY_BEATS[18],
    baseSpeed: 0.0012,
    spawnRate: 400,
    maxMarbles: 46,
    colors: COLORS.slice(0, 7),
    pathType: 'circular',
    obstacles: [
      { x: 200, y: 250, radius: 22, type: 'rotating', speed: 0.07 },
      { x: 400, y: 150, radius: 22, type: 'rotating', speed: -0.07 },
      { x: 600, y: 250, radius: 22, type: 'rotating', speed: 0.07 },
      { x: 400, y: 450, radius: 22, type: 'rotating', speed: -0.07 },
      { x: 400, y: 300, radius: 25, type: 'magnetic', strength: 0.12, pullRadius: 140 }
    ],
    challenge: { targetScore: 12000, description: "The ring surrounds you. Break free!" },
    tips: ["Four rotating obstacles", "One magnetic center", "Find the safe spot"]
  },
  // Level 19: Heart of Light
  {
    story: STORY_BEATS[19],
    baseSpeed: 0.00125,
    spawnRate: 380,
    maxMarbles: 48,
    colors: COLORS.slice(0, 7),
    pathType: 'heart',
    obstacles: [
      { x: 400, y: 220, radius: 28, type: 'magnetic', strength: 0.13, pullRadius: 160 },
      { x: 300, y: 350, radius: 20, type: 'rotating', speed: 0.075 },
      { x: 500, y: 350, radius: 20, type: 'rotating', speed: -0.075 },
      { x: 250, y: 450, radius: 18, type: 'breakable', health: 5 },
      { x: 550, y: 450, radius: 18, type: 'breakable', health: 5 }
    ],
    challenge: { targetScore: 13000, description: "Light emerges! Victory is near!", bonusPoints: 3000 },
    tips: ["One more level!", "All skills tested here", "Trust your instincts"]
  },
  // Level 20: Final Boss
  {
    story: STORY_BEATS[20],
    baseSpeed: 0.0013,
    spawnRate: 350,
    maxMarbles: 50,
    colors: COLORS,
    pathType: 'spiral',
    obstacles: [
      { x: 250, y: 200, radius: 25, type: 'magnetic', strength: 0.15, pullRadius: 180 },
      { x: 550, y: 400, radius: 25, type: 'magnetic', strength: 0.15, pullRadius: 180 },
      { x: 350, y: 400, radius: 22, type: 'rotating', speed: 0.08 },
      { x: 450, y: 200, radius: 22, type: 'rotating', speed: -0.08 },
      { x: 200, y: 300, radius: 20, type: 'breakable', health: 6 },
      { x: 600, y: 300, radius: 20, type: 'breakable', health: 6 },
      { x: 400, y: 300, radius: 30, type: 'barrier', health: 15 }
    ],
    challenge: { targetScore: 15000, description: "Final challenge! Become the Neon Legend!", bonusPoints: 5000 },
    tips: ["The ultimate test", "Use all power-ups", "You are ready - believe!"]
  }
];

const LEVELS: LevelConfig[] = LEVEL_CONFIGS.map((config, index) => ({
  ...config,
  id: index + 1
}));

// --- Helper Functions ---

const getDistance = (p1: Point, p2: Point) => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

const getDistanceSq = (p1: Point, p2: Point) => {
  return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
};

// Spatial Hash Grid for optimized collision detection
class SpatialHash {
  cellSize: number;
  grid: Map<string, { type: 'marble' | 'obstacle', index: number, x: number, y: number }[]>;

  constructor(cellSize: number = 80) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  private getKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(type: 'marble' | 'obstacle', index: number, x: number, y: number) {
    const key = this.getKey(x, y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push({ type, index, x, y });
  }

  query(x: number, y: number, radius: number): { type: 'marble' | 'obstacle', index: number, x: number, y: number }[] {
    const results: { type: 'marble' | 'obstacle', index: number, x: number, y: number }[] = [];
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.grid.get(`${cx},${cy}`);
        if (cell) {
          for (const item of cell) {
            const dx = item.x - x;
            const dy = item.y - y;
            if (dx * dx + dy * dy <= radius * radius) {
              results.push(item);
            }
          }
        }
      }
    }
    return results;
  }
}

const spatialHash = new SpatialHash(80);

// --- Texture Cache ---
const marbleCache: Record<string, HTMLCanvasElement> = {};

const getMarbleTexture = (color: Color): HTMLCanvasElement => {
  if (marbleCache[color.name]) return marbleCache[color.name];

  const canvas = document.createElement('canvas');
  canvas.width = MARBLE_RADIUS * 2 + 10;
  canvas.height = MARBLE_RADIUS * 2 + 10;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    ctx.shadowBlur = 10;
    ctx.shadowColor = color.glow;
    
    const grad = ctx.createRadialGradient(
      cx - MARBLE_RADIUS * 0.3, 
      cy - MARBLE_RADIUS * 0.3, 
      MARBLE_RADIUS * 0.1,
      cx, 
      cy, 
      MARBLE_RADIUS
    );
    grad.addColorStop(0, 'white');
    grad.addColorStop(0.2, color.fill);
    grad.addColorStop(1, 'black');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, MARBLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  marbleCache[color.name] = canvas;
  return canvas;
};

interface PathData {
  points: Point[];
  totalLength: number;
  segmentLengths: number[];
}

const generatePath = (type: string): PathData => {
  let points: Point[] = [];
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;

  if (type === 'spiral') {
    const a = 20, b = 12;
    for (let theta = 0; theta < Math.PI * 8; theta += 0.05) {
      const r = a + b * theta;
      points.push({ x: centerX + r * Math.cos(theta), y: centerY + r * Math.sin(theta) });
    }
    points = points.reverse();
  } else if (type === 's-curve') {
    for (let x = 0; x < CANVAS_WIDTH; x += 5) {
      const y = centerY + 200 * Math.sin((x / CANVAS_WIDTH) * Math.PI * 2);
      points.push({ x, y });
    }
  } else if (type === 'loop') {
    for (let theta = 0; theta < Math.PI * 2; theta += 0.05) {
      const r = 200 + 50 * Math.sin(theta * 3);
      points.push({ x: centerX + r * Math.cos(theta), y: centerY + r * Math.sin(theta) });
    }
    const last = points[points.length - 1];
    for (let i = 0; i < 20; i++) {
      points.push({ x: last.x + i * 10, y: last.y });
    }
  } else if (type === 'zigzag') {
    const step = CANVAS_WIDTH / 8;
    for (let i = 0; i <= 8; i++) {
      points.push({ x: i * step, y: i % 2 === 0 ? 100 : 500 });
    }
  } else if (type === 'heart') {
    for (let t = 0; t < Math.PI * 2; t += 0.05) {
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      points.push({ x: centerX + x * 18, y: centerY + y * 18 });
    }
  } else if (type === 'circular') {
    for (let theta = 0; theta < Math.PI * 4; theta += 0.05) {
      const r = 250 - theta * 15;
      points.push({ x: centerX + r * Math.cos(theta), y: centerY + r * Math.sin(theta) });
    }
  } else if (type === 'curvy') {
    for (let x = -100; x < CANVAS_WIDTH + 100; x += 5) {
      const y = centerY + 150 * Math.sin(x * 0.01) * Math.cos(x * 0.005);
      points.push({ x, y });
    }
  }
  
  // Smooth the path (Linear Interpolation)
  const smoothed: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i], p2 = points[i+1];
    const dist = getDistance(p1, p2);
    const steps = Math.max(1, Math.floor(dist / 5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      smoothed.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
    }
  }
  smoothed.push(points[points.length - 1]);

  // Calculate lengths
  let totalLength = 0;
  const segmentLengths: number[] = [0];
  for (let i = 0; i < smoothed.length - 1; i++) {
    const d = getDistance(smoothed[i], smoothed[i+1]);
    totalLength += d;
    segmentLengths.push(totalLength);
  }

  return { points: smoothed, totalLength, segmentLengths };
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [savedHighScore, setSavedHighScore] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('neon-pop-highscore') || '0', 10);
    }
    return 0;
  });
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover' | 'level-complete' | 'level-select'>('start');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(savedHighScore);
  const [level, setLevel] = useState(1);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [combo, setCombo] = useState(0);
  const [lastMatchTime, setLastMatchTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [shake, setShake] = useState(0);
  const [consecutiveMultiplier, setConsecutiveMultiplier] = useState(1);
  const [targetAngle, setTargetAngle] = useState(0);
  const [shooterPulse, setShooterPulse] = useState(0);
  const [flash, setFlash] = useState(0);
  const [stats, setStats] = useState({ maxCombo: 0, totalMatches: 0, powerUpsUsed: 0 });
  const [marblesCleared, setMarblesCleared] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [gamepadActive, setGamepadActive] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionOpacity, setTransitionOpacity] = useState(0);
  const [transitionStage, setTransitionStage] = useState<'none' | 'fade-out' | 'pause' | 'fade-in' | 'complete'>('none');
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [achievementNotify, setAchievementNotify] = useState<Achievement | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('neon-pop-theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('neon-pop-sound') !== 'false';
    }
    return true;
  });
  const [gameSpeed, setGameSpeed] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('neon-pop-speed') || '1.0');
    }
    return 1.0;
  });
  const [savedProgress, setSavedProgress] = useState<{ maxLevel: number; achievements: string[] }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('neon-pop-progress');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return { maxLevel: 1, achievements: [] };
        }
      }
    }
    return { maxLevel: 1, achievements: [] };
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activePowerUpEffect, setActivePowerUpEffect] = useState<{ type: PowerUpType, timer: number, color: string } | null>(null);
  const [magneticSettings, setMagneticSettings] = useState({ strength: 1.0, radius: 1.0 });
  const [lastInteractionTime, setLastInteractionTime] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activePowerUpEffect) {
      const timer = setInterval(() => {
        setActivePowerUpEffect(prev => {
          if (!prev || prev.timer <= 0) return null;
          return { ...prev, timer: prev.timer - 16 };
        });
      }, 16);
      return () => clearInterval(timer);
    }
  }, [activePowerUpEffect]);

  useEffect(() => {
    localStorage.setItem('neon-pop-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('neon-pop-sound', String(soundEnabled));
    sounds.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('neon-pop-speed', String(gameSpeed));
  }, [gameSpeed]);

  useEffect(() => {
    if (score > savedHighScore) {
      setSavedHighScore(score);
      localStorage.setItem('neon-pop-highscore', String(score));
    }
  }, [score, savedHighScore]);

  useEffect(() => {
    const progress = {
      maxLevel: Math.max(savedProgress.maxLevel, level),
      achievements: [...new Set([...savedProgress.achievements, ...unlockedAchievements])]
    };
    setSavedProgress(progress);
    localStorage.setItem('neon-pop-progress', JSON.stringify(progress));
  }, [level, unlockedAchievements]);

  const unlockAchievement = (id: string) => {
    if (unlockedAchievements.includes(id)) return;
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
      setUnlockedAchievements(prev => [...prev, id]);
      setAchievementNotify(achievement);
      setTimeout(() => setAchievementNotify(null), 4000);
    }
  };

  // Game references
  const levelConfig = LEVELS[level - 1] || LEVELS[0];
  const pathRef = useRef<PathData>(generatePath(levelConfig.pathType));
  const chainRef = useRef<Marble[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const obstaclesRef = useRef<Obstacle[]>(levelConfig.obstacles.map(o => new Obstacle(o)));
  const particlesRef = useRef<Particle[]>([]);
  const nextColorRef = useRef<Color>(levelConfig.colors[Math.floor(Math.random() * levelConfig.colors.length)]);
  const shooterAngleRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const spawnCountRef = useRef(0);
  const requestRef = useRef<number>(0);
  const slowMoTimerRef = useRef<number>(0);
  const gameStartedRef = useRef(false);

  const startGame = (startLevel?: number) => {
    sounds.init();
    sounds.setEnabled(soundEnabled);
    if (startLevel) setLevel(startLevel);
    const cfg = startLevel ? LEVELS[startLevel - 1] : levelConfig;
    
    // Reset game state
    chainRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    pathRef.current = generatePath(cfg.pathType);
    obstaclesRef.current = cfg.obstacles.map(o => new Obstacle(o));
    spawnCountRef.current = 0;
    setMarblesCleared(0);
    setScore(0);
    setStats({ maxCombo: 0, totalMatches: 0, powerUpsUsed: 0 });
    gameStartedRef.current = false; // Reset - wait for intro to finish
    
    // Start Intro Sequence
    setGameState('playing');
    setShowIntro(true);
    setIntroStep(0);
    
    // Sequence: 1. Zone Name -> 2. Challenge -> 3. Start
    setTimeout(() => setIntroStep(1), 1500);
    setTimeout(() => setIntroStep(2), 3000);
    setTimeout(() => {
      setShowIntro(false);
      gameStartedRef.current = true; // NOW game officially starts
      lastSpawnTimeRef.current = performance.now();
    }, 4500);
  };

  const nextLevel = () => {
    if (level >= LEVELS.length) {
      setGameState('gameover');
      return;
    }

    // Multi-stage smooth transition
    setIsTransitioning(true);
    setTransitionStage('fade-out');
    setTransitionOpacity(0);
    
    // Stage 1: Fade out (0.6s)
    setTimeout(() => {
      setTransitionStage('pause');
      setTransitionOpacity(1);
      
      // Advance level while screen is black
      const nextLvl = level + 1;
      setLevel(nextLvl);
      setWinStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak >= 5) unlockAchievement('streak_5');
        return newStreak;
      });
      if (nextLvl > 10) unlockAchievement('level_10');
      
      // Save progress - unlock next level
      if (nextLvl > savedProgress.maxLevel) {
        setSavedProgress(prev => {
          const newProgress = { ...prev, maxLevel: nextLvl };
          localStorage.setItem('neon-pop-progress', JSON.stringify(newProgress));
          return newProgress;
        });
      }
      
      // Reset game state for new level
      chainRef.current = [];
      projectilesRef.current = [];
      particlesRef.current = [];
      const nextCfg = LEVELS[nextLvl - 1];
      pathRef.current = generatePath(nextCfg.pathType);
      obstaclesRef.current = nextCfg.obstacles.map(o => new Obstacle(o));
      spawnCountRef.current = 0;
      setMarblesCleared(0);
      
      // Stage 2: Brief pause (0.3s)
      setTimeout(() => {
        // Stage 3: Fade in (0.6s)
        setTransitionStage('fade-in');
        setTransitionOpacity(0);
        
        // Stage 4: Show intro and start
        setTimeout(() => {
          setGameState('playing');
          setShowIntro(true);
          setIntroStep(0);
          setTimeout(() => setIntroStep(1), 1500);
          setTimeout(() => setIntroStep(2), 3000);
          setTimeout(() => {
            setShowIntro(false);
            setIsTransitioning(false);
            setTransitionStage('none');
            gameStartedRef.current = true; // CRITICAL: Enable game after intro
            lastSpawnTimeRef.current = performance.now();
          }, 4500);
        }, 400);
      }, 300);
    }, 600);
  };

  const createExplosion = (x: number, y: number, color: string, intensity: number = 1) => {
    const count = Math.floor(24 * intensity);
    for (let i = 0; i < count; i++) {
      const particleType = Math.random();
      let type: 'spark' | 'glow' | 'ring' | 'streak' = 'spark';
      if (particleType > 0.85) type = 'glow';
      else if (particleType > 0.75) type = 'ring';
      else if (particleType > 0.65) type = 'streak';
      particlesRef.current.push(new Particle(x, y, color, type));
    }
    if (intensity > 0.8) {
      for (let i = 0; i < Math.floor(count / 3); i++) {
        particlesRef.current.push(new Particle(x, y, 'rgba(255, 255, 255, 0.3)', 'smoke'));
      }
    }
    if (intensity > 1.2) {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        particlesRef.current.push(new Particle(x + Math.cos(angle) * 40, y + Math.sin(angle) * 40, color, 'ring'));
      }
    }
    if (intensity > 1.5) {
      setShake(Math.max(shake, intensity * 3));
      setFlash(Math.min(0.5, flash + 0.2));
    }
  };

  const gameOver = useCallback(() => {
    sounds.playGameOver();
    setGameState('gameover');
    setHighScore(prev => Math.max(prev, score));
    setCombo(0);
    setWinStreak(0);
  }, [score]);

  const getPointOnPath = (distance: number): Point => {
    const { points, totalLength, segmentLengths } = pathRef.current;
    if (distance <= 0) return points[0];
    if (distance >= totalLength) return points[points.length - 1];

    // Find segment using binary search for performance
    let low = 0, high = segmentLengths.length - 1;
    let index = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (segmentLengths[mid] <= distance) {
        index = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const nextIndex = Math.min(index + 1, points.length - 1);
    if (index === nextIndex) return points[index];

    const segStart = segmentLengths[index];
    const segEnd = segmentLengths[nextIndex];
    const t = (distance - segStart) / (segEnd - segStart);
    
    const p1 = points[index], p2 = points[nextIndex];
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
  };

  const triggerPowerUp = (type: PowerUpType, index: number) => {
    const chain = chainRef.current;
    if (index < 0 || index >= chain.length) return;
    
    const marble = chain[index];
    const marblePos = getPointOnPath(marble.distance);

    setActivePowerUpEffect({
      type,
      timer: 1000,
      color: marble.color.fill
    });

    if (type === 'bomb') {
      unlockAchievement('first_bomb');
      sounds.playExplosion();
      setStats(prev => ({ ...prev, powerUpsUsed: prev.powerUpsUsed + 1 }));
      createExplosion(marblePos.x, marblePos.y, '#ff4400', 5);
      // Add shockwave particles
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const dist = 50;
        particlesRef.current.push(new Particle(marblePos.x + Math.cos(angle) * dist, marblePos.y + Math.sin(angle) * dist, '#ffaa00', 'glow'));
      }
      // Destroy nearby static, breakable, or barrier obstacles
      obstaclesRef.current.forEach(obs => {
        if ((obs.type === 'static' || obs.type === 'breakable' || obs.type === 'barrier') && getDistance(marblePos, obs.getPos()) < 160) {
          obs.destroyed = true;
          createExplosion(obs.getPos().x, obs.getPos().y, '#ff0000', 3);
        }
      });
      
      const start = Math.max(0, index - 2);
      const count = Math.min(chain.length - start, 5);
      chain.splice(start, count);
      setMarblesCleared(prev => prev + count);
      setScore(prev => Math.floor(prev + count * 200 * consecutiveMultiplier));
    } else if (type === 'lightning') {
      sounds.playMatch();
      setStats(prev => ({ ...prev, powerUpsUsed: prev.powerUpsUsed + 1 }));
      createExplosion(marblePos.x, marblePos.y, '#00ffff', 4);
      // Add lightning particles
      for (let i = 0; i < 15; i++) {
        particlesRef.current.push(new Particle(marblePos.x + (Math.random() - 0.5) * 100, marblePos.y + (Math.random() - 0.5) * 100, '#00ffff', 'spark'));
      }
      const colorToKill = chain[index].color.name;
      const initialLen = chain.length;
      chainRef.current = chain.filter(m => {
        if (m.color.name === colorToKill) {
          const p = getPointOnPath(m.distance);
          createExplosion(p.x, p.y, m.color.fill, 1);
          return false;
        }
        return true;
      });
      const killedCount = initialLen - chainRef.current.length;
      setMarblesCleared(prev => prev + killedCount);
      setScore(prev => Math.floor(prev + killedCount * 150 * consecutiveMultiplier));
    } else if (type === 'slow') {
      setSlowMoActive(true);
      setStats(prev => ({ ...prev, powerUpsUsed: prev.powerUpsUsed + 1 }));
      slowMoTimerRef.current = performance.now() + 5000;
      createExplosion(marblePos.x, marblePos.y, '#00e5ff', 3);
      // Add slow-motion particles
      for (let i = 0; i < 10; i++) {
        particlesRef.current.push(new Particle(marblePos.x, marblePos.y, '#00e5ff', 'glow'));
      }
    }
  };

  const checkMatches = useCallback((index: number) => {
    const chain = chainRef.current;
    if (index < 0 || index >= chain.length) return;
    const color = chain[index].color.name;
    let start = index, end = index;
    while (start > 0 && chain[start - 1].color.name === color) start--;
    while (end < chain.length - 1 && chain[end + 1].color.name === color) end++;
    const count = end - start + 1;
    if (count >= 3) {
      sounds.playMatch();
      if (count >= 5) {
        setShake(prev => Math.max(prev, 5));
      }
      // Collect power-ups before removing marbles
      const powerUpsToTrigger: { type: PowerUpType, index: number }[] = [];
      for (let i = start; i <= end; i++) {
        const m = chain[i];
        const pos = getPointOnPath(m.distance);
        createExplosion(pos.x, pos.y, m.color.fill, 1.5);
        if (m.powerUp) powerUpsToTrigger.push({ type: m.powerUp, index: i });
      }
      
      // Remove marbles
      chain.splice(start, count);
      setMarblesCleared(prev => prev + count);
      
      const now = performance.now();
      const timeDiff = now - lastMatchTime;
      const newCombo = timeDiff < 2000 ? combo + 1 : 1;
      
      if (timeDiff < 1000) {
        setConsecutiveMultiplier(prev => Math.min(prev + 0.5, 5));
      } else if (timeDiff > 3000) {
        setConsecutiveMultiplier(1);
      }

      setCombo(newCombo);
      if (newCombo >= 10) unlockAchievement('max_combo');
      setLastMatchTime(now);
      setStats(prev => ({ 
        ...prev, 
        totalMatches: prev.totalMatches + 1,
        maxCombo: Math.max(prev.maxCombo, newCombo)
      }));
      
      const points = Math.floor(count * 100 * newCombo * consecutiveMultiplier);
      setScore(prev => prev + points);

      // Trigger power-ups
      powerUpsToTrigger.forEach(pu => triggerPowerUp(pu.type, start));

      // Recursive check: after removal, the new neighbors might match
      if (start > 0 && start < chain.length) {
        if (chain[start - 1].color.name === chain[start].color.name) {
          // They match! But we only trigger if they are "touching" or will snap together
          // The snap-back logic in update() will handle the actual trigger when they touch.
        }
      }
    }
  }, [combo, lastMatchTime, consecutiveMultiplier]);

  const checkAllMatches = useCallback(() => {
    const chain = chainRef.current;
    let i = 0;
    while (i < chain.length) {
      const color = chain[i].color.name;
      let j = i + 1;
      while (j < chain.length && chain[j].color.name === color) j++;
      const count = j - i;
      if (count >= 3) {
        let touching = true;
        for (let k = i; k < j - 1; k++) {
          if (chain[k + 1].distance - chain[k].distance > MARBLE_DIAMETER * 1.1) {
            touching = false; break;
          }
        }
        if (touching) {
          sounds.playMatch();
          chain.splice(i, count);
          setMarblesCleared(prev => prev + count);
          setScore(prev => prev + count * 100);
          continue;
        }
      }
      i++;
    }
  }, []);

  const handleMouseMove = (e: MouseEvent) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const centerX = CANVAS_WIDTH / 2, centerY = CANVAS_HEIGHT / 2;
    setTargetAngle(Math.atan2(y - centerY, x - centerX));
  };

  const handleClick = useCallback(() => {
    if (gameState !== 'playing' || isPaused || showIntro) return;
    
    sounds.playShoot();
    projectilesRef.current.push(new Projectile(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, shooterAngleRef.current, nextColorRef.current));
    nextColorRef.current = levelConfig.colors[Math.floor(Math.random() * levelConfig.colors.length)];
    setShooterPulse(10);
  }, [gameState, isPaused, showIntro, levelConfig]);

  const update = useCallback((time: number) => {
    requestRef.current = requestAnimationFrame(update);
    
    // Game logic only runs when properly in playing state with no intro/pause
    if (gameState !== 'playing' || isPaused || showIntro) {
      // Still render basic frame but skip game logic
      return;
    }

    if (shake > 0) setShake(prev => Math.max(0, prev - 0.5));
    if (flash > 0) setFlash(prev => Math.max(0, prev - 0.02));
    if (shooterPulse > 0) setShooterPulse(prev => Math.max(0, prev - 1));

    // Smooth shooter rotation
    let diff = targetAngle - shooterAngleRef.current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    shooterAngleRef.current += diff * 0.2;

    if (slowMoActive && time > slowMoTimerRef.current) setSlowMoActive(false);

    const chain = chainRef.current;
    const projectiles = projectilesRef.current;
    const obstacles = obstaclesRef.current;

    // 2. Movement
    const levelGroup = Math.floor((level - 1) / 5);
    const difficultySpeedMult = 1 + (levelGroup * 0.1);
    const difficultySpawnMult = 1 - (levelGroup * 0.05);
    
    const timeInLevel = (time - lastSpawnTimeRef.current) / 60000;
    const timeSpeedMult = 1 + Math.min(0.5, timeInLevel * 0.2);
    
    const baseSpeed = 1.5 * difficultySpeedMult * timeSpeedMult * gameSpeed;
    const speedMult = slowMoActive ? 0.3 : 1;
    const currentSpawnRate = (levelConfig.spawnRate * difficultySpawnMult) / gameSpeed;

    // Spawning
    if (spawnCountRef.current < levelConfig.maxMarbles && time - lastSpawnTimeRef.current > currentSpawnRate && chain.length < 100) {
      const first = chain[0];
      if (!first || first.distance > MARBLE_DIAMETER * 1.5) {
        const hasPowerUp = Math.random() < 0.1;
        const powerUp = hasPowerUp ? (['bomb', 'lightning', 'slow'][Math.floor(Math.random() * 3)] as PowerUpType) : null;
        chain.unshift(new Marble(levelConfig.colors[Math.floor(Math.random() * levelConfig.colors.length)], 0, powerUp));
        lastSpawnTimeRef.current = time;
        spawnCountRef.current++;
      }
    }

    // Update chain movement
    if (chain.length > 0) {
      // Move the head marble
      const head = chain[chain.length - 1];
      head.distance += baseSpeed * speedMult;
      
      if (head.distance >= pathRef.current.totalLength) { gameOver(); return; }

      // Other marbles follow
      for (let i = chain.length - 2; i >= 0; i--) {
        const m = chain[i];
        const prev = chain[i + 1];
        
        const idealDist = MARBLE_DIAMETER;
        const currentDist = prev.distance - m.distance;
        
        if (currentDist < idealDist) {
          // Pushed by marble in front
          m.distance = prev.distance - idealDist;
        } else if (currentDist > idealDist) {
          // Gap exists
          // Snap-back logic: if colors match at the gap, pull back section
          if (m.color.name === prev.color.name) {
            m.distance += baseSpeed * 3; // Pull back faster
            if (prev.distance - m.distance < idealDist) {
              m.distance = prev.distance - idealDist;
              // Trigger match check when they snap together
              checkMatches(i);
            }
          } else {
            // Normal movement for disconnected sections
            m.distance += baseSpeed * speedMult * 0.5; 
          }
        } else {
          // Perfectly following
          m.distance = prev.distance - idealDist;
        }

        if (m.distance >= pathRef.current.totalLength) { gameOver(); return; }
      }
    }

    // 3. Projectiles & Obstacles
    // Build spatial hash for chain marbles for optimized collision detection
    spatialHash.clear();
    for (let idx = 0; idx < chain.length; idx++) {
      const pos = getPointOnPath(chain[idx].distance);
      spatialHash.insert('marble', idx, pos.x, pos.y);
    }

    obstacles.forEach(obs => {
      if (!obs.destroyed) obs.update();
    });

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.update(time);
      if (p.isOffScreen()) { projectiles.splice(i, 1); continue; }

      // Obstacle collision
      let hitObstacle = false;
      const pPos = { x: p.x, y: p.y };

      for (const obs of obstacles) {
        if (obs.destroyed) continue;

        if (obs.type === 'platform') {
          const pos = obs.getPos();
          const dx = p.x - pos.x;
          const dy = p.y - pos.y;
          const halfWidth = obs.radius * 1.25;
          const halfHeight = 10;
          if (Math.abs(dx) < halfWidth + MARBLE_RADIUS && Math.abs(dy) < halfHeight + MARBLE_RADIUS) {
            p.triggerImpactEffect();
            createExplosion(p.x, p.y, '#00e5ff', 1.2);
            for (let sp = 0; sp < 5; sp++) {
              particlesRef.current.push(new Particle(pos.x + (Math.random() - 0.5) * 40, pos.y + (Math.random() - 0.5) * 20, '#00e5ff', 'glow'));
            }           
            setShake(5);
            projectiles.splice(i, 1);
            hitObstacle = true;
            break;
          }
          continue;
        }

        if (obs.type === 'portal') {
          const obsPos = obs.getPos();
          const distSq = getDistanceSq(pPos, obsPos);
          if (distSq < (obs.radius + MARBLE_RADIUS) ** 2) {
            if (p.lastPortalId === `${obs.initialX}_${obs.initialY}`) break;
            const otherPortal = obstacles.find(o => o !== obs && o.type === 'portal' && !o.destroyed);
            if (otherPortal) {
              const otherPos = otherPortal.getPos();
              p.x = otherPos.x;
              p.y = otherPos.y;
              p.lastPortalId = `${otherPortal.initialX}_${otherPortal.initialY}`;
              createExplosion(obsPos.x, obsPos.y, '#00ffff', 1.5);
              createExplosion(otherPos.x, otherPos.y, '#00ffff', 1.5);
              hitObstacle = true;
              break;
            }
          }
          continue;
        }

        const collisionDistSq = (obs.radius + MARBLE_RADIUS) ** 2;
        if (getDistanceSq(pPos, obs.getPos()) < collisionDistSq) {
          if (obs.type === 'barrier') {
            p.triggerImpactEffect();
            createExplosion(p.x, p.y, '#ff00ff', 1.2);
            setShake(5);
            projectiles.splice(i, 1);
            hitObstacle = true;
            break;
          }
          if (obs.hit()) {
            createExplosion(p.x, p.y, '#ffffff', 1.5);
            setShake(5);
          } else {
            createExplosion(p.x, p.y, '#ffffff', 0.8);
            setShake(3);
          }
          projectiles.splice(i, 1);
          hitObstacle = true;
          break;
        }
      }
      if (hitObstacle) continue;

      // Chain collision using spatial hash
      const nearbyMarbles = spatialHash.query(p.x, p.y, MARBLE_RADIUS * 2.5);
      for (const item of nearbyMarbles) {
        if (item.type !== 'marble') continue;
        const m = chain[item.index];
        const mPos = getPointOnPath(m.distance);
        if (getDistanceSq(pPos, mPos) < (MARBLE_RADIUS * 2) ** 2) {
          p.triggerImpactEffect();
          createExplosion(p.x, p.y, p.color.fill, 1.8);
          setShake(5);
          
          // Determine insertion point
          chain.splice(item.index, 0, new Marble(p.color, m.distance - MARBLE_DIAMETER));
          
          // Impact effect: push the chain slightly
          for (let k = item.index; k < chain.length; k++) {
            chain[k].distance += 10;
          }

          // Shift everything behind the insertion point back to make room
          for (let k = 0; k < item.index; k++) {
            chain[k].distance -= MARBLE_DIAMETER;
          }

          projectiles.splice(i, 1);
          checkMatches(item.index);
          break;
        }
      }
    }

    // 4. Check Win
    if (spawnCountRef.current >= levelConfig.maxMarbles && chain.length === 0) {
      sounds.playLevelComplete();
      setGameState('level-complete');
    }
    if (score >= 50000) unlockAchievement('high_score');

    checkAllMatches();

    // 5. Render
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      if (gameState === 'start') {
        // Animated Background for Splash Screen
        ctx.fillStyle = theme === 'dark' ? '#050505' : '#f8f8f8';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Grid
        ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        const offset = (time * 0.01) % gridSize;
        for (let x = offset; x < CANVAS_WIDTH; x += gridSize) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
        }
        for (let y = offset; y < CANVAS_HEIGHT; y += gridSize) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
        }

        // Floating Orbs
        for (let i = 0; i < 10; i++) {
          const x = (Math.sin(time * 0.001 + i) * 0.5 + 0.5) * CANVAS_WIDTH;
          const y = (Math.cos(time * 0.0008 + i * 2) * 0.5 + 0.5) * CANVAS_HEIGHT;
          const color = COLORS[i % COLORS.length];
          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = color.glow;
          ctx.fillStyle = color.fill;
          ctx.globalAlpha = theme === 'dark' ? 0.1 : 0.05;
          ctx.beginPath();
          ctx.arc(x, y, 30 + Math.sin(time * 0.002 + i) * 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        return;
      }

      ctx.save();
      if (shake > 0) {
        const sx = (Math.random() - 0.5) * shake;
        const sy = (Math.random() - 0.5) * shake;
        ctx.translate(sx, sy);
      }

      // Path
      const isDanger = chain.some(m => m.distance > pathRef.current.totalLength * 0.8);
      ctx.beginPath();
      ctx.strokeStyle = isDanger ? `rgba(255, 0, 0, ${0.1 + Math.sin(time * 0.01) * 0.05})` : (theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)');
      ctx.lineWidth = 40;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const path = pathRef.current;
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
      ctx.stroke();

      // Path Glow
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.01)';
      ctx.lineWidth = 50;
      ctx.stroke();

      // Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.update(time);
        p.draw(ctx);
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }

      // Obstacles
      obstacles.forEach(obs => obs.draw(ctx, theme));

      // Marbles
      chain.forEach(m => {
        let pos = getPointOnPath(m.distance);
        
        // Pushing effect from rotating obstacles & Pulling from magnetic
        obstacles.forEach(obs => {
          if (!obs.destroyed) {
            if (obs.type === 'rotating') {
              const obsPos = obs.getPos();
              const dSq = getDistanceSq(pos, obsPos);
              const limit = (obs.radius + MARBLE_RADIUS + 50) ** 2;
              if (dSq < limit && dSq > 0) {
                const d = Math.sqrt(dSq);
                const angle = Math.atan2(pos.y - obsPos.y, pos.x - obsPos.x);
                
                // Calculate rotation direction influence
                const rotationDir = obs.speed > 0 ? 1 : -1;
                const absSpeed = Math.abs(obs.speed);
                
                // Proximity factor - stronger when closer
                const proximityFactor = 1 - (d / (obs.radius + MARBLE_RADIUS + 50));
                
                // Speed factor - faster rotation = stronger push
                const speedFactor = Math.min(absSpeed * 3, 2);
                
                // Combined push force with rotation direction
                const basePush = (Math.sqrt(limit) - d) * 0.5;
                const rotationPush = rotationDir * proximityFactor * speedFactor * 3;
                const totalForce = basePush + Math.abs(rotationPush);
                
                // Apply push in rotation direction + outward push
                const pushAngle = angle + (rotationDir * Math.PI / 2);
                pos.x += Math.cos(pushAngle) * Math.abs(rotationPush) * 0.5;
                pos.y += Math.sin(pushAngle) * Math.abs(rotationPush) * 0.5;
                
                // Also push outward
                pos.x += Math.cos(angle) * basePush;
                pos.y += Math.sin(angle) * basePush;
                
                // Add rotation particles when very close
                if (d < obs.radius + MARBLE_RADIUS + 20 && Math.random() < 0.15) {
                  const particleAngle = Math.random() * Math.PI * 2;
                  particlesRef.current.push(new Particle(
                    obsPos.x + Math.cos(particleAngle) * obs.radius,
                    obsPos.y + Math.sin(particleAngle) * obs.radius,
                    obs.speed > 0 ? '#ff00ff' : '#00ffff',
                    'spark'
                  ));
                }
              }
            } else if (obs.type === 'magnetic') {
              const obsPos = obs.getPos();
              const dSq = getDistanceSq(pos, obsPos);
              const effectivePullRadius = obs.pullRadius * magneticSettings.radius;
              const pullLimitSq = effectivePullRadius ** 2;
              if (dSq < pullLimitSq) {
                const d = Math.sqrt(dSq);
                const angle = Math.atan2(obsPos.y - pos.y, obsPos.x - pos.x);
                const force = (1 - d / effectivePullRadius) * obs.strength * 50 * magneticSettings.strength;
                pos.x += Math.cos(angle) * force;
                pos.y += Math.sin(angle) * force;
                
                // Add magnetic particles
                if (Math.random() < 0.1) {
                  particlesRef.current.push(new Particle(pos.x, pos.y, '#00ffff', 'glow'));
                }
              }
            }
          }
        });

        const texture = getMarbleTexture(m.color);
        ctx.drawImage(texture, pos.x - texture.width / 2, pos.y - texture.height / 2);
        
        if (m.powerUp) {
          ctx.save();
          ctx.fillStyle = 'white';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowBlur = 5;
          ctx.shadowColor = 'black';
          ctx.fillText(m.powerUp[0].toUpperCase(), pos.x, pos.y + 4);
          ctx.restore();
        }
      });

      // Projectiles
      projectiles.forEach(p => p.draw(ctx));
      // Shooter
      const centerX = CANVAS_WIDTH / 2, centerY = CANVAS_HEIGHT / 2;
      ctx.save();
      ctx.translate(centerX, centerY);

      // Power-up Aura with enhanced visual effects
      if (activePowerUpEffect) {
        const p = activePowerUpEffect;
        const pulse = Math.sin(time * 0.01) * 0.2 + 1;
        
        // Multiple concentric rings
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = p.color;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4;
        ctx.globalAlpha = (p.timer / 1000) * 0.5;
        
        // Outer ring
        ctx.beginPath();
        ctx.arc(0, 0, SHOOTER_RADIUS * 1.5 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner ring
        ctx.lineWidth = 2;
        ctx.globalAlpha = (p.timer / 1000) * 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, SHOOTER_RADIUS * 1.2 * (1 / pulse), 0, Math.PI * 2);
        ctx.stroke();
        
        // Rotating dashed ring
        ctx.globalAlpha = (p.timer / 1000) * 0.4;
        ctx.setLineDash([8, 8]);
        ctx.rotate(time * 0.003);
        ctx.beginPath();
        ctx.arc(0, 0, SHOOTER_RADIUS * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Particle sparks around shooter based on power-up type
        const particleColor = p.type === 'bomb' ? '#ff4400' : 
                            p.type === 'lightning' ? '#00ffff' : '#00e5ff';
        
        if (Math.random() < 0.3) {
          const sparkAngle = Math.random() * Math.PI * 2;
          const sparkDist = SHOOTER_RADIUS * 1.5 + Math.random() * 40;
          particlesRef.current.push(new Particle(
            centerX + Math.cos(sparkAngle) * sparkDist,
            centerY + Math.sin(sparkAngle) * sparkDist,
            particleColor,
            p.type === 'lightning' ? 'streak' : 'spark'
          ));
        }
        
        // Type-specific particle effects
        if (p.type === 'bomb' && Math.random() < 0.2) {
          particlesRef.current.push(new Particle(
            centerX + (Math.random() - 0.5) * 80,
            centerY + (Math.random() - 0.5) * 80,
            '#ff6600',
            'glow'
          ));
        } else if (p.type === 'lightning' && Math.random() < 0.25) {
          particlesRef.current.push(new Particle(
            centerX + (Math.random() - 0.5) * 120,
            centerY + (Math.random() - 0.5) * 120,
            '#00ffff',
            'spark'
          ));
        } else if (p.type === 'slow' && Math.random() < 0.15) {
          particlesRef.current.push(new Particle(
            centerX + (Math.random() - 0.5) * 100,
            centerY + (Math.random() - 0.5) * 100,
            '#00e5ff',
            'glow'
          ));
        }
        ctx.restore();
      }

      ctx.rotate(shooterAngleRef.current);
      
      const pulseScale = 1 + (shooterPulse / 50);
      ctx.scale(pulseScale, pulseScale);

      ctx.shadowBlur = 20;
      ctx.shadowColor = nextColorRef.current.glow;
      ctx.fillStyle = '#1a1a1a';
      ctx.strokeStyle = nextColorRef.current.fill;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, SHOOTER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Barrel
      ctx.fillStyle = '#333';
      ctx.fillRect(0, -10, 45, 20);
      ctx.strokeRect(0, -10, 45, 20);
      
      // Loaded Marble 3D
      const shooterGrad = ctx.createRadialGradient(
        -MARBLE_RADIUS * 0.3, 
        -MARBLE_RADIUS * 0.3, 
        MARBLE_RADIUS * 0.1,
        0, 
        0, 
        MARBLE_RADIUS
      );
      shooterGrad.addColorStop(0, 'white');
      shooterGrad.addColorStop(0.2, nextColorRef.current.fill);
      shooterGrad.addColorStop(1, 'black');
      
      ctx.fillStyle = shooterGrad;
      ctx.beginPath();
      ctx.arc(0, 0, MARBLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Screen Flash
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flash})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Level Transition Fade with animation
      if (isTransitioning && transitionStage !== 'none') {
        let opacity = transitionOpacity;
        let bgColor = 'rgba(0, 0, 0, 1)';
        
        if (transitionStage === 'fade-out') {
          // Calculate progressive fade out
          const progress = Math.min(1, (Date.now() % 600) / 600);
          opacity = progress;
          bgColor = 'rgba(0, 0, 0, 1)';
        } else if (transitionStage === 'fade-in') {
          // Calculate progressive fade in
          const progress = Math.min(1, (Date.now() % 600) / 600);
          opacity = 1 - progress;
          bgColor = 'rgba(0, 0, 0, 1)';
        } else if (transitionStage === 'pause') {
          opacity = 1;
        }
        
        // Add transition effect
        ctx.save();
        const grad = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 0, CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH * 0.7);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, bgColor.replace('1)', `${opacity})`));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Show level number during transition
        if (transitionStage !== 'none') {
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
          ctx.font = 'bold 120px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowBlur = 30;
          ctx.shadowColor = '#ff00ff';
          ctx.fillText(`${level}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
          
          ctx.font = 'bold 24px sans-serif';
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
          ctx.fillText('ZONE', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 80);
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }, [gameState, gameOver, checkAllMatches, checkMatches, level, slowMoActive, levelConfig, isPaused, shake, consecutiveMultiplier, targetAngle, shooterPulse, flash, theme, transitionOpacity, isTransitioning, transitionStage, magneticSettings]);

  useEffect(() => {
    let gamepadInterval: number;
    let lastButton0Time = 0;
    let lastButton9Time = 0;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0];
      if (!gp) {
        if (gamepadActive) setGamepadActive(false);
        return;
      }

      if (!gamepadActive) setGamepadActive(true);

      // Analog Stick for Rotation
      const axisX = gp.axes[0];
      const axisY = gp.axes[1];
      if (Math.abs(axisX) > 0.1 || Math.abs(axisY) > 0.1) {
        setTargetAngle(Math.atan2(axisY, axisX));
      }

      // Buttons
      // Button 0 (A on Xbox, X on PS) - Shoot with debounce
      const now = Date.now();
      if (gp.buttons[0].pressed && now - lastButton0Time > 150) {
        handleClick();
        lastButton0Time = now;
      }

      // Button 9 (Start) - Pause with debounce
      if (gp.buttons[9].pressed && now - lastButton9Time > 500) {
        setIsPaused(prev => !prev);
        lastButton9Time = now;
      }
    };

    gamepadInterval = window.setInterval(pollGamepad, 16);
    return () => clearInterval(gamepadInterval);
  }, [gamepadActive, gameState, isPaused, handleClick]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  return (
    <div className={`min-h-screen min-h-dvh ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-[#f0f2f5] text-slate-900'} flex items-center justify-center p-2 sm:p-4 font-sans selection:bg-pink-500/30 transition-colors duration-700`}>
      <div className={`game-container relative w-full max-w-[800px] aspect-[4/3] ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10 shadow-black' : 'bg-white border-black/5 shadow-slate-200'} rounded-xl sm:rounded-2xl lg:rounded-[2.5rem] border shadow-2xl transition-all duration-700 overflow-y-auto`}>
        
        {/* Fixed Right-Side Scrollbar */}
        <div className="fixed right-0 top-0 bottom-0 w-3 sm:w-4 pointer-events-none z-[9999]">
          <div className="absolute right-1 sm:right-2 top-4 sm:top-6 bottom-4 sm:bottom-6 w-2 sm:w-3 rounded-full bg-gradient-to-b from-pink-500 via-purple-500 to-violet-600 shadow-[0_0_15px_rgba(236,72,153,0.8),0_0_30px_rgba(139,92,246,0.6)]"></div>
        </div>
        
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onMouseMove={handleMouseMove} onClick={handleClick} className="w-full h-full cursor-crosshair touch-none" />

        <div className="hud-top-left absolute top-2 sm:top-4 md:top-6 left-2 sm:left-4 md:left-6 lg:top-8 lg:left-8 pointer-events-none flex flex-col gap-2 sm:gap-4 md:gap-6">
          <div className="flex flex-col gap-0.5 sm:gap-1">
            <span className={`text-[8px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-black`}>Zone {level}</span>
            <span className="text-base sm:text-xl md:text-2xl font-black italic tracking-tighter text-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.4)]">{levelConfig.name}</span>
          </div>
          <div className="flex flex-col gap-0.5 sm:gap-1">
            <span className={`text-[8px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-black`}>Score</span>
            <span className={`text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'} tabular-nums drop-shadow-[0_0_25px_rgba(0,0,0,0.1)]`}>{score.toLocaleString()}</span>
          </div>
          
          <div className={`w-32 sm:w-40 md:w-56 h-1.5 sm:h-2 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} rounded-full overflow-hidden border mt-1 sm:mt-2`}>
            <motion.div 
              className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (marblesCleared / levelConfig.maxMarbles) * 100)}%` }}
              transition={{ type: "spring", stiffness: 50, damping: 20 }}
            />
          </div>
        </div>

        <div className="hud-top-right absolute top-2 sm:top-4 md:top-6 right-2 sm:right-4 md:right-6 lg:top-8 lg:right-8 pointer-events-none text-right flex flex-col gap-2 sm:gap-4 md:gap-6">
          <div className="flex flex-col gap-0.5 sm:gap-1">
            <span className={`text-[8px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-black`}>Marbles</span>
            <span className={`text-base sm:text-xl md:text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'} tabular-nums`}>{marblesCleared} / {levelConfig.maxMarbles}</span>
          </div>
          <div className="flex flex-col gap-1 sm:gap-2 items-end">
            {combo > 1 && (
              <motion.div 
                initial={{ x: 20, opacity: 0, scale: 0.8 }} 
                animate={{ x: 0, opacity: 1, scale: 1 }} 
                className="text-lg sm:text-2xl md:text-3xl font-black italic text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]"
              >
                {combo}X COMBO!
              </motion.div>
            )}
            {consecutiveMultiplier > 1 && (
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[8px] sm:text-xs font-black text-pink-500 bg-pink-500/10 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-pink-500/20 backdrop-blur-md">
                BONUS X{consecutiveMultiplier.toFixed(1)}
              </motion.div>
            )}
          </div>
          {slowMoActive && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1 sm:gap-2 text-blue-400 font-black uppercase text-[8px] sm:text-[10px] tracking-widest bg-blue-500/10 px-2 sm:px-4 py-1 sm:py-2 rounded-full border border-blue-500/20 backdrop-blur-md">
              <Clock size={12} sm:size={14} /> Slow Motion
            </motion.div>
          )}
        </div>

        <div className="hud-controls absolute top-2 sm:top-4 md:top-6 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 pointer-events-auto">
          <button 
            onClick={() => setIsPaused(!isPaused)} 
            className={`p-2 sm:p-3 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-200'} rounded-xl sm:rounded-2xl border transition-all hover:scale-110 active:scale-95`}
          >
            {isPaused ? <Play size={20} sm:size={24} className={theme === 'dark' ? 'text-white' : 'text-slate-900'} fill="currentColor" /> : <div className="flex gap-1"><div className={`w-1.5 sm:w-2 h-4 sm:h-6 ${theme === 'dark' ? 'bg-white' : 'bg-slate-900'} rounded-full`} /><div className={`w-1.5 sm:w-2 h-4 sm:h-6 ${theme === 'dark' ? 'bg-white' : 'bg-slate-900'} rounded-full`} /></div>}
          </button>
          <button 
            onClick={() => setShowSettings(true)} 
            className={`p-2 sm:p-3 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-200'} rounded-xl sm:rounded-2xl border transition-all hover:scale-110 active:scale-95`}
          >
            <Settings size={20} sm:size={24} className={theme === 'dark' ? 'text-white' : 'text-slate-900'} />
          </button>
        </div>

        <AnimatePresence>
          {isPaused && (
            <motion.div key="paused-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4">
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-black italic tracking-tighter mb-6 sm:mb-8 text-white">PAUSED</h2>
              <div className="flex gap-3 sm:gap-4 flex-wrap justify-center">
                <button onClick={() => setIsPaused(false)} className="btn-primary px-8 sm:px-12 py-3 sm:py-4 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform text-sm sm:text-base">
                  Resume
                </button>
                <button onClick={() => setGameState('start')} className="px-6 sm:px-8 py-3 sm:py-4 bg-white/10 text-white font-black uppercase tracking-widest rounded-full hover:bg-white/20 transition-colors text-sm sm:text-base">
                  Quit
                </button>
              </div>
            </motion.div>
          )}

          {isInitialLoading && (
            <motion.div 
              key="initial-loading"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-[#f0f2f5]'} z-[200] flex flex-col items-center justify-center`}
            >
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <h1 className="text-6xl font-black italic tracking-tighter mb-4 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(236,72,153,0.3)]">
                  NEON POP
                </h1>
                <div className={`w-48 h-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-200'} rounded-full overflow-hidden mx-auto`}>
                  <motion.div 
                    className="h-full bg-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'start' && (
            <motion.div key="start-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/20'} backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4`}>
              <motion.div 
                initial={{ y: -30, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="text-center relative mb-6 sm:mb-8"
              >
                <div className={`absolute -inset-10 sm:-inset-20 ${theme === 'dark' ? 'bg-pink-500/10' : 'bg-pink-500/5'} blur-[60px] sm:blur-[100px] rounded-full animate-pulse`} />
                <h1 className="title-text text-4xl sm:text-6xl md:text-7xl lg:text-9xl font-black italic tracking-tighter mb-1 sm:mb-2 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(236,72,153,0.3)] relative">
                  NEON POP
                </h1>
                <p className={`tracking-[0.4em] sm:tracking-[0.6em] uppercase text-[8px] sm:text-xs font-black relative ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>The Ultimate Marble Popper</p>
              </motion.div>
              
              <div className="flex gap-4 sm:gap-8 mb-8 sm:mb-12 relative flex-wrap justify-center">
                <button onClick={() => startGame()} className={`group relative px-8 sm:px-16 md:px-20 py-4 sm:py-6 ${theme === 'dark' ? 'bg-white text-black shadow-[0_0_60px_rgba(255,255,255,0.3)]' : 'bg-slate-900 text-white shadow-[0_0_60px_rgba(0,0,0,0.2)]'} font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] rounded-full hover:scale-105 transition-all active:scale-95 text-sm sm:text-lg`}>
                  <span className="relative z-10 flex items-center gap-2 sm:gap-3"><Play size={20} sm:size={28} fill="currentColor" /> Play Now</span>
                  <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-white' : 'bg-slate-900'} blur-3xl opacity-0 group-hover:opacity-50 transition-opacity rounded-full`} />
                </button>
                <button onClick={() => setGameState('level-select')} className={`px-6 sm:px-10 md:px-12 py-4 sm:py-6 ${theme === 'dark' ? 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/30' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300'} font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] rounded-full border transition-all backdrop-blur-md text-sm sm:text-base`}>
                  Zones
                </button>
              </div>

              <div className="feature-cards grid grid-cols-3 gap-3 sm:gap-6 mb-8 sm:mb-12 max-w-2xl w-full px-4 sm:px-8">
                <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} text-center`}>
                  <div className="text-pink-500 mb-1 sm:mb-2 flex justify-center"><Zap size={14} sm:size={20} /></div>
                  <div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Match 3</div>
                  <div className={`text-[6px] sm:text-[8px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Clear chain</div>
                </div>
                <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} text-center`}>
                  <div className="text-blue-400 mb-1 sm:mb-2 flex justify-center"><Bomb size={14} sm:size={20} /></div>
                  <div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Power Up</div>
                  <div className={`text-[6px] sm:text-[8px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Special items</div>
                </div>
                <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} text-center`}>
                  <div className="text-yellow-400 mb-1 sm:mb-2 flex justify-center"><Trophy size={14} sm:size={20} /></div>
                  <div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Clear Zone</div>
                  <div className={`text-[6px] sm:text-[8px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Reach target</div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 sm:gap-6 relative">
                <span className={`text-[8px] sm:text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.4em] ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'} font-black`}>Achievements</span>
                <div className="achievement-icons flex gap-2 sm:gap-4">
                  {ACHIEVEMENTS.map(a => (
                    <motion.div 
                      key={a.id} 
                      whileHover={{ scale: 1.2, y: -5 }}
                      title={`${a.name}: ${a.description}`}
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-2xl border transition-all ${unlockedAchievements.includes(a.id) ? (theme === 'dark' ? 'bg-white/10 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.1)] grayscale-0' : 'bg-slate-100 border-slate-300 shadow-[0_0_20px_rgba(0,0,0,0.05)] grayscale-0') : (theme === 'dark' ? 'bg-black/40 border-white/5 grayscale opacity-20' : 'bg-slate-50 border-slate-100 grayscale opacity-30')}`}
                    >
                      {a.icon}
                    </motion.div>
                  ))}
                </div>
              </div>
              
              <div className={`absolute bottom-4 sm:bottom-12 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'} text-[8px] sm:text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.5em] font-black`}>
                High Score: {highScore.toLocaleString()} | Progress: {savedProgress.maxLevel}/{LEVELS.length}
              </div>
            </motion.div>
          )}

          {showSettings && (
            <motion.div 
              key="settings-overlay"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
            >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className={`modal-content w-full max-w-sm sm:max-w-md ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200'} rounded-xl sm:rounded-2xl lg:rounded-[2.5rem] border p-6 sm:p-8 md:p-10 shadow-3xl relative`}
                >
                  <button 
                    onClick={() => setShowSettings(false)}
                    className={`absolute top-4 right-4 sm:top-6 sm:right-6 p-2 ${theme === 'dark' ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-100 text-slate-400'} rounded-full transition-colors`}
                  >
                    <X size={20} sm:size={24} />
                  </button>

                  <h2 className={`text-2xl sm:text-3xl font-black tracking-tighter mb-6 sm:mb-8 italic uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Settings</h2>

                  <div className="space-y-6 sm:space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-black uppercase tracking-widest text-xs sm:text-sm mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Appearance</div>
                        <div className={`text-[10px] sm:text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Toggle Dark/Light mode</div>
                      </div>
                      <button 
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200'}`}
                      >
                        {theme === 'dark' ? <Moon size={16} sm:size={18} /> : <Sun size={16} sm:size={18} />}
                        <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-black uppercase tracking-widest text-xs sm:text-sm mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Audio</div>
                        <div className={`text-[10px] sm:text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Enable sound effects</div>
                      </div>
                      <button 
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border transition-all ${soundEnabled ? (theme === 'dark' ? 'bg-pink-500/20 border-pink-500/30 text-pink-500' : 'bg-pink-500/10 border-pink-500/20 text-pink-500') : (theme === 'dark' ? 'bg-white/5 border-white/10 text-white/40' : 'bg-slate-100 border-slate-200 text-slate-400')}`}
                      >
                        {soundEnabled ? <Volume2 size={16} sm:size={18} /> : <VolumeX size={16} sm:size={18} />}
                        <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">{soundEnabled ? 'On' : 'Off'}</span>
                      </button>
                    </div>

                    <div className="space-y-2 sm:space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-black uppercase tracking-widest text-xs sm:text-sm mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Game Speed</div>
                          <div className={`text-[10px] sm:text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Adjust pace</div>
                        </div>
                        <span className={`text-xs font-black ${theme === 'dark' ? 'text-pink-500' : 'text-pink-600'}`}>{gameSpeed.toFixed(1)}x</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2.0" 
                        step="0.1" 
                        value={gameSpeed} 
                        onChange={(e) => setGameSpeed(parseFloat(e.target.value))}
                        className="w-full h-2 bg-pink-500/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                      />
                    </div>

                    <div className="space-y-2 sm:space-y-4 pt-2 sm:pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-black uppercase tracking-widest text-xs sm:text-sm mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Magnetic Pull Strength</div>
                          <div className={`text-[10px] sm:text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Force of magnetic obstacles</div>
                        </div>
                        <span className={`text-xs font-black ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{(magneticSettings.strength * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.2" 
                        max="3.0" 
                        step="0.1" 
                        value={magneticSettings.strength} 
                        onChange={(e) => setMagneticSettings(prev => ({ ...prev, strength: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>

                    <div className="space-y-2 sm:space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-black uppercase tracking-widest text-xs sm:text-sm mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Magnetic Pull Radius</div>
                          <div className={`text-[10px] sm:text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Range of magnetic pull</div>
                        </div>
                        <span className={`text-xs font-black ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{(magneticSettings.radius * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2.0" 
                        step="0.1" 
                        value={magneticSettings.radius} 
                        onChange={(e) => setMagneticSettings(prev => ({ ...prev, radius: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>

                    <div className="pt-2 sm:pt-4">
                      <button 
                        onClick={() => setShowSettings(false)}
                        className={`w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-xs sm:text-sm transition-all ${theme === 'dark' ? 'bg-white text-black hover:scale-[1.02]' : 'bg-slate-900 text-white hover:scale-[1.02]'}`}
                      >
                        Done
                      </button>
                    </div>

                    {gameState === 'playing' && (
                      <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 border-t border-white/10">
                        <div className={`font-black uppercase tracking-widest text-xs sm:text-sm mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Game Controls</div>
                        <div className="flex gap-2 sm:gap-3">
                          <button 
                            onClick={() => {
                              setIsPaused(true);
                              setShowSettings(false);
                            }}
                            disabled={isPaused}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${isPaused ? (theme === 'dark' ? 'bg-white/5 border-white/10 text-white/30' : 'bg-slate-100 border-slate-200 text-slate-300') : (theme === 'dark' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/30' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 hover:bg-yellow-500/20')}`}
                          >
                            <Pause size={14} sm:size={16} />
                            <span className="hidden sm:inline">Pause</span>
                          </button>
                          <button 
                            onClick={() => {
                              setIsPaused(false);
                              setShowSettings(false);
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${isPaused ? (theme === 'dark' ? 'bg-green-500/20 border-green-500/30 text-green-500 hover:bg-green-500/30' : 'bg-green-500/10 border-green-500/20 text-green-600 hover:bg-green-500/20') : (theme === 'dark' ? 'bg-white/5 border-white/10 text-white/30' : 'bg-slate-100 border-slate-200 text-slate-300')}`}
                            disabled={!isPaused}
                          >
                            <Play size={14} sm:size={16} />
                            <span className="hidden sm:inline">Resume</span>
                          </button>
                          <button 
                            onClick={() => {
                              setGameState('start');
                              setShowSettings(false);
                              setIsPaused(false);
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${theme === 'dark' ? 'bg-red-500/20 border-red-500/30 text-red-500 hover:bg-red-500/30' : 'bg-red-500/10 border-red-500/20 text-red-600 hover:bg-red-500/20'}`}
                          >
                            <Home size={14} sm:size={16} />
                            <span className="hidden sm:inline">Home</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}

          {achievementNotify && (
              <motion.div 
                key={`achievement-${achievementNotify.id}`}
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className={`absolute bottom-24 left-1/2 -translate-x-1/2 z-[100] ${theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white'} px-8 py-5 rounded-3xl shadow-3xl flex items-center gap-5 pointer-events-none border ${theme === 'dark' ? 'border-white/20' : 'border-slate-700'}`}
              >
                <div className="text-4xl drop-shadow-lg">{achievementNotify.icon}</div>
                <div>
                  <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-black/40' : 'text-white/40'}`}>Achievement Unlocked</div>
                  <div className="text-xl font-black tracking-tighter uppercase italic">{achievementNotify.name}</div>
                </div>
              </motion.div>
            )}

          {gameState === 'level-select' && (
            <motion.div key="level-select-screen" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/90' : 'bg-white/95'} backdrop-blur-md flex flex-col items-center justify-center z-20 p-4 sm:p-8 md:p-12`}>
              <h2 className={`text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter mb-4 sm:mb-6 md:mb-8 uppercase italic ${theme === 'dark' ? 'bg-gradient-to-r from-white to-white/40' : 'bg-gradient-to-r from-slate-900 to-slate-500'} bg-clip-text text-transparent`}>Select Zone</h2>
              
              <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg">
                <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4 max-h-[150px] sm:max-h-[220px] md:max-h-[280px] overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 pr-6 sm:pr-8 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} rounded-xl sm:rounded-2xl md:rounded-[2.5rem] border shadow-xl scrollbar-visible`}>
                  {LEVELS.map((l) => {
                    const isUnlocked = l.id <= savedProgress.maxLevel;
                    return (
                      <button 
                        key={l.id} 
                        onClick={() => isUnlocked && startGame(l.id)}
                        disabled={!isUnlocked}
                        className={`group relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all shadow-lg ${
                          isUnlocked 
                            ? `${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} hover:bg-pink-500 hover:border-pink-500 hover:scale-110 active:scale-95 cursor-pointer` 
                            : `${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-100'} cursor-not-allowed opacity-50`
                        }`}
                      >
                        <span className={`text-[6px] sm:text-[8px] ${isUnlocked ? (theme === 'dark' ? 'text-white/40' : 'text-slate-400') : 'text-white/20'} group-hover:text-white/60 font-black uppercase tracking-tighter`}>Zone</span>
                        <span className={`text-base sm:text-xl md:text-2xl font-black ${isUnlocked ? (theme === 'dark' ? 'text-white' : 'text-slate-900') : 'text-white/30'}`}>{l.id}</span>
                        {l.id === savedProgress.maxLevel && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                        )}
                        <div className={`absolute inset-0 ${isUnlocked ? 'bg-pink-500 blur-xl opacity-0 group-hover:opacity-20 transition-opacity' : ''} rounded-xl sm:rounded-2xl`} />
                        {!isUnlocked && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Lock size={12} className="text-white/30" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className={`mt-4 sm:mt-6 text-center ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>
                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
                  Unlocked: {savedProgress.maxLevel} / {LEVELS.length}
                </span>
              </div>
              
              <button onClick={() => setGameState('start')} className={`mt-4 sm:mt-6 px-6 sm:px-8 md:px-10 py-2 sm:py-3 md:py-4 ${theme === 'dark' ? 'bg-white/5 text-white/40 border-white/5 hover:text-white hover:border-white/20' : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-900 hover:border-slate-300'} uppercase text-[8px] sm:text-[10px] font-black tracking-[0.2em] sm:tracking-[0.4em] rounded-full border transition-all`}>
                Return to Menu
              </button>
            </motion.div>
          )}

          {showIntro && (
            <motion.div key="intro-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/90' : 'bg-white/95'} backdrop-blur-2xl flex flex-col items-center justify-center z-[60] p-4`}>
              <AnimatePresence mode="wait">
                {introStep === 0 && (
                  <motion.div key="step-0" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }} className="text-center">
                    <span className="text-pink-500 font-black text-xs sm:text-sm uppercase tracking-[0.3em] sm:tracking-[0.5em] block mb-2 sm:mb-4">Entering Zone {level}</span>
                    <h2 className={`text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'} uppercase drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]`}>{levelConfig.name}</h2>
                  </motion.div>
                )}
                {introStep === 1 && (
                  <motion.div key="step-1" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="text-center max-w-xs sm:max-w-md">
                    <div className={`${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} p-6 sm:p-8 md:p-12 rounded-xl sm:rounded-2xl md:rounded-[3rem] border backdrop-blur-xl shadow-2xl`}>
                      <h3 className="text-yellow-400 font-black text-lg sm:text-xl md:text-2xl italic tracking-tighter mb-2 sm:mb-4 uppercase">Mission Objective</h3>
                      <p className={`font-black tracking-tight text-lg sm:text-2xl md:text-3xl leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{levelConfig.challenge.description}</p>
                    </div>
                  </motion.div>
                )}
                {introStep === 2 && (
                  <motion.div key="step-2" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="text-center">
                    <h2 className={`text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'} uppercase animate-pulse`}>GO!</h2>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {gameState === 'level-complete' && (
            <motion.div key="complete-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/90' : 'bg-white/95'} backdrop-blur-xl flex flex-col items-center justify-center z-40 p-4 sm:p-8 md:p-12`}>
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-6 sm:mb-8 md:mb-12">
                <div className="w-16 h-16 sm:w-20 md:w-24 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_50px_rgba(250,204,21,0.5)]">
                  <Trophy size={24} sm:size={32} md:size={48} className="text-black" />
                </div>
                <h2 className={`text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter italic uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'} mb-1 sm:mb-2`}>Zone Clear!</h2>
                <p className="text-yellow-400 font-black tracking-[0.3em] sm:tracking-[0.5em] uppercase text-[8px] sm:text-xs">Mission Accomplished</p>
              </motion.div>

              <div className={`grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8 md:mb-12 w-full max-w-xs sm:max-w-sm md:max-w-md ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} p-4 sm:p-6 md:p-10 rounded-xl sm:rounded-2xl md:rounded-[3rem] border shadow-xl`}>
                <div className="text-center">
                  <span className={`text-[8px] sm:text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-black block mb-1`}>Score</span>
                  <span className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{score.toLocaleString()}</span>
                </div>
                <div className="text-center">
                  <span className={`text-[8px] sm:text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-black block mb-1`}>Matches</span>
                  <span className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.totalMatches}</span>
                </div>
              </div>

              {winStreak > 0 && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }}
                  className={`mb-6 sm:mb-8 md:mb-12 p-3 sm:p-4 md:p-6 ${theme === 'dark' ? 'bg-yellow-400/10 border-yellow-400/20' : 'bg-yellow-400/5 border-yellow-400/20'} rounded-xl sm:rounded-2xl md:rounded-3xl border text-center`}
                >
                  <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-yellow-400 font-black block mb-1">Win Streak Bonus</span>
                  <span className={`text-xl sm:text-2xl md:text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>+{ (winStreak * 500).toLocaleString() }</span>
                  <p className={`text-[8px] sm:text-[10px] ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} mt-1 uppercase tracking-widest font-bold`}>{winStreak} Consecutive Zones</p>
                </motion.div>
              )}

              <button onClick={nextLevel} className={`group relative px-8 sm:px-12 md:px-16 py-3 sm:py-4 md:py-6 ${theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white'} font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] md:tracking-[0.3em] rounded-full hover:scale-105 transition-all active:scale-95 shadow-2xl text-sm sm:text-base md:text-lg`}>
                <span className="relative z-10 flex items-center gap-2 sm:gap-3"><ChevronRight size={16} sm:size={20} md:size={24} /> Next Zone</span>
                <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-white' : 'bg-slate-900'} blur-2xl opacity-0 group-hover:opacity-40 transition-opacity rounded-full`} />
              </button>
            </motion.div>
          )}

          {isTransitioning && (
            <motion.div 
              key="transition-overlay"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className={`absolute inset-0 ${theme === 'dark' ? 'bg-black' : 'bg-white'} z-[100] flex items-center justify-center`}
            >
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className={`${theme === 'dark' ? 'text-white' : 'text-slate-900'} font-black tracking-[1em] uppercase text-xl italic`}
              >
                Loading Zone {level + 1}...
              </motion.div>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div key="gameover-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/90' : 'bg-white/95'} backdrop-blur-xl flex flex-col items-center justify-center z-40 p-12`}>
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-12">
                <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(239,68,68,0.5)]">
                  <Skull size={48} className="text-white" />
                </div>
                <h2 className={`text-6xl font-black tracking-tighter italic uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'} mb-2`}>Zone Failed</h2>
                <p className="text-red-500 font-black tracking-[0.5em] uppercase text-xs">Game Over</p>
              </motion.div>

              <div className={`grid grid-cols-3 gap-6 mb-12 w-full max-w-md ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} p-8 rounded-[3rem] border shadow-xl`}>
                <div className="text-center">
                  <span className={`text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-black block mb-1`}>Matches</span>
                  <span className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.totalMatches}</span>
                </div>
                <div className="text-center">
                  <span className={`text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-black block mb-1`}>Combo</span>
                  <span className="text-2xl font-black text-yellow-400">{stats.maxCombo}x</span>
                </div>
                <div className="text-center">
                  <span className={`text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-black block mb-1`}>Power-ups</span>
                  <span className="text-2xl font-black text-blue-400">{stats.powerUpsUsed}</span>
                </div>
              </div>

              <div className={`flex flex-col items-center gap-2 mb-12 w-full max-w-md ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} p-10 rounded-[3rem] border shadow-xl`}>
                <span className={`text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-black`}>Final Score</span>
                <span className={`text-5xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'} tabular-nums`}>{score.toLocaleString()}</span>
                {score > highScore && (
                  <span className="text-xs font-black text-yellow-400 uppercase tracking-widest flex items-center gap-2 mt-2">
                    <Trophy size={16} /> New High Score!
                  </span>
                )}
              </div>

              <button onClick={() => startGame()} className={`group relative px-16 py-6 ${theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white'} font-black uppercase tracking-[0.3em] rounded-full hover:scale-105 transition-all active:scale-95 shadow-2xl`}>
                Try Again
                <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-white' : 'bg-slate-900'} blur-2xl opacity-0 group-hover:opacity-40 transition-opacity rounded-full`} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="hud-bottom-right absolute bottom-2 sm:bottom-4 md:bottom-6 lg:bottom-8 right-2 sm:right-4 md:right-6 lg:right-8 flex gap-2 sm:gap-4 pointer-events-auto">
          {gamepadActive && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className={`flex items-center gap-1 sm:gap-2 ${theme === 'dark' ? 'bg-green-500/10 border-green-500/20' : 'bg-green-500/5 border-green-500/10'} px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border text-green-500`}
            >
              <Gamepad2 size={14} sm:size={16} /> <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] hidden sm:inline">Controller</span>
            </motion.div>
          )}
        </div>

        <div className="hud-bottom-left absolute bottom-2 sm:bottom-4 md:bottom-6 lg:bottom-8 left-2 sm:left-4 md:left-6 lg:left-8 flex gap-2 sm:gap-3 pointer-events-auto">
          <div className="group relative">
            <div className={`flex items-center gap-1 sm:gap-2 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border cursor-help transition-all hover:scale-105`}>
              <Bomb size={12} sm:size={16} className="text-pink-500" /> <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>Bomb</span>
            </div>
            <div className={`absolute bottom-full left-0 mb-2 sm:mb-3 w-44 sm:w-56 p-3 sm:p-4 ${theme === 'dark' ? 'bg-zinc-900 border-white/10 text-white/80' : 'bg-white border-slate-200 text-slate-600'} border rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none text-[8px] sm:text-[10px] leading-relaxed z-50 shadow-xl`}>
              <strong className="text-pink-500 block mb-1 uppercase tracking-widest font-black">Bomb</strong>
              Explodes on match, clearing nearby marbles and destroying static obstacles.
            </div>
          </div>
          <div className="group relative">
            <div className={`flex items-center gap-1 sm:gap-2 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border cursor-help transition-all hover:scale-105`}>
              <Zap size={12} sm:size={16} className="text-yellow-400" /> <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>Lightning</span>
            </div>
            <div className={`absolute bottom-full left-0 mb-2 sm:mb-3 w-44 sm:w-56 p-3 sm:p-4 ${theme === 'dark' ? 'bg-zinc-900 border-white/10 text-white/80' : 'bg-white border-slate-200 text-slate-600'} border rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none text-[8px] sm:text-[10px] leading-relaxed z-50 shadow-xl`}>
              <strong className="text-yellow-400 block mb-1 uppercase tracking-widest font-black">Lightning</strong>
              Instantly removes all marbles of the same color from the entire chain.
            </div>
          </div>
          <div className="group relative">
            <div className={`flex items-center gap-1 sm:gap-2 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border cursor-help transition-all hover:scale-105`}>
              <Clock size={12} sm:size={16} className="text-blue-400" /> <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>Slow-Mo</span>
            </div>
            <div className={`absolute bottom-full left-0 mb-2 sm:mb-3 w-44 sm:w-56 p-3 sm:p-4 ${theme === 'dark' ? 'bg-zinc-900 border-white/10 text-white/80' : 'bg-white border-slate-200 text-slate-600'} border rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none text-[8px] sm:text-[10px] leading-relaxed z-50 shadow-xl`}>
              <strong className="text-blue-400 block mb-1 uppercase tracking-widest font-black">Slow Motion</strong>
              Temporarily slows down the movement of the entire chain for 5 seconds.
            </div>
          </div>
          <div className="group relative hidden sm:block">
            <div className={`flex items-center gap-2 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} px-4 py-2 rounded-xl border cursor-help transition-all hover:scale-105`}>
              <Shield size={16} className="text-red-500" /> <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>Obstacle</span>
            </div>
            <div className={`absolute bottom-full left-0 mb-3 w-56 p-4 ${theme === 'dark' ? 'bg-zinc-900 border-white/10 text-white/80' : 'bg-white border-slate-200 text-slate-600'} border rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none text-[10px] leading-relaxed z-50 shadow-xl`}>
              <strong className="text-red-500 block mb-1 uppercase tracking-widest font-black">Shield</strong>
              Blocks shots. Static ones can be bombed; rotating ones push marbles away.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
