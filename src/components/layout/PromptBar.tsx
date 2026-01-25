import { useState } from 'react';
import { Sparkles, Send, Loader2, CheckCircle } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { generateWorkflowWithAI } from '../../services/workflowGenerator';
import { generateSkill, isSkillGenerationRequest, type SkillGenerationResult } from '../../services/skillGenerator';

export default function PromptBar() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatingType, setGeneratingType] = useState<'skill' | 'workflow'>('workflow');
  const { loadWorkflow } = useWorkflowStore();

  const handleSubmit = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    // 스킬 생성 요청인지 판단
    const isSkillRequest = isSkillGenerationRequest(prompt);
    setGeneratingType(isSkillRequest ? 'skill' : 'workflow');

    try {
      if (isSkillRequest) {
        // 스킬 생성
        const result: SkillGenerationResult = await generateSkill(prompt);

        if (result.success && result.skill) {
          setSuccessMessage(`스킬 "${result.skill.skillName}"이 ${result.savedPath}에 저장되었습니다!`);
          setPrompt('');

          // 3초 후 메시지 숨김
          setTimeout(() => setSuccessMessage(null), 5000);
        } else {
          throw new Error(result.error || '스킬 생성에 실패했습니다.');
        }
      } else {
        // 워크플로우 생성
        const { workflow, workflowName } = await generateWorkflowWithAI(prompt);

        loadWorkflow({
          nodes: workflow.nodes,
          edges: workflow.edges,
          name: workflowName,
        });

        setPrompt('');
      }
    } catch (err) {
      console.error('Generation failed:', err);
      const message = err instanceof Error ? err.message : '생성에 실패했습니다.';
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

      {/* Status Message */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap">
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : successMessage ? (
          <span className="text-green-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {successMessage}
          </span>
        ) : isGenerating ? (
          <span className="text-accent">
            AI가 {generatingType === 'skill' ? '스킬' : '워크플로우'}을 생성하고 있습니다...
          </span>
        ) : (
          <span className="text-gray-600">
            "스킬 만들어줘" 또는 워크플로우 설명을 입력하세요
          </span>
        )}
      </div>
    </div>
  );
}
