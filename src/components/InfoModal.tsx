import React from 'react';
import { X, ShieldCheck, Moon, EyeOff, Sparkles, HelpCircle, Waves, Disc } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  reducedMotion,
  onToggleReducedMotion,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-slate-950/95 border border-slate-800/60 text-slate-200 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/60">
          <h2 id="info-modal-title" className="text-lg font-medium text-slate-100 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-sky-400" />
            BELOW 소개 및 안내
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-slate-200 font-medium">
              <Waves className="w-4 h-4 text-sky-400" />
              실제 바닷속으로의 물리적 침잠
            </div>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              화면의 빛이 단순히 어두워지는 것이 아니라, 관찰자가 수면(15m)에서부터 심해(1,000m+)로 점차 내려가면서 수면의 빛줄기가 위쪽으로 멀어지고 깊은 물속의 빛 흡수 법칙(Beer-Lambert law)에 따라 빛이 완전히 닿지 않게 되는 실제 해양 광학 원리를 시뮬레이션합니다. 내려갈 때 물속 부유 입자가 시점을 스쳐 위로 흘러가는 시차(Parallax) 효과를 느낄 수 있습니다.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/40">
            <div className="flex items-center gap-2 text-slate-200 font-medium">
              <Disc className="w-4 h-4 text-sky-400" />
              아득히 먼 심해의 고래 울음소리
            </div>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              수 킬로미터 밖 깊은 대양에서 울려 퍼지는 하나의 아련하고 깊은 야생 혹등고래 소리와 바닷속 저음역 조류음을 담았습니다. 산만하지 않도록 긴 여운과 침묵을 두고 멀리서 은은하게 울려 퍼집니다.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/40">
            <div className="flex items-center gap-2 text-slate-200 font-medium">
              <Sparkles className="w-4 h-4 text-sky-400" />
              생각을 빛으로 비워내는 경험
            </div>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              기록한 생각은 물속에서 반짝이는 은은한 입자로 흩어지며 깊은 바다로 놓아집니다. 휴식 모드에 들어가면 화면의 모든 버튼과 텍스트가 사라져 수면을 방해하지 않습니다.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/40">
            <div className="flex items-center gap-2 text-slate-200 font-medium">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              개인정보 보호
            </div>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              모든 내용은 외부 서버로 전송되지 않으며 오직 사용자의 브라우저(localStorage)에만 안전하게 보관됩니다.
            </p>
          </div>

          {/* Accessibility toggle */}
          <div className="pt-3 border-t border-slate-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-300">움직임 줄이기 (Reduced Motion)</span>
            </div>
            <button
              onClick={onToggleReducedMotion}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                reducedMotion
                  ? 'bg-sky-900/40 text-sky-200 border border-sky-700/40'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {reducedMotion ? '켜짐' : '꺼짐'}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 italic pt-1">
            * 본 서비스는 의학적 치료 목적의 소프트웨어가 아니며, 편안한 취침 환경 조성을 돕는 웰니스 웹 경험입니다.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-slate-800/60 bg-slate-950/60 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800/70 hover:bg-slate-700/70 text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
