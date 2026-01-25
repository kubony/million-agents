import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2, CheckCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useWorkflowStore } from '../../stores/workflowStore';
import { usePanelStore } from '../../stores/panelStore';
import { useExecutionStore } from '../../stores/executionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { generateWorkflowWithAI } from '../../services/workflowGenerator';
import { isSkillGenerationRequest } from '../../services/skillGenerator';
import {
  socketService,
  type SkillProgressEvent,
  type SkillCompletedData,
  type SkillErrorData,
} from '../../services/socketService';
import type { SkillNodeData } from '../../types/nodes';

export default function PromptBar() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatingType, setGeneratingType] = useState<'skill' | 'workflow'>('workflow');
  const { loadWorkflow, addNode, setSelectedNode, nodes } = useWorkflowStore();
  const { openConsolePanel, openStepPanel } = usePanelStore();
  const { addLog, clearLogs } = useExecutionStore();
  const { apiMode, apiKey, proxyUrl } = useSettingsStore();

  // Socket.IO 이벤트 핸들러
  const handleSkillProgress = useCallback((event: SkillProgressEvent) => {
    console.log('[PromptBar] Skill progress:', event.step, event.message);
    // 진행 상황을 로그에 추가
    const level = event.step === 'error' ? 'error' :
                  event.step === 'completed' ? 'success' : 'info';
    addLog(level, event.message, undefined, event.detail);
  }, [addLog]);

  const handleSkillCompleted = useCallback((data: SkillCompletedData) => {
    setIsGenerating(false);
    setSuccessMessage(`스킬 "${data.skill.skillName}"이 ${data.savedPath}에 저장되었습니다!`);
    setPrompt('');
    setTimeout(() => setSuccessMessage(null), 5000);

    // 캔버스에 스킬 노드 추가
    const nodeId = nanoid();
    const existingNodes = nodes.length;
    const newNode = {
      id: nodeId,
      type: 'skill' as const,
      position: {
        x: 100 + (existingNodes % 3) * 300,
        y: 100 + Math.floor(existingNodes / 3) * 200,
      },
      data: {
        label: data.skill.skillName,
        description: data.skill.description,
        status: 'idle',
        skillType: 'generated',
        skillId: data.skill.skillId,
        skillPath: data.savedPath,
      } as SkillNodeData,
    };
    addNode(newNode);
    setSelectedNode(nodeId);
    openStepPanel();
  }, [nodes, addNode, setSelectedNode, openStepPanel]);

  const handleSkillError = useCallback((data: SkillErrorData) => {
    setIsGenerating(false);
    setError(data.error);
  }, []);

  // Socket.IO 이벤트 리스너 등록
  useEffect(() => {
    socketService.on<SkillProgressEvent>('skill:progress', handleSkillProgress);
    socketService.on<SkillCompletedData>('skill:completed', handleSkillCompleted);
    socketService.on<SkillErrorData>('skill:error', handleSkillError);

    return () => {
      socketService.off<SkillProgressEvent>('skill:progress', handleSkillProgress);
      socketService.off<SkillCompletedData>('skill:completed', handleSkillCompleted);
      socketService.off<SkillErrorData>('skill:error', handleSkillError);
    };
  }, [handleSkillProgress, handleSkillCompleted, handleSkillError]);

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
        // 스킬 생성 - Socket.IO 사용
        clearLogs();
        openConsolePanel();

        // 즉시 시작 로그 추가 (서버 응답 전에 사용자에게 피드백)
        addLog('info', '✨ 스킬 생성을 시작합니다...', undefined, `요청: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

        // Socket 연결 상태 확인
        if (!socketService.isConnected()) {
          addLog('warning', '⚠️ 서버 연결 대기 중...', undefined, '잠시 후 자동으로 연결됩니다');
        }

        socketService.generateSkill({
          prompt,
          apiMode,
          apiKey: apiMode === 'direct' ? apiKey : undefined,
          proxyUrl: apiMode === 'proxy' ? proxyUrl : undefined,
        });

        addLog('info', '🔍 요청을 분석하고 있어요...', undefined, 'AI가 어떤 스킬이 필요한지 파악 중');
        // 이후 진행 상황은 Socket.IO 이벤트로 처리됨
      } else {
        // 워크플로우 생성
        const { workflow, workflowName } = await generateWorkflowWithAI(prompt);

        loadWorkflow({
          nodes: workflow.nodes,
          edges: workflow.edges,
          name: workflowName,
        });

        setPrompt('');
        setIsGenerating(false);
      }
    } catch (err) {
      console.error('Generation failed:', err);
      const message = err instanceof Error ? err.message : '생성에 실패했습니다.';
      setError(message);
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
