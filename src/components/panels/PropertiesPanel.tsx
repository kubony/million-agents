import { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, Sparkles, MessageSquare, Zap, Anchor, BarChart3, Settings2, FileCode, ChevronDown, ChevronRight, Loader2, Play, CheckCircle, XCircle, Wand2 } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useProjectStore } from '../../stores/projectStore';
import { useExecutionStore } from '../../stores/executionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { syncNode, deleteNode } from '../../services/syncService';
import type { WorkflowNode, AgentNodeData, InputNodeData, SkillNodeData, HookNodeData } from '../../types/nodes';
import { AVAILABLE_TOOLS } from '../../types/nodes';
import { AVAILABLE_SKILLS } from '../../data/availableSkills';
import AIGenerateModal, { type GeneratedContent } from '../modals/AIGenerateModal';

const NODE_TYPE_NAMES: Record<string, string> = {
  agent: '에이전트',
  skill: '스킬',
  hook: '훅',
};

interface PropertiesPanelProps {
  node: WorkflowNode | undefined;
}

// Model options (similar to Opal's Gemini models)
const MODEL_OPTIONS = [
  { id: 'sonnet', name: 'Claude 4 Sonnet', description: 'Fast, cost-efficient' },
  { id: 'opus', name: 'Claude 4.5 Opus', description: 'Best for complex tasks' },
  { id: 'haiku', name: 'Claude 3.5 Haiku', description: 'Fastest, for simple tasks' },
];

function getNodeIcon(type: string | undefined) {
  switch (type) {
    case 'input':
      return <MessageSquare className="w-5 h-5 text-yellow-400" />;
    case 'agent':
      return <Sparkles className="w-5 h-5 text-purple-400" />;
    case 'skill':
      return <Zap className="w-5 h-5 text-cyan-400" />;
    case 'hook':
      return <Anchor className="w-5 h-5 text-pink-400" />;
    case 'output':
      return <BarChart3 className="w-5 h-5 text-emerald-400" />;
    default:
      return null;
  }
}

function getNodeTypeName(type: string | undefined) {
  switch (type) {
    case 'input':
      return 'User Input';
    case 'agent':
      return 'Agent';
    case 'skill':
      return 'Skill';
    case 'hook':
      return 'Hook';
    case 'output':
      return 'Output';
    default:
      return 'Node';
  }
}

