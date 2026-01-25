import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { execSync, spawn } from 'child_process';

const MAKECC_SECTION_MARKER = '<!-- makecc-managed-section -->';
const MAKECC_SECTION_END = '<!-- /makecc-managed-section -->';

/**
 * makecc가 로컬 프로젝트에 추가할 CLAUDE.md 기본 템플릿
 */
const MAKECC_CLAUDE_MD_TEMPLATE = `${MAKECC_SECTION_MARKER}
## makecc 스킬/워크플로우 규칙

이 섹션은 makecc에 의해 자동 생성되었습니다.

### Python 가상환경

**모든 스킬은 프로젝트 로컬 가상환경을 사용합니다:**

\`\`\`
.venv/
\`\`\`

**사용 패턴:**

\`\`\`bash
# 로컬 venv Python 직접 실행 (권장)
.venv/bin/python script.py

# 또는 활성화 후 실행
source .venv/bin/activate && python script.py
\`\`\`

### 패키지 관리

**uv를 우선 사용합니다 (pip보다 10-100x 빠름):**

\`\`\`bash
# uv로 패키지 설치 (권장)
uv pip install --python .venv/bin/python package_name

# requirements.txt 설치
uv pip install --python .venv/bin/python -r requirements.txt

# uv가 없으면 pip 폴백
.venv/bin/pip install package_name
\`\`\`

### 스킬 저장 경로

| 항목 | 경로 |
|------|------|
| 스킬 | \`.claude/skills/[skill-name]/\` |
| 에이전트 | \`.claude/agents/[agent-name].md\` |
| 워크플로우 | \`.claude/agents/[workflow-name].md\` |

### 스킬 구조

\`\`\`
.claude/skills/[skill-name]/
├── SKILL.md          # 스킬 정의 (필수)
├── scripts/
│   └── main.py       # 메인 스크립트
└── requirements.txt  # 의존성 목록
\`\`\`

### 스킬 실행 규칙

1. **가상환경 사용**: 항상 \`.venv/bin/python\` 사용
2. **의존성 설치**: \`uv pip install\` 우선, 실패 시 \`pip\` 폴백
3. **경로 참조**: 상대 경로 대신 절대 경로 사용 권장
4. **한글 지원**: 사용자 메시지는 한글로 출력

${MAKECC_SECTION_END}
`;

