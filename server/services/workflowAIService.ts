import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import { join } from 'path';
import { skillGeneratorService } from './skillGeneratorService';

// API 설정 타입
export interface ApiSettings {
  apiMode: 'proxy' | 'direct';
  apiKey?: string;
  proxyUrl?: string;
  projectPath?: string; // makecc 프로젝트 경로 (스킬/에이전트 저장 위치)
}

// 진행 상황 콜백
export type WorkflowProgressCallback = (event: {
  step: 'workflow' | 'skill' | 'agent' | 'completed';
  message: string;
  current?: number;
  total?: number;
}) => void;

// AI가 생성하는 워크플로우 결과 타입
export interface AIWorkflowResult {
  workflowName: string;
  description: string;
  nodes: AIGeneratedNode[];
  edges: { from: number; to: number }[];
}

export interface AIGeneratedNode {
  type: 'input' | 'agent' | 'skill' | 'mcp' | 'output';
  label: string;
  description: string;
  config: {
    // input
    inputType?: 'text' | 'file' | 'select';
    placeholder?: string;
    defaultValue?: string; // 기본 입력값
    // agent
    role?: string;
    tools?: string[];
    model?: string;
    systemPrompt?: string;
    // skill
    skillType?: 'official' | 'custom';
    skillId?: string;
    skillContent?: string; // 커스텀 스킬 SKILL.md 내용
    // output
    outputType?: 'auto' | 'markdown' | 'document' | 'image';
  };
}

// 사용 가능한 공식 스킬 목록
const AVAILABLE_SKILLS = [
  { id: 'image-gen-nanobanana', name: 'Image Generator', description: 'Google Gemini 기반 AI 이미지 생성' },
  { id: 'ppt-generator', name: 'PPT Generator', description: '한국어에 최적화된 미니멀 프레젠테이션 생성' },
  { id: 'video-gen-veo3', name: 'Video Generator', description: 'Google Veo3 기반 AI 영상 생성' },
  { id: 'pdf', name: 'PDF', description: 'PDF 텍스트 추출, 생성, 병합/분할, 폼 처리' },
  { id: 'docx', name: 'Word Document', description: 'Word 문서 생성, 편집, 변경 추적' },
  { id: 'xlsx', name: 'Excel', description: '스프레드시트 생성, 편집, 수식, 데이터 분석' },
  { id: 'pptx', name: 'PowerPoint', description: 'PPT 생성, 편집, 레이아웃, 스피커 노트' },
  { id: 'git-commit-push', name: 'Git Commit/Push', description: 'Git 커밋 메시지 작성 및 푸시/PR 생성' },
];

// 사용 가능한 도구 목록
const AVAILABLE_TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebSearch', 'WebFetch', 'Task', 'TodoWrite',
];

