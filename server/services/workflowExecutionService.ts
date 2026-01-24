import Anthropic from '@anthropic-ai/sdk';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type {
  ExecutionNode,
  SubagentNodeData,
  SkillNodeData,
  InputNodeData,
  OutputNodeData,
  McpNodeData,
  NodeExecutionUpdate,
} from '../types';

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface ExecutionContext {
  workflowId: string;
  workflowName: string;
  nodes: ExecutionNode[];
  edges: WorkflowEdge[];
  inputs?: Record<string, string>;
  outputDir: string;
}

export interface ExecutionResult {
  nodeId: string;
  success: boolean;
  result?: string;
  files?: Array<{ path: string; type: string; name: string }>;
  error?: string;
}

type ProgressCallback = (update: NodeExecutionUpdate) => void;
type LogCallback = (type: 'info' | 'warn' | 'error' | 'debug', message: string) => void;

/**
 * Anthropic API를 사용한 워크플로우 실행 서비스
 */
export class WorkflowExecutionService {
  private client: Anthropic;
  private results: Map<string, ExecutionResult> = new Map();
  private outputDir: string = '';

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * 워크플로우 전체 실행
   */
  async execute(
    context: ExecutionContext,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<Map<string, ExecutionResult>> {
    this.results.clear();
    this.outputDir = context.outputDir;

    // 출력 디렉토리 생성
    if (!existsSync(this.outputDir)) {
      await mkdir(this.outputDir, { recursive: true });
    }

    const executionOrder = this.topologicalSort(context.nodes, context.edges);

    onLog?.('info', `워크플로우 "${context.workflowName}" 실행 시작 (${executionOrder.length}개 노드)`);

    for (const node of executionOrder) {
      try {
        onProgress?.({ nodeId: node.id, status: 'running', progress: 0 });
        onLog?.('info', `노드 "${node.data.label}" 실행 중...`);

        const result = await this.executeNode(node, context, onProgress, onLog);
        this.results.set(node.id, result);

        if (result.success) {
          onProgress?.({ nodeId: node.id, status: 'completed', progress: 100, result: result.result });
          onLog?.('info', `노드 "${node.data.label}" 완료`);
        } else {
          onProgress?.({ nodeId: node.id, status: 'error', error: result.error });
          onLog?.('error', `노드 "${node.data.label}" 실패: ${result.error}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.results.set(node.id, { nodeId: node.id, success: false, error: errorMessage });
        onProgress?.({ nodeId: node.id, status: 'error', error: errorMessage });
        onLog?.('error', `노드 "${node.data.label}" 실행 오류: ${errorMessage}`);
      }
    }

    return this.results;
  }

  /**
   * 개별 노드 실행
   */
  private async executeNode(
    node: ExecutionNode,
    context: ExecutionContext,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    // 이전 노드 결과 수집
    const previousResults = this.collectPreviousResults(node, context.edges);

    switch (node.type) {
      case 'input':
        return this.executeInputNode(node, context.inputs);

      case 'subagent':
        return this.executeSubagentNode(node, previousResults, onProgress, onLog);

      case 'skill':
        return this.executeSkillNode(node, previousResults, onProgress, onLog);

      case 'mcp':
        return this.executeMcpNode(node, previousResults, onProgress, onLog);

      case 'output':
        return this.executeOutputNode(node, previousResults, onLog);

      default:
        return { nodeId: node.id, success: false, error: `Unknown node type: ${node.type}` };
    }
  }

  /**
   * Input 노드 실행 - 사용자 입력값 반환
   */
  private async executeInputNode(
    node: ExecutionNode,
    inputs?: Record<string, string>
  ): Promise<ExecutionResult> {
    const data = node.data as InputNodeData;
    const value = inputs?.[node.id] || data.value || '';

    return {
      nodeId: node.id,
      success: true,
      result: value,
    };
  }

  /**
   * Subagent 노드 실행 - Claude API로 작업 수행
   */
  private async executeSubagentNode(
    node: ExecutionNode,
    previousResults: string,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    const data = node.data as SubagentNodeData;

    onProgress?.({ nodeId: node.id, status: 'running', progress: 20 });

    // 역할별 시스템 프롬프트
    const rolePrompts: Record<string, string> = {
      researcher: `당신은 전문 리서처입니다. 주어진 주제에 대해 깊이 있는 조사를 수행하고, 핵심 정보를 정리하여 제공합니다.`,
      writer: `당신은 전문 작가입니다. 명확하고 매력적인 콘텐츠를 작성합니다. 사용자의 요구에 맞는 톤과 스타일로 글을 작성합니다.`,
      analyst: `당신은 데이터 분석가입니다. 정보를 분석하고 패턴을 파악하여 인사이트를 도출합니다.`,
      coder: `당신은 전문 개발자입니다. 깔끔하고 효율적인 코드를 작성하며, 모범 사례를 따릅니다.`,
      designer: `당신은 디자인 전문가입니다. 상세페이지, 배너, UI 등을 위한 디자인 가이드와 컨셉을 제안합니다.`,
      custom: `당신은 AI 어시스턴트입니다. 주어진 작업을 최선을 다해 수행합니다.`,
    };

    const systemPrompt = data.systemPrompt || rolePrompts[data.role] || rolePrompts.custom;

    const userMessage = `## 작업 설명
${data.description || '주어진 작업을 수행해주세요.'}

## 이전 단계 결과
${previousResults || '(없음)'}

위 내용을 바탕으로 작업을 수행하고 결과를 제공해주세요.`;

    onLog?.('debug', `Subagent "${data.label}" (${data.role}) 호출 중...`);

    try {
      onProgress?.({ nodeId: node.id, status: 'running', progress: 40 });

      const modelId = this.getModelId(data.model);

      const response = await this.client.messages.create({
        model: modelId,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ],
      });

      onProgress?.({ nodeId: node.id, status: 'running', progress: 80 });

      // 응답 텍스트 추출
      const resultText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      onProgress?.({ nodeId: node.id, status: 'running', progress: 100 });

      return {
        nodeId: node.id,
        success: true,
        result: resultText,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Claude API 호출 실패';
      onLog?.('error', `Subagent 오류: ${errorMsg}`);
      return {
        nodeId: node.id,
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Skill 노드 실행 - 특화된 스킬 실행
   */
  private async executeSkillNode(
    node: ExecutionNode,
    previousResults: string,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    const data = node.data as SkillNodeData;
    const skillId = data.skillId;

    onProgress?.({ nodeId: node.id, status: 'running', progress: 10 });
    onLog?.('info', `스킬 "${skillId}" 실행 중...`);

    switch (skillId) {
      case 'image-gen-nanobanana':
        return this.executeImageGenerationSkill(node, previousResults, onProgress, onLog);

      case 'ppt-generator':
        return this.executePptGeneratorSkill(node, previousResults, onProgress, onLog);

      default:
        // 일반 스킬: Claude를 사용해 스킬 작업 수행
        return this.executeGenericSkill(node, previousResults, onProgress, onLog);
    }
  }

  /**
   * 이미지 생성 스킬 (상세페이지 이미지 세트)
   */
  private async executeImageGenerationSkill(
    node: ExecutionNode,
    previousResults: string,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    onLog?.('info', '상세페이지 이미지 세트 생성 중...');

    // 1단계: Claude로 이미지 프롬프트 생성
    const promptGenerationMsg = `당신은 상세페이지 이미지 기획 전문가입니다.

## 요청 내용
${previousResults}

## 작업
위 요청을 바탕으로 상세페이지에 필요한 이미지 세트를 기획해주세요.

다음 형식으로 각 이미지에 대한 상세 프롬프트를 작성해주세요:

### 1. 메인 배너 이미지 (1920x600)
- 목적: [이미지 목적]
- 프롬프트: [상세한 이미지 생성 프롬프트 - 영문으로]
- 스타일: [스타일 키워드]

### 2. 상품 메인 이미지 (800x800)
- 목적: [이미지 목적]
- 프롬프트: [상세한 이미지 생성 프롬프트 - 영문으로]
- 스타일: [스타일 키워드]

### 3. 라이프스타일 이미지 (1200x800)
- 목적: [이미지 목적]
- 프롬프트: [상세한 이미지 생성 프롬프트 - 영문으로]
- 스타일: [스타일 키워드]

### 4. 특징/기능 설명 이미지 (600x400) x 3개
- 각 이미지별 프롬프트 작성

프롬프트는 반드시 영문으로 작성하고, 구체적이고 시각적으로 묘사해주세요.`;

    try {
      onProgress?.({ nodeId: node.id, status: 'running', progress: 20 });

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: promptGenerationMsg }],
      });

      const imagePrompts = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      onProgress?.({ nodeId: node.id, status: 'running', progress: 50 });

      // 2단계: Gemini API로 실제 이미지 생성 (API 키가 있는 경우)
      const generatedFiles: Array<{ path: string; type: string; name: string }> = [];

      if (process.env.GEMINI_API_KEY) {
        onLog?.('info', 'Gemini API로 이미지 생성 중...');
        // TODO: Gemini API 이미지 생성 구현
        // 현재는 프롬프트만 반환
      } else {
        onLog?.('warn', 'GEMINI_API_KEY가 설정되지 않아 이미지 프롬프트만 생성합니다.');
      }

      // 결과 파일 저장
      const resultPath = join(this.outputDir, 'image-prompts.md');
      await writeFile(resultPath, `# 상세페이지 이미지 세트 프롬프트\n\n${imagePrompts}`, 'utf-8');

      generatedFiles.push({
        path: resultPath,
        type: 'markdown',
        name: '이미지 프롬프트',
      });

      onProgress?.({ nodeId: node.id, status: 'running', progress: 100 });

      return {
        nodeId: node.id,
        success: true,
        result: imagePrompts,
        files: generatedFiles,
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : '이미지 생성 실패',
      };
    }
  }

  /**
   * PPT 생성 스킬
   */
  private async executePptGeneratorSkill(
    node: ExecutionNode,
    previousResults: string,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    onLog?.('info', 'PPT 콘텐츠 생성 중...');

    const pptPrompt = `당신은 프레젠테이션 전문가입니다.

## 요청 내용
${previousResults}

## 작업
위 내용을 바탕으로 전문적인 프레젠테이션 슬라이드 구성을 작성해주세요.

각 슬라이드에 대해 다음 형식으로 작성:

### 슬라이드 1: [제목]
- 메인 텍스트: [핵심 내용]
- 서브 텍스트: [보조 설명]
- 비주얼 가이드: [권장 이미지/그래픽 설명]
- 스피커 노트: [발표 시 참고 내용]

전체 10-15개 슬라이드로 구성해주세요.`;

    try {
      onProgress?.({ nodeId: node.id, status: 'running', progress: 30 });

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: pptPrompt }],
      });

      const pptContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // 결과 파일 저장
      const resultPath = join(this.outputDir, 'presentation.md');
      await writeFile(resultPath, `# 프레젠테이션 슬라이드\n\n${pptContent}`, 'utf-8');

      onProgress?.({ nodeId: node.id, status: 'running', progress: 100 });

      return {
        nodeId: node.id,
        success: true,
        result: pptContent,
        files: [{ path: resultPath, type: 'markdown', name: 'PPT 슬라이드' }],
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'PPT 생성 실패',
      };
    }
  }

