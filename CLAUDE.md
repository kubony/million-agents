# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소의 코드를 다룰 때 참고하는 가이드입니다.

## 프로젝트 개요

**makecc**는 Claude Code 스킬과 워크플로우를 시각적으로 생성하는 도구입니다.

### 핵심 목표

**비개발자가 자연어로 스킬을 만들 수 있게 하는 것**

예: "gmail 읽고 쓰는 스킬 만들어줘" → AI가 완전한 스킬 생성 → `.claude/skills/`에 저장

### 주요 기능

1. **스킬 생성**: 자연어 프롬프트로 SKILL.md + Python 스크립트 자동 생성
2. **워크플로우 빌더**: 노드 기반 UI로 에이전트 워크플로우 설계
3. **즉시 저장**: 생성된 스킬/워크플로우를 프로젝트의 `.claude/`에 바로 저장

## 사용 방법

```bash
# 프로젝트 디렉토리에서 실행
npx makecc

# 브라우저에서 http://localhost:3003 접속
```

## 프로젝트 구조

```
makecc/
├── src/                    # React 프론트엔드
│   ├── components/         # UI 컴포넌트
│   │   ├── layout/         # PromptBar, Header 등
│   │   └── nodes/          # 노드 에디터 컴포넌트
│   ├── services/           # API 서비스
│   └── stores/             # Zustand 상태 관리
├── server/                 # Express 백엔드
│   ├── index.ts            # 메인 서버
│   └── services/           # 스킬 생성 서비스
├── bin/                    # CLI 진입점
└── dist/                   # 빌드 결과물
```

## 애플리케이션 아키텍처

### 라우팅 구조

React Router로 두 가지 주요 페이지를 제공합니다:

| 경로 | 컴포넌트 | 설명 |
|------|---------|------|
| `/` | `HomePage` | 프로젝트 목록 및 갤러리 |
| `/project/:projectName` | `WorkflowBuilder` | 워크플로우 편집기 |

### 홈 페이지 구조

```
src/components/home/
├── HomePage.tsx           # 메인 홈 페이지
├── ProjectCard.tsx        # 프로젝트 카드
├── GalleryCard.tsx        # 갤러리 템플릿 카드
└── CreateProjectDialog.tsx # 프로젝트 생성 다이얼로그
```

### 프로젝트 관리 API

**기본 경로**: `~/makecc` (또는 `MAKECC_HOME` 환경변수)

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/projects` | 프로젝트 + 갤러리 목록 |
| `POST /api/projects` | 새 프로젝트 생성 |
| `DELETE /api/projects/:id` | 프로젝트 삭제 (휴지통으로 이동) |

### 프로젝트 디렉토리 구조

```
~/makecc/[project-name]/
├── project.json        # 메타데이터 (id, description, createdAt)
├── CLAUDE.md           # 프로젝트 가이드
└── .claude/
    ├── skills/         # 스킬 저장소
    └── agents/         # 에이전트 저장소
```

## 핵심 흐름

### 스킬 생성 플로우

1. 사용자가 프롬프트 입력 ("스킬 만들어줘" 키워드 감지)
2. `/api/generate/skill` API 호출
3. AI가 SKILL.md + 스크립트 생성
4. 프로젝트의 `.claude/skills/[skill-name]/`에 저장

### 워크플로우 생성 플로우

1. 사용자가 워크플로우 설명 입력
2. AI가 노드 기반 워크플로우 JSON 생성
3. UI에서 시각적으로 편집 가능
4. `.claude/agents/`에 에이전트로 저장

## 기술 스택

- **프론트엔드**: React 19, @xyflow/react, Zustand, Tailwind CSS
- **백엔드**: Express 5, Socket.IO
- **AI**: Anthropic Claude API (@anthropic-ai/sdk)
- **빌드**: Vite, TypeScript

## 개발 명령어

```bash
# 개발 서버 (프론트 + 백엔드)
npm run dev:all

# 빌드
npm run build

# 빌드 후 테스트
npm run start
```

## API 키 설정

- UI 우측 상단 설정 아이콘에서 API 키 설정
- 프록시 서버 사용 또는 직접 API 키 입력
- 입력된 API 키는 프로젝트 루트의 `.env`에 저장

## 에이전트/스킬 정의 형식

### 에이전트 (`.claude/agents/[name].md`)

```yaml
---
name: agent-name
description: 설명
tools: WebSearch, WebFetch, Read, Grep, Glob
model: sonnet
---
```

### 스킬 (`.claude/skills/[name]/SKILL.md`)

```yaml
---
name: skill-name
description: 스킬 설명
---

# 스킬 사용법
...
```

<!-- makecc-managed-section -->
## makecc 스킬/워크플로우 규칙

이 섹션은 makecc에 의해 자동 생성되었습니다.

### Python 가상환경

**모든 스킬은 프로젝트 로컬 가상환경을 사용합니다:**

```
.venv/
```

**사용 패턴:**

```bash
# 로컬 venv Python 직접 실행 (권장)
.venv/bin/python script.py

# 또는 활성화 후 실행
source .venv/bin/activate && python script.py
```

### 패키지 관리

**uv를 우선 사용합니다 (pip보다 10-100x 빠름):**

```bash
# uv로 패키지 설치 (권장)
uv pip install --python .venv/bin/python package_name

# requirements.txt 설치
uv pip install --python .venv/bin/python -r requirements.txt

# uv가 없으면 pip 폴백
.venv/bin/pip install package_name
```

### 스킬 저장 경로

| 항목 | 경로 |
|------|------|
| 스킬 | `.claude/skills/[skill-name]/` |
| 에이전트 | `.claude/agents/[agent-name].md` |
| 워크플로우 | `.claude/agents/[workflow-name].md` |

### 스킬 구조

```
.claude/skills/[skill-name]/
├── SKILL.md          # 스킬 정의 (필수)
├── scripts/
│   └── main.py       # 메인 스크립트
└── requirements.txt  # 의존성 목록
```

### 스킬 실행 규칙

1. **가상환경 사용**: 항상 `.venv/bin/python` 사용
2. **의존성 설치**: `uv pip install` 우선, 실패 시 `pip` 폴백
3. **경로 참조**: 상대 경로 대신 절대 경로 사용 권장
4. **한글 지원**: 사용자 메시지는 한글로 출력

<!-- /makecc-managed-section -->
