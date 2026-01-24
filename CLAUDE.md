# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

million_agent is a Claude Code Sub-Agent project. This repository follows the modular agent architecture pattern established in sibling projects.

## Project Structure

```
million_agent/
├── .claude/
│   ├── agents/           # Agent definitions (YAML frontmatter + markdown)
│   ├── skills/           # Skill implementations with SKILL.md files
│   └── settings.local.json  # Permissions configuration
├── CLAUDE.md             # This file
└── package.json          # Dependencies (if Node.js based)
```

## Agent Definition Format

Agents are defined in `.claude/agents/[agent-name].md` with YAML frontmatter:

```yaml
---
name: agent-name
description: Human readable description
tools: WebSearch, WebFetch, Read, Grep, Glob
model: sonnet
subagents:
  - other-agent
---
```

## Skill Definition Format

Skills are defined in `.claude/skills/[skill-name]/SKILL.md`:

```yaml
---
name: skill-name
description: What the skill does
---
```

## Permissions Configuration

Configure in `.claude/settings.local.json`:

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

## Model Selection Guidelines

- **Sonnet**: Fast, cost-efficient tasks (research, structure, organization)
- **Opus**: High-quality generation (writing, complex reasoning)

## Data Passing Between Agents

Agents communicate via JSON files in a defined schema. Each agent reads from its input file and writes to its output file for the next stage.
