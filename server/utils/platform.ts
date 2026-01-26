/**
 * 플랫폼별 경로 및 명령어 유틸리티
 * macOS/Linux와 Windows 모두 지원
 */

import * as path from 'path';
import { execSync } from 'child_process';

/**
 * 현재 플랫폼이 Windows인지 확인
 */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Python 가상환경의 Python 실행 파일 경로
 * @param venvPath - .venv 디렉토리 경로 (예: '/project/.venv' 또는 '.venv')
 * @returns Python 실행 파일 경로
 *
 * @example
 * // Unix: .venv/bin/python
 * // Windows: .venv\Scripts\python.exe
 * getVenvPythonPath('.venv')
 */
export function getVenvPythonPath(venvPath: string = '.venv'): string {
  if (isWindows()) {
    return path.join(venvPath, 'Scripts', 'python.exe');
  }
  return path.join(venvPath, 'bin', 'python');
}

/**
 * Python 가상환경의 pip 실행 파일 경로
 * @param venvPath - .venv 디렉토리 경로
 * @returns pip 실행 파일 경로
 */
export function getVenvPipPath(venvPath: string = '.venv'): string {
  if (isWindows()) {
    return path.join(venvPath, 'Scripts', 'pip.exe');
  }
  return path.join(venvPath, 'bin', 'pip');
}

/**
 * 가상환경 활성화 명령어
 * @param venvPath - .venv 디렉토리 경로
 * @returns 활성화 명령어 문자열
 *
 * @example
 * // Unix: source .venv/bin/activate
 * // Windows (cmd): .venv\Scripts\activate.bat
 * // Windows (PowerShell): .venv\Scripts\Activate.ps1
 */
export function getVenvActivateCommand(venvPath: string = '.venv'): string {
  if (isWindows()) {
    // cmd.exe에서 사용
    return path.join(venvPath, 'Scripts', 'activate.bat');
  }
  return `source ${path.join(venvPath, 'bin', 'activate')}`;
}

/**
 * 명령어 존재 확인 (cross-platform)
 * @param cmd - 확인할 명령어
 * @returns 명령어가 존재하면 true
 */
export function checkCommandExists(cmd: string): boolean {
  try {
    if (isWindows()) {
      execSync(`where ${cmd}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Python venv 생성 명령어
 * @param venvPath - 생성할 venv 경로
 * @returns venv 생성 명령어
 */
export function getVenvCreateCommand(venvPath: string): string {
  if (isWindows()) {
    return `python -m venv "${venvPath}"`;
  }
  return `python3 -m venv "${venvPath}"`;
}

/**
 * uv를 사용한 패키지 설치 명령어
 * @param venvPythonPath - venv Python 경로
 * @param packageOrRequirements - 패키지명 또는 -r requirements.txt
 * @returns uv pip install 명령어
 */
export function getUvInstallCommand(venvPythonPath: string, packageOrRequirements: string): string {
  return `uv pip install --python "${venvPythonPath}" ${packageOrRequirements}`;
}

/**
 * 경로 구분자를 현재 플랫폼에 맞게 변환
 * @param pathStr - 변환할 경로 문자열
 * @returns 플랫폼에 맞는 경로
 */
export function normalizePath(pathStr: string): string {
  return pathStr.split(/[/\\]/).join(path.sep);
}

/**
 * 홈 디렉토리 경로 반환
 * @returns 홈 디렉토리 절대 경로
 */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * ~ 로 시작하는 경로를 절대 경로로 확장
 * @param filePath - ~ 로 시작할 수 있는 경로
 * @returns 절대 경로
 */
export function expandTilde(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(getHomeDir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * 문서용 venv Python 경로 (CLAUDE.md 등에 표시)
 * 플랫폼에 따라 적절한 예시 경로 반환
 */
export function getVenvPythonPathForDocs(): string {
  if (isWindows()) {
    return '.venv\\Scripts\\python.exe';
  }
  return '.venv/bin/python';
}

/**
 * 문서용 venv 활성화 명령어 (CLAUDE.md 등에 표시)
 */
export function getVenvActivateCommandForDocs(): string {
  if (isWindows()) {
    return '.venv\\Scripts\\activate';
  }
  return 'source .venv/bin/activate';
}

/**
 * 문서용 uv pip install 명령어 (CLAUDE.md 등에 표시)
 */
export function getUvInstallCommandForDocs(): string {
  if (isWindows()) {
    return 'uv pip install --python .venv\\Scripts\\python.exe';
  }
  return 'uv pip install --python .venv/bin/python';
}