const SYSTEM_PROMPT = `당신은 Claude Code 워크플로우 설계 전문가입니다.

사용자의 워크플로우 설명을 분석하여 적절한 노드들과 연결을 생성합니다.

## 사용 가능한 공식 스킬
${AVAILABLE_SKILLS.map(s => `- ${s.id}: ${s.description}`).join('\n')}

## 사용 가능한 도구 (agent의 tools에 사용)
${AVAILABLE_TOOLS.join(', ')}

## 응답 형식 (JSON)
반드시 아래 형식의 유효한 JSON으로 응답하세요. 다른 텍스트 없이 JSON만 반환하세요.

{
  "workflowName": "Workflow Name in English",
  "description": "워크플로우 설명 (한글 가능)",
  "nodes": [
    {
      "type": "input",
      "label": "input-name-in-english",
      "description": "입력 설명 (한글 가능)",
      "config": {
        "inputType": "text",
        "placeholder": "입력 안내",
        "defaultValue": "워크플로우에 적합한 예시 입력값"
      }
    },
    {
      "type": "agent",
      "label": "agent-name-in-english",
      "description": "에이전트 역할 설명 (한글 가능)",
      "config": {
        "role": "researcher|writer|analyst|coder|custom",
        "tools": ["Read", "Write"],
        "model": "sonnet",
        "systemPrompt": "에이전트의 구체적인 지시사항"
      }
    },
    {
      "type": "skill",
      "label": "skill-name-in-english",
      "description": "스킬 설명 (한글 가능)",
      "config": {
        "skillType": "official",
        "skillId": "image-gen-nanobanana"
      }
    },
    {
      "type": "skill",
      "label": "custom-skill-name",
      "description": "커스텀 스킬 설명 (한글 가능)",
      "config": {
        "skillType": "custom",
        "skillId": "my-custom-skill",
        "skillContent": "---\\nname: my-custom-skill\\ndescription: Custom skill description\\n---\\n\\n# Skill Instructions\\n\\nSpecific instructions..."
      }
    },
    {
      "type": "output",
      "label": "output-name-in-english",
      "description": "출력 설명 (한글 가능)",
      "config": {
        "outputType": "auto|markdown|document|image"
      }
    }
  ],
  "edges": [
    { "from": 0, "to": 1 },
    { "from": 1, "to": 2 }
  ]
}

## 규칙
1. 항상 input 노드로 시작하고 output 노드로 종료
2. 기존 공식 스킬로 가능하면 official 스킬 사용
3. 새로운 기능이 필요하면 custom 스킬 생성 (skillContent에 SKILL.md 형식)
4. agent는 복잡한 추론이나 다단계 작업에 사용
5. edges의 from/to는 nodes 배열의 인덱스 (0부터 시작)
6. 순차적으로 연결되지 않아도 됨 (병렬 처리, 합류 가능)
7. systemPrompt는 구체적이고 실행 가능한 지시사항으로 작성
8. **중요: label은 반드시 영어로, kebab-case 형식으로 작성 (예: blog-writer, data-analyzer)**
9. workflowName도 영어로 작성
10. **필수: input 노드의 config에 반드시 defaultValue 포함 - 워크플로우 목적에 맞는 구체적인 예시 값을 한글로 제공**

## 예시

### 예시 1: "이미지 3개 만들어줘"
{
  "workflowName": "Image Generation",
  "description": "3개의 이미지를 생성하는 워크플로우",
  "nodes": [
    { "type": "input", "label": "image-prompt", "description": "생성할 이미지에 대한 설명", "config": { "inputType": "text", "placeholder": "이미지 프롬프트 입력", "defaultValue": "미래적인 도시 야경, 네온 사인이 빛나는 사이버펑크 스타일" } },
    { "type": "skill", "label": "image-generator", "description": "AI로 이미지 생성", "config": { "skillType": "official", "skillId": "image-gen-nanobanana" } },
    { "type": "output", "label": "generated-images", "description": "생성된 이미지 결과", "config": { "outputType": "image" } }
  ],
  "edges": [{ "from": 0, "to": 1 }, { "from": 1, "to": 2 }]
}

### 예시 2: "데이터 분석해서 보고서 만들어줘"
{
  "workflowName": "Data Analysis Report",
  "description": "데이터를 분석하고 보고서를 작성하는 워크플로우",
  "nodes": [
    { "type": "input", "label": "data-file", "description": "분석할 데이터 파일", "config": { "inputType": "file", "defaultValue": "2024년 1~3분기 매출 데이터: 1월 1200만, 2월 1350만, 3월 1100만, 4월 1500만, 5월 1650만, 6월 1400만, 7월 1800만, 8월 1750만, 9월 1900만" } },
    { "type": "agent", "label": "data-analyzer", "description": "데이터를 분석하고 인사이트 도출", "config": { "role": "analyst", "tools": ["Read", "Grep", "Glob"], "model": "sonnet", "systemPrompt": "주어진 데이터를 분석하여 핵심 인사이트를 도출하세요. 통계적 요약, 트렌드, 이상치를 파악하세요." } },
    { "type": "agent", "label": "report-writer", "description": "분석 결과로 보고서 작성", "config": { "role": "writer", "tools": ["Read", "Write"], "model": "opus", "systemPrompt": "분석 결과를 바탕으로 경영진을 위한 간결하고 명확한 보고서를 작성하세요." } },
    { "type": "output", "label": "analysis-report", "description": "최종 분석 보고서", "config": { "outputType": "document" } }
  ],
  "edges": [{ "from": 0, "to": 1 }, { "from": 1, "to": 2 }, { "from": 2, "to": 3 }]
}
`;

export class WorkflowAIService {
  private getClient(settings?: ApiSettings): Anthropic {
    const DEFAULT_ANTHROPIC_URL = 'https://api.anthropic.com';

    // 1. 프록시 우선: proxyUrl이 설정되어 있고, 기본 Anthropic URL이 아닌 경우
    //    프록시 서버가 API 키를 관리하므로 클라이언트는 키 불필요
    if (settings?.proxyUrl && settings.proxyUrl !== DEFAULT_ANTHROPIC_URL) {
      console.log(`Using proxy server: ${settings.proxyUrl}`);
      return new Anthropic({
        baseURL: settings.proxyUrl,
        apiKey: 'proxy-mode', // 프록시 서버가 실제 키를 관리
      });
    }

    // 2. 환경변수에 API 키가 있으면 직접 호출
    const envApiKey = process.env.ANTHROPIC_API_KEY;
    if (envApiKey) {
      console.log('Using API key from environment variable');
      return new Anthropic({ apiKey: envApiKey });
    }

    // 3. UI에서 direct 모드로 API 키를 직접 입력한 경우
    if (settings?.apiMode === 'direct' && settings.apiKey) {
      console.log('Using API key from UI settings');
      return new Anthropic({ apiKey: settings.apiKey });
    }

    // 4. 아무것도 없으면 에러
    throw new Error(
      'API 키가 설정되지 않았습니다.\n' +
      '해결 방법:\n' +
      '1. 프록시 서버 URL을 설정하거나\n' +
      '2. 프로젝트 .env 파일에 ANTHROPIC_API_KEY를 추가하거나\n' +
      '3. 설정에서 Direct 모드로 API 키를 직접 입력하세요.'
    );
  }

