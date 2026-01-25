import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, promises as fs } from 'fs';

// 프로젝트 경로의 .env 파일을 명시적으로 로드
// npx makecc 실행 시 MAKECC_PROJECT_PATH가 사용자 프로젝트 경로를 가리킴
const projectPath = process.env.MAKECC_PROJECT_PATH || process.cwd();
const envPath = join(projectPath, '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loaded .env from: ${envPath}`);
} else {
  // 폴백: 현재 디렉토리에서 로드 시도
  dotenv.config();
}
import { ClaudeService } from './services/claudeService';
import { fileService } from './services/fileService';
import { workflowAIService } from './services/workflowAIService';
import { skillGeneratorService, type SkillProgressEvent } from './services/skillGeneratorService';
import { nodeSyncService } from './services/nodeSyncService';
import { configLoaderService } from './services/configLoaderService';
import { workflowExecutionService } from './services/workflowExecutionService';
import { executeInTerminal, getClaudeCommand } from './services/terminalService';
import { claudeMdService } from './services/claudeMdService';
import type { WorkflowExecutionRequest, NodeExecutionUpdate } from './types';
import type { ClaudeConfigExport, SaveOptions } from './services/fileService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

const isProduction = process.env.NODE_ENV === 'production';

const io = new Server(httpServer, {
  cors: {
    origin: isProduction
      ? undefined
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Serve static files in production
if (isProduction) {
  const clientDistPath = join(__dirname, '..', 'dist', 'client');
  if (existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
  }
}

const claudeService = new ClaudeService();

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get project path
app.get('/api/project-path', (req, res) => {
  res.json({ path: fileService.getProjectPath() });
});

// Save workflow as Claude Code configuration
app.post('/api/save/workflow', async (req, res) => {
  try {
    const { config, options } = req.body as {
      config: ClaudeConfigExport;
      options: SaveOptions;
    };

    if (!config || !options) {
      return res.status(400).json({ message: 'Missing config or options' });
    }

    const result = await fileService.saveWorkflow(config, options);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Save workflow error:', errorMessage);
    res.status(500).json({ message: errorMessage });
  }
});

// Save API key to .env
app.post('/api/settings/api-key', async (req, res) => {
  try {
    const { apiKey } = req.body as { apiKey: string };

    if (!apiKey) {
      return res.status(400).json({ message: 'API key is required' });
    }

    const result = await fileService.saveApiKey(apiKey);
    if (result.success) {
      res.json({ success: true, message: 'API 키가 .env 파일에 저장되었습니다.' });
    } else {
      res.status(500).json({ success: false, message: result.error });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
});

// Get API settings
app.get('/api/settings/api-key', async (req, res) => {
  try {
    const settings = await fileService.getApiSettings();
    res.json(settings);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
});

// Sync node to file system
app.post('/api/sync/node', async (req, res) => {
  try {
    const { node } = req.body;
    if (!node) {
      return res.status(400).json({ message: 'Node data is required' });
    }

    const result = await nodeSyncService.syncNode(node);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ message: result.error });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
});

// Delete node from file system
app.delete('/api/sync/node', async (req, res) => {
  try {
    const { node, nodes } = req.body;
    if (!node) {
      return res.status(400).json({ message: 'Node data is required' });
    }

    const result = await nodeSyncService.deleteNode(node, nodes);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ message: result.error });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
});

// Sync edge (connection) to file system
app.post('/api/sync/edge', async (req, res) => {
  try {
    const { edge, nodes } = req.body;
    if (!edge || !nodes) {
      return res.status(400).json({ message: 'Edge and nodes data are required' });
    }

    const result = await nodeSyncService.syncEdge(edge, nodes);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ message: result.error });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
});

// Remove edge from file system
app.delete('/api/sync/edge', async (req, res) => {
  try {
    const { edge, nodes } = req.body;
    if (!edge || !nodes) {
      return res.status(400).json({ message: 'Edge and nodes data are required' });
    }

    const result = await nodeSyncService.removeEdge(edge, nodes);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ message: result.error });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
});

// Generate skill using AI
app.post('/api/generate/skill', async (req, res) => {
  try {
    const { prompt } = req.body as { prompt: string };

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    const apiMode = req.headers['x-api-mode'] as string || 'proxy';
    const apiKey = req.headers['x-api-key'] as string;
    const proxyUrl = req.headers['x-proxy-url'] as string;

    console.log('Generating skill for prompt:', prompt);

    const result = await skillGeneratorService.generate(prompt, {
      apiMode: apiMode as 'proxy' | 'direct',
      apiKey,
      proxyUrl,
    });

    if (result.success) {
      console.log('Skill generated:', result.skill?.skillName, 'at', result.savedPath);
      res.json(result);
    } else {
      res.status(500).json({ message: result.error });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Generate skill error:', errorMessage);
    res.status(500).json({ message: errorMessage });
  }
});

// Load existing Claude config from .claude/ directory
app.get('/api/load/claude-config', async (req, res) => {
  try {
    const config = await configLoaderService.loadAll();
    console.log(
      `Loaded config: ${config.skills.length} skills, ${config.agents.length} agents, ${config.hooks.length} hooks`
    );
    res.json(config);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Load config error:', errorMessage);
    res.status(500).json({ message: errorMessage });
  }
});

// Generate workflow using AI
app.post('/api/generate/workflow', async (req, res) => {
  try {
    const { prompt, expand = true } = req.body as { prompt: string; expand?: boolean };

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // Get API settings from headers
    const apiMode = req.headers['x-api-mode'] as string || 'proxy';
    const apiKey = req.headers['x-api-key'] as string;
    const proxyUrl = req.headers['x-proxy-url'] as string;

    console.log('Generating workflow for prompt:', prompt, 'mode:', apiMode, 'expand:', expand);

    const settings = {
      apiMode: apiMode as 'proxy' | 'direct',
      apiKey,
      proxyUrl,
    };

    // expand=true (기본값)이면 재귀적으로 스킬/에이전트 상세 생성
    const result = expand
      ? await workflowAIService.generateWithExpansion(prompt, settings, (event) => {
          console.log(`[Workflow] ${event.step}: ${event.message}`);
        })
      : await workflowAIService.generate(prompt, settings);

    console.log('Workflow generated:', result.workflowName);

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Generate workflow error:', errorMessage);
    res.status(500).json({ message: errorMessage });
  }
});

// Test skill execution
app.post('/api/skill/test', async (req, res) => {
  const { spawn } = await import('child_process');

  try {
    const { skillPath, args } = req.body as { skillPath: string; args?: string[] };

    if (!skillPath) {
      return res.status(400).json({ message: 'Skill path is required' });
    }

    // 보안: 프로젝트 경로 내의 파일만 접근 허용
    const projectRoot = fileService.getProjectPath();
    if (!skillPath.startsWith(projectRoot)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const mainPyPath = join(skillPath, 'scripts', 'main.py');
    if (!existsSync(mainPyPath)) {
      return res.status(404).json({ message: 'main.py not found' });
    }

    // 로컬 프로젝트의 .venv 사용
    const localPythonPath = join(projectRoot, '.venv', 'bin', 'python');
    const command = existsSync(localPythonPath) ? localPythonPath : 'python3';

    console.log(`Testing skill: ${command} ${mainPyPath}`);

    return new Promise<void>((resolve) => {
      const proc = spawn(command, [mainPyPath, ...(args || [])], {
        cwd: skillPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000, // 30초 타임아웃
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        res.json({
          success: code === 0,
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
        resolve();
      });

      proc.on('error', (err) => {
        res.status(500).json({
          success: false,
          error: err.message,
        });
        resolve();
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Skill test error:', errorMessage);
    res.status(500).json({ message: errorMessage });
  }
});

// Save workflow output to local project
app.post('/api/save/workflow-output', async (req, res) => {
  try {
    const { workflowName, files } = req.body as {
      workflowName: string;
      files: Array<{ name: string; content: string }>;
    };

    if (!workflowName || !files || files.length === 0) {
      return res.status(400).json({ message: 'Workflow name and files are required' });
    }

    // output/워크플로우명/ 폴더 생성
    const sanitizedName = workflowName.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
    const outputDir = join(fileService.getProjectPath(), 'output', sanitizedName);

    await fs.mkdir(outputDir, { recursive: true });

    const savedFiles: Array<{ name: string; path: string }> = [];

    for (const file of files) {
      const filePath = join(outputDir, file.name);
      await fs.writeFile(filePath, file.content, 'utf-8');
      savedFiles.push({ name: file.name, path: filePath });
      console.log(`Saved workflow output: ${filePath}`);
    }

    res.json({
      success: true,
      outputDir,
      files: savedFiles,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Save workflow output error:', errorMessage);
    res.status(500).json({ message: errorMessage });
  }
});

// Read skill files for preview
app.get('/api/skill/files', async (req, res) => {
  try {
    const skillPath = req.query.path as string;

    if (!skillPath) {
      return res.status(400).json({ message: 'Skill path is required' });
    }

    // 보안: 프로젝트 경로 내의 파일만 접근 허용
    const projectRoot = fileService.getProjectPath();
    if (!skillPath.startsWith(projectRoot)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const files: Array<{ name: string; content: string; language: string }> = [];

    // SKILL.md 읽기
    const skillMdPath = join(skillPath, 'SKILL.md');
    if (existsSync(skillMdPath)) {
      const content = await fs.readFile(skillMdPath, 'utf-8');
      files.push({ name: 'SKILL.md', content, language: 'markdown' });
    }

    // scripts/main.py 읽기
    const mainPyPath = join(skillPath, 'scripts', 'main.py');
    if (existsSync(mainPyPath)) {
      const content = await fs.readFile(mainPyPath, 'utf-8');
      files.push({ name: 'scripts/main.py', content, language: 'python' });
    }

    // requirements.txt 읽기
    const requirementsPath = join(skillPath, 'requirements.txt');
    if (existsSync(requirementsPath)) {
      const content = await fs.readFile(requirementsPath, 'utf-8');
      files.push({ name: 'requirements.txt', content, language: 'text' });
    }

    res.json({ files });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Read skill files error:', errorMessage);
    res.status(500).json({ message: errorMessage });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Execute workflow - Actually executes the workflow using Claude Code SDK
  socket.on('execute:workflow', async (data: WorkflowExecutionRequest) => {
    console.log('Executing workflow:', data.workflowId);

    try {
      // Emit start event
      socket.emit('workflow:started', { workflowId: data.workflowId });

      socket.emit('console:log', {
        type: 'info',
        message: `워크플로우 "${data.workflowName}" 실행 시작...`,
        timestamp: new Date().toISOString(),
      });

      // 출력 디렉토리 설정
      const outputDir = join(fileService.getProjectPath(), 'output', data.workflowId);

      // 실제 워크플로우 실행
      const results = await workflowExecutionService.execute(
        {
          workflowId: data.workflowId,
          workflowName: data.workflowName,
          nodes: data.nodes,
          edges: data.edges,
          inputs: data.inputs,
          outputDir,
        },
        // Progress callback
        (update: NodeExecutionUpdate) => {
          socket.emit('node:update', update);
        },
        // Log callback
        (type, message) => {
          socket.emit('console:log', {
            type,
            message,
            timestamp: new Date().toISOString(),
          });
        }
      );

      // 결과 수집
      const allResults: Array<{
        nodeId: string;
        label: string;
        success: boolean;
        result?: string;
        files?: Array<{ path: string; type: string; name: string }>;
        error?: string;
      }> = [];

      for (const [nodeId, result] of results) {
        const node = data.nodes.find((n) => n.id === nodeId);
        allResults.push({
          nodeId,
          label: node?.data.label || nodeId,
          success: result.success,
          result: result.result,
          files: result.files,
          error: result.error,
        });
      }

      // 최종 결과 전송
      socket.emit('workflow:completed', {
        workflowId: data.workflowId,
        results: allResults,
        outputDir,
      });

      socket.emit('console:log', {
        type: 'info',
        message: `워크플로우 실행 완료! 결과가 ${outputDir}에 저장되었습니다.`,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      socket.emit('console:log', {
        type: 'error',
        message: `실행 오류: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      });
      socket.emit('workflow:error', { workflowId: data.workflowId, error: errorMessage });
    }
  });

  // Execute workflow in Terminal (alternative mode)
  socket.on('execute:workflow:terminal', async (data: WorkflowExecutionRequest) => {
    console.log('Executing workflow in Terminal:', data.workflowId);

    try {
      socket.emit('workflow:started', { workflowId: data.workflowId });

      socket.emit('console:log', {
        type: 'info',
        message: 'Opening Terminal with Claude Code...',
        timestamp: new Date().toISOString(),
      });

      const result = await executeInTerminal({
        workflowName: data.workflowName,
        nodes: data.nodes,
        edges: data.edges,
        inputs: data.inputs,
        workingDirectory: fileService.getProjectPath(),
      });

      if (result.success) {
        socket.emit('console:log', {
          type: 'info',
          message: result.message,
          timestamp: new Date().toISOString(),
        });
        socket.emit('workflow:completed', { workflowId: data.workflowId });
      } else {
        socket.emit('workflow:error', {
          workflowId: data.workflowId,
          error: result.message
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      socket.emit('workflow:error', { workflowId: data.workflowId, error: errorMessage });
    }
  });

  // Cancel workflow execution
  socket.on('execute:cancel', () => {
    claudeService.cancelExecution();
    socket.emit('workflow:cancelled');
  });

  // Generate skill with real-time progress
  socket.on('generate:skill', async (data: {
    prompt: string;
    apiMode?: 'proxy' | 'direct';
    apiKey?: string;
    proxyUrl?: string;
  }) => {
    console.log('Generating skill via Socket.IO:', data.prompt);

    try {
      const result = await skillGeneratorService.generate(
        data.prompt,
        {
          apiMode: data.apiMode || 'proxy',
          apiKey: data.apiKey,
          proxyUrl: data.proxyUrl,
        },
        // Progress callback
        (event: SkillProgressEvent) => {
          socket.emit('skill:progress', event);
        }
      );

      if (result.success) {
        socket.emit('skill:completed', {
          skill: result.skill,
          savedPath: result.savedPath,
        });
      } else {
        socket.emit('skill:error', {
          error: result.error,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      socket.emit('skill:error', { error: errorMessage });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// SPA fallback - serve index.html for all non-API routes in production
if (isProduction) {
  const clientDistPath = join(__dirname, '..', 'dist', 'client');
  app.get('/{*path}', (req, res) => {
    res.sendFile(join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;

// 서버 시작 시 프로젝트 초기화
async function startServer() {
  try {
    // CLAUDE.md, .venv, uv 초기화
    await claudeMdService.setup();
  } catch (error) {
    console.error('Project setup warning:', error);
    // 초기화 실패해도 서버는 시작
  }

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
