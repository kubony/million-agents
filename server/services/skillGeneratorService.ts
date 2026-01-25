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

    const userPrompt = `Create a skill for: "${prompt}"

Generate complete, working code. Respond with JSON only.`;

    try {
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
        return { success: false, error: 'AI 응답을 받지 못했습니다.' };
      }

      // Prefill로 '{'를 보냈으니 응답 앞에 '{'를 붙임
      const fullJson = '{' + responseText;

      let skill: GeneratedSkill;
      try {
        skill = JSON.parse(fullJson);
      } catch {
        console.error('Failed to parse skill response:', fullJson.slice(0, 500));
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