  async generate(prompt: string, settings?: ApiSettings): Promise<AIWorkflowResult> {
    const client = this.getClient(settings);

    const userPrompt = `다음 워크플로우를 설계해주세요: "${prompt}"

반드시 JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 응답하세요.`;

    let responseText = '';

    // Anthropic SDK 사용
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // 응답에서 텍스트 추출
    for (const block of response.content) {
      if (block.type === 'text') {
        responseText += block.text;
      }
    }

    if (!responseText) {
      throw new Error('AI 응답을 받지 못했습니다.');
    }

    // JSON 블록이 있으면 추출
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const rawJson = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

    try {
      const result = JSON.parse(rawJson) as AIWorkflowResult;
      return this.validateAndNormalize(result);
    } catch (error) {
      console.error('Failed to parse AI response:', rawJson);
      throw new Error('AI 응답을 파싱하는데 실패했습니다. 다시 시도해주세요.');
    }
  }

  private validateAndNormalize(result: AIWorkflowResult): AIWorkflowResult {
    // 필수 필드 검증
    if (!result.workflowName) {
      result.workflowName = 'AI Generated Workflow';
    }
    if (!result.nodes || result.nodes.length === 0) {
      throw new Error('노드가 생성되지 않았습니다.');
    }
    if (!result.edges) {
      result.edges = [];
    }

    // 노드 정규화
    result.nodes = result.nodes.map((node, index) => ({
      ...node,
      label: node.label || `Node ${index + 1}`,
      description: node.description || '',
      config: node.config || {},
    }));

    // 엣지 검증 (범위 체크)
    result.edges = result.edges.filter(
      (edge) =>
        edge.from >= 0 &&
        edge.from < result.nodes.length &&
        edge.to >= 0 &&
        edge.to < result.nodes.length
    );

    return result;
  }

  /**
   * 워크플로우 생성 + 재귀적 노드 확장
   * 각 custom 스킬과 에이전트에 대해 상세 내용 생성
   */
  async generateWithExpansion(
    prompt: string,
    settings?: ApiSettings,
    onProgress?: WorkflowProgressCallback
  ): Promise<AIWorkflowResult> {
    // 1. 워크플로우 구조 생성
    onProgress?.({ step: 'workflow', message: '워크플로우 구조를 생성하고 있습니다...' });
    const result = await this.generate(prompt, settings);

    // 2. 확장이 필요한 노드 식별
    const customSkills = result.nodes.filter(
      (n) => n.type === 'skill' && n.config.skillType === 'custom'
    );
    const agents = result.nodes.filter((n) => n.type === 'agent');

    const totalExpansions = customSkills.length + agents.length;
    let current = 0;

    // 3. 각 custom 스킬 확장
    for (const skill of customSkills) {
      current++;
      onProgress?.({
        step: 'skill',
        message: `스킬 "${skill.label}" 상세 생성 중...`,
        current,
        total: totalExpansions,
      });

      try {
        // skillGeneratorService를 사용하여 완전한 스킬 생성
        const skillPrompt = this.buildSkillPrompt(skill, result);
        const skillResult = await skillGeneratorService.generate(skillPrompt, settings);

        if (skillResult.success && skillResult.skill) {
          // 생성된 스킬 정보로 노드 업데이트
          skill.config.skillId = skillResult.skill.skillId;
          skill.config.skillContent = undefined; // 파일로 저장되었으므로 제거
          // savedPath는 로그로만 출력 (타입에 없음)
          console.log(`Skill saved to: ${skillResult.savedPath}`);
        }
      } catch (error) {
        console.error(`Failed to expand skill ${skill.label}:`, error);
        // 실패해도 계속 진행
      }
    }

    // 4. 각 에이전트 확장 (상세 systemPrompt 생성) + 파일 저장
    for (const agent of agents) {
      current++;
      onProgress?.({
        step: 'agent',
        message: `에이전트 "${agent.label}" 상세 생성 중...`,
        current,
        total: totalExpansions,
      });

      try {
        const expandedPrompt = await this.expandAgentPrompt(agent, result, settings);
        agent.config.systemPrompt = expandedPrompt;

        // 에이전트 파일로 저장
        if (settings?.projectPath) {
          await this.saveAgentFile(agent, expandedPrompt, settings.projectPath);
        }
      } catch (error) {
        console.error(`Failed to expand agent ${agent.label}:`, error);
        // 실패해도 계속 진행
      }
    }

    onProgress?.({ step: 'completed', message: '워크플로우 생성 완료!' });
    return result;
  }

