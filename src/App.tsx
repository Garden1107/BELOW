/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Archive,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Clock,
  Radio,
  CheckCircle2,
  Waves,
} from 'lucide-react';
import { AppStep, RestDuration, SavedThought } from './types';
import { UnderwaterScene3D } from './components/UnderwaterScene3D';
import { TextDissolveCanvas } from './components/TextDissolveCanvas';
import { SavedThoughtsModal } from './components/SavedThoughtsModal';
import { InfoModal } from './components/InfoModal';
import { useOceanAudio } from './hooks/useOceanAudio';

const STORAGE_KEY = 'below_saved_thoughts';

// Configurable durations (seconds)
const DURATION_OPTIONS: { label: string; value: RestDuration; desc: string }[] = [
  { label: '1분', value: 60, desc: '가벼운 쉼' },
  { label: '3분', value: 180, desc: '표준 여정' },
  { label: '5분', value: 300, desc: '깊은 침잠' },
  { label: '자유', value: 0, desc: '무제한 고요' },
];

export default function App() {
  // App state
  const [step, setStep] = useState<AppStep>('SURFACE');
  const [thoughtInput, setThoughtInput] = useState<string>('');
  const [saveForTomorrow, setSaveForTomorrow] = useState<boolean>(false);
  const [selectedDuration, setSelectedDuration] = useState<RestDuration>(180); // 3 minutes default

  // Real-time simulated ocean depth in meters
  const [depthMeters, setDepthMeters] = useState<number>(15);

  // Rest timer state
  const [timeRemaining, setTimeRemaining] = useState<number>(180);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Dissolution visual triggers & text particle canvas state
  const [thoughtTriggerCount, setThoughtTriggerCount] = useState<number>(0);
  const [isDissolving, setIsDissolving] = useState<boolean>(false);

  // Smooth completion fade states
  const [isEndingStillness, setIsEndingStillness] = useState<boolean>(false);
  const [showCompletedCard, setShowCompletedCard] = useState<boolean>(false);

  // Stillness UI visibility (auto-hide when mouse/touch stops)
  const [showControls, setShowControls] = useState<boolean>(false);
  const controlTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Saved thoughts collection in localStorage
  const [savedThoughts, setSavedThoughts] = useState<SavedThought[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Modals
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);

  // Accessibility: reduced motion
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Audio hook: Ocean swell & Whale song synthesis
  const {
    isOceanPlaying,
    isWhalePlaying,
    toggleOceanSound,
    toggleWhaleSound,
  } = useOceanAudio();

  // Save thoughts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedThoughts));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [savedThoughts]);

  // Sync reduced motion preference if system changes
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Keyboard shortcut: ESC closes open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsArchiveOpen(false);
        setIsInfoOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reveal controls momentarily upon interaction in STILLNESS
  const pokeControls = useCallback(() => {
    setShowControls(true);
    if (controlTimeoutRef.current) {
      clearTimeout(controlTimeoutRef.current);
    }
    controlTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4200);
  }, []);

  // Generate AI thought reply (comfort & resolution advice)
  const handleGenerateAiReply = useCallback(async (thoughtId: string) => {
    const target = savedThoughts.find((t) => t.id === thoughtId);
    if (!target) return;

    setSavedThoughts((prev) =>
      prev.map((t) => (t.id === thoughtId ? { ...t, isGeneratingAi: true } : t))
    );

    try {
      const res = await fetch('/api/gemini/thought-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: target.text }),
      });
      const data = await res.json();
      if (data && data.comfortMessage && data.resolutionAdvice) {
        setSavedThoughts((prev) =>
          prev.map((t) =>
            t.id === thoughtId
              ? {
                  ...t,
                  isGeneratingAi: false,
                  aiResponse: {
                    comfortMessage: data.comfortMessage,
                    resolutionAdvice: data.resolutionAdvice,
                    generatedAt: Date.now(),
                  },
                }
              : t
          )
        );
      } else {
        setSavedThoughts((prev) =>
          prev.map((t) => (t.id === thoughtId ? { ...t, isGeneratingAi: false } : t))
        );
      }
    } catch (err) {
      console.error('Failed to generate AI reply:', err);
      setSavedThoughts((prev) =>
        prev.map((t) => (t.id === thoughtId ? { ...t, isGeneratingAi: false } : t))
      );
    }
  }, [savedThoughts]);

  // STEP 1 -> STEP 2 Transition: "바다에 내려놓기"
  const handleReleaseThought = () => {
    const trimmed = thoughtInput.trim();

    // If user opted to save for tomorrow and entered text, store it and prepare AI morning reply
    if (trimmed && saveForTomorrow) {
      const thoughtId = `th-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newThought: SavedThought = {
        id: thoughtId,
        text: trimmed,
        createdAt: Date.now(),
        saveForTomorrow: true,
        isGeneratingAi: true,
      };
      setSavedThoughts((prev) => [newThought, ...prev]);

      // Automatically generate AI morning comfort & resolution advice in the background
      fetch('/api/gemini/thought-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.comfortMessage) {
            setSavedThoughts((prev) =>
              prev.map((t) =>
                t.id === thoughtId
                  ? {
                      ...t,
                      isGeneratingAi: false,
                      aiResponse: {
                        comfortMessage: data.comfortMessage,
                        resolutionAdvice: data.resolutionAdvice,
                        generatedAt: Date.now(),
                      },
                    }
                  : t
              )
            );
          }
        })
        .catch(() => {
          setSavedThoughts((prev) =>
            prev.map((t) => (t.id === thoughtId ? { ...t, isGeneratingAi: false } : t))
          );
        });
    }

    // 1. Trigger visible particle dissolution of the entered thought text
    setIsDissolving(true);
    setThoughtTriggerCount((c) => c + 1);

    // After 1.3s of luminous text particle dispersion, begin descent into the sea
    setTimeout(() => {
      setStep('DESCENT');
      setTimeRemaining(selectedDuration);
      setIsPaused(false);
    }, 1300);

    // After contemplative message finishes, glide seamlessly into STILLNESS
    setTimeout(() => {
      setIsDissolving(false);
      setStep('STILLNESS');
      pokeControls();
    }, 5400);
  };

  // Skip directly to STILLNESS without entering thoughts
  const handleDirectStillness = () => {
    setThoughtTriggerCount((c) => c + 1);
    setStep('DESCENT');
    setTimeRemaining(selectedDuration);
    setIsPaused(false);

    setTimeout(() => {
      setStep('STILLNESS');
      pokeControls();
    }, 3800);
  };

  // Gracefully transition from STILLNESS to COMPLETED with a soothing fade
  const triggerGracefulCompletion = useCallback(() => {
    setIsEndingStillness(true);
    setShowControls(false);

    // 1. Let stillness breathing focal point fade out smoothly over 1.6 seconds
    setTimeout(() => {
      setStep('COMPLETED');
      setIsEndingStillness(false);
      setShowCompletedCard(false);

      // 2. Soft pause, then gently fade in the completion text over 2 seconds
      setTimeout(() => {
        setShowCompletedCard(true);
      }, 100);
    }, 1600);
  }, []);

  // Timer countdown in STILLNESS mode
  useEffect(() => {
    if (step !== 'STILLNESS' || isPaused || isEndingStillness) return;

    // Infinite mode: stays in stillness
    if (selectedDuration === 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerGracefulCompletion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, isPaused, isEndingStillness, selectedDuration, triggerGracefulCompletion]);

  // Restart back to STEP 1
  const handleRestart = () => {
    setShowCompletedCard(false);
    setIsEndingStillness(false);
    setIsDissolving(false);
    setStep('SURFACE');
    setThoughtInput('');
    setSaveForTomorrow(false);
    setTimeRemaining(selectedDuration);
    setIsPaused(false);
    setShowControls(false);
  };

  // Complete rest immediately with graceful fade
  const handleFinishEarly = () => {
    triggerGracefulCompletion();
  };

  // Delete saved thought
  const handleDeleteThought = (id: string) => {
    setSavedThoughts((prev) => prev.filter((item) => item.id !== id));
  };

  // Clear all saved thoughts
  const handleClearAllThoughts = () => {
    setSavedThoughts([]);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  };

  // Calculate progress ratio (0 to 1) for water darkening
  const progressRatio =
    selectedDuration > 0
      ? Math.max(0, Math.min(1, (selectedDuration - timeRemaining) / selectedDuration))
      : 0.85; // steady deep dim in infinite mode

  // Format mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper description of current ocean depth layer
  const getDepthDescription = (depth: number) => {
    if (depth < 80) return '수면 유광층';
    if (depth < 200) return '점이층 (햇빛 감소)';
    if (depth < 800) return '중심해 (약광대 / 황혼)';
    return '점심해 / 심해저대 (완전한 암흑)';
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col justify-between font-sans select-none"
      onMouseMove={step === 'STILLNESS' ? pokeControls : undefined}
      onTouchStart={step === 'STILLNESS' ? pokeControls : undefined}
    >
      {/* 1. Underlying real 3D physical underwater environment with volumetric light and depth descent */}
      <UnderwaterScene3D
        step={step}
        progress={progressRatio}
        thoughtTriggerCount={thoughtTriggerCount}
        reducedMotion={reducedMotion}
        onDepthChange={setDepthMeters}
      />

      {/* 2. Top Header Bar (Quiet, unboxed navigation) */}
      <header
        className={`relative z-20 flex items-center justify-between px-6 py-5 md:px-10 md:py-6 transition-all duration-700 ${
          step === 'STILLNESS' && !showControls
            ? 'opacity-0 pointer-events-none -translate-y-2'
            : 'opacity-100'
        }`}
      >
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif-kr tracking-widest text-lg md:text-xl font-light text-cyan-100">
            BELOW
          </span>
          <span className="hidden sm:inline text-xs text-cyan-400/50 font-light">
            하루의 끝, 고요한 바닷속
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Saved thoughts button */}
          <button
            onClick={() => setIsArchiveOpen(true)}
            aria-label="내일의 보관함 열기"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-cyan-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5 text-cyan-400/80" />
            <span className="hidden xs:inline">보관함</span>
            {savedThoughts.length > 0 && (
              <span className="text-[11px] text-cyan-300 font-mono">
                {savedThoughts.length}
              </span>
            )}
          </button>

          {/* Whale Song Toggle (실제 혹등고래 소리) */}
          <button
            onClick={toggleWhaleSound}
            aria-label={isWhalePlaying ? '고래 소리 끄기' : '고래 소리 켜기'}
            title={isWhalePlaying ? '실제 혹등고래 소리 끄기' : '실제 혹등고래 소리 켜기 (알래스카 글레이셔 만 야생 녹음)'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isWhalePlaying
                ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-sm shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isWhalePlaying ? 'text-sky-300 animate-pulse' : 'text-slate-400'}`} />
            <span>고래 소리 {isWhalePlaying ? '재생 중' : '끔'}</span>
          </button>

          {/* Ocean Ambient Sound Toggle */}
          <button
            onClick={toggleOceanSound}
            aria-label={isOceanPlaying ? '바다 소리 끄기' : '바다 소리 켜기'}
            title={isOceanPlaying ? '바다 소리 끄기' : '바다 소리 켜기'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isOceanPlaying
                ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/20'
                : 'text-slate-400 hover:text-cyan-200 hover:bg-white/5'
            }`}
          >
            {isOceanPlaying ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                <span className="hidden xs:inline">바다 소리 켬</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden xs:inline">바다 소리 끔</span>
              </>
            )}
          </button>

          {/* Info & Settings */}
          <button
            onClick={() => setIsInfoOpen(true)}
            aria-label="안내 및 설정"
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 3. Main Center Stage Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6">
        {/* ============================================================ */}
        {/* STEP 1: SURFACE (수면 — 생각 기록 및 입자 분해 연출) */}
        {/* ============================================================ */}
        {step === 'SURFACE' && (
          <>
            {/* Luminous Text Stardust Dissolution Overlay */}
            <TextDissolveCanvas
              isActive={isDissolving}
              text={thoughtInput.trim() || '오늘 마음에 남아있는 생각'}
            />

            <div
              className={`w-full max-w-xl mx-auto flex flex-col items-center text-center transition-all duration-1000 ${
                isDissolving
                  ? 'opacity-0 scale-95 pointer-events-none filter blur-sm'
                  : 'opacity-100'
              }`}
            >
              {/* Poetic Prompt */}
              <h1 className="font-serif-kr text-xl sm:text-2xl md:text-3xl text-slate-100 font-light tracking-wide leading-relaxed mb-6 sm:mb-8 drop-shadow-sm">
                오늘 마음에 남아 있는 생각은 무엇인가요?
              </h1>

              {/* Input Card Container */}
              <div className="w-full bg-slate-950/50 backdrop-blur-md border border-slate-700/25 rounded-2xl p-4 sm:p-6 shadow-2xl transition-all focus-within:border-sky-700/40 focus-within:bg-slate-950/60">
                <textarea
                  value={thoughtInput}
                  onChange={(e) => setThoughtInput(e.target.value)}
                  placeholder="잠들기 전 머릿속을 맴도는 걱정, 할 일, 혹은 잊고 싶은 감정을 적어보세요..."
                  rows={4}
                  disabled={isDissolving}
                  className="w-full bg-transparent border-0 text-slate-200 placeholder-slate-400/40 text-sm sm:text-base leading-relaxed resize-none focus:outline-none font-light"
                  aria-label="오늘 마음에 남아 있는 생각 입력창"
                />

                {/* Options row inside the card */}
                <div className="pt-3 mt-3 border-t border-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {/* Save for tomorrow toggle */}
                  <label className="flex items-center gap-2 text-slate-300 hover:text-slate-100 cursor-pointer select-none transition-colors">
                    <input
                      type="checkbox"
                      checked={saveForTomorrow}
                      onChange={(e) => setSaveForTomorrow(e.target.checked)}
                      disabled={isDissolving}
                      className="w-3.5 h-3.5 accent-sky-600 rounded cursor-pointer"
                    />
                    <span>내일 다시 보기 (기기 보관 및 아침 AI 답글)</span>
                  </label>

                  {/* Duration selector */}
                  <div className="flex items-center gap-1 text-slate-400 self-end sm:self-auto">
                    <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      침잠 시간:
                    </span>
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSelectedDuration(opt.value)}
                        disabled={isDissolving}
                        className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                          selectedDuration === opt.value
                            ? 'bg-sky-900/40 text-sky-200 border border-sky-700/40 font-medium'
                            : 'hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Primary Action Button */}
              <div className="mt-6 flex flex-col items-center gap-3 w-full">
                <button
                  onClick={handleReleaseThought}
                  disabled={isDissolving}
                  className="w-full sm:w-auto min-w-[240px] px-8 py-3.5 bg-gradient-to-r from-sky-800/80 via-blue-900/80 to-slate-900/90 hover:from-sky-700 hover:via-blue-800 hover:to-slate-800 text-slate-100 rounded-xl font-normal text-sm sm:text-base tracking-wide shadow-xl shadow-black/40 transition-all duration-300 cursor-pointer border border-sky-600/25 active:scale-[0.99] disabled:opacity-50"
                >
                  {isDissolving ? '생각이 바다에 녹아드는 중...' : '바다에 내려놓기'}
                </button>

                {/* Secondary discrete skip option */}
                <button
                  onClick={handleDirectStillness}
                  disabled={isDissolving}
                  className="text-xs text-slate-400/70 hover:text-slate-200 transition-colors py-1 cursor-pointer underline underline-offset-4 decoration-slate-700/60"
                >
                  생각 없이 바로 바닷속으로 들어가기
                </button>
              </div>

              {/* Privacy reassuring footnote */}
              <div className="mt-8 text-[11px] text-slate-400/50 font-light max-w-sm">
                작성된 생각은 외부 서버로 전송되지 않으며 당신의 기기 안에만 머뭅니다.
              </div>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* STEP 2: DESCENT (심해 — 생각을 빛으로 바꾸며 침잠 시작) */}
        {/* ============================================================ */}
        {step === 'DESCENT' && (
          <div className="max-w-md mx-auto text-center animate-in fade-in zoom-in-95 duration-1000 px-4">
            <p className="font-serif-kr text-xl sm:text-2xl text-slate-100 font-light leading-relaxed tracking-wider drop-shadow-md">
              {thoughtInput.trim()
                ? '오늘의 생각은 이곳에 두고 가도 괜찮아요.'
                : '오늘 하루도 참 애쓰셨습니다. 이제 마음을 쉬어주세요.'}
            </p>
            <p className="text-xs text-slate-400/70 font-light mt-4 tracking-widest">
              생각이 은은한 빛이 되어 깊은 바닷속으로 흩어졌습니다
            </p>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: STILLNESS (고요 — 자동 침잠 및 휴식 모드) */}
        {/* ============================================================ */}
        {step === 'STILLNESS' && (
          <div
            className={`relative w-full h-full flex flex-col items-center justify-center pointer-events-none transition-opacity duration-1500 ${
              isEndingStillness ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {/* Very subtle breathing focal point */}
            <div className="flex flex-col items-center text-center select-none">
              <div
                className={`w-36 h-36 sm:w-48 sm:h-48 rounded-full border border-slate-700/15 flex items-center justify-center transition-all duration-1000 ${
                  reducedMotion ? '' : 'animate-pulse'
                }`}
                style={{
                  background:
                    'radial-gradient(circle, rgba(148, 163, 184, 0.03) 0%, transparent 70%)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300/30" />
              </div>

              {/* Minimal text that stays very faint */}
              <p className="text-xs text-slate-400/40 font-light tracking-widest mt-6">
                천천히 숨을 쉬며 깊은 심해의 고요를 느껴보세요
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: COMPLETED (수면 준비 완료 — 부드러운 페이드 인) */}
        {/* ============================================================ */}
        {step === 'COMPLETED' && (
          <div
            className={`max-w-lg mx-auto text-center px-4 space-y-6 transition-all duration-2000 ease-out transform ${
              showCompletedCard
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95'
            }`}
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-cyan-300/70">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="font-serif-kr text-xl sm:text-2xl text-cyan-100 font-light tracking-wide leading-relaxed">
                마음이 한결 가벼워졌기를 바랍니다.
              </h2>
              <p className="text-sm text-slate-400 font-light leading-relaxed">
                이제 기기를 내려놓고, 깊고 포근한 밤을 맞이하세요.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-200 border border-cyan-800/40 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                다시 시작하기
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 4. Bottom Controls & Physical Ocean Depth Indicator */}
      <footer
        className={`relative z-20 px-6 py-5 md:px-10 md:py-6 transition-all duration-700 ${
          step === 'STILLNESS' && !showControls
            ? 'opacity-0 pointer-events-none translate-y-2'
            : step === 'DESCENT'
            ? 'opacity-0 pointer-events-none'
            : 'opacity-100'
        }`}
      >
        <div className="max-w-xl mx-auto flex items-center justify-between text-xs text-slate-400">
          {step === 'STILLNESS' ? (
            <>
              {/* Depth & Timer status */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-cyan-300/80 font-mono text-[11px]">
                  <Waves className="w-3.5 h-3.5 text-cyan-400/90" />
                  <span>수심 {depthMeters}m</span>
                  <span className="text-cyan-500/40">·</span>
                  <span className="text-slate-400">{getDepthDescription(depthMeters)}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {selectedDuration > 0
                    ? `남은 시간 ${formatTime(timeRemaining)} / ${formatTime(selectedDuration)}`
                    : '자유 침잠 중'}
                </div>
              </div>

              {/* Actions during stillness */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleWhaleSound}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    isWhalePlaying
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-sm shadow-sky-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                  title={isWhalePlaying ? '고래 소리 끄기' : '고래 소리 켜기'}
                >
                  <Radio className={`w-3.5 h-3.5 ${isWhalePlaying ? 'text-sky-300 animate-pulse' : 'text-slate-400'}`} />
                  <span>고래 소리 {isWhalePlaying ? '재생 중' : '끔'}</span>
                </button>

                <button
                  onClick={handleRestart}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-cyan-200 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>처음으로</span>
                </button>

                <button
                  onClick={handleFinishEarly}
                  className="px-3.5 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-200 border border-cyan-800/40 rounded-lg transition-colors cursor-pointer font-medium"
                >
                  종료하기
                </button>
              </div>
            </>
          ) : step === 'SURFACE' ? (
            <div className="w-full flex items-center justify-between text-[11px] text-slate-400/70">
              <span className="flex items-center gap-1.5">
                <Waves className="w-3 h-3 text-cyan-400/60" />
                현재 위치: 수심 {depthMeters}m (수면 유광층)
              </span>
              <span>빛이 닿는 깊이: 약 300m</span>
            </div>
          ) : (
            <div />
          )}
        </div>
      </footer>

      {/* Modals */}
      <SavedThoughtsModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        thoughts={savedThoughts}
        onDeleteThought={handleDeleteThought}
        onClearAll={handleClearAllThoughts}
        onGenerateAiReply={handleGenerateAiReply}
      />

      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion((v) => !v)}
      />
    </div>
  );
}
