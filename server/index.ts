import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ClaudeService } from './services/claudeService';
import { fileService } from './services/fileService';
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Execute workflow
  socket.on('execute:workflow', async (data: WorkflowExecutionRequest) => {
    console.log('Executing workflow:', data.workflowId);

    try {
      // Emit start event
      socket.emit('workflow:started', { workflowId: data.workflowId });

      // Execute each node in order
      for (const node of data.nodes) {
        // Update node status to running
        const runningUpdate: NodeExecutionUpdate = {
          nodeId: node.id,
          status: 'running',
          progress: 0,
        };
        socket.emit('node:update', runningUpdate);

        try {
          // Execute node based on type
          const result = await claudeService.executeNode(node, (progress) => {
            socket.emit('node:update', {
              nodeId: node.id,
              status: 'running',
              progress,
            });
          });

          // Update node status to completed
          const completedUpdate: NodeExecutionUpdate = {
            nodeId: node.id,
            status: 'completed',
            progress: 100,
            result,
          };
          socket.emit('node:update', completedUpdate);

          // Emit console log
          socket.emit('console:log', {
            type: 'info',
            message: `Node ${node.data.label} completed`,
            timestamp: new Date().toISOString(),
            nodeId: node.id,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          const errorUpdate: NodeExecutionUpdate = {
            nodeId: node.id,
            status: 'error',
            error: errorMessage,
          };
          socket.emit('node:update', errorUpdate);

          socket.emit('console:log', {
            type: 'error',
            message: `Error in node ${node.data.label}: ${errorMessage}`,
            timestamp: new Date().toISOString(),
            nodeId: node.id,
          });

          // Stop execution on error
          break;
        }
      }

      socket.emit('workflow:completed', { workflowId: data.workflowId });
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

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
