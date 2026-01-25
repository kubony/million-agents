import { spawn } from 'child_process';
import { join, basename } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import { mkdir, copyFile, readdir, stat } from 'fs/promises';

export interface ClaudeCliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  generatedFiles: Array<{ name: string; path: string; type: string }>;
}

export interface ClaudeCliOptions {
  prompt: string;
  workingDirectory: string;
  outputDirectory: string;
  timeoutMs?: number;
}

/**
 * claude -c 명령어를 백그라운드로 실행하고 결과를 캡처합니다.
 */
export async function executeClaudeCli(options: ClaudeCliOptions): Promise<ClaudeCliResult> {
  const { prompt, workingDirectory, outputDirectory, timeoutMs = 300000 } = options; // 기본 5분 타임아웃

  // 출력 디렉토리 생성
  if (!existsSync(outputDirectory)) {
    await mkdir(outputDirectory, { recursive: true });
  }

  // 실행 전 working directory 파일 목록 스냅샷
  const beforeFiles = await getDirectorySnapshot(workingDirectory);

  return new Promise((resolve) => {
    // claude -c --print 옵션으로 결과만 출력 (인터랙티브 모드 없이)
    const proc = spawn('claude', ['-c', '--print', prompt], {
      cwd: workingDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // TERM 설정으로 색상 코드 방지
        TERM: 'dumb',
        NO_COLOR: '1',
      },
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // 타임아웃 설정
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeoutMs);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      clearTimeout(timer);

      // 실행 후 새로 생성된 파일 찾기
      const afterFiles = await getDirectorySnapshot(workingDirectory);
      const newFiles = findNewFiles(beforeFiles, afterFiles);

      // 새 파일들을 output 디렉토리로 복사
      const generatedFiles: Array<{ name: string; path: string; type: string }> = [];

      for (const filePath of newFiles) {
        const fileName = basename(filePath);
        const destPath = join(outputDirectory, fileName);
        const fileType = getFileType(fileName);

        try {
          await copyFile(filePath, destPath);
          generatedFiles.push({ name: fileName, path: destPath, type: fileType });
          console.log(`Copied generated file: ${filePath} -> ${destPath}`);
        } catch (err) {
          console.error(`Failed to copy file ${filePath}:`, err);
        }
      }

      // stdout 결과도 파일로 저장 (결과가 있으면)
      if (stdout.trim()) {
        const { writeFile } = await import('fs/promises');
        const resultPath = join(outputDirectory, 'claude-output.md');
        await writeFile(resultPath, stdout, 'utf-8');
        generatedFiles.push({ name: 'claude-output.md', path: resultPath, type: 'markdown' });
      }

      resolve({
        success: code === 0 && !timedOut,
        stdout: timedOut ? stdout + '\n[Execution timed out]' : stdout,
        stderr,
        exitCode: code,
        generatedFiles,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        stdout: '',
        stderr: err.message,
        exitCode: null,
        generatedFiles: [],
      });
    });
  });
}

/**
 * 디렉토리의 파일 스냅샷 (재귀적으로 1단계까지만)
 */
async function getDirectorySnapshot(dir: string): Promise<Map<string, number>> {
  const snapshot = new Map<string, number>();

  if (!existsSync(dir)) {
    return snapshot;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // 숨김 파일 및 특정 폴더 제외
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') {
        continue;
      }

      const fullPath = join(dir, entry.name);

      if (entry.isFile()) {
        const stats = await stat(fullPath);
        snapshot.set(fullPath, stats.mtimeMs);
      }
    }
  } catch (err) {
    console.error('Error reading directory:', err);
  }

  return snapshot;
}

/**
 * 파일 확장자로 타입 결정
 */
function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    md: 'markdown',
    txt: 'text',
    json: 'json',
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    svg: 'image',
    pdf: 'pdf',
    xlsx: 'excel',
    xls: 'excel',
    pptx: 'powerpoint',
    ppt: 'powerpoint',
    docx: 'word',
    doc: 'word',
  };
  return typeMap[ext] || 'file';
}

/**
 * 새로 생성되거나 수정된 파일 찾기
 */
function findNewFiles(before: Map<string, number>, after: Map<string, number>): string[] {
  const newFiles: string[] = [];

  for (const [path, mtime] of after) {
    const beforeMtime = before.get(path);

    // 새 파일이거나 수정된 파일
    if (beforeMtime === undefined || mtime > beforeMtime) {
      newFiles.push(path);
    }
  }

  return newFiles;
}

/**
 * 노드별 프롬프트 생성
 */
export function buildNodePrompt(
  nodeType: string,
  nodeData: Record<string, unknown>,
  previousResults: string
): string {
  const lines: string[] = [];

  if (nodeType === 'subagent') {
    const role = nodeData.role as string || 'assistant';
    const description = nodeData.description as string || '';
    const systemPrompt = nodeData.systemPrompt as string || '';

    lines.push(`You are a ${role}.`);
    if (systemPrompt) {
      lines.push(systemPrompt);
    }
    lines.push('');
    lines.push('## Task');
    lines.push(description || 'Complete the following task based on the input.');
    lines.push('');
    if (previousResults) {
      lines.push('## Input from previous steps');
      lines.push(previousResults);
      lines.push('');
    }
    lines.push('Please complete this task and provide the result.');
  } else if (nodeType === 'skill') {
    const skillId = nodeData.skillId as string || '';
    const description = nodeData.description as string || '';

    if (skillId) {
      lines.push(`Execute the skill: /${skillId}`);
    }
    lines.push('');
    lines.push('## Task');
    lines.push(description || 'Execute this skill with the provided input.');
    lines.push('');
    if (previousResults) {
      lines.push('## Input');
      lines.push(previousResults);
      lines.push('');
    }
  } else {
    // Generic
    lines.push('## Task');
    lines.push(nodeData.description as string || 'Process the following input.');
    lines.push('');
    if (previousResults) {
      lines.push('## Input');
      lines.push(previousResults);
    }
  }

  return lines.join('\n');
}