export default function PropertiesPanel({ node }: PropertiesPanelProps) {
  const { updateNode, removeNode, nodes } = useWorkflowStore();
  const { currentProject } = useProjectStore();
  const { addLog } = useExecutionStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // AI 생성 가능한 노드 타입인지 확인
  const canUseAIGenerate = node && ['agent', 'skill', 'hook'].includes(node.type);

  // AI 생성 시작 (모달에서 프롬프트 제출 시)
  const handleAISubmit = async (prompt: string) => {
    if (!node || !currentProject?.path) return;

    const nodeTypeName = NODE_TYPE_NAMES[node.type] || node.type;

    // 노드 상태를 running으로 변경
    updateNode(node.id, { status: 'running' });
    setIsGenerating(true);

    // 로그: 시작
    addLog('info', `🤖 "${node.data.label}" ${nodeTypeName} 생성을 시작합니다...`, node.id);

    try {
      // API 설정 가져오기
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

      // 로그: AI 분석 중
      addLog('info', `💭 AI가 "${prompt}" 요청을 분석하고 있습니다...`, node.id);

      const response = await fetch('/api/generate/node-content', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nodeType: node.type,
          nodeLabel: node.data.label,
          prompt,
          projectPath: currentProject.path,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `서버 오류 (${response.status})`);
      }

      const result: GeneratedContent = await response.json();

      // 로그: 생성 완료
      addLog('info', `✨ ${nodeTypeName} 내용이 생성되었습니다. 적용 중...`, node.id);

      // 결과 적용
      const updates: Record<string, unknown> = { status: 'idle' };

      if (result.description) {
        updates.description = result.description;
      }

      if (node.type === 'agent') {
        if (result.systemPrompt) updates.systemPrompt = result.systemPrompt;
        if (result.tools) updates.tools = result.tools;
        if (result.model) updates.model = result.model;
      } else if (node.type === 'skill') {
        if (result.skillPath) updates.skillPath = result.skillPath;
        if (result.skillId) updates.skillId = result.skillId;
        if (result.skillType) updates.skillType = result.skillType;
      } else if (node.type === 'hook') {
        if (result.hookEvent) updates.hookEvent = result.hookEvent;
        if (result.hookMatcher) updates.hookMatcher = result.hookMatcher;
        if (result.hookCommand) updates.hookCommand = result.hookCommand;
      }

      updateNode(node.id, updates);

      // 로그: 완료
      addLog('success', `✅ "${node.data.label}" ${nodeTypeName}가 성공적으로 생성되었습니다!`, node.id);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';

      // 노드 상태를 error로 변경
      updateNode(node.id, { status: 'error' });

      // 로그: 에러
      addLog('error', `❌ ${nodeTypeName} 생성 실패: ${errorMessage}`, node.id);
    } finally {
      setIsGenerating(false);
    }
  };

  // Debounced sync to filesystem when node changes
  const debouncedSync = useCallback((nodeToSync: WorkflowNode) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      syncNode(nodeToSync).catch(err => {
        console.error('Failed to sync node to filesystem:', err);
      });
    }, 500); // 500ms debounce
  }, []);

  // Sync when node data changes (skip input/output nodes)
  useEffect(() => {
    if (node && node.type !== 'input' && node.type !== 'output') {
      debouncedSync(node);
    }
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [node, debouncedSync]);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <Settings2 className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-center">Select a node to configure its settings</p>
      </div>
    );
  }

  const handleDeleteClick = () => {
    // Show confirmation dialog for non-input/output nodes
    if (node.type !== 'input' && node.type !== 'output') {
      setShowDeleteConfirm(true);
    } else {
      removeNode(node.id);
    }
  };

  const confirmDelete = () => {
    // Sync deletion to filesystem
    deleteNode(node, nodes as WorkflowNode[]).catch(err => {
      console.error('Failed to delete node from filesystem:', err);
    });
    removeNode(node.id);
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleLabelChange = (label: string) => {
    updateNode(node.id, { label });
  };

  const handleDescriptionChange = (description: string) => {
    updateNode(node.id, { description });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface">
            {getNodeIcon(node.type)}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{node.data.label}</h3>
            <p className="text-xs text-gray-500">{getNodeTypeName(node.type)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canUseAIGenerate && (
            <button
              onClick={() => setShowAIModal(true)}
              disabled={isGenerating}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isGenerating
                  ? 'bg-amber-500/20 text-amber-300 cursor-not-allowed'
                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300'
              }`}
              title="AI로 상세 내용 생성"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {isGenerating ? '생성 중...' : 'AI 생성'}
            </button>
          )}
          <button
            onClick={handleDeleteClick}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete node"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Name
          </label>
          <input
            type="text"
            value={node.data.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          />
        </div>

        {/* Description / Prompt */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            {node.type === 'agent' ? 'Prompt' : 'Description'}
          </label>
          <textarea
            value={node.data.description || ''}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            rows={4}
            placeholder={node.type === 'agent' ? 'Enter instructions for this agent...' : 'Describe what this step does...'}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all resize-none"
          />
        </div>

        {/* Type-specific settings */}
        {node.type === 'input' && (
          <InputSettings
            data={node.data as InputNodeData}
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}

        {node.type === 'agent' && (
          <AgentSettings
            data={node.data as AgentNodeData}
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}

        {node.type === 'skill' && (
          <SkillSettings
            data={node.data as SkillNodeData}
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}

        {node.type === 'hook' && (
          <HookSettings
            data={node.data as HookNodeData}
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}

        {node.type === 'output' && (
          <OutputSettings
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4 border border-zinc-700 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">노드 삭제 확인</h3>
            </div>

            <p className="text-zinc-300 mb-4">
              <span className="font-medium text-white">{node.data.label}</span> 노드를 삭제하시겠습니까?
              <br />
              <span className="text-red-400 text-sm">이 작업은 파일을 삭제하며 되돌릴 수 없습니다.</span>
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      {canUseAIGenerate && (
        <AIGenerateModal
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
          nodeType={node.type as 'agent' | 'skill' | 'hook'}
          nodeLabel={node.data.label}
          onSubmit={handleAISubmit}
        />
      )}
    </div>
  );
}

// Input-specific settings
function InputSettings({
  data,
  onUpdate,
}: {
  data: InputNodeData;
  onUpdate: (data: Partial<InputNodeData>) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Input Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {['text', 'file', 'select'].map((type) => (
            <button
              key={type}
              onClick={() => onUpdate({ inputType: type as InputNodeData['inputType'] })}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                data.inputType === type
                  ? 'bg-accent/20 border-accent text-white'
                  : 'bg-surface border-border text-gray-400 hover:border-gray-500'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Default Value
        </label>
        <textarea
          value={data.value || ''}
          onChange={(e) => onUpdate({ value: e.target.value })}
          rows={3}
          placeholder="Enter default value..."
          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
      </div>
    </>
  );
}

// Agent-specific settings
function AgentSettings({
  data,
  onUpdate,
}: {
  data: AgentNodeData;
  onUpdate: (data: Partial<AgentNodeData>) => void;
}) {
  return (
    <>
      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Model
        </label>
        <div className="space-y-2">
          {MODEL_OPTIONS.map((model) => (
            <button
              key={model.id}
              onClick={() => onUpdate({ model: model.id as AgentNodeData['model'] })}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                data.model === model.id
                  ? 'bg-accent/20 border-accent'
                  : 'bg-surface-hover border-border hover:border-gray-500'
              }`}
            >
              <Sparkles className="w-5 h-5 text-purple-400" />
              <div className="text-left">
                <div className="font-medium text-white">{model.name}</div>
                <div className="text-xs text-gray-500">{model.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Allowed Tools
        </label>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_TOOLS.map((tool) => (
            <label
              key={tool}
              className="flex items-center gap-2 p-2 bg-surface-hover rounded-lg cursor-pointer hover:bg-border transition-colors"
            >
              <input
                type="checkbox"
                checked={data.tools?.includes(tool) ?? false}
                onChange={(e) => {
                  const newTools = e.target.checked
                    ? [...(data.tools || []), tool]
                    : (data.tools || []).filter((t) => t !== tool);
                  onUpdate({ tools: newTools });
                }}
                className="rounded border-gray-600 bg-surface text-accent focus:ring-accent"
              />
              <span className="text-sm text-gray-300">{tool}</span>
            </label>
          ))}
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          System Prompt
        </label>
        <textarea
          value={data.systemPrompt || ''}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          rows={4}
          placeholder="Enter custom instructions for this agent..."
          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
      </div>
    </>
  );
}

