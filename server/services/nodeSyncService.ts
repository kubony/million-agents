import * as fs from 'fs/promises';
import * as path from 'path';

interface NodeData {
  id: string;
  type: 'skill' | 'subagent' | 'command' | 'hook' | 'input' | 'output';
  label: string;
  description?: string;
  // Skill specific
  skillId?: string;
  skillPath?: string;
  upstream?: string[];   // Connected upstream agents/skills
  downstream?: string[]; // Connected downstream agents/skills
  // Subagent specific
  tools?: string[];
  model?: string;
  skills?: string[];  // Connected downstream skills
  systemPrompt?: string;
  // Command specific
  commandName?: string;
  commandContent?: string;
  // Hook specific
  hookEvent?: string;
  hookMatcher?: string;
  hookCommand?: string;
}

interface EdgeData {
  source: string;
  target: string;
  sourceType: string;
  targetType: string;
}

export class NodeSyncService {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.env.MAKECC_PROJECT_PATH || process.cwd();
  }

  /**
   * 노드 생성/수정 시 파일 동기화
   */
  async syncNode(node: NodeData): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      switch (node.type) {
        case 'skill':
          return await this.syncSkillNode(node);
        case 'subagent':
          return await this.syncSubagentNode(node);
        case 'command':
          return await this.syncCommandNode(node);
        case 'hook':
          return await this.syncHookNode(node);
        case 'input':
        case 'output':
          // 입력/출력 노드는 파일 저장 불필요
          return { success: true };
        default:
          return { success: false, error: `Unknown node type: ${node.type}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 노드 삭제 시 파일 삭제 및 관련 참조 정리
   */
  async deleteNode(node: NodeData, allNodes?: NodeData[]): Promise<{ success: boolean; error?: string }> {
    try {
      const nodeId = this.getNodeIdentifier(node);

      // 먼저 관련 노드들에서 참조 제거
      if (allNodes) {
        await this.removeReferencesToNode(nodeId, node.type, allNodes);
      }

      // 파일 삭제
      switch (node.type) {
        case 'skill':
          if (node.skillId) {
            const skillPath = path.join(this.projectRoot, '.claude', 'skills', node.skillId);
            await fs.rm(skillPath, { recursive: true, force: true });
          }
          break;
        case 'subagent':
          const agentName = this.toKebabCase(node.label);
          const agentPath = path.join(this.projectRoot, '.claude', 'agents', `${agentName}.md`);
          await fs.unlink(agentPath).catch(() => {});
          break;
        case 'command':
          const cmdName = node.commandName || this.toKebabCase(node.label);
          const cmdPath = path.join(this.projectRoot, '.claude', 'commands', `${cmdName}.md`);
          await fs.unlink(cmdPath).catch(() => {});
          break;
        case 'hook':
          await this.removeHookFromSettings(node);
          break;
      }
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 삭제되는 노드에 대한 모든 참조를 관련 노드에서 제거
   */
  private async removeReferencesToNode(nodeId: string, nodeType: string, allNodes: NodeData[]): Promise<void> {
    for (const relatedNode of allNodes) {
      if (relatedNode.type === 'subagent') {
        // 서브에이전트의 skills 배열에서 삭제된 노드 제거
        if (relatedNode.skills?.includes(nodeId)) {
          relatedNode.skills = relatedNode.skills.filter(s => s !== nodeId);
          await this.syncSubagentNode(relatedNode);
        }
      } else if (relatedNode.type === 'skill') {
        let updated = false;
        // 스킬의 upstream에서 삭제된 노드 제거
        if (relatedNode.upstream?.includes(nodeId)) {
          relatedNode.upstream = relatedNode.upstream.filter(s => s !== nodeId);
          updated = true;
        }
        // 스킬의 downstream에서 삭제된 노드 제거
        if (relatedNode.downstream?.includes(nodeId)) {
          relatedNode.downstream = relatedNode.downstream.filter(s => s !== nodeId);
          updated = true;
        }
        if (updated) {
          await this.syncSkillNode(relatedNode);
        }
      }
    }
  }

  /**
   * 엣지 연결 시 관계 업데이트
   * - source의 downstream에 target 추가
   * - target의 upstream에 source 추가
   */
  async syncEdge(edge: EdgeData, nodes: NodeData[]): Promise<{ success: boolean; error?: string }> {
    try {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) {
        return { success: false, error: 'Source or target node not found' };
      }

      const sourceId = this.getNodeIdentifier(sourceNode);
      const targetId = this.getNodeIdentifier(targetNode);

      // 서브에이전트 → 스킬 연결
      if (sourceNode.type === 'subagent' && targetNode.type === 'skill') {
        // 에이전트의 skills 필드 업데이트
        const skills = sourceNode.skills || [];
        if (!skills.includes(targetId)) {
          skills.push(targetId);
          sourceNode.skills = skills;
          await this.syncSubagentNode(sourceNode);
        }

        // 스킬의 upstream 필드 업데이트
        const upstream = targetNode.upstream || [];
        if (!upstream.includes(sourceId)) {
          upstream.push(sourceId);
          targetNode.upstream = upstream;
          await this.syncSkillNode(targetNode);
        }
      }

      // 스킬 → 스킬 연결
      if (sourceNode.type === 'skill' && targetNode.type === 'skill') {
        // source의 downstream 업데이트
        const downstream = sourceNode.downstream || [];
        if (!downstream.includes(targetId)) {
          downstream.push(targetId);
          sourceNode.downstream = downstream;
          await this.syncSkillNode(sourceNode);
        }

        // target의 upstream 업데이트
        const upstream = targetNode.upstream || [];
        if (!upstream.includes(sourceId)) {
          upstream.push(sourceId);
          targetNode.upstream = upstream;
          await this.syncSkillNode(targetNode);
        }
      }

      // 스킬 → 서브에이전트 연결
      if (sourceNode.type === 'skill' && targetNode.type === 'subagent') {
        // 에이전트의 upstream skills 필드 업데이트
        const skills = targetNode.skills || [];
        if (!skills.includes(sourceId)) {
          skills.push(sourceId);
          targetNode.skills = skills;
          await this.syncSubagentNode(targetNode);
        }

        // 스킬의 downstream 필드 업데이트
        const downstream = sourceNode.downstream || [];
        if (!downstream.includes(targetId)) {
          downstream.push(targetId);
          sourceNode.downstream = downstream;
          await this.syncSkillNode(sourceNode);
        }
      }

      // 서브에이전트 → 서브에이전트 연결
      if (sourceNode.type === 'subagent' && targetNode.type === 'subagent') {
        // source의 downstream agents
        const sourceDownstream = sourceNode.skills || [];
        if (!sourceDownstream.includes(targetId)) {
          sourceDownstream.push(targetId);
          sourceNode.skills = sourceDownstream;
          await this.syncSubagentNode(sourceNode);
        }
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 노드의 식별자 반환 (skillId 또는 kebab-case label)
   */
  private getNodeIdentifier(node: NodeData): string {
    if (node.type === 'skill') {
      return node.skillId || this.toKebabCase(node.label);
    }
    return this.toKebabCase(node.label);
  }

  /**
   * 엣지 삭제 시 관계 업데이트
   */
  async removeEdge(edge: EdgeData, nodes: NodeData[]): Promise<{ success: boolean; error?: string }> {
    try {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) {
        return { success: true }; // 노드가 없으면 무시
      }

      const sourceId = this.getNodeIdentifier(sourceNode);
      const targetId = this.getNodeIdentifier(targetNode);

      // 서브에이전트 → 스킬 연결 해제
      if (sourceNode.type === 'subagent' && targetNode.type === 'skill') {
        // 에이전트에서 스킬 제거
        sourceNode.skills = (sourceNode.skills || []).filter(s => s !== targetId);
        await this.syncSubagentNode(sourceNode);

        // 스킬에서 upstream 제거
        targetNode.upstream = (targetNode.upstream || []).filter(s => s !== sourceId);
        await this.syncSkillNode(targetNode);
      }

      // 스킬 → 스킬 연결 해제
      if (sourceNode.type === 'skill' && targetNode.type === 'skill') {
        sourceNode.downstream = (sourceNode.downstream || []).filter(s => s !== targetId);
        await this.syncSkillNode(sourceNode);

        targetNode.upstream = (targetNode.upstream || []).filter(s => s !== sourceId);
        await this.syncSkillNode(targetNode);
      }

      // 스킬 → 서브에이전트 연결 해제
      if (sourceNode.type === 'skill' && targetNode.type === 'subagent') {
        targetNode.skills = (targetNode.skills || []).filter(s => s !== sourceId);
        await this.syncSubagentNode(targetNode);

        sourceNode.downstream = (sourceNode.downstream || []).filter(s => s !== targetId);
        await this.syncSkillNode(sourceNode);
      }

      // 서브에이전트 → 서브에이전트 연결 해제
      if (sourceNode.type === 'subagent' && targetNode.type === 'subagent') {
        sourceNode.skills = (sourceNode.skills || []).filter(s => s !== targetId);
        await this.syncSubagentNode(sourceNode);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  // ===== Private Methods =====

  private async syncSkillNode(node: NodeData): Promise<{ success: boolean; path?: string; error?: string }> {
    const skillId = node.skillId || this.toKebabCase(node.label);
    const skillPath = path.join(this.projectRoot, '.claude', 'skills', skillId);
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    await fs.mkdir(skillPath, { recursive: true });

    // Frontmatter 구성
    const frontmatter: Record<string, string> = {
      name: skillId,
      description: node.description || node.label,
    };

    // upstream 연결 추가
    if (node.upstream && node.upstream.length > 0) {
      frontmatter.upstream = node.upstream.join(', ');
    }

    // downstream 연결 추가
    if (node.downstream && node.downstream.length > 0) {
      frontmatter.downstream = node.downstream.join(', ');
    }

    // 기존 파일이 있으면 읽어서 업데이트, 없으면 새로 생성
    let content = '';
    try {
      content = await fs.readFile(skillMdPath, 'utf-8');
      // frontmatter 업데이트
      for (const [key, value] of Object.entries(frontmatter)) {
        content = this.updateFrontmatter(content, { [key]: value });
      }
    } catch {
      // 새로 생성
      const frontmatterStr = Object.entries(frontmatter)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      content = `---
${frontmatterStr}
---

# ${node.label}

## 사용 시점
이 스킬은 다음 상황에서 사용됩니다:
- ${node.description || '설명을 추가하세요'}

## 사용 방법

\`\`\`bash
# 스킬 사용 방법을 여기에 작성하세요
\`\`\`
`;
    }

    await fs.writeFile(skillMdPath, content, 'utf-8');
    return { success: true, path: skillPath };
  }

  private async syncSubagentNode(node: NodeData): Promise<{ success: boolean; path?: string; error?: string }> {
    const agentName = this.toKebabCase(node.label);
    const agentsDir = path.join(this.projectRoot, '.claude', 'agents');
    const agentPath = path.join(agentsDir, `${agentName}.md`);

    await fs.mkdir(agentsDir, { recursive: true });

    // 기존 파일 읽기 시도
    let existingContent = '';
    let existingFrontmatter: Record<string, string> = {};
    let existingBody = '';
    try {
      existingContent = await fs.readFile(agentPath, 'utf-8');
      const parsed = this.parseFrontmatter(existingContent);
      existingFrontmatter = parsed.frontmatter;
      existingBody = parsed.body;
    } catch {
      // 파일 없음 - 새로 생성
    }

    // Frontmatter 구성 - 기존 값 유지하면서 업데이트
    const frontmatter: Record<string, string> = {
      ...existingFrontmatter,
      name: agentName,
      description: node.description || existingFrontmatter.description || node.label,
    };

    if (node.tools && node.tools.length > 0) {
      frontmatter.tools = node.tools.join(', ');
    }

    if (node.model) {
      frontmatter.model = node.model;
    }

    // skills 필드 처리 - 기존 값과 새 값 병합
    if (node.skills && node.skills.length > 0) {
      frontmatter.skills = node.skills.join(', ');
    } else if (node.skills && node.skills.length === 0) {
      // 명시적으로 빈 배열이면 skills 제거
      delete frontmatter.skills;
    }

    const frontmatterStr = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    // body 처리 - systemPrompt가 명시되면 교체, 아니면 기존 유지
    const body = node.systemPrompt || existingBody || `You are ${node.label}.

${node.description || ''}
`;

    const content = `---
${frontmatterStr}
---

${body}
`;

    await fs.writeFile(agentPath, content, 'utf-8');
    return { success: true, path: agentPath };
  }

  /**
   * Frontmatter 파싱
   */
  private parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
    const frontmatter: Record<string, string> = {};
    let body = content;

    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (match) {
      const fmContent = match[1];
      body = match[2].trim();

      for (const line of fmContent.split('\n')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();
          frontmatter[key] = value;
        }
      }
    }

    return { frontmatter, body };
  }

  private async syncCommandNode(node: NodeData): Promise<{ success: boolean; path?: string; error?: string }> {
    const cmdName = node.commandName || this.toKebabCase(node.label);
    const commandsDir = path.join(this.projectRoot, '.claude', 'commands');
    const cmdPath = path.join(commandsDir, `${cmdName}.md`);

    await fs.mkdir(commandsDir, { recursive: true });

    const content = node.commandContent || `---
description: ${node.description || node.label}
---

${node.description || '커맨드 내용을 여기에 작성하세요'}

$ARGUMENTS
`;

    await fs.writeFile(cmdPath, content, 'utf-8');
    return { success: true, path: cmdPath };
  }

  private async syncHookNode(node: NodeData): Promise<{ success: boolean; path?: string; error?: string }> {
    const settingsPath = path.join(this.projectRoot, '.claude', 'settings.json');

    // 기존 settings 읽기
    let settings: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    } catch {
      // 파일 없음
    }

    // hooks 섹션 확인/생성
    if (!settings.hooks) {
      settings.hooks = {};
    }

    const hooks = settings.hooks as Record<string, unknown[]>;
    const event = node.hookEvent || 'PreToolUse';

    if (!hooks[event]) {
      hooks[event] = [];
    }

    // 기존 훅 찾기 (같은 matcher로)
    const eventHooks = hooks[event] as Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
    const existingIndex = eventHooks.findIndex(h => h.matcher === (node.hookMatcher || '*'));

    const hookConfig = {
      matcher: node.hookMatcher || '*',
      hooks: [
        {
          type: 'command',
          command: node.hookCommand || 'echo "Hook triggered"',
        },
      ],
    };

    if (existingIndex >= 0) {
      eventHooks[existingIndex] = hookConfig;
    } else {
      eventHooks.push(hookConfig);
    }

    // .claude 디렉토리 생성
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    return { success: true, path: settingsPath };
  }

  private async removeHookFromSettings(node: NodeData): Promise<void> {
    const settingsPath = path.join(this.projectRoot, '.claude', 'settings.json');

    let settings: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    } catch {
      return;
    }

    const hooks = settings.hooks as Record<string, unknown[]> | undefined;
    if (!hooks) return;

    const event = node.hookEvent || 'PreToolUse';
    if (!hooks[event]) return;

    const eventHooks = hooks[event] as Array<{ matcher: string }>;
    hooks[event] = eventHooks.filter(h => h.matcher !== (node.hookMatcher || '*'));

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  private updateFrontmatter(content: string, updates: Record<string, string>): string {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      // frontmatter 없으면 추가
      const fm = Object.entries(updates)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      return `---\n${fm}\n---\n\n${content}`;
    }

    let frontmatter = frontmatterMatch[1];
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}:.*$`, 'm');
      if (regex.test(frontmatter)) {
        frontmatter = frontmatter.replace(regex, `${key}: ${value}`);
      } else {
        frontmatter += `\n${key}: ${value}`;
      }
    }

    return content.replace(/^---\n[\s\S]*?\n---/, `---\n${frontmatter}\n---`);
  }

  private toKebabCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

export const nodeSyncService = new NodeSyncService();