  /**
   * 스킬 생성을 위한 상세 프롬프트 빌드
   */
  private buildSkillPrompt(skill: AIGeneratedNode, workflow: AIWorkflowResult): string {
    // 워크플로우에서 이 스킬의 연결 관계 파악
    const skillIndex = workflow.nodes.indexOf(skill);
    const upstreamNodes = workflow.edges
      .filter((e) => e.to === skillIndex)
      .map((e) => workflow.nodes[e.from]);
    const downstreamNodes = workflow.edges
      .filter((e) => e.from === skillIndex)
      .map((e) => workflow.nodes[e.to]);

    const contextParts = [
      `스킬 이름: ${skill.label}`,
      `설명: ${skill.description}`,
      `워크플로우: ${workflow.workflowName}`,
    ];

    if (upstreamNodes.length > 0) {
      contextParts.push(
        `이전 단계: ${upstreamNodes.map((n) => `${n.label} (${n.type})`).join(', ')}`
      );
    }

    if (downstreamNodes.length > 0) {
      contextParts.push(
        `다음 단계: ${downstreamNodes.map((n) => `${n.label} (${n.type})`).join(', ')}`
      );
    }

    if (skill.config.skillContent) {
      contextParts.push(`기본 내용:\n${skill.config.skillContent}`);
    }

    return `다음 스킬을 생성해주세요:\n\n${contextParts.join('\n')}`;
  }

  /**
   * 에이전트의 systemPrompt를 상세하게 확장
   */
  private async expandAgentPrompt(
    agent: AIGeneratedNode,
    workflow: AIWorkflowResult,
    settings?: ApiSettings
  ): Promise<string> {
    const client = this.getClient(settings);

    // 워크플로우에서 이 에이전트의 연결 관계 파악
    const agentIndex = workflow.nodes.indexOf(agent);
    const upstreamNodes = workflow.edges
      .filter((e) => e.to === agentIndex)
      .map((e) => workflow.nodes[e.from]);
    const downstreamNodes = workflow.edges
      .filter((e) => e.from === agentIndex)
      .map((e) => workflow.nodes[e.to]);

    const systemPrompt = `You are an expert at writing detailed system prompts for AI agents.
Given an agent's context, generate a comprehensive system prompt that:
1. Clearly defines the agent's role and responsibilities
2. Specifies input/output expectations
3. Provides step-by-step instructions
4. Includes best practices and constraints
5. Is written in Korean for user-facing parts

Respond with ONLY the system prompt text, no explanations or formatting.`;

    const userPrompt = `워크플로우: ${workflow.workflowName}
워크플로우 설명: ${workflow.description}

에이전트 정보:
- 이름: ${agent.label}
- 설명: ${agent.description}
- 역할: ${agent.config.role || 'custom'}
- 도구: ${(agent.config.tools || []).join(', ')}
- 모델: ${agent.config.model || 'sonnet'}

${upstreamNodes.length > 0 ? `이전 단계에서 받는 입력:\n${upstreamNodes.map((n) => `- ${n.label}: ${n.description}`).join('\n')}` : ''}

${downstreamNodes.length > 0 ? `다음 단계로 전달할 출력:\n${downstreamNodes.map((n) => `- ${n.label}: ${n.description}`).join('\n')}` : ''}

${agent.config.systemPrompt ? `기존 프롬프트 (확장 필요):\n${agent.config.systemPrompt}` : ''}

이 에이전트를 위한 상세하고 실행 가능한 system prompt를 작성해주세요.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let result = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        result += block.text;
      }
    }

    return result.trim() || agent.config.systemPrompt || agent.description;
  }

  /**
   * 에이전트를 .claude/agents/에이전트명.md 파일로 저장
   */
  private async saveAgentFile(
    agent: AIGeneratedNode,
    systemPrompt: string,
    projectPath: string
  ): Promise<void> {
    const agentName = agent.label
      .toLowerCase()
      .replace(/[^a-z0-9가-힣-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const agentsDir = join(projectPath, '.claude', 'agents');
    const agentPath = join(agentsDir, `${agentName}.md`);

    await fs.mkdir(agentsDir, { recursive: true });

    // Frontmatter 구성
    const tools = agent.config.tools?.join(', ') || 'Read, Write, Bash';
    const model = agent.config.model || 'sonnet';

    const content = `---
name: ${agentName}
description: ${agent.description || agent.label}
tools: ${tools}
model: ${model}
---

${systemPrompt}
`;

    await fs.writeFile(agentPath, content, 'utf-8');
    console.log(`Saved agent to: ${agentPath}`);
  }
}

export const workflowAIService = new WorkflowAIService();
