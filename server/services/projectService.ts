import { promises as fs, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { nanoid } from 'nanoid';

export interface Project {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  skillCount: number;
  agentCount: number;
  path: string;
  lastModified: string;
  createdAt: string;
}

export interface GalleryItem {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  author: string;
  downloads: number;
  tags: string[];
}

// Default makecc home directory
const MAKECC_HOME = process.env.MAKECC_HOME || join(homedir(), 'makecc');

// Gallery items (static for now, could be fetched from a registry later)
const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'gmail-assistant',
    name: 'Gmail Assistant',
    description: 'Read, write and organize emails using Claude',
    thumbnail: '/gallery/gmail.png',
    author: 'makecc',
    downloads: 1234,
    tags: ['email', 'productivity'],
  },
  {
    id: 'web-scraper',
    name: 'Web Scraper',
    description: 'Extract data from websites automatically',
    thumbnail: '/gallery/scraper.png',
    author: 'makecc',
    downloads: 892,
    tags: ['data', 'automation'],
  },
  {
    id: 'document-analyzer',
    name: 'Document Analyzer',
    description: 'Analyze and summarize PDF documents',
    thumbnail: '/gallery/docs.png',
    author: 'makecc',
    downloads: 567,
    tags: ['pdf', 'analysis'],
  },
];

class ProjectService {
  private makeccHome: string;

  constructor() {
    this.makeccHome = MAKECC_HOME;
  }

  getMakeccHome(): string {
    return this.makeccHome;
  }

  async ensureMakeccHome(): Promise<void> {
    if (!existsSync(this.makeccHome)) {
      await fs.mkdir(this.makeccHome, { recursive: true });
      console.log(`Created makecc home directory: ${this.makeccHome}`);
    }
  }

