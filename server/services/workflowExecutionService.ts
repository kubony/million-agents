import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { executeClaudeCli, buildNodePrompt } from './claudeCliService';
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
 * Claude CLI를 사용한 워크플로우 실행 서비스
 */
export class WorkflowExecutionService {
  private results: Map<string, ExecutionResult> = new Map();
  private outputDir: string = '';
  private projectRoot: string = '';

  constructor() {
    this.projectRoot = process.env.MAKECC_PROJECT_PATH || process.cwd();
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
   * Subagent 노드 실행 - Claude CLI로 작업 수행
   */
  private async executeSubagentNode(
    node: ExecutionNode,
    previousResults: string,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    const data = node.data as SubagentNodeData;

    onProgress?.({ nodeId: node.id, status: 'running', progress: 20 });
    onLog?.('info', `claude -c 실행 중: ${data.label} (${data.role})`);

    // 프롬프트 생성
    const prompt = buildNodePrompt('subagent', data as unknown as Record<string, unknown>, previousResults);

    try {
      onProgress?.({ nodeId: node.id, status: 'running', progress: 40 });

      const result = await executeClaudeCli({
        prompt,
        workingDirectory: this.projectRoot,
        outputDirectory: this.outputDir,
        timeoutMs: 300000, // 5분
      });

      onProgress?.({ nodeId: node.id, status: 'running', progress: 100 });

      if (result.success) {
        return {
          nodeId: node.id,
          success: true,
          result: result.stdout,
          files: result.generatedFiles,
        };
      } else {
        return {
          nodeId: node.id,
          success: false,
          error: result.stderr || 'Claude CLI 실행 실패',
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Claude CLI 호출 실패';
      onLog?.('error', `Subagent 오류: ${errorMsg}`);
      return {
        nodeId: node.id,
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Skill 노드 실행 - Claude CLI로 스킬 실행
   */
  private async executeSkillNode(
    node: ExecutionNode,
    previousResults: string,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    const data = node.data as SkillNodeData;
    const skillId = data.skillId || 'generic';

    onProgress?.({ nodeId: node.id, status: 'running', progress: 10 });
    onLog?.('info', `claude -c 실행 중: /${skillId}`);

    // 프롬프트 생성 - 스킬 호출 형태
    const prompt = buildNodePrompt('skill', data as unknown as Record<string, unknown>, previousResults);

    try {
      const result = await executeClaudeCli({
        prompt,
        workingDirectory: this.projectRoot,
        outputDirectory: this.outputDir,
        timeoutMs: 300000,
      });

      onProgress?.({ nodeId: node.id, status: 'running', progress: 100 });

      if (result.success) {
        return {
          nodeId: node.id,
          success: true,
          result: result.stdout,
          files: result.generatedFiles,
        };
      } else {
        return {
          nodeId: node.id,
          success: false,
          error: result.stderr || '스킬 실행 실패',
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '스킬 실행 실패';
      onLog?.('error', errorMsg);
      return {
        nodeId: node.id,
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * MCP 노드 실행 - Claude CLI로 MCP 서버 연동
   */
  private async executeMcpNode(
    node: ExecutionNode,
    previousResults: string,
    onProgress?: ProgressCallback,
    onLog?: LogCallback
  ): Promise<ExecutionResult> {
    const data = node.data as McpNodeData;

    onProgress?.({ nodeId: node.id, status: 'running', progress: 10 });
    onLog?.('info', `claude -c 실행 중: MCP 서버 "${data.serverName}"`);

    const prompt = `MCP 서버를 사용하여 작업을 수행해주세요.

## MCP 서버 정보
- 서버 이름: ${data.serverName}
- 서버 타입: ${data.serverType}

## 이전 단계 결과
${previousResults || '(없음)'}

## 작업
위 MCP 서버를 사용하여 이전 단계의 결과를 처리하세요.`;

    try {
      onProgress?.({ nodeId: node.id, status: 'running', progress: 50 });

      const result = await executeClaudeCli({
        prompt,
        workingDirectory: this.projectRoot,
        outputDirectory: this.outputDir,
        timeoutMs: 300000,
      });

      onProgress?.({ nodeId: node.id, status: 'running', progress: 100 });

      if (result.success) {
        return {
          nodeId: node.id,
          success: true,
          result: result.stdout,
          files: result.generatedFiles,
        };
      } else {
        return {
          nodeId: node.id,
          success: false,
          error: result.stderr || 'MCP 노드 실행 실패',
        };
      }
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
