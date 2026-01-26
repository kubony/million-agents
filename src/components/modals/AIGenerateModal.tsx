import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Loader2, Zap, Anchor } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeType: 'agent' | 'skill' | 'hook';
  nodeLabel: string;
  onGenerate: (result: GeneratedContent) => void;
  projectPath?: string;
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

export default function AIGenerateModal({
  isOpen,
  onClose,
  nodeType,
  nodeLabel,
  onGenerate,
  projectPath,
}: AIGenerateModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요.');
      return;
    }

    if (!projectPath) {
      setError('프로젝트가 선택되지 않았습니다.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Get API settings
      const { apiMode, apiKey, proxyUrl } = useSettingsStore.getState();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Mode': apiMode,
      };

      if (apiMode === 'direct' && apiKey) {
        headers['X-API-Key'] = apiKey;
      } else if (apiMode === 'proxy' && proxyUrl) {
        headers['X-Proxy-URL'] = proxyUrl;
      }

      const response = await fetch('/api/generate/node-content', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nodeType,
          nodeLabel,
          prompt: prompt.trim(),
          projectPath,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `서버 오류 (${response.status})`);
      }

      const result = await response.json();
      onGenerate(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
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
            어떤 {nodeType === 'agent' ? '에이전트' : nodeType === 'skill' ? '스킬' : '훅'}을 만들고 싶으세요?
          </label>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={PLACEHOLDERS[nodeType]}
            rows={4}
            disabled={isGenerating}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <p className="mt-2 text-xs text-zinc-500">
            자세하게 설명할수록 더 좋은 결과를 얻을 수 있습니다.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-700 bg-zinc-800/50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
              isGenerating || !prompt.trim()
                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                생성하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
