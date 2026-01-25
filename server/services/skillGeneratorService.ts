import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import type { ApiSettings } from './workflowAIService';

export interface GeneratedSkill {
  skillName: string;
  skillId: string;
  description: string;
  files: Array<{
    path: string;
    content: string;
    language: string;
  }>;
}

export interface SkillGenerationResult {
  success: boolean;
  skill?: GeneratedSkill;
  savedPath?: string;
  error?: string;
}

export type SkillProgressStep =
  | 'started'
  | 'analyzing'
  | 'designing'
  | 'generating'
  | 'saving'
  | 'installing'
  | 'completed'
  | 'error';

export interface SkillProgressEvent {
  step: SkillProgressStep;
  message: string;
  detail?: string;
}

export type SkillProgressCallback = (event: SkillProgressEvent) => void;

const SYSTEM_PROMPT = `You are a Claude Code skill generator. You MUST respond with ONLY a valid JSON object. No markdown, no code blocks, no explanations - just pure JSON.

Your response must follow this exact JSON schema:

{
  "skillName": "Human readable skill name",
  "skillId": "skill-id-in-kebab-case",
  "description": "Brief description of what this skill does",
  "files": [
    {
      "path": "SKILL.md",
      "content": "Full SKILL.md content here",
      "language": "markdown"
    },
    {
      "path": "scripts/main.py",
      "content": "Full Python script content here",
      "language": "python"
    },
    {
      "path": "requirements.txt",
      "content": "package1\\npackage2",
      "language": "text"
    }
  ]
}

SKILL.md must follow this format:
---
name: skill-id
description: One line description
---

# Skill Name

## When to use
- Use case 1
- Use case 2

## Usage
\`\`\`bash
~/.claude/venv/bin/python ~/.claude/skills/skill-id/scripts/main.py [args]
\`\`\`

## Parameters
- \`--param1\`: Description

## Example
[Usage example]

RULES:
1. Generate COMPLETE, WORKING code - no placeholders
2. Include proper error handling with try-except
3. Use Korean for user-facing messages
4. Scripts run with ~/.claude/venv/bin/python
5. List all required packages in requirements.txt
6. RESPOND WITH JSON ONLY - NO OTHER TEXT`;

