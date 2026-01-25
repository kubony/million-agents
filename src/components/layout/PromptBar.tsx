import { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { generateWorkflowWithAI } from '../../services/workflowGenerator';

export default function PromptBar() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadWorkflow } = useWorkflowStore();

  const handleSubmit = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      // AI 기반 워크플로우 생성 시도
      const { workflow, workflowName } = await generateWorkflowWithAI(prompt);

      // 생성된 워크플로우 로드
      loadWorkflow({
        nodes: workflow.nodes,
        edges: workflow.edges,
        name: workflowName,
      });

      setPrompt('');
    } catch (err) {
      console.error('AI workflow generation failed:', err);
      const message = err instanceof Error ? err.message : '워크플로우 생성에 실패했습니다.';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-surface border border-border rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3">
      <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />

      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your workflow... (e.g., 'Create an HTML page with images')"
        className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm"
        disabled={isGenerating}
      />

      <button
        onClick={handleSubmit}
        disabled={!prompt.trim() || isGenerating}
        className={`p-2 rounded-full transition-all duration-200 ${
          prompt.trim() && !isGenerating
            ? 'bg-accent text-white hover:bg-accent-hover hover:scale-105'
            : 'bg-surface-hover text-gray-500'
        }`}
        title="Generate Workflow"
      >
        {isGenerating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </button>

      {/* Disclaimer or Error */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs">
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : isGenerating ? (
          <span className="text-accent">AI가 워크플로우를 생성하고 있습니다...</span>
        ) : (
          <span className="text-gray-600">AI가 워크플로우를 자동 생성합니다</span>
        )}
      </div>
    </div>
  );
}
