import React from 'react';
import {
  X,
  Trash2,
  ShieldCheck,
  Waves,
  Sun,
  HeartHandshake,
  Compass,
  Sparkles,
} from 'lucide-react';
import { SavedThought } from '../types';

interface SavedThoughtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  thoughts: SavedThought[];
  onDeleteThought: (id: string) => void;
  onClearAll: () => void;
  onGenerateAiReply: (thoughtId: string) => Promise<void>;
}

export const SavedThoughtsModal: React.FC<SavedThoughtsModalProps> = ({
  isOpen,
  onClose,
  thoughts,
  onDeleteThought,
  onClearAll,
  onGenerateAiReply,
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = React.useState<boolean>(false);

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours % 12 || 12;
    return `${month}월 ${date}일 ${ampm} ${displayHours}:${minutes}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-thoughts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl max-h-[88vh] flex flex-col bg-slate-950/95 border border-slate-800/70 text-slate-200 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/60">
          <div>
            <h2
              id="saved-thoughts-title"
              className="text-lg font-medium text-slate-100 flex items-center gap-2"
            >
              <Waves className="w-4 h-4 text-sky-400" />
              내일 다시 볼 생각들
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              마음의 짐을 덜기 위해 바다에 맡겨둔 기록 ({thoughts.length}개)
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Privacy & Storage Notice Banner */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/50 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-slate-200">안심 보관 안내: </span>
            작성하신 모든 생각은 사용자의 기기 브라우저(localStorage)에만 안전하게 보관됩니다. 숙면 후 생각이 정리될 수 있도록 AI 아침 답글이 함께 제공됩니다.
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 divide-y divide-slate-800/40">
          {thoughts.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-slate-400 text-sm font-light">
                보관된 생각이 없습니다.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                생각을 기록할 때 &lsquo;내일 다시 보기&rsquo;를 체크하면 바다가 밤새 생각을 품어주고 아침 답글을 전해줍니다.
              </p>
            </div>
          ) : (
            thoughts.map((item) => (
              <div
                key={item.id}
                className="pt-4 first:pt-0 group flex flex-col gap-2"
              >
                {/* User's Original Thought Card */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-sky-400/80 mb-1 font-mono flex items-center gap-2">
                      <span>{formatDate(item.createdAt)}</span>
                      <span className="text-[11px] text-slate-500 font-sans">바다에 내려놓은 생각</span>
                    </div>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-light break-words">
                      {item.text}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteThought(item.id)}
                    title="바다로 놓아주기 (삭제)"
                    aria-label="이 생각 삭제"
                    className="opacity-60 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* AI Morning Reply Section */}
                {item.aiResponse ? (
                  <div className="mt-2.5 p-3.5 bg-gradient-to-br from-sky-950/40 via-slate-900/60 to-slate-950/80 border border-sky-800/35 rounded-xl space-y-2.5 shadow-lg">
                    {/* Card Header */}
                    <div className="flex items-center justify-between text-xs font-medium text-sky-200">
                      <div className="flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-300" />
                        <span>숙면 후 도착한 바다의 아침 답글</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">
                        {formatDate(item.aiResponse.generatedAt)}
                      </span>
                    </div>

                    {/* Comfort message ("괜찮다"는 위로) */}
                    <div className="flex items-start gap-2.5 text-xs text-sky-100/90 leading-relaxed font-light">
                      <HeartHandshake className="w-3.5 h-3.5 text-rose-300/90 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-rose-200/90 mr-1.5">따뜻한 위로:</span>
                        {item.aiResponse.comfortMessage}
                      </div>
                    </div>

                    {/* Resolution advice (해결 방안) */}
                    <div className="flex items-start gap-2.5 text-xs text-slate-200/90 leading-relaxed font-light pt-2.5 border-t border-sky-900/40">
                      <Compass className="w-3.5 h-3.5 text-teal-300/90 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-teal-300 mr-1.5">실마리와 해결 방안:</span>
                        {item.aiResponse.resolutionAdvice}
                      </div>
                    </div>
                  </div>
                ) : item.isGeneratingAi ? (
                  <div className="mt-2 p-3 bg-sky-950/30 border border-sky-800/30 rounded-xl flex items-center gap-2.5 text-xs text-sky-300/90 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    <span>바다가 밤새 생각을 가다듬으며 아침 답글을 적어내리는 중입니다...</span>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => onGenerateAiReply(item.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-900/30 hover:bg-sky-800/40 text-sky-200 border border-sky-700/40 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                      <span>AI 아침 위로 및 해결 방안 확인하기</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {thoughts.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-800/60 flex items-center justify-between text-xs bg-slate-950/60">
            {isConfirmingClear ? (
              <div className="flex items-center gap-2 animate-in fade-in duration-200">
                <span className="text-slate-300">정말 모든 기록을 비울까요?</span>
                <button
                  onClick={() => {
                    onClearAll();
                    setIsConfirmingClear(false);
                  }}
                  className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700/60 rounded text-xs transition-colors cursor-pointer font-medium"
                >
                  네, 모두 비우기
                </button>
                <button
                  onClick={() => setIsConfirmingClear(false)}
                  className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirmingClear(true)}
                className="text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
              >
                모든 기록 비우기
              </button>
            )}
            <button
              onClick={() => {
                setIsConfirmingClear(false);
                onClose();
              }}
              className="px-4 py-2 bg-slate-800/70 hover:bg-slate-700/70 text-slate-200 rounded-lg transition-colors cursor-pointer font-medium"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