export class SkillGeneratorService {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.env.MAKECC_PROJECT_PATH || process.cwd();
  }

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

  async generate(
    prompt: string,
    settings?: ApiSettings,
    onProgress?: SkillProgressCallback
  ): Promise<SkillGenerationResult> {
    const progress = onProgress || (() => {});

    progress({
      step: 'started',
      message: '✨ 스킬 생성을 시작합니다',
      detail: `요청: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
    });

    const client = this.getClient(settings);

    progress({
      step: 'analyzing',
      message: '🔍 요청을 분석하고 있어요',
      detail: '어떤 스킬이 필요한지 파악 중...',
    });

    const userPrompt = `Create a skill for: "${prompt}"

Generate complete, working code. Respond with JSON only.`;

    try {
      progress({
        step: 'designing',
        message: '📝 스킬 구조를 설계하고 있어요',
        detail: 'AI가 최적의 스킬 구조를 결정 중...',
      });

      progress({
        step: 'generating',
        message: '⚙️ 코드를 생성하고 있어요',
        detail: 'Python 스크립트와 설정 파일 작성 중...',
      });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: '{' }  // Prefill to force JSON
        ],
      });

      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      if (!responseText) {
        progress({
          step: 'error',
          message: '❌ AI 응답을 받지 못했습니다',
        });
        return { success: false, error: 'AI 응답을 받지 못했습니다.' };
      }

      // Prefill로 '{'를 보냈으니 응답 앞에 '{'를 붙임
      const fullJson = '{' + responseText;

      let skill: GeneratedSkill;
      try {
        skill = JSON.parse(fullJson);
      } catch {
        console.error('Failed to parse skill response:', fullJson.slice(0, 500));
        progress({
          step: 'error',
          message: '❌ AI 응답을 파싱할 수 없습니다',
          detail: '다시 시도해주세요',
        });
        return { success: false, error: 'AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.' };
      }

      progress({
        step: 'saving',
        message: '💾 파일을 저장하고 있어요',
        detail: `${skill.files.length}개 파일 저장 중...`,
      });

      // 파일 저장
      const skillPath = path.join(this.projectRoot, '.claude', 'skills', skill.skillId);
      await this.saveSkillFiles(skillPath, skill.files);

      // requirements.txt가 있으면 의존성 설치
      const requirementsPath = path.join(skillPath, 'requirements.txt');
      if (existsSync(requirementsPath)) {
        progress({
          step: 'installing',
          message: '📦 패키지를 설치하고 있어요',
          detail: 'pip install 실행 중...',
        });

        try {
          await this.installDependencies(requirementsPath, progress);
        } catch (installError) {
          // 설치 실패해도 스킬 생성은 성공으로 처리
          console.error('Dependency installation failed:', installError);
          progress({
            step: 'installing',
            message: '⚠️ 일부 패키지 설치에 실패했어요',
            detail: '나중에 수동으로 설치해주세요',
          });
        }
      }

      progress({
        step: 'completed',
        message: '✅ 스킬이 생성되었습니다!',
        detail: `${skill.skillName} → ${skillPath}`,
      });

      return {
        success: true,
        skill,
        savedPath: skillPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Skill generation error:', errorMessage);
      progress({
        step: 'error',
        message: '❌ 스킬 생성에 실패했습니다',
        detail: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  private async saveSkillFiles(
    skillPath: string,
    files: Array<{ path: string; content: string }>
  ): Promise<void> {
    // 스킬 디렉토리 생성
    await fs.mkdir(skillPath, { recursive: true });

    for (const file of files) {
      const filePath = path.join(skillPath, file.path);
      const dirPath = path.dirname(filePath);

      // 하위 디렉토리 생성
      await fs.mkdir(dirPath, { recursive: true });

      // 파일 저장
      await fs.writeFile(filePath, file.content, 'utf-8');
      console.log(`Saved: ${filePath}`);
    }
  }

  private async installDependencies(
    requirementsPath: string,
    progress: SkillProgressCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const venvPythonPath = path.join(homeDir, '.claude', 'venv', 'bin', 'python');

      let command: string;
      let args: string[];

      // uv를 우선 사용 (10-100x 빠름)
      // uv pip install --python <venv-python> -r requirements.txt
      const useUv = this.checkCommandExists('uv');

      if (useUv && existsSync(venvPythonPath)) {
        command = 'uv';
        args = ['pip', 'install', '--python', venvPythonPath, '-r', requirementsPath];
        progress({
          step: 'installing',
          message: '⚡ uv로 패키지 설치 중 (고속)',
          detail: 'uv pip install 실행 중...',
        });
      } else if (existsSync(path.join(homeDir, '.claude', 'venv', 'bin', 'pip'))) {
        // fallback: 전역 venv pip 사용
        command = path.join(homeDir, '.claude', 'venv', 'bin', 'pip');
        args = ['install', '-r', requirementsPath];
        progress({
          step: 'installing',
          message: '📦 pip으로 패키지 설치 중',
          detail: 'pip install 실행 중...',
        });
      } else {
        // fallback: 시스템 pip 사용
        command = 'pip3';
        args = ['install', '-r', requirementsPath];
        progress({
          step: 'installing',
          message: '📦 pip으로 패키지 설치 중',
          detail: 'pip install 실행 중...',
        });
      }

      console.log(`Installing dependencies: ${command} ${args.join(' ')}`);

      const proc = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          if (line.includes('Successfully installed') || line.includes('Requirement already satisfied') || line.includes('Installed')) {
            progress({
              step: 'installing',
              message: '📦 패키지 설치 중',
              detail: line.slice(0, 60) + (line.length > 60 ? '...' : ''),
            });
          }
        }
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          progress({
            step: 'installing',
            message: '✅ 패키지 설치 완료',
            detail: '모든 의존성이 설치되었습니다',
          });
          resolve();
        } else {
          console.error('Package install failed:', errorOutput);
          reject(new Error(`Package install failed with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        console.error('Failed to start package installer:', err);
        reject(err);
      });
    });
  }

  private checkCommandExists(cmd: string): boolean {
    try {
      const { execSync } = require('child_process');
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

export const skillGeneratorService = new SkillGeneratorService();
