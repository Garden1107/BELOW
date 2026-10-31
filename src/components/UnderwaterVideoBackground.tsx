import React, { useRef, useState, useEffect } from 'react';
import { AppStep, Particle } from '../types';

interface UnderwaterVideoBackgroundProps {
  step: AppStep;
  progress: number; // 0 to 1 during STILLNESS step
  thoughtTriggerCount: number;
  reducedMotion: boolean;
  onDepthChange?: (depthMeters: number) => void;
}

export const UnderwaterVideoBackground: React.FC<UnderwaterVideoBackgroundProps> = ({
  step,
  progress,
  thoughtTriggerCount,
  reducedMotion,
  onDepthChange,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<boolean>(false);

  // Depth simulation
  const currentDepthRef = useRef<number>(15);
  const targetDepthRef = useRef<number>(15);
  const onDepthChangeRef = useRef(onDepthChange);
  onDepthChangeRef.current = onDepthChange;

  // Particle tracking
  const particlesRef = useRef<Particle[]>([]);
  const thoughtParticlesRef = useRef<Particle[]>([]);
  const prevTriggerRef = useRef<number>(thoughtTriggerCount);
  const lastTimeRef = useRef<number>(performance.now());
  const animFrameRef = useRef<number | null>(null);

  // Attempt to play video on mount (muted, loop, playsinline)
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.play().then(() => {
        setVideoLoaded(true);
      }).catch((err) => {
        console.warn('Video autoPlay was deferred or blocked:', err);
        // Retry on user interaction
        const handleUserGesture = () => {
          video.play().then(() => setVideoLoaded(true)).catch(() => {});
          window.removeEventListener('click', handleUserGesture);
          window.removeEventListener('touchstart', handleUserGesture);
        };
        window.addEventListener('click', handleUserGesture);
        window.addEventListener('touchstart', handleUserGesture);
      });
    }
  }, []);

  // Initialize a very small number (only 12) of faint, natural organic motes
  useEffect(() => {
    const motes: Particle[] = [];
    for (let i = 0; i < 12; i++) {
      const z = Math.random() * 0.7 + 0.3;
      motes.push({
        x: Math.random(),
        y: Math.random(),
        z,
        size: (Math.random() * 1.6 + 0.6) * z,
        vx: (Math.random() - 0.5) * 0.000015,
        vy: Math.random() * 0.000015 + 0.000008,
        alpha: (Math.random() * 0.12 + 0.04) * z,
        maxAlpha: (Math.random() * 0.14 + 0.06) * z,
        pulseSpeed: Math.random() * 0.0008 + 0.0003,
        pulseOffset: Math.random() * Math.PI * 2,
        colorType: 'ambient',
      });
    }
    particlesRef.current = motes;
  }, []);

  // Spawn gentle thought-light particles on release
  useEffect(() => {
    if (thoughtTriggerCount > 0 && thoughtTriggerCount !== prevTriggerRef.current) {
      prevTriggerRef.current = thoughtTriggerCount;

      const newParticles: Particle[] = [];
      const count = 55;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.00022 + 0.00006;
        const z = Math.random() * 0.5 + 0.5;
        newParticles.push({
          x: 0.5 + (Math.random() - 0.5) * 0.16,
          y: 0.46 + (Math.random() - 0.5) * 0.1,
          z,
          size: (Math.random() * 2.4 + 0.8) * z,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.00005,
          alpha: 0.7,
          maxAlpha: 0.8,
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

  // Main canvas loop for particles & depth physics
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

      // Depth targets
      if (step === 'SURFACE') {
        targetDepthRef.current = 15;
      } else if (step === 'DESCENT') {
        targetDepthRef.current = 140;
      } else if (step === 'STILLNESS') {
        targetDepthRef.current = 140 + progress * 960; // down to 1,100m
      } else if (step === 'COMPLETED') {
        targetDepthRef.current = 1100;
      }

      const depthSpeed = step === 'DESCENT' ? 0.0016 : 0.0008;
      currentDepthRef.current +=
        (targetDepthRef.current - currentDepthRef.current) * Math.min(1, depthSpeed * dt);
      const currentDepth = currentDepthRef.current;

      if (onDepthChangeRef.current) {
        onDepthChangeRef.current(Math.round(currentDepth));
      }

      const motionMultiplier = reducedMotion ? 0.2 : 1.0;
      ctx.clearRect(0, 0, width, height);

      // 1. Ambient Marine Motes
      const isSinking = step === 'DESCENT' || step === 'STILLNESS';
      const sinkSpeed = isSinking ? 0.00007 * (step === 'DESCENT' ? 1.5 : 1.0) : 0.00001;

      ctx.save();
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

        const depthFade = Math.max(0.2, 1 - (currentDepth / 1100) * 0.6);
        const alpha = p.alpha * depthFade;

        ctx.fillStyle = `rgba(180, 210, 235, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. Thought Dissolution Particles
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
            p.y += (p.vy - sinkSpeed * 0.4) * motionMultiplier * dt;

            let alphaVal = 1.0;
            if (ratio < 0.15) {
              alphaVal = ratio / 0.15;
            } else {
              alphaVal = Math.pow(1 - (ratio - 0.15) / 0.85, 1.8);
            }

            const currentAlpha = p.alpha * alphaVal * 0.65;
            const px = p.x * width;
            const py = p.y * height;

            const radGrad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.2);
            radGrad.addColorStop(0, `rgba(235, 245, 255, ${currentAlpha})`);
            radGrad.addColorStop(0.4, `rgba(150, 195, 235, ${currentAlpha * 0.5})`);
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
  }, [step, progress, reducedMotion]);

  // Optical absorption calculation:
  // Step 1: minimal dimming, bright surface light through water
  // Step 2: slight deepening
  // Step 3: sunlight is absorbed, water darkens to velvety deep navy/indigo midnight abyss
  // BUT the video motion remains visible!
  const depthFactor =
    step === 'SURFACE'
      ? 0.12
      : step === 'DESCENT'
      ? 0.38
      : 0.38 + progress * 0.54; // max 0.92, never 1.0 so video motion is always alive!

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#01060e]">
      {/* 1. Base Layer: Real Underwater Video Footage */}
      {!videoError ? (
        <video
          ref={videoRef}
          src="/videos/ocean_footage.mp4"
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setVideoLoaded(true)}
          onError={() => setVideoError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            filter: `brightness(${Math.max(0.35, 1 - depthFactor * 0.65)}) contrast(${
              1 + depthFactor * 0.15
            }) saturate(${Math.max(0.65, 1 - depthFactor * 0.35)})`,
            transform: `scale(${1 + depthFactor * 0.05})`,
          }}
        />
      ) : null}

      {/* 2. Fallback Photo Layer (if video error or loading) */}
      <img
        src="/images/underwater_surface.jpg"
        alt="실제 바닷속 배경"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          videoLoaded && !videoError ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          filter: `brightness(${Math.max(0.35, 1 - depthFactor * 0.65)})`,
        }}
      />

      {/* 3. Seawater Optical Absorption & Depth Layer (Beer-Lambert light absorption) */}
      {/* Dims surface sunlight from top downward, leaving only the calm fluid motion in deep water */}
      <div
        className="absolute inset-0 transition-opacity duration-1000 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 15%, rgba(2, 10, 25, ${
            depthFactor * 0.75
          }) 0%, rgba(1, 6, 16, ${0.35 + depthFactor * 0.58}) 70%, rgba(1, 4, 10, ${
            0.55 + depthFactor * 0.42
          }) 100%)`,
        }}
      />

      {/* 4. Soft Top Surface Light Attenuation */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 transition-opacity duration-1000 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, rgba(1, 5, 14, ${depthFactor * 0.85}), transparent)`,
        }}
      />

      {/* 5. Canvas Layer for Thoughts & Ambient Marine Motes */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
};
