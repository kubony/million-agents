import Anthropic from '@anthropic-ai/sdk';

// API 설정 타입
export interface ApiSettings {
  apiMode: 'proxy' | 'direct';
  apiKey?: string;
  proxyUrl?: string;
}

// AI가 생성하는 워크플로우 결과 타입
export interface AIWorkflowResult {
  workflowName: string;
  description: string;
  nodes: AIGeneratedNode[];
  edges: { from: number; to: number }[];
}

export interface AIGeneratedNode {
  type: 'input' | 'subagent' | 'skill' | 'mcp' | 'output';
  label: string;
  description: string;
  config: {
    // input
    inputType?: 'text' | 'file' | 'select';
    placeholder?: string;
    // subagent
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

## 사용 가능한 도구 (subagent의 tools에 사용)
${AVAILABLE_TOOLS.join(', ')}

## 응답 형식 (JSON)
반드시 아래 형식의 유효한 JSON으로 응답하세요. 다른 텍스트 없이 JSON만 반환하세요.

{
  "workflowName": "워크플로우 이름 (한글 가능)",
  "description": "워크플로우 설명",
  "nodes": [
    {
      "type": "input",
      "label": "입력 노드 이름",
      "description": "입력 설명",
      "config": {
        "inputType": "text",
        "placeholder": "입력 안내"
      }
    },
    {
      "type": "subagent",
      "label": "에이전트 이름",
      "description": "에이전트 역할 설명",
      "config": {
        "role": "researcher|writer|analyst|coder|custom",
        "tools": ["Read", "Write"],
        "model": "sonnet",
        "systemPrompt": "에이전트의 구체적인 지시사항"
      }
    },
    {
      "type": "skill",
      "label": "스킬 이름",
      "description": "스킬 설명",
      "config": {
        "skillType": "official",
        "skillId": "image-gen-nanobanana"
      }
    },
    {
      "type": "skill",
      "label": "커스텀 스킬 이름",
      "description": "커스텀 스킬 설명",
      "config": {
        "skillType": "custom",
        "skillId": "my-custom-skill",
        "skillContent": "---\\nname: my-custom-skill\\ndescription: 커스텀 스킬 설명\\n---\\n\\n# 스킬 내용\\n\\n구체적인 지시사항..."
      }
    },
    {
      "type": "output",
      "label": "출력 이름",
      "description": "출력 설명",
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
4. subagent는 복잡한 추론이나 다단계 작업에 사용
5. edges의 from/to는 nodes 배열의 인덱스 (0부터 시작)
6. 순차적으로 연결되지 않아도 됨 (병렬 처리, 합류 가능)
7. systemPrompt는 구체적이고 실행 가능한 지시사항으로 작성

## 예시

### 예시 1: "이미지 3개 만들어줘"
{
  "workflowName": "이미지 생성",
  "description": "3개의 이미지를 생성하는 워크플로우",
  "nodes": [
    { "type": "input", "label": "이미지 설명", "description": "생성할 이미지에 대한 설명", "config": { "inputType": "text", "placeholder": "이미지 프롬프트 입력" } },
    { "type": "skill", "label": "이미지 생성기", "description": "AI로 이미지 생성", "config": { "skillType": "official", "skillId": "image-gen-nanobanana" } },
    { "type": "output", "label": "생성된 이미지", "description": "생성된 이미지 결과", "config": { "outputType": "image" } }
  ],
  "edges": [{ "from": 0, "to": 1 }, { "from": 1, "to": 2 }]
}

### 예시 2: "데이터 분석해서 보고서 만들어줘"
{
  "workflowName": "데이터 분석 보고서",
  "description": "데이터를 분석하고 보고서를 작성하는 워크플로우",
  "nodes": [
    { "type": "input", "label": "데이터 파일", "description": "분석할 데이터 파일", "config": { "inputType": "file" } },
    { "type": "subagent", "label": "데이터 분석가", "description": "데이터를 분석하고 인사이트 도출", "config": { "role": "analyst", "tools": ["Read", "Grep", "Glob"], "model": "sonnet", "systemPrompt": "주어진 데이터를 분석하여 핵심 인사이트를 도출하세요. 통계적 요약, 트렌드, 이상치를 파악하세요." } },
    { "type": "subagent", "label": "보고서 작성자", "description": "분석 결과로 보고서 작성", "config": { "role": "writer", "tools": ["Read", "Write"], "model": "opus", "systemPrompt": "분석 결과를 바탕으로 경영진을 위한 간결하고 명확한 보고서를 작성하세요." } },
    { "type": "output", "label": "분석 보고서", "description": "최종 분석 보고서", "config": { "outputType": "document" } }
  ],
  "edges": [{ "from": 0, "to": 1 }, { "from": 1, "to": 2 }, { "from": 2, "to": 3 }]
}
`;

export class WorkflowAIService {
  private getClient(settings?: ApiSettings): Anthropic {
    // 1. Direct mode with user-provided API key
    if (settings?.apiMode === 'direct' && settings.apiKey) {
      return new Anthropic({
        apiKey: settings.apiKey,
      });
    }

    // 2. Proxy mode with custom base URL
    if (settings?.apiMode === 'proxy' && settings.proxyUrl) {
      return new Anthropic({
        baseURL: settings.proxyUrl,
        // Proxy server handles the API key
        apiKey: process.env.ANTHROPIC_API_KEY || 'proxy-mode',
      });
    }

    // 3. Default: use environment variable
    const envApiKey = process.env.ANTHROPIC_API_KEY;
    if (!envApiKey) {
      throw new Error('API 키가 설정되지 않았습니다. 설정에서 API 키를 입력하거나 프록시 서버를 설정하세요.');
    }

    return new Anthropic({
      apiKey: envApiKey,
    });
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
}

export const workflowAIService = new WorkflowAIService();
