# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소의 코드를 다룰 때 참고하는 가이드입니다.

## 프로젝트 개요

million_agent는 Claude Code 서브 에이전트 프로젝트입니다. 이 저장소는 형제 프로젝트들에서 확립된 모듈형 에이전트 아키텍처 패턴을 따릅니다.

## 프로젝트 구조

```
million_agent/
├── .claude/
│   ├── agents/           # 에이전트 정의 (YAML 프론트매터 + 마크다운)
│   ├── skills/           # SKILL.md 파일을 포함한 스킬 구현
│   └── settings.local.json  # 권한 설정
├── CLAUDE.md             # 이 파일
└── package.json          # 의존성 (Node.js 기반인 경우)
```

## 에이전트 정의 형식

에이전트는 `.claude/agents/[에이전트명].md`에 YAML 프론트매터로 정의합니다:

```yaml
---
name: agent-name
description: 사람이 읽을 수 있는 설명
tools: WebSearch, WebFetch, Read, Grep, Glob
model: sonnet
subagents:
  - other-agent
---
```

## 스킬 정의 형식

스킬은 `.claude/skills/[스킬명]/SKILL.md`에 정의합니다:

```yaml
---
name: skill-name
description: 스킬이 하는 일
---
```

## 권한 설정

`.claude/settings.local.json`에서 설정합니다:

```json
{
  "permissions": {
    "allow": [
      "Skill(skill-name)",
      "Skill(skill-name:*)",
      "Bash(cd:*)"
    ]
  }
}
```

## 모델 선택 가이드

- **Sonnet**: 빠르고 비용 효율적인 작업 (리서치, 구조화, 정리)
- **Opus**: 고품질 생성 (작문, 복잡한 추론)

## 에이전트 간 데이터 전달

에이전트들은 정의된 스키마의 JSON 파일을 통해 통신합니다. 각 에이전트는 입력 파일에서 읽고, 다음 단계를 위해 출력 파일에 씁니다.
