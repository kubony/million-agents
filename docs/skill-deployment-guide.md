# Claude Code 스킬 생성 및 배포 가이드

이 문서는 React 등의 프로젝트에서 Claude Code 스킬을 만들고 플러그인으로 배포하는 전체 과정을 정리합니다.

---

## 목차

1. [스킬이란?](#스킬이란)
2. [스킬 구조](#스킬-구조)
3. [스킬 생성 프로세스](#스킬-생성-프로세스)
4. [배포 방법](#배포-방법)
5. [설치 및 사용](#설치-및-사용)

---

## 스킬이란?

스킬은 Claude의 기능을 확장하는 **모듈형 패키지**입니다.

### 스킬이 제공하는 것

| 기능 | 설명 | 예시 |
|------|------|------|
| **워크플로우** | 특정 도메인의 다단계 절차 | PDF 처리, 이미지 편집 |
| **도구 통합** | 특정 파일 형식/API 작업 지침 | pptx, xlsx, docx |
| **도메인 전문성** | 회사별 지식, 스키마, 비즈니스 로직 | BigQuery 스키마, 브랜드 가이드 |
| **번들 리소스** | 스크립트, 레퍼런스, 에셋 | Python 스크립트, 템플릿 |

---

## 스킬 구조

```
skill-name/
├── SKILL.md (필수)
│   ├── YAML frontmatter (필수: name, description)
│   └── Markdown 본문 (사용 지침)
└── 번들 리소스 (선택)
    ├── scripts/          # 실행 가능한 코드 (Python/Bash)
    ├── references/       # 참조 문서 (필요시 로드)
    └── assets/           # 출력에 사용될 파일 (템플릿, 이미지)
```

### SKILL.md 예시

```yaml
---
name: pdf-processor
description: PDF 파일 처리 스킬. 텍스트 추출, 페이지 회전, 병합/분할 지원.
  사용 시점: (1) PDF 텍스트 추출 (2) PDF 편집 (3) PDF 병합/분할
---

# PDF Processor

## 기본 사용법
pdfplumber로 텍스트 추출:
[코드 예시]

## 고급 기능
- **폼 작성**: [FORMS.md](references/FORMS.md) 참조
- **API 레퍼런스**: [REFERENCE.md](references/REFERENCE.md) 참조
```

### 리소스 폴더 역할

| 폴더 | 용도 | 예시 |
|------|------|------|
| `scripts/` | 반복 실행되는 코드 | `rotate_pdf.py`, `convert_xlsx.py` |
| `references/` | 상세 문서 (필요시 로드) | `schema.md`, `api_docs.md` |
| `assets/` | 출력에 사용될 파일 | `logo.png`, `template.pptx` |

---

## 스킬 생성 프로세스

### 1단계: 스킬 이해하기

구체적인 사용 예시를 수집합니다:

```
질문 예시:
- "이 스킬은 어떤 기능을 지원해야 하나요?"
- "사용자가 어떻게 이 스킬을 호출할까요?"
- "어떤 트리거 문구가 이 스킬을 활성화해야 하나요?"
```

### 2단계: 재사용 가능한 콘텐츠 계획

각 사용 예시를 분석하여 필요한 리소스 파악:

| 시나리오 | 분석 | 필요한 리소스 |
|----------|------|---------------|
| PDF 회전 | 매번 같은 코드 작성 | `scripts/rotate_pdf.py` |
| 프론트엔드 앱 생성 | 매번 같은 보일러플레이트 | `assets/hello-world/` |
| BigQuery 조회 | 매번 스키마 찾기 | `references/schema.md` |

### 3단계: 스킬 초기화

```bash
# init_skill.py 스크립트로 템플릿 생성
scripts/init_skill.py <skill-name> --path <output-directory>
```

생성되는 구조:
- SKILL.md 템플릿 (frontmatter + TODO)
- 예시 scripts/, references/, assets/ 폴더

### 4단계: 스킬 편집

#### YAML Frontmatter 작성

```yaml
---
name: my-skill
description: |
  스킬 설명. 무엇을 하는지 + 언제 사용하는지 포함.
  사용 시점: (1) 트리거1 (2) 트리거2 (3) 트리거3
---
```

> **중요**: `description`은 스킬 트리거링의 핵심입니다. 본문은 트리거 후에만 로드됩니다.

#### 본문 작성 지침

- 명령형/원형 동사 사용
- 500줄 이하 유지
- 상세 내용은 `references/` 폴더로 분리

### 5단계: 패키징

```bash
# 검증 + 패키징 (.skill 파일 생성)
scripts/package_skill.py <path/to/skill-folder>

# 출력 폴더 지정
scripts/package_skill.py <path/to/skill-folder> ./dist
```

검증 항목:
- YAML frontmatter 형식
- 필수 필드 (name, description)
- 디렉토리 구조

### 6단계: 테스트 및 반복

실제 작업에서 스킬 사용 → 개선점 발견 → 수정 → 재테스트

---

## 배포 방법

스킬 배포에는 두 가지 방법이 있습니다:

### 방법 1: /promote (내부 배포)

**용도**: 로컬 → 전역(~/.claude) 또는 공유 저장소로 배포

```bash
# 배포 가능한 항목 목록
/promote --list

# 특정 항목 배포
/promote [name]
```

#### 배포 대상 선택

| 대상 | 경로 | 용도 |
|------|------|------|
| 전역 | `~/.claude/skills/` | 모든 프로젝트에서 사용 |
| 공유 저장소 | `~/projects/claudesystem/.claude/` | 팀 공유용 |

#### /promote 특징

- 자동 타입 감지 (skill/agent/command)
- 중복 발견 시 버전 비교
- Python venv 경로 자동 변환 (`$PROJECT_ROOT/.venv` → `~/.claude/venv`)
- 다른 프로젝트 중복 정리

### 방법 2: /publish (외부 배포 - GitHub)

**용도**: 로컬/전역 → GitHub 공개 레포로 배포 (마켓플레이스)

```bash
# 게시 가능한 항목 목록
/publish --list

# 미리보기 (실제 생성 안 함)
/publish --dry-run [name]

# GitHub에 게시
/publish [name]
```

#### /promote vs /publish 비교

| 비교 | /promote | /publish |
|------|----------|----------|
| 방향 | 로컬 → 전역/공유 | 로컬/전역 → GitHub |
| 대상 | 내부 재사용 | 외부 마켓플레이스 |
| 결과 | 파일 복사 | 레포 + README + LICENSE + plugin.json |

#### /publish가 자동 생성하는 파일

**README.md**:
```markdown
# [Name]

> [description]

## Installation

/plugin install [owner]/[repo-name]

## Usage
[트리거 예시들]
```

**plugin.json** (마켓플레이스 호환):
```json
{
  "name": "[name]",
  "version": "1.0.0",
  "description": "[description]",
  "type": "skill|agent|command",
  "repository": "https://github.com/[owner]/[repo-name]",
  "license": "MIT"
}
```

#### 민감 정보 자동 제외

- `.env`, `.env.*`
- `*credentials*.json`
- `*token*.pickle`
- API 키 패턴 (`sk-...`, `AIza...`, `ghp_...`)

---

## 설치 및 사용

### 설치 방법

```bash
# 플러그인으로 설치 (권장)
/plugin install [owner]/[repo-name]

# 수동 설치
git clone https://github.com/[owner]/[repo-name].git
cp -r [repo-name] ~/.claude/skills/
```

### 스킬 위치별 가상환경

| 스킬 유형 | 가상환경 경로 | 실행 패턴 |
|----------|---------------|-----------|
| **전역 스킬** | `~/.claude/venv/` | `~/.claude/venv/bin/python scripts/...` |
| **로컬 스킬** | `$PROJECT_ROOT/.venv/` | `source .venv/bin/activate && python scripts/...` |

### 의존성 설치

```bash
# uv 사용 (권장, pip보다 10배 빠름)
uv pip install --python ~/.claude/venv/bin/python -r requirements.txt

# pip 사용
~/.claude/venv/bin/pip install -r requirements.txt
```

---

## 체크리스트

### 스킬 생성 전

- [ ] 구체적인 사용 예시 3개 이상 수집
- [ ] 필요한 리소스 파악 (scripts/references/assets)

### 스킬 생성 중

- [ ] SKILL.md frontmatter에 name, description 포함
- [ ] description에 트리거 키워드 포함
- [ ] 본문 500줄 이하
- [ ] 스크립트 테스트 완료

### 배포 전

- [ ] 민감 정보 제거 (.env, API 키, credentials)
- [ ] requirements.txt 작성 (Python 스킬)
- [ ] 패키징 검증 통과

### 배포 후

- [ ] 설치 테스트
- [ ] 트리거 테스트
- [ ] 다른 환경에서 동작 확인

---

## 참고 명령어

```bash
# 스킬 생성 도우미
/skill-creator

# 전역 배포
/promote [name]

# GitHub 배포
/publish [name]

# 플러그인 설치
/plugin install [owner]/[repo-name]
```
