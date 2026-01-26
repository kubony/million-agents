import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Zap, Anchor } from 'lucide-react';

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeType: 'agent' | 'skill' | 'hook';
  nodeLabel: string;
  onSubmit: (prompt: string) => void;
}

export interface GeneratedContent {
  // Agent
  systemPrompt?: string;
  tools?: string[];
  model?: string;
  // Skill
  skillPath?: string;
  skillId?: string;
  skillType?: 'generated';
  // Hook
  hookEvent?: string;
  hookMatcher?: string;
  hookCommand?: string;
  // Common
  description?: string;
}

const PLACEHOLDERS: Record<string, string> = {
  agent: '예: 웹에서 뉴스 기사를 검색하고 요약해서 마크다운으로 정리하는 에이전트',
  skill: '예: Gmail API를 사용해서 이메일을 읽고 보내는 스킬',
  hook: '예: Bash 명령 실행 전에 위험한 명령인지 확인하는 훅',
};

const TITLES: Record<string, string> = {
  agent: 'AI로 에이전트 생성',
  skill: 'AI로 스킬 생성',
  hook: 'AI로 훅 생성',
};

const ICONS: Record<string, React.ReactNode> = {
  agent: <Sparkles className="w-5 h-5 text-purple-400" />,
  skill: <Zap className="w-5 h-5 text-cyan-400" />,
  hook: <Anchor className="w-5 h-5 text-pink-400" />,
};

const NODE_TYPE_NAMES: Record<string, string> = {
  agent: '에이전트',
  skill: '스킬',
  hook: '훅',
};

export default function AIGenerateModal({
  isOpen,
  onClose,
  nodeType,
  nodeLabel,
  onSubmit,
}: AIGenerateModalProps) {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요.');
      return;
    }

    // Submit prompt and close immediately
    onSubmit(prompt.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    // Escape to close
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-zinc-900 rounded-xl w-full max-w-lg mx-4 border border-zinc-700 shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800">
              {ICONS[nodeType]}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {TITLES[nodeType]}
              </h2>
              <p className="text-sm text-zinc-400">{nodeLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            어떤 {NODE_TYPE_NAMES[nodeType]}을 만들고 싶으세요?
          </label>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={PLACEHOLDERS[nodeType]}
            rows={4}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          />

          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <p className="mt-2 text-xs text-zinc-500">
            자세하게 설명할수록 더 좋은 결과를 얻을 수 있습니다. (⌘+Enter로 바로 생성)
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-700 bg-zinc-800/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
              !prompt.trim()
                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            생성 시작
          </button>
        </div>
      </div>
    </div>
  );
}
