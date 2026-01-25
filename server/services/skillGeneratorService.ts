import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
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

const SYSTEM_PROMPT = `당신은 Claude Code 스킬 생성 전문가입니다.

사용자의 요청을 분석하여 완전히 작동하는 Claude Code 스킬을 생성합니다.

## Claude Code 스킬 구조

스킬은 다음 구조로 생성됩니다:
\`\`\`
.claude/skills/[skill-name]/
├── SKILL.md          # 스킬 정의 (필수)
├── scripts/          # 스크립트 폴더
│   └── main.py       # 메인 스크립트
└── requirements.txt  # Python 의존성 (필요시)
\`\`\`

## SKILL.md 형식

\`\`\`markdown
---
name: skill-name
description: 스킬 설명 (한 줄)
---

# 스킬 이름

## 사용 시점
이 스킬은 다음 상황에서 사용됩니다:
- 상황 1
- 상황 2

## 사용 방법

\\\`\\\`\\\`bash
~/.claude/venv/bin/python ~/.claude/skills/[skill-name]/scripts/main.py [인자들]
\\\`\\\`\\\`

## 파라미터
- \`param1\`: 설명
- \`param2\`: 설명

## 예시
[사용 예시]
\`\`\`

## 응답 형식 (JSON)

반드시 아래 형식의 JSON으로 응답하세요:

{
  "skillName": "스킬 이름 (한글 가능)",
  "skillId": "skill-id-kebab-case",
  "description": "스킬 설명",
  "files": [
    {
      "path": "SKILL.md",
      "content": "SKILL.md 전체 내용",
      "language": "markdown"
    },
    {
      "path": "scripts/main.py",
      "content": "Python 스크립트 전체 내용",
      "language": "python"
    },
    {
      "path": "requirements.txt",
      "content": "의존성 목록 (필요한 경우)",
      "language": "text"
    }
  ]
}

## 중요 규칙

1. **완전한 코드 생성**: 실제로 동작하는 완전한 코드를 작성하세요
2. **에러 처리 포함**: try-except로 에러 처리를 포함하세요
3. **한글 지원**: 출력 메시지는 한글로 작성하세요
4. **환경 고려**:
   - Python 스크립트는 \`~/.claude/venv/bin/python\`으로 실행됩니다
   - 필요한 패키지는 requirements.txt에 명시하세요
5. **JSON만 반환**: 설명 없이 JSON만 반환하세요
`;

export class SkillGeneratorService {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.env.MAKECC_PROJECT_PATH || process.cwd();
  }

  private getClient(settings?: ApiSettings): Anthropic {
    if (settings?.apiMode === 'direct' && settings.apiKey) {
      return new Anthropic({ apiKey: settings.apiKey });
    }

    if (settings?.apiMode === 'proxy' && settings.proxyUrl) {
      return new Anthropic({
        baseURL: settings.proxyUrl,
        apiKey: process.env.ANTHROPIC_API_KEY || 'proxy-mode',
      });
    }

    const envApiKey = process.env.ANTHROPIC_API_KEY;
    if (!envApiKey) {
      throw new Error('API 키가 설정되지 않았습니다. 설정에서 API 키를 입력하세요.');
    }

    return new Anthropic({ apiKey: envApiKey });
  }

  async generate(prompt: string, settings?: ApiSettings): Promise<SkillGenerationResult> {
    const client = this.getClient(settings);

    const userPrompt = `다음 스킬을 생성해주세요: "${prompt}"

완전히 동작하는 코드를 포함한 스킬을 생성하세요.
반드시 JSON만 반환하세요.`;

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      if (!responseText) {
        return { success: false, error: 'AI 응답을 받지 못했습니다.' };
      }

      // JSON 추출
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const rawJson = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

      let skill: GeneratedSkill;
      try {
        skill = JSON.parse(rawJson);
      } catch {
        console.error('Failed to parse skill response:', rawJson.slice(0, 500));
        return { success: false, error: 'AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.' };
      }

      // 파일 저장
      const skillPath = path.join(this.projectRoot, '.claude', 'skills', skill.skillId);
      await this.saveSkillFiles(skillPath, skill.files);

      return {
        success: true,
        skill,
        savedPath: skillPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Skill generation error:', errorMessage);
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
}

export const skillGeneratorService = new SkillGeneratorService();
