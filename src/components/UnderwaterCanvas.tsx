import React, { useEffect, useRef, useState } from 'react';
import { AppStep, Particle } from '../types';

interface UnderwaterCanvasProps {
  step: AppStep;
  progress: number; // 0 to 1 in STILLNESS step
  thoughtTriggerCount: number;
  reducedMotion: boolean;
  onDepthChange?: (depthMeters: number) => void;
}

export const UnderwaterCanvas: React.FC<UnderwaterCanvasProps> = ({
  step,
  progress,
  thoughtTriggerCount,
  reducedMotion,
  onDepthChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Background documentary image references
  const surfaceImgRef = useRef<HTMLImageElement | null>(null);
  const abyssImgRef = useRef<HTMLImageElement | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState<boolean>(false);

  // Animation references
  const animFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const thoughtParticlesRef = useRef<Particle[]>([]);
  const lastTimeRef = useRef<number>(performance.now());
  const currentDepthRef = useRef<number>(15);
  const targetDepthRef = useRef<number>(15);
  const prevTriggerRef = useRef<number>(thoughtTriggerCount);
  const onDepthChangeRef = useRef(onDepthChange);
  onDepthChangeRef.current = onDepthChange;

  // Preload documentary underwater still photos
  useEffect(() => {
    let loadedCount = 0;
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= 2) {
        setImagesLoaded(true);
      }
    };

    const imgSurface = new Image();
    imgSurface.src = '/images/underwater_surface.jpg';
    imgSurface.onload = checkAllLoaded;
    imgSurface.onerror = checkAllLoaded;
    surfaceImgRef.current = imgSurface;

    const imgAbyss = new Image();
    imgAbyss.src = '/images/underwater_abyss.jpg';
    imgAbyss.onload = checkAllLoaded;
    imgAbyss.onerror = checkAllLoaded;
    abyssImgRef.current = imgAbyss;
  }, []);

  // Initialize very few (only 18), extremely subtle, natural organic marine motes
  // In real underwater documentary footage, particles are barely visible, never the main focus
  useEffect(() => {
    const motes: Particle[] = [];
    const count = 18;
    for (let i = 0; i < count; i++) {
      const z = Math.random() * 0.7 + 0.3;
      motes.push({
        x: Math.random(),
        y: Math.random(),
        z,
        size: (Math.random() * 1.5 + 0.6) * z,
        vx: (Math.random() - 0.5) * 0.000015,
        vy: (Math.random() * 0.000015 + 0.000008),
        alpha: (Math.random() * 0.12 + 0.04) * z, // extremely faint (0.04 - 0.12)
        maxAlpha: (Math.random() * 0.14 + 0.06) * z,
        pulseSpeed: Math.random() * 0.0008 + 0.0003,
        pulseOffset: Math.random() * Math.PI * 2,
        colorType: 'ambient',
      });
    }
    particlesRef.current = motes;
  }, []);

  // Thought dispersion: soft pale motes that gently dissolve into the sea
  useEffect(() => {
    if (thoughtTriggerCount > 0 && thoughtTriggerCount !== prevTriggerRef.current) {
      prevTriggerRef.current = thoughtTriggerCount;

      const newParticles: Particle[] = [];
      const count = 65;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.00025 + 0.00008;
        const z = Math.random() * 0.5 + 0.5;
        newParticles.push({
          x: 0.5 + (Math.random() - 0.5) * 0.16,
          y: 0.46 + (Math.random() - 0.5) * 0.1,
          z,
          size: (Math.random() * 2.2 + 0.8) * z,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.00006, // subtle upward buoyancy
          alpha: 0.65,
          maxAlpha: 0.75,
          pulseSpeed: Math.random() * 0.0015 + 0.0005,
          pulseOffset: Math.random() * Math.PI * 2,
          colorType: 'thought',
          life: 0,
          maxLife: 4200 + Math.random() * 1800,
        });
      }
      thoughtParticlesRef.current = newParticles;
    }
  }, [thoughtTriggerCount]);

  // Main rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = (time: number) => {
      const dt = Math.min(time - lastTimeRef.current, 100);
      lastTimeRef.current = time;

      // 1. Calculate target realistic depth in meters
      if (step === 'SURFACE') {
        targetDepthRef.current = 15;
      } else if (step === 'DESCENT') {
        targetDepthRef.current = 150;
      } else if (step === 'STILLNESS') {
        targetDepthRef.current = 150 + progress * 1050; // up to 1,200m
      } else if (step === 'COMPLETED') {
        targetDepthRef.current = 1200;
      }

      // Smooth depth approach (gentle inertia)
      const depthSpeed = step === 'DESCENT' ? 0.0015 : 0.0007;
      currentDepthRef.current += (targetDepthRef.current - currentDepthRef.current) * Math.min(1, depthSpeed * dt);
      const currentDepth = currentDepthRef.current;

      if (onDepthChangeRef.current) {
        onDepthChangeRef.current(Math.round(currentDepth));
      }

      const motionMultiplier = reducedMotion ? 0.2 : 1.0;

      // Depth ratios:
      // surfaceT: 0 at 15m, 1 at 350m (when sunlight completely disappears)
      const surfaceFade = Math.max(0, Math.min(1, (currentDepth - 15) / 320));
      // abyssT: 0 until 180m, rises to 1 by 900m
      const abyssFade = Math.max(0, Math.min(1, (currentDepth - 150) / 750));

      // 2. Draw Natural Base Background
      // Base natural ocean color: deep muted navy #030d1a to dark midnight #010408
      ctx.fillStyle = '#01050c';
      ctx.fillRect(0, 0, width, height);

      // Render actual documentary photo layers
      const drawCoverImage = (img: HTMLImageElement, alpha: number, offsetYRatio: number) => {
        if (!img.complete || img.naturalWidth === 0 || alpha <= 0.001) return;

        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = width / height;
        let renderW = width;
        let renderH = height;
        let offsetX = 0;
        let offsetY = 0;

        if (canvasRatio > imgRatio) {
          renderW = width * 1.05;
          renderH = renderW / imgRatio;
          offsetX = (width - renderW) * 0.5;
          offsetY = (height - renderH) * 0.5 + offsetYRatio * height * 0.15;
        } else {
          renderH = height * 1.05;
          renderW = renderH * imgRatio;
          offsetX = (width - renderW) * 0.5;
          offsetY = (height - renderH) * 0.5 + offsetYRatio * height * 0.15;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
        ctx.restore();
      };

      // As we descend, the surface image moves slightly upward and fades out
      if (surfaceImgRef.current && surfaceFade < 1.0) {
        // Very slow, subtle camera breath: 24s period
        const breathY = Math.sin(time * 0.00025 * motionMultiplier) * 0.012;
        const sinkOffsetY = -surfaceFade * 0.22 + breathY;
        const surfaceAlpha = Math.pow(1 - surfaceFade, 1.4);
        drawCoverImage(surfaceImgRef.current, surfaceAlpha, sinkOffsetY);
      }

      // As we sink past 150m, the deep abyss image blends in naturally
      if (abyssImgRef.current && abyssFade > 0.01) {
        const abyssAlpha = Math.min(0.92, abyssFade * 0.92);
        drawCoverImage(abyssImgRef.current, abyssAlpha, 0);
      }

      // 3. Subtle Natural Water Movement (Organic Refraction)
      // Natural water is never static, but movements are gentle and non-repetitive
      // We apply an ultra-gentle, non-intrusive ambient light waver (opacity ~ 0.04 to 0.08)
      if (surfaceFade < 0.7) {
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';

        const waverTime = time * 0.0003 * motionMultiplier;
        const shimmerAlpha = (1 - surfaceFade / 0.7) * 0.12;

        const shimmerGrad = ctx.createLinearGradient(
          width * (0.5 + Math.sin(waverTime) * 0.08),
          0,
          width * (0.5 + Math.cos(waverTime * 0.8) * 0.08),
          height * 0.75
        );
        shimmerGrad.addColorStop(0, `rgba(180, 215, 240, ${shimmerAlpha * 1.4})`);
        shimmerGrad.addColorStop(0.4, `rgba(100, 160, 210, ${shimmerAlpha * 0.7})`);
        shimmerGrad.addColorStop(1, 'rgba(10, 30, 60, 0)');

        ctx.fillStyle = shimmerGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      // 4. Natural Darkening Overlay for Text Legibility & Eye Comfort
      // Smooth vignette: ensures typography is always effortlessly readable
      const vignetteGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.25,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8
      );
      const darkFactor = 0.35 + (currentDepth / 1200) * 0.55;
      vignetteGrad.addColorStop(0, `rgba(1, 5, 12, ${darkFactor * 0.5})`);
      vignetteGrad.addColorStop(1, `rgba(1, 4, 10, ${darkFactor * 0.95})`);
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, width, height);

      // 5. Barely Noticeable Natural Organic Marine Motes (Extremely subdued)
      ctx.save();
      const isSinking = step === 'DESCENT' || step === 'STILLNESS';
      const sinkSpeed = isSinking ? 0.00008 * (step === 'DESCENT' ? 1.6 : 1.0) : 0.00001;

      for (const p of particlesRef.current) {
        const sway = Math.sin(time * 0.0002 + p.pulseOffset) * 0.000015;
        p.x += (p.vx + sway) * motionMultiplier * dt;
        p.y += (p.vy - sinkSpeed * p.z) * motionMultiplier * dt;

        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        } else if (p.y > 1.05) {
          p.y = -0.05;
          p.x = Math.random();
        }
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;

        // Dim, natural muted grayish-blue mote, barely visible (no neon, no glowing dots)
        const alpha = p.alpha * (1 - surfaceFade * 0.5);
        ctx.fillStyle = `rgba(160, 195, 220, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 6. Thought Particles (Gentle Dissolution into the deep)
      if (thoughtParticlesRef.current.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        const remaining: Particle[] = [];
        for (const p of thoughtParticlesRef.current) {
          p.life = (p.life || 0) + dt;
          const ratio = p.life / (p.maxLife || 4500);

          if (ratio < 1.0) {
            p.vx *= 0.994;
            p.vy *= 0.994;
            p.x += p.vx * motionMultiplier * dt;
            p.y += (p.vy - sinkSpeed * 0.5) * motionMultiplier * dt;

            let alphaVal = 1.0;
            if (ratio < 0.15) {
              alphaVal = ratio / 0.15;
            } else {
              alphaVal = Math.pow(1 - (ratio - 0.15) / 0.85, 1.8);
            }

            const currentAlpha = p.alpha * alphaVal * 0.6; // soft and gentle
            const px = p.x * width;
            const py = p.y * height;

            // Soft pale warm-white/blue mote (no harsh cyan neon)
            const radGrad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.2);
            radGrad.addColorStop(0, `rgba(225, 240, 255, ${currentAlpha})`);
            radGrad.addColorStop(0.4, `rgba(140, 185, 225, ${currentAlpha * 0.5})`);
            radGrad.addColorStop(1, 'rgba(20, 60, 110, 0)');

            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(px, py, p.size * 2.2, 0, Math.PI * 2);
            ctx.fill();

            remaining.push(p);
          }
        }
        thoughtParticlesRef.current = remaining;
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [step, progress, reducedMotion, imagesLoaded]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};
