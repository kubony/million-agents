---
name: visual-builder
description: Visual Workflow Builder를 실행합니다. 노드 기반 UI로 AI 에이전트 워크플로우를 설계하고 실행할 수 있습니다.
---

# Visual Workflow Builder

노드 기반의 비주얼 워크플로우 빌더를 실행합니다.

## 사용 시점

- 복잡한 AI 워크플로우를 시각적으로 설계하고 싶을 때
- 여러 에이전트를 연결하여 파이프라인을 구성하고 싶을 때
- 워크플로우 실행 결과를 확인하고 싶을 때

## 실행 방법

프로젝트 루트에서 다음 명령을 실행합니다:

```bash
cd {{projectRoot}}
npm run dev
```

브라우저에서 http://localhost:5173 으로 접속합니다.

## 주요 기능

1. **노드 타입**
   - **Input**: 사용자 입력 (텍스트, 파일, 선택)
   - **Subagent**: AI 에이전트 노드 (Claude API 호출)
   - **Skill**: 스킬 실행 노드
   - **MCP**: MCP 서버 연동 노드
   - **Output**: 결과 출력 노드

2. **워크플로우 실행**
   - Run Workflow 버튼으로 실행
   - 실시간 콘솔 로그 확인
   - 결과 마크다운 파일 다운로드

3. **AI 워크플로우 생성**
   - 프롬프트 바에서 자연어로 워크플로우 생성 가능
   - 예: "블로그 글 작성 워크플로우 만들어줘"

## 환경 설정

`.env` 파일에 API 키가 필요합니다:

```env
VITE_ANTHROPIC_API_KEY=your-api-key
```

## 출력

- 워크플로우 실행 결과는 마크다운 파일로 다운로드됩니다
- 콘솔에서 실시간 로그를 확인할 수 있습니다
