import { spawn } from 'child_process';
import { platform } from 'os';
import type { ExecutionNode, SubagentNodeData, SkillNodeData, InputNodeData } from '../types';

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface TerminalExecutionOptions {
  workflowName: string;
  nodes: ExecutionNode[];
  edges: WorkflowEdge[];
  inputs?: Record<string, string>;
  workingDirectory?: string;
}

/**
 * Generates a Claude Code prompt from the workflow
 */
function generateClaudePrompt(options: TerminalExecutionOptions): string {
  const { workflowName, nodes, edges, inputs } = options;

  const lines: string[] = [];
  lines.push(`# ${workflowName}`);
  lines.push('');

  // Collect inputs
  const inputNodes = nodes.filter((n): n is ExecutionNode & { data: InputNodeData } => n.type === 'input');
  if (inputNodes.length > 0 && inputs) {
    lines.push('## Inputs');
    inputNodes.forEach((node) => {
      const value = inputs[node.id] || node.data.value || '';
      if (value) {
        lines.push(`- ${node.data.label}: ${value}`);
      }
    });
    lines.push('');
  }

  // Build execution order
  const executionOrder = topologicalSort(nodes, edges);

  lines.push('## Tasks');
  lines.push('');

  let stepNum = 1;
  executionOrder.forEach((node) => {
    if (node.type === 'input') return;

    if (node.type === 'subagent') {
      const data = node.data as SubagentNodeData;
      lines.push(`${stepNum}. **${data.label}** (${data.role})`);
      if (data.description) {
        lines.push(`   ${data.description}`);
      }
      if (data.systemPrompt) {
        lines.push(`   System: ${data.systemPrompt}`);
      }
      if (data.tools.length > 0) {
        lines.push(`   Tools: ${data.tools.join(', ')}`);
      }
      lines.push('');
      stepNum++;
    }

    if (node.type === 'skill') {
      const data = node.data as SkillNodeData;
      lines.push(`${stepNum}. **${data.label}** (skill)`);
      if (data.skillId) {
        lines.push(`   Execute /${data.skillId}`);
      }
      if (data.mdContent) {
        lines.push(`   ${data.mdContent.substring(0, 200)}`);
      }
      lines.push('');
      stepNum++;
    }

    if (node.type === 'output') {
      lines.push(`${stepNum}. Output the final result.`);
      lines.push('');
      stepNum++;
    }
  });

  return lines.join('\n');
}

/**
 * Opens Terminal.app and runs claude -c with the workflow prompt
 */
export async function executeInTerminal(
  options: TerminalExecutionOptions
): Promise<{ success: boolean; message: string }> {
  const prompt = generateClaudePrompt(options);
  const cwd = options.workingDirectory || process.cwd();

  // Escape for shell
  const escapedPrompt = prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');

  const os = platform();

  if (os === 'darwin') {
    // macOS: Use osascript to open Terminal and run command
    const appleScript = `
tell application "Terminal"
  activate
  do script "cd \\"${cwd}\\" && claude -c \\"${escapedPrompt}\\""
end tell
`;

    return new Promise((resolve) => {
      const proc = spawn('osascript', ['-e', appleScript]);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: 'Terminal opened with Claude Code',
          });
        } else {
          resolve({
            success: false,
            message: `Failed to open Terminal (exit code: ${code})`,
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          message: `Error: ${err.message}`,
        });
      });
    });
  } else if (os === 'linux') {
    // Linux: Try common terminal emulators
    const command = `cd "${cwd}" && claude -c "${escapedPrompt}"`;

    return new Promise((resolve) => {
      // Try gnome-terminal first, then xterm
      const proc = spawn('gnome-terminal', ['--', 'bash', '-c', command], {
        detached: true,
        stdio: 'ignore',
      });

      proc.on('error', () => {
        // Fallback to xterm
        const xtermProc = spawn('xterm', ['-e', `bash -c '${command}'`], {
          detached: true,
          stdio: 'ignore',
        });

        xtermProc.on('error', (err) => {
          resolve({
            success: false,
            message: `Could not open terminal: ${err.message}`,
          });
        });

        xtermProc.unref();
        resolve({
          success: true,
          message: 'Terminal opened with Claude Code',
        });
      });

      proc.unref();
      resolve({
        success: true,
        message: 'Terminal opened with Claude Code',
      });
    });
  } else if (os === 'win32') {
    // Windows: Use cmd or PowerShell
    const command = `cd /d "${cwd}" && claude -c "${escapedPrompt}"`;

    return new Promise((resolve) => {
      const proc = spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', command], {
        detached: true,
        stdio: 'ignore',
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          message: `Error: ${err.message}`,
        });
      });

      proc.unref();
      resolve({
        success: true,
        message: 'Terminal opened with Claude Code',
      });
    });
  }

  return {
    success: false,
    message: `Unsupported platform: ${os}`,
  };
}

/**
 * Copies the claude command to clipboard (fallback)
 */
export function getClaudeCommand(options: TerminalExecutionOptions): string {
  const prompt = generateClaudePrompt(options);
  const escaped = prompt.replace(/"/g, '\\"');
  return `claude -c "${escaped}"`;
}

/**
 * Topological sort for execution order
 */
function topologicalSort<T extends { id: string }>(
  nodes: T[],
  edges: Array<{ source: string; target: string }>
): T[] {
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

  const result: T[] = [];
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
