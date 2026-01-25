import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { spawn, execSync } from 'child_process';
import type { ApiSettings } from './workflowAIService';
import { claudeMdService } from './claudeMdService';

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

const SYSTEM_PROMPT = `You are an expert Claude Code skill generator. Generate production-quality skills with complete, working code.

RESPOND WITH ONLY A VALID JSON OBJECT - NO MARKDOWN, NO CODE BLOCKS, NO EXPLANATIONS.

## JSON Schema

{
  "skillName": "Human Readable Skill Name",
  "skillId": "skill-id-in-kebab-case",
  "description": "Comprehensive description including what it does AND when to use it. Include trigger phrases in Korean. Example: 'PDF 문서에서 텍스트 추출 및 분석. \"PDF 읽어줘\", \"PDF 분석해줘\", \"PDF에서 텍스트 추출\" 등의 요청 시 사용.'",
  "files": [
    {
      "path": "SKILL.md",
      "content": "Full SKILL.md content (see format below)",
      "language": "markdown"
    },
    {
      "path": "scripts/main.py",
      "content": "Full Python script (150-300 lines, production quality)",
      "language": "python"
    },
    {
      "path": "requirements.txt",
      "content": "package1\\npackage2",
      "language": "text"
    }
  ]
}

## SKILL.md Format (MUST follow exactly)

---
name: skill-id
description: Detailed description with trigger phrases. Include what it does AND specific Korean trigger phrases like "~해줘", "~만들어줘". This is the PRIMARY mechanism for skill activation.
---

# Skill Name

Brief description of what this skill does.

## 실행 전 요구사항 (필수)

List any prerequisites:
- API keys needed (with instructions to check/request)
- Environment setup
- Dependencies

## 빠른 시작

\\\`\\\`\\\`bash
.venv/bin/python .claude/skills/skill-id/scripts/main.py \\\\
  --required-arg "value" \\\\
  --output output.ext
\\\`\\\`\\\`

## 스크립트 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| \\\`--arg1\\\`, \\\`-a\\\` | Description | default |
| \\\`--output\\\`, \\\`-o\\\` | 출력 경로 (필수) | - |

## 사용 예시

### 예시 1: Basic Usage
\\\`\\\`\\\`bash
.venv/bin/python .claude/skills/skill-id/scripts/main.py \\\\
  --arg "value" --output result.ext
\\\`\\\`\\\`

### 예시 2: Advanced Usage
\\\`\\\`\\\`bash
.venv/bin/python .claude/skills/skill-id/scripts/main.py \\\\
  --arg "value" --advanced-option
\\\`\\\`\\\`

## 제한사항

- List any limitations or constraints

## Python Script Requirements (scripts/main.py)

The script MUST:
1. Be 150-300 lines of COMPLETE, WORKING code
2. Use argparse with --help support
3. Include comprehensive error handling (try-except)
4. Print Korean status messages with emoji (✅ 완료, ❌ 오류, ⏳ 처리 중)
5. Check dependencies at startup with helpful install instructions
6. Support common use cases with sensible defaults
7. Include docstring with usage examples

## Script Template Structure

\\\`\\\`\\\`python
#!/usr/bin/env python3
"""
Skill Name - Brief description

Usage:
    python main.py --arg "value" --output output.ext

Examples:
    python main.py --input data.txt --output result.txt
"""

import argparse
import sys
from pathlib import Path

def check_dependencies():
    """Check required packages"""
    try:
        import required_package
        return True
    except ImportError:
        print("❌ required_package가 설치되어 있지 않습니다.")
        print("   설치: uv pip install --python .venv/bin/python required_package")
        return False

def main_function(arg1, arg2, output_path):
    """Main processing logic with error handling"""
    print(f"⏳ 처리 중...")

    try:
        # Processing logic here
        result = process(arg1, arg2)

        # Save output
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, 'w') as f:
            f.write(result)

        print(f"✅ 완료!")
        print(f"   파일: {output_file}")
        return str(output_file)

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(
        description="Skill description",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=\"\"\"
예시:
  python main.py --input data.txt --output result.txt
  python main.py --input data.txt --output result.txt --option
        \"\"\"
    )

    parser.add_argument("--input", "-i", required=True, help="입력 파일")
    parser.add_argument("--output", "-o", required=True, help="출력 경로")
    parser.add_argument("--option", action="store_true", help="옵션 설명")

    args = parser.parse_args()

    if not check_dependencies():
        sys.exit(1)

    main_function(args.input, args.option, args.output)

if __name__ == "__main__":
    main()
\\\`\\\`\\\`

## Critical Rules

1. GENERATE COMPLETE, WORKING CODE - NO PLACEHOLDERS, NO "# TODO", NO "pass"
2. Scripts must be 150-300 lines with real implementation
3. Include ALL necessary imports and helper functions
4. Use Korean for user-facing messages, English for code/logs
5. description field MUST include Korean trigger phrases
6. SKILL.md MUST have complete usage examples with actual commands
7. Always include requirements.txt with specific packages needed
8. RESPOND WITH JSON ONLY - NO OTHER TEXT`;

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

    // CLAUDE.md 내용 읽기
    let claudeMdContext = '';
    const claudeMdContent = await claudeMdService.read();
    if (claudeMdContent) {
      claudeMdContext = `\n\n<project_context>
The following is the project's CLAUDE.md file. Follow these guidelines when generating the skill:

${claudeMdContent}
</project_context>`;
      console.log('Including CLAUDE.md in API context');
    }

    const userPrompt = `Create a skill for: "${prompt}"

Generate complete, working code. Respond with JSON only.${claudeMdContext}`;

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
      // 로컬 프로젝트의 .venv 사용
      const localVenvPythonPath = path.join(this.projectRoot, '.venv', 'bin', 'python');
      const localVenvPipPath = path.join(this.projectRoot, '.venv', 'bin', 'pip');

      let command: string;
      let args: string[];

      // uv를 우선 사용 (10-100x 빠름)
      const useUv = this.checkCommandExists('uv');

      if (useUv && existsSync(localVenvPythonPath)) {
        command = 'uv';
        args = ['pip', 'install', '--python', localVenvPythonPath, '-r', requirementsPath];
        progress({
          step: 'installing',
          message: '⚡ uv로 패키지 설치 중 (고속)',
          detail: 'uv pip install → .venv/',
        });
      } else if (existsSync(localVenvPipPath)) {
        // fallback: 로컬 venv pip 사용
        command = localVenvPipPath;
        args = ['install', '-r', requirementsPath];
        progress({
          step: 'installing',
          message: '📦 pip으로 패키지 설치 중',
          detail: 'pip install → .venv/',
        });
      } else {
        // fallback: 시스템 pip 사용 (경고)
        console.warn('Warning: .venv not found, using system pip');
        command = 'pip3';
        args = ['install', '-r', requirementsPath];
        progress({
          step: 'installing',
          message: '⚠️ 시스템 pip 사용 중',
          detail: '.venv가 없어 시스템 pip 사용',
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
