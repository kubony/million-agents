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
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string }>;
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

class SocketService {
  private socket: Socket;
  private connected: boolean = false;

  constructor() {
    this.socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
  }

  // 이벤트 리스너 등록
  on(event: string, callback: (...args: unknown[]) => void): void {
    this.socket.on(event, callback);
  }

  // 이벤트 리스너 제거
  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  // 이벤트 발송
  emit(event: string, data?: unknown): void {
    if (!this.socket.connected) {
      console.warn('Socket not connected, queuing emit:', event);
    }
    this.socket.emit(event, data);
  }

  // 워크플로우 실행 요청
  executeWorkflow(request: WorkflowExecutionRequest): void {
    this.emit('execute:workflow', request);
  }

  // 실행 취소
  cancelExecution(): void {
    this.emit('execute:cancel');
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.socket.connected;
  }

  // 연결 해제
  disconnect(): void {
    this.socket.disconnect();
  }

  // 재연결
  connect(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }
}

export const socketService = new SocketService();