  /**
   * 일반 스킬 실행 (Claude 기반)
   */
  private async executeGenericSkill(
    node: ExecutionNode,
    previousResults: string,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    const data = node.data as SkillNodeData;

    const skillPrompt = `스킬: ${data.label}
설명: ${data.description || ''}

## 이전 단계 결과
${previousResults}

## 스킬 내용
${data.mdContent || '주어진 작업을 수행해주세요.'}

위 내용을 바탕으로 작업을 수행하고 결과를 제공해주세요.`;

    try {
      onProgress?.({ nodeId: node.id, status: 'running', progress: 50 });

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: skillPrompt }],
      });

      const result = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      return {
        nodeId: node.id,
        success: true,
        result,
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : '스킬 실행 실패',
      };
    }
  }

  /**
   * MCP 노드 실행 - 외부 도구/서비스 연결
   */
  private async executeMcpNode(
    node: ExecutionNode,
    previousResults: string,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    const data = node.data as McpNodeData;

    onProgress?.({ nodeId: node.id, status: 'running', progress: 10 });
    onLog?.('info', `MCP 서버 "${data.serverName}" 연결 중...`);

    // MCP 서버 타입별 처리
    const mcpPrompt = `당신은 MCP (Model Context Protocol) 서버와 상호작용하는 전문가입니다.

## MCP 서버 정보
- 서버 이름: ${data.serverName}
- 서버 타입: ${data.serverType}
- 설정: ${JSON.stringify(data.serverConfig, null, 2)}

## 이전 단계 결과
${previousResults}

## 작업
위 MCP 서버를 사용하여 이전 단계의 결과를 처리하세요.

다음 MCP 서버 유형에 따라 적절한 작업을 수행하세요:
- PostgreSQL/데이터베이스: 데이터 조회 또는 저장
- Notion/Google Drive: 문서 생성 또는 업데이트
- Slack/Discord: 메시지 전송 시뮬레이션
- GitHub/Jira: 이슈 또는 PR 관련 작업 시뮬레이션

작업 결과를 상세히 설명해주세요.`;

    try {
      onProgress?.({ nodeId: node.id, status: 'running', progress: 50 });

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: mcpPrompt }],
      });

      const result = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      onProgress?.({ nodeId: node.id, status: 'running', progress: 100 });

      return {
        nodeId: node.id,
        success: true,
        result,
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'MCP 노드 실행 실패',
      };
    }
  }

  /**
   * Output 노드 실행 - 결과 수집 및 파일 저장
   */
  private async executeOutputNode(
    node: ExecutionNode,
    previousResults: string,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    const data = node.data as OutputNodeData;

    onLog?.('info', '최종 결과 수집 및 저장 중...');

    // 모든 이전 결과와 파일 수집
    const allFiles: Array<{ path: string; type: string; name: string }> = [];

    for (const [, result] of this.results) {
      if (result.files) {
        allFiles.push(...result.files);
      }
    }

    // 결과 요약 파일 생성
    const summaryPath = join(this.outputDir, 'result-summary.md');
    const summaryContent = `# 워크플로우 실행 결과

## 생성된 컨텐츠

${previousResults}

## 생성된 파일 목록
${allFiles.map((f) => `- **${f.name}**: \`${f.path}\``).join('\n') || '없음'}

