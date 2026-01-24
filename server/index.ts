import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ClaudeService } from './services/claudeService';
import { fileService } from './services/fileService';
import { workflowAIService } from './services/workflowAIService';
import { executeInTerminal, getClaudeCommand } from './services/terminalService';
import type { WorkflowExecutionRequest, NodeExecutionUpdate } from './types';
import type { ClaudeConfigExport, SaveOptions } from './services/fileService';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

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

  // Execute workflow - Opens Terminal with claude -c command
  socket.on('execute:workflow', async (data: WorkflowExecutionRequest) => {
    console.log('Executing workflow in Terminal:', data.workflowId);

    try {
      // Emit start event
      socket.emit('workflow:started', { workflowId: data.workflowId });

      socket.emit('console:log', {
        type: 'info',
        message: 'Opening Terminal with Claude Code...',
        timestamp: new Date().toISOString(),
      });

      // Execute in terminal
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

        // Also send the command for reference
        const command = getClaudeCommand({
          workflowName: data.workflowName,
          nodes: data.nodes,
          edges: data.edges,
          inputs: data.inputs,
        });

        socket.emit('console:log', {
          type: 'debug',
          message: `Command: ${command.substring(0, 200)}...`,
          timestamp: new Date().toISOString(),
        });

        socket.emit('workflow:completed', { workflowId: data.workflowId });
      } else {
        socket.emit('console:log', {
          type: 'error',
          message: result.message,
          timestamp: new Date().toISOString(),
        });

        socket.emit('workflow:error', {
          workflowId: data.workflowId,
          error: result.message
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      socket.emit('console:log', {
        type: 'error',
        message: `Error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      });
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

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
