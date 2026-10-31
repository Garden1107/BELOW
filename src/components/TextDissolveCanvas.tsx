import React, { useEffect, useRef } from 'react';

interface TextDissolveCanvasProps {
  isActive: boolean;
  text: string;
  onComplete?: () => void;
}

interface TextParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: string;
  wobbleSpeed: number;
  wobbleOffset: number;
}

export const TextDissolveCanvas: React.FC<TextDissolveCanvasProps> = ({
  isActive,
  text,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Spawn 320 crisp, sparkling aquatic starlight particles
    // Clear, distinct cores with a soft luminous aura (no muddy blurry fog!)
    const particles: TextParticle[] = [];
    const count = Math.min(360, Math.max(220, text.length * 6));
    const centerX = width / 2;
    const centerY = height * 0.46; // Center of the thought card

    // Crisp crystal aquatic tones with elegant luminous clarity
    const colors = [
      'rgba(240, 250, 255,', // Pure crystal droplet
      'rgba(205, 235, 255,', // Clear celestial sea ice
      'rgba(185, 225, 255,', // Subtle luminous azure
      'rgba(225, 245, 255,', // Soft moonlit water pearl
    ];

    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * Math.min(460, width * 0.76);
      const ry = (Math.random() - 0.5) * 120;

      // Radial burst outwards with crisp speed
      const angle = Math.atan2(ry, rx) + (Math.random() - 0.5) * 0.85;
      const speed = Math.random() * 2.4 + 0.8;

      particles.push({
        x: centerX + rx,
        y: centerY + ry,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 0.5 + 0.25), // gentle upward buoyancy
        size: Math.random() * 1.8 + 1.2, // Crisp, clearly defined particle size
        alpha: Math.random() * 0.2 + 0.75, // Clear, distinct visibility (0.75 ~ 0.95)
        maxLife: Math.random() * 65 + 90,
        life: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        wobbleSpeed: Math.random() * 0.06 + 0.025,
        wobbleOffset: Math.random() * Math.PI * 2,
      });
    }

    let frameCount = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      let aliveCount = 0;
      frameCount++;

      for (const p of particles) {
        if (p.life < p.maxLife) {
          aliveCount++;
          p.life++;

          // Natural water drag slows particles smoothly
          p.vx *= 0.976;
          p.vy *= 0.976;

          // Gentle fluid swirl
          const wobble = Math.sin(frameCount * p.wobbleSpeed + p.wobbleOffset) * 0.35;
          p.x += p.vx + wobble;
          p.y += p.vy - 0.22; // Peaceful upward floating

          // Smooth fade out towards the end
          const progress = p.life / p.maxLife;
          const currentAlpha = p.alpha * Math.pow(1 - progress, 1.4);

          ctx.save();
          // 1. Soft, clean luminous glow halo
          ctx.shadowColor = `rgba(165, 215, 255, ${currentAlpha * 0.55})`;
          ctx.shadowBlur = 7;
          ctx.fillStyle = `${p.color} ${currentAlpha * 0.85})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          // 2. Crisp, sparkling inner core (gives sharp, distinct clarity to the eye)
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha * 0.95})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (aliveCount > 0) {
        animRef.current = requestAnimationFrame(render);
      } else {
        if (onComplete) onComplete();
      }
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isActive, text, onComplete]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-30 pointer-events-none"
      aria-hidden="true"
    />
  );
};
