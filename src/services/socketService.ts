import { io, Socket } from 'socket.io-client';
import type { WorkflowNode, WorkflowEdge, NodeStatus } from '../types/nodes';

const SOCKET_URL = 'http://localhost:3001';

// Event types
export interface NodeUpdateEvent {
  nodeId: string;
  status: NodeStatus;
  progress?: number;
  result?: string;
  error?: string;
}

export interface ConsoleLogEvent {
  type: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  nodeId?: string;
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  workflowName: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  inputs?: Record<string, string>;
}

// Workflow result types
export interface WorkflowResult {
  nodeId: string;
  label: string;
  success: boolean;
  result?: string;
  files?: Array<{ path: string; type: string; name: string }>;
  error?: string;
}

export interface WorkflowCompletedData {
  workflowId: string;
  results?: WorkflowResult[];
  outputDir?: string;
}

// Event handlers type
export interface SocketEventHandlers {
  onNodeUpdate?: (event: NodeUpdateEvent) => void;
  onConsoleLog?: (event: ConsoleLogEvent) => void;
  onWorkflowStarted?: (data: { workflowId: string }) => void;
  onWorkflowCompleted?: (data: WorkflowCompletedData) => void;
  onWorkflowError?: (data: { workflowId: string; error: string }) => void;
  onWorkflowCancelled?: () => void;
}

class SocketService {
  private socket: Socket | null = null;
  private handlers: SocketEventHandlers = {};

  connect(handlers: SocketEventHandlers): void {
    if (this.socket?.connected) {
      return;
    }

    this.handlers = handlers;
    this.socket = io(SOCKET_URL);

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Node updates
    this.socket.on('node:update', (data: NodeUpdateEvent) => {
      this.handlers.onNodeUpdate?.(data);
    });

    // Console logs
    this.socket.on('console:log', (data: ConsoleLogEvent) => {
      this.handlers.onConsoleLog?.(data);
    });

    // Workflow events
    this.socket.on('workflow:started', (data: { workflowId: string }) => {
      this.handlers.onWorkflowStarted?.(data);
    });

    this.socket.on('workflow:completed', (data: WorkflowCompletedData) => {
      this.handlers.onWorkflowCompleted?.(data);
    });

    this.socket.on('workflow:error', (data: { workflowId: string; error: string }) => {
      this.handlers.onWorkflowError?.(data);
    });

    this.socket.on('workflow:cancelled', () => {
      this.handlers.onWorkflowCancelled?.();
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  executeWorkflow(request: WorkflowExecutionRequest): void {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }

    this.socket.emit('execute:workflow', request);
  }

  cancelExecution(): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('execute:cancel');
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