  async listProjects(): Promise<Project[]> {
    await this.ensureMakeccHome();

    const entries = await fs.readdir(this.makeccHome, { withFileTypes: true });
    const projects: Project[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const projectPath = join(this.makeccHome, entry.name);
      const project = await this.loadProjectInfo(projectPath, entry.name);
      if (project) {
        projects.push(project);
      }
    }

    // Sort by lastModified (most recent first)
    projects.sort((a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );

    return projects;
  }

  private async loadProjectInfo(projectPath: string, name: string): Promise<Project | null> {
    try {
      const stat = await fs.stat(projectPath);

      // Read project.json if exists
      const configPath = join(projectPath, 'project.json');
      let config: { description?: string; id?: string; createdAt?: string } = {};

      if (existsSync(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(content);
      }

      // Count skills and agents
      const claudePath = join(projectPath, '.claude');
      let skillCount = 0;
      let agentCount = 0;

      if (existsSync(claudePath)) {
        const skillsPath = join(claudePath, 'skills');
        const agentsPath = join(claudePath, 'agents');

        if (existsSync(skillsPath)) {
          const skills = await fs.readdir(skillsPath, { withFileTypes: true });
          skillCount = skills.filter(s => s.isDirectory()).length;
        }

        if (existsSync(agentsPath)) {
          const agents = await fs.readdir(agentsPath);
          agentCount = agents.filter(a => a.endsWith('.md')).length;
        }
      }

      return {
        id: config.id || name,
        name,
        description: config.description || '',
        skillCount,
        agentCount,
        path: projectPath,
        lastModified: stat.mtime.toISOString(),
        createdAt: config.createdAt || stat.birthtime.toISOString(),
      };
    } catch (error) {
      console.error(`Failed to load project info for ${name}:`, error);
      return null;
    }
  }

  async createProject(name: string, description: string): Promise<Project> {
    await this.ensureMakeccHome();

    // Sanitize project name
    const sanitizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const projectPath = join(this.makeccHome, sanitizedName);

    if (existsSync(projectPath)) {
      throw new Error(`Project "${sanitizedName}" already exists`);
    }

    // Create project directory structure
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(join(projectPath, '.claude', 'skills'), { recursive: true });
    await fs.mkdir(join(projectPath, '.claude', 'agents'), { recursive: true });

    // Create project.json
    const projectId = nanoid(10);
    const now = new Date().toISOString();
    const config = {
      id: projectId,
      name: sanitizedName,
      description,
      createdAt: now,
    };

    await fs.writeFile(
      join(projectPath, 'project.json'),
      JSON.stringify(config, null, 2)
    );

    // Create CLAUDE.md
    const claudeMd = `# ${name}

${description}

## Project Structure

\`\`\`
${sanitizedName}/
├── .claude/
│   ├── skills/      # Claude Code skills
│   └── agents/      # Claude Code agents
└── project.json     # Project configuration
\`\`\`

## Getting Started

1. Open this project in makecc
2. Create skills using natural language
3. Build workflows to automate tasks
`;

    await fs.writeFile(join(projectPath, 'CLAUDE.md'), claudeMd);

    return {
      id: projectId,
      name: sanitizedName,
      description,
      skillCount: 0,
      agentCount: 0,
      path: projectPath,
      lastModified: now,
      createdAt: now,
    };
  }

  async deleteProject(projectId: string): Promise<void> {
    const projects = await this.listProjects();
    const project = projects.find(p => p.id === projectId || p.name === projectId);

    if (!project) {
      throw new Error(`Project "${projectId}" not found`);
    }

    // Move to trash instead of permanent delete
    const trashPath = join(this.makeccHome, '.trash');
    await fs.mkdir(trashPath, { recursive: true });

    const trashName = `${project.name}_${Date.now()}`;
    await fs.rename(project.path, join(trashPath, trashName));
  }

  async copyProject(projectId: string): Promise<Project> {
    const projects = await this.listProjects();
    const sourceProject = projects.find(p => p.id === projectId || p.name === projectId);

    if (!sourceProject) {
      throw new Error(`Project "${projectId}" not found`);
    }

    // Generate new name with copy suffix
    let newName = `${sourceProject.name}-copy`;
    let counter = 1;
    while (existsSync(join(this.makeccHome, newName))) {
      newName = `${sourceProject.name}-copy-${counter}`;
      counter++;
    }

    const newProjectPath = join(this.makeccHome, newName);

    // Recursively copy directory
    await this.copyDirectory(sourceProject.path, newProjectPath);

    // Update project.json with new id and name
    const projectId2 = nanoid(10);
    const now = new Date().toISOString();
    const configPath = join(newProjectPath, 'project.json');

    let config: { description?: string } = {};
    if (existsSync(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    }

    const newConfig = {
      ...config,
      id: projectId2,
      name: newName,
      createdAt: now,
    };

    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));

    // Return the new project info
    const newProject = await this.loadProjectInfo(newProjectPath, newName);
    if (!newProject) {
      throw new Error('Failed to load copied project');
    }

    return newProject;
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  async getProject(projectId: string): Promise<Project | null> {
    const projects = await this.listProjects();
    return projects.find(p => p.id === projectId || p.name === projectId) || null;
  }

  getGalleryItems(): GalleryItem[] {
    return GALLERY_ITEMS;
  }

  async createSampleProjects(): Promise<void> {
    await this.ensureMakeccHome();

    // Check if samples already exist
    const projects = await this.listProjects();
    const hasGmail = projects.some(p => p.name === 'gmail-assistant');
    const hasScraper = projects.some(p => p.name === 'web-scraper');

    if (!hasGmail) {
      await this.createGmailSampleProject();
    }

    if (!hasScraper) {
      await this.createScraperSampleProject();
    }
  }

  private async createGmailSampleProject(): Promise<void> {
    const projectPath = join(this.makeccHome, 'gmail-assistant');
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(join(projectPath, '.claude', 'skills', 'gmail'), { recursive: true });
    await fs.mkdir(join(projectPath, '.claude', 'agents'), { recursive: true });

    // project.json
    await fs.writeFile(
      join(projectPath, 'project.json'),
      JSON.stringify({
        id: 'gmail-sample',
        name: 'gmail-assistant',
        description: 'Read, write and organize emails using Claude',
        createdAt: new Date().toISOString(),
      }, null, 2)
    );

    // Sample skill: SKILL.md
    const skillMd = `---
name: gmail
description: Gmail 읽기/쓰기 스킬
---

# Gmail Skill

이 스킬은 Gmail API를 사용하여 이메일을 읽고 쓸 수 있게 합니다.

## 사용법

\`\`\`bash
python scripts/main.py read --count 10
python scripts/main.py send --to "user@example.com" --subject "Hello" --body "Hi there!"
\`\`\`

## 기능

- 받은편지함 읽기
- 이메일 검색
- 이메일 작성 및 전송
- 라벨 관리
`;

    await fs.writeFile(
      join(projectPath, '.claude', 'skills', 'gmail', 'SKILL.md'),
      skillMd
    );

    // Sample Python script
    const mainPy = `#!/usr/bin/env python3
"""Gmail skill for reading and writing emails."""

import argparse
import json

def read_emails(count: int = 10):
    """Read recent emails from inbox."""
    print(json.dumps({
        "status": "success",
        "message": f"Would read {count} emails from Gmail",
        "note": "This is a sample - configure Gmail API credentials to use"
    }))

def send_email(to: str, subject: str, body: str):
    """Send an email."""
    print(json.dumps({
        "status": "success",
        "message": f"Would send email to {to}",
        "subject": subject,
        "note": "This is a sample - configure Gmail API credentials to use"
    }))

def main():
    parser = argparse.ArgumentParser(description='Gmail Skill')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Read command
    read_parser = subparsers.add_parser('read', help='Read emails')
    read_parser.add_argument('--count', type=int, default=10, help='Number of emails')

    # Send command
    send_parser = subparsers.add_parser('send', help='Send email')
    send_parser.add_argument('--to', required=True, help='Recipient')
    send_parser.add_argument('--subject', required=True, help='Subject')
    send_parser.add_argument('--body', required=True, help='Body')

    args = parser.parse_args()

    if args.command == 'read':
        read_emails(args.count)
    elif args.command == 'send':
        send_email(args.to, args.subject, args.body)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
`;

    await fs.mkdir(join(projectPath, '.claude', 'skills', 'gmail', 'scripts'), { recursive: true });
    await fs.writeFile(
      join(projectPath, '.claude', 'skills', 'gmail', 'scripts', 'main.py'),
      mainPy
    );

    console.log('Created sample project: gmail-assistant');
  }

  private async createScraperSampleProject(): Promise<void> {
    const projectPath = join(this.makeccHome, 'web-scraper');
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(join(projectPath, '.claude', 'agents'), { recursive: true });

    // project.json
    await fs.writeFile(
      join(projectPath, 'project.json'),
      JSON.stringify({
        id: 'scraper-sample',
        name: 'web-scraper',
        description: 'Extract data from websites automatically',
        createdAt: new Date().toISOString(),
      }, null, 2)
    );

    // Sample agent
    const agentMd = `---
name: web-scraper
description: 웹 페이지에서 데이터를 추출하는 에이전트
tools: WebFetch, Read, Write
model: sonnet
---

# Web Scraper Agent

이 에이전트는 웹 페이지에서 데이터를 추출하고 구조화합니다.

## 워크플로우

1. URL을 입력받습니다
2. WebFetch로 페이지 내용을 가져옵니다
3. 원하는 데이터를 추출합니다
4. JSON 또는 CSV로 결과를 저장합니다

## 사용 예시

"https://example.com에서 모든 제품 이름과 가격을 추출해줘"
`;

    await fs.writeFile(
      join(projectPath, '.claude', 'agents', 'web-scraper.md'),
      agentMd
    );

    console.log('Created sample project: web-scraper');
  }
}

export const projectService = new ProjectService();
