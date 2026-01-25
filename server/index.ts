import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { ClaudeService } from './services/claudeService';
import { fileService } from './services/fileService';
import { workflowAIService } from './services/workflowAIService';
import { workflowExecutionService } from './services/workflowExecutionService';
import { executeInTerminal, getClaudeCommand } from './services/terminalService';
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

// Generate workflow using AI
app.post('/api/generate/workflow', async (req, res) => {
  try {
    const { prompt } = req.body as { prompt: string };

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    console.log('Generating workflow for prompt:', prompt);
    const result = await workflowAIService.generate(prompt);
    console.log('Workflow generated:', result.workflowName);

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Generate workflow error:', errorMessage);
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

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
