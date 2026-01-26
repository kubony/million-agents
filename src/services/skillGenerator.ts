import { useSettingsStore } from '../stores/settingsStore';
import { useProjectStore } from '../stores/projectStore';

export interface GeneratedSkillFile {
  path: string;
  content: string;
  language: string;
}

export interface GeneratedSkill {
  skillName: string;
  skillId: string;
  description: string;
  files: GeneratedSkillFile[];
}

export interface SkillGenerationResult {
  success: boolean;
  skill?: GeneratedSkill;
  savedPath?: string;
  error?: string;
}

/**
 * 프롬프트가 스킬 생성 요청인지 판단
 */
export function isSkillGenerationRequest(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();

  // "스킬" 키워드가 포함되어 있으면 스킬 생성
  if (lowerPrompt.includes('스킬') || lowerPrompt.includes('skill')) {
    return true;
  }

  // "~하는 것을 만들어줘" 같은 패턴
  const createPatterns = [
    /만들어\s*(줘|주세요|줘요)/,
    /작성해\s*(줘|주세요|줘요)/,
    /생성해\s*(줘|주세요|줘요)/,
  ];

  for (const pattern of createPatterns) {
    if (pattern.test(prompt)) {
      return true;
    }
  }

  return false;
}

/**
 * AI로 스킬 생성 (서버 API 호출)
 * @param prompt 스킬 생성 프롬프트
 * @param projectPath 저장할 프로젝트 경로 (선택, 없으면 currentProject 사용)
 */
export async function generateSkill(
  prompt: string,
  projectPath?: string
): Promise<SkillGenerationResult> {
  const { apiMode, apiKey, proxyUrl } = useSettingsStore.getState();
  const { currentProject } = useProjectStore.getState();

  // projectPath가 없으면 currentProject.path 사용
  const targetPath = projectPath || currentProject?.path;

  if (!targetPath) {
    return {
      success: false,
      error: '프로젝트를 먼저 선택해주세요. 홈에서 프로젝트를 선택하거나 새로 만드세요.',
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Mode': apiMode,
  };

  if (apiMode === 'direct' && apiKey) {
    headers['X-API-Key'] = apiKey;
  } else if (apiMode === 'proxy' && proxyUrl) {
    headers['X-Proxy-URL'] = proxyUrl;
  }

  try {
    const response = await fetch('/api/generate/skill', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, projectPath: targetPath }),
    });

    if (!response.ok) {
      let errorMessage = `서버 오류 (${response.status})`;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        // ignore
      }
      return { success: false, error: errorMessage };
    }

    return await response.json();
  } catch (err) {
    return {
      success: false,
      error: '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.'
    };
  }
}