// Skill file type
interface SkillFile {
  name: string;
  content: string;
  language: string;
}

// Skill test result type
interface SkillTestResult {
  success: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

// Skill-specific settings
function SkillSettings({
  data,
  onUpdate,
}: {
  data: SkillNodeData;
  onUpdate: (data: Partial<SkillNodeData>) => void;
}) {
  const [files, setFiles] = useState<SkillFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [testArgs, setTestArgs] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null);

  // 생성된 스킬인 경우 파일 불러오기
  useEffect(() => {
    if (data.skillType === 'generated' && data.skillPath) {
      setLoading(true);
      fetch(`/api/skill/files?path=${encodeURIComponent(data.skillPath)}`)
        .then((res) => res.json())
        .then((result) => {
          setFiles(result.files || []);
          // 첫 번째 파일 자동 확장
          if (result.files?.length > 0) {
            setExpandedFile(result.files[0].name);
          }
        })
        .catch((err) => {
          console.error('Failed to load skill files:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [data.skillPath, data.skillType]);

  // 스킬 테스트 실행
  const runTest = async () => {
    if (!data.skillPath) return;

    setTesting(true);
    setTestResult(null);

    try {
      const args = testArgs.trim() ? testArgs.trim().split(/\s+/) : [];
      const response = await fetch('/api/skill/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillPath: data.skillPath, args }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setTesting(false);
    }
  };

  // AVAILABLE_SKILLS에서 import하여 Single Source of Truth 유지

  // 생성된 스킬인 경우 미리보기 UI
  if (data.skillType === 'generated' && data.skillPath) {
    return (
      <>
        {/* 스킬 경로 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Skill Path
          </label>
          <div className="px-3 py-2 bg-surface border border-border rounded-lg text-gray-400 text-sm font-mono break-all">
            {data.skillPath}
          </div>
        </div>

        {/* 파일 미리보기 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <FileCode className="w-4 h-4 inline mr-1" />
            Files Preview
          </label>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              파일 로딩 중...
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              파일을 찾을 수 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.name} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedFile(expandedFile === file.name ? null : file.name)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-surface-hover hover:bg-border transition-colors"
                  >
                    <span className="text-sm text-white font-medium">{file.name}</span>
                    {expandedFile === file.name ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedFile === file.name && (
                    <pre className="p-3 bg-[#0d1117] text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto font-mono">
                      {file.content}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 테스트 실행 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <Play className="w-4 h-4 inline mr-1" />
            Test Skill
          </label>

          <div className="space-y-3">
            {/* 인자 입력 */}
            <div>
              <input
                type="text"
                value={testArgs}
                onChange={(e) => setTestArgs(e.target.value)}
                placeholder="Arguments (optional, space-separated)"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* 실행 버튼 */}
            <button
              onClick={runTest}
              disabled={testing}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                testing
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-700 text-white'
              }`}
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  실행 중...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  테스트 실행
                </>
              )}
            </button>

            {/* 결과 표시 */}
            {testResult && (
              <div className={`p-3 rounded-lg border ${
                testResult.success
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={`text-sm font-medium ${
                    testResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {testResult.success ? '성공' : '실패'}
                    {testResult.exitCode !== undefined && ` (exit code: ${testResult.exitCode})`}
                  </span>
                </div>

                {testResult.stdout && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-500 mb-1">Output:</div>
                    <pre className="p-2 bg-black/30 rounded text-xs text-gray-300 overflow-x-auto max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                      {testResult.stdout}
                    </pre>
                  </div>
                )}

                {testResult.stderr && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Error:</div>
                    <pre className="p-2 bg-black/30 rounded text-xs text-red-400 overflow-x-auto max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                      {testResult.stderr}
                    </pre>
                  </div>
                )}

                {testResult.error && (
                  <div className="text-sm text-red-400">
                    {testResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // 일반 스킬 선택 UI
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Skill Type
        </label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {['official', 'custom'].map((type) => (
            <button
              key={type}
              onClick={() => onUpdate({ skillType: type as SkillNodeData['skillType'] })}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                data.skillType === type
                  ? 'bg-accent/20 border-accent text-white'
                  : 'bg-surface border-border text-gray-400 hover:border-gray-500'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Select Skill
        </label>
        <div className="space-y-2">
          {AVAILABLE_SKILLS.map((skill) => (
            <button
              key={skill.id}
              onClick={() => onUpdate({ skillId: skill.id, description: skill.description })}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                data.skillId === skill.id
                  ? 'bg-accent/20 border-accent'
                  : 'bg-surface border-border hover:border-gray-500'
              }`}
            >
              <Zap className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="font-medium text-white">{skill.name}</div>
                <div className="text-xs text-gray-500">{skill.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// Hook-specific settings
function HookSettings({
  data,
  onUpdate,
}: {
  data: HookNodeData;
  onUpdate: (data: Partial<HookNodeData>) => void;
}) {
  const hookEvents = ['PreToolUse', 'PostToolUse', 'Notification', 'Stop'] as const;

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Hook Event
        </label>
        <div className="grid grid-cols-2 gap-2">
          {hookEvents.map((event) => (
            <button
              key={event}
              onClick={() => onUpdate({ hookEvent: event })}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                data.hookEvent === event
                  ? 'bg-accent/20 border-accent text-white'
                  : 'bg-surface border-border text-gray-400 hover:border-gray-500'
              }`}
            >
              {event}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Tool Matcher (optional)
        </label>
        <input
          type="text"
          value={data.hookMatcher || ''}
          onChange={(e) => onUpdate({ hookMatcher: e.target.value })}
          placeholder="e.g., Bash, Write, Edit"
          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="mt-1 text-xs text-gray-500">Filter by tool name pattern</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Hook Command
        </label>
        <input
          type="text"
          value={data.hookCommand || ''}
          onChange={(e) => onUpdate({ hookCommand: e.target.value })}
          placeholder="e.g., npm run lint"
          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="mt-1 text-xs text-gray-500">Shell command to execute</p>
      </div>
    </>
  );
}

// Output-specific settings
function OutputSettings({
  onUpdate,
}: {
  onUpdate: (data: any) => void;
}) {
  const layoutOptions = [
    { id: 'auto', name: 'Auto Format', description: 'Automatically format output' },
    { id: 'markdown', name: 'Markdown', description: 'Plain markdown text' },
    { id: 'document', name: 'Document', description: 'Formatted document output' },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">
        Output Format
      </label>
      <div className="space-y-2">
        {layoutOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onUpdate({ layoutType: option.id })}
            className="w-full flex items-center gap-3 p-3 rounded-lg border bg-surface-hover border-border hover:border-gray-500 transition-colors text-left"
          >
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="font-medium text-white">{option.name}</div>
              <div className="text-xs text-gray-500">{option.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