export class ClaudeMdService {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.env.MAKECC_PROJECT_PATH || process.cwd();
  }

  /**
   * CLAUDE.md 파일 경로
   */
  private getClaudeMdPath(): string {
    return path.join(this.projectRoot, 'CLAUDE.md');
  }

  /**
   * CLAUDE.md 내용 읽기
   */
  async read(): Promise<string | null> {
    const claudeMdPath = this.getClaudeMdPath();
    if (!existsSync(claudeMdPath)) {
      return null;
    }
    return fs.readFile(claudeMdPath, 'utf-8');
  }

  /**
   * makecc 섹션이 있는지 확인
   */
  hasMakeccSection(content: string): boolean {
    return content.includes(MAKECC_SECTION_MARKER);
  }

  /**
   * CLAUDE.md 초기화 - 없으면 생성, 있으면 섹션 추가
   */
  async initialize(): Promise<{ created: boolean; updated: boolean; path: string }> {
    const claudeMdPath = this.getClaudeMdPath();
    const result = { created: false, updated: false, path: claudeMdPath };

    const existingContent = await this.read();

    if (existingContent === null) {
      // 파일이 없으면 새로 생성
      const newContent = `# CLAUDE.md

이 파일은 Claude Code가 이 프로젝트의 코드를 다룰 때 참고하는 가이드입니다.

${MAKECC_CLAUDE_MD_TEMPLATE}
`;
      await fs.writeFile(claudeMdPath, newContent, 'utf-8');
      result.created = true;
      console.log(`Created CLAUDE.md at ${claudeMdPath}`);
    } else if (!this.hasMakeccSection(existingContent)) {
      // 파일은 있지만 makecc 섹션이 없으면 추가
      const updatedContent = existingContent.trimEnd() + '\n\n' + MAKECC_CLAUDE_MD_TEMPLATE;
      await fs.writeFile(claudeMdPath, updatedContent, 'utf-8');
      result.updated = true;
      console.log(`Added makecc section to CLAUDE.md at ${claudeMdPath}`);
    } else {
      console.log(`CLAUDE.md already has makecc section at ${claudeMdPath}`);
    }

    return result;
  }

  /**
   * 프로젝트 로컬 .venv 초기화
   */
  async initializeVenv(): Promise<{ created: boolean; path: string }> {
    const venvPath = path.join(this.projectRoot, '.venv');
    const result = { created: false, path: venvPath };

    if (existsSync(venvPath)) {
      console.log(`Virtual environment already exists at ${venvPath}`);
      return result;
    }

    console.log(`Creating virtual environment at ${venvPath}...`);

    try {
      // uv가 있으면 uv venv 사용 (더 빠름)
      if (this.checkCommandExists('uv')) {
        execSync(`uv venv "${venvPath}"`, { cwd: this.projectRoot, stdio: 'inherit' });
      } else {
        // python -m venv 사용
        execSync(`python3 -m venv "${venvPath}"`, { cwd: this.projectRoot, stdio: 'inherit' });
      }
      result.created = true;
      console.log(`Created virtual environment at ${venvPath}`);
    } catch (error) {
      console.error('Failed to create virtual environment:', error);
      throw error;
    }

    return result;
  }

  /**
   * uv 설치 확인 및 자동 설치
   */
  async ensureUvInstalled(): Promise<{ installed: boolean; alreadyExists: boolean }> {
    const result = { installed: false, alreadyExists: false };

    if (this.checkCommandExists('uv')) {
      result.alreadyExists = true;
      console.log('uv is already installed');
      return result;
    }

    console.log('uv not found, attempting to install...');

    try {
      // curl 스크립트로 설치
      await this.runCommand('curl', ['-LsSf', 'https://astral.sh/uv/install.sh', '-o', '/tmp/uv-install.sh']);
      await this.runCommand('sh', ['/tmp/uv-install.sh']);

      // PATH에 추가된 uv 확인
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const uvPath = path.join(homeDir, '.local', 'bin', 'uv');

      if (existsSync(uvPath)) {
        // PATH에 추가
        process.env.PATH = `${path.dirname(uvPath)}:${process.env.PATH}`;
        result.installed = true;
        console.log('uv installed successfully');
      } else {
        console.warn('uv installation may have failed, falling back to pip');
      }
    } catch (error) {
      console.error('Failed to install uv:', error);
      console.log('Will fall back to pip for package management');
    }

    return result;
  }

  /**
   * 전체 초기화 실행
   */
  async setup(): Promise<{
    claudeMd: { created: boolean; updated: boolean; path: string };
    venv: { created: boolean; path: string };
    uv: { installed: boolean; alreadyExists: boolean };
  }> {
    console.log('\n=== makecc Project Setup ===\n');
    console.log(`Project root: ${this.projectRoot}\n`);

    // 1. uv 설치 확인
    const uvResult = await this.ensureUvInstalled();

    // 2. CLAUDE.md 초기화
    const claudeMdResult = await this.initialize();

    // 3. .venv 초기화
    const venvResult = await this.initializeVenv();

    console.log('\n=== Setup Complete ===\n');

    return {
      claudeMd: claudeMdResult,
      venv: venvResult,
      uv: uvResult,
    };
  }

  /**
   * 명령어 존재 확인
   */
  private checkCommandExists(cmd: string): boolean {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 명령어 실행 (Promise)
   */
  private runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { stdio: 'inherit' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Command failed with code ${code}`));
      });
      proc.on('error', reject);
    });
  }
}

export const claudeMdService = new ClaudeMdService();