---
생성 시간: ${new Date().toLocaleString('ko-KR')}
`;

    try {
      await writeFile(summaryPath, summaryContent, 'utf-8');

      return {
        nodeId: node.id,
        success: true,
        result: summaryContent,
        files: [
          { path: summaryPath, type: 'markdown', name: '결과 요약' },
          ...allFiles,
        ],
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: true,
        result: previousResults,
        files: allFiles,
      };
    }
  }

  /**
   * 모델 ID 변환
   */
  private getModelId(model?: 'sonnet' | 'opus' | 'haiku'): string {
    switch (model) {
      case 'opus':
        return 'claude-opus-4-20250514';
      case 'haiku':
        return 'claude-3-5-haiku-20241022';
      default:
        return 'claude-sonnet-4-20250514';
    }
  }

  /**
   * 이전 노드 결과 수집
   */
  private collectPreviousResults(node: ExecutionNode, edges: WorkflowEdge[]): string {
    const incomingEdges = edges.filter((e) => e.target === node.id);
    const previousResults: string[] = [];

    for (const edge of incomingEdges) {
      const result = this.results.get(edge.source);
      if (result?.result) {
        previousResults.push(result.result);
      }
    }

    return previousResults.join('\n\n---\n\n');
  }

  /**
   * 위상 정렬 (실행 순서 결정)
   */
  private topologicalSort(nodes: ExecutionNode[], edges: WorkflowEdge[]): ExecutionNode[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    nodes.forEach((node) => {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    });

    edges.forEach((edge) => {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    const queue: string[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });

    const result: ExecutionNode[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (node) {
        result.push(node);
      }

      adjList.get(nodeId)?.forEach((neighborId) => {
        const newDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, newDegree);
        if (newDegree === 0) {
          queue.push(neighborId);
        }
      });
    }

    return result;
  }
}

export const workflowExecutionService = new WorkflowExecutionService();
