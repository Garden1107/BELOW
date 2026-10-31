export type AppStep = 'SURFACE' | 'DESCENT' | 'STILLNESS' | 'COMPLETED';

export type RestDuration = 60 | 180 | 300 | 0; // seconds (0 = infinite)

export interface AiThoughtReply {
  comfortMessage: string; // "괜찮다"는 따뜻한 공감과 위로
  resolutionAdvice: string; // 오늘 하루를 위한 실천적인 해결 방안 및 조언
  generatedAt: number;
}

export interface SavedThought {
  id: string;
  text: string;
  createdAt: number; // timestamp
  saveForTomorrow: boolean;
  aiResponse?: AiThoughtReply;
  isGeneratingAi?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  z: number; // depth layer for 3D parallax (0.2 = far, 1.0 = near)
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  maxAlpha: number;
  pulseSpeed: number;
  pulseOffset: number;
  colorType?: 'ambient' | 'thought' | 'biolum';
  life?: number;
  maxLife?: number;
}
