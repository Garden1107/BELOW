import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Audio Engine:
 * 1. Whale Song: Authentic wild humpback whale recording (NOAA/NPS Alaskan archives).
 *    Uses direct HTML5 Audio element to ensure 100% reliable playback without Web Audio CORS silencing bugs.
 * 2. Ocean Ambient: Deep low-frequency water rumble via native Web Audio noise generator.
 */
export function useOceanAudio() {
  const [isOceanPlaying, setIsOceanPlaying] = useState<boolean>(false);
  const [isWhalePlaying, setIsWhalePlaying] = useState<boolean>(false);

  // Audio elements & contexts
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oceanGainRef = useRef<GainNode | null>(null);
  const whaleAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize solitary distant whale audio element
  useEffect(() => {
    const audio = new Audio('/audio/distant_whale_call.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.65; // Warm, gentle, distant listening level
    whaleAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Initialize Web Audio Context for ocean swell
  const initWebAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const oceanGain = ctx.createGain();
      oceanGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      oceanGain.connect(ctx.destination);
      oceanGainRef.current = oceanGain;

      // Low-frequency brown noise generator for deep water swell
      const bufferSize = ctx.sampleRate * 4;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.2;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(90, ctx.currentTime);
      lp.Q.setValueAtTime(1.2, ctx.currentTime);

      const swellOsc = ctx.createOscillator();
      swellOsc.frequency.setValueAtTime(0.08, ctx.currentTime);
      const swellGain = ctx.createGain();
      swellGain.gain.setValueAtTime(25, ctx.currentTime);
      swellOsc.connect(swellGain);
      swellGain.connect(lp.frequency);

      noiseSource.connect(lp);
      lp.connect(oceanGain);

      noiseSource.start(0);
      swellOsc.start(0);
    }

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // Toggle Ocean Ambient Sound
  const toggleOceanSound = useCallback(() => {
    initWebAudio();
    if (!isOceanPlaying) {
      if (oceanGainRef.current && audioCtxRef.current) {
        const now = audioCtxRef.current.currentTime;
        oceanGainRef.current.gain.cancelScheduledValues(now);
        oceanGainRef.current.gain.setValueAtTime(oceanGainRef.current.gain.value, now);
        oceanGainRef.current.gain.linearRampToValueAtTime(0.24, now + 2.0);
      }
      setIsOceanPlaying(true);
    } else {
      if (oceanGainRef.current && audioCtxRef.current) {
        const now = audioCtxRef.current.currentTime;
        oceanGainRef.current.gain.cancelScheduledValues(now);
        oceanGainRef.current.gain.setValueAtTime(oceanGainRef.current.gain.value, now);
        oceanGainRef.current.gain.linearRampToValueAtTime(0.0001, now + 1.5);
      }
      setIsOceanPlaying(false);
    }
  }, [isOceanPlaying, initWebAudio]);

  // Toggle Whale Song (Reliable direct HTML5 Audio)
  const toggleWhaleSound = useCallback(() => {
    const audio = whaleAudioRef.current;
    if (!audio) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    if (!isWhalePlaying) {
      audio.volume = 0.72;
      audio.play().then(() => {
        setIsWhalePlaying(true);
      }).catch((err) => {
        console.warn('Whale audio play error:', err);
        // Retry on user interaction
        audio.play().then(() => setIsWhalePlaying(true)).catch(() => {});
      });
    } else {
      // Smooth fade out over 600ms
      let vol = audio.volume;
      fadeIntervalRef.current = setInterval(() => {
        vol -= 0.15;
        if (vol <= 0.05) {
          audio.volume = 0;
          audio.pause();
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          setIsWhalePlaying(false);
        } else {
          audio.volume = vol;
        }
      }, 80);
    }
  }, [isWhalePlaying]);

  return {
    isOceanPlaying,
    isWhalePlaying,
    toggleOceanSound,
    toggleWhaleSound,
  };
}
