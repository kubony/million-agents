import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { LogEntry, LogLevel } from '../types/workflow';

interface ExecutionState {
  // Execution state
  isRunning: boolean;
  currentNodeId: string | null;
  completedNodes: Set<string>;
  failedNodes: Set<string>;
  results: Map<string, any>;
  startTime: number | null;
  endTime: number | null;

  // Logs
  logs: LogEntry[];

  // Actions
  startExecution: () => void;
  stopExecution: () => void;
  setCurrentNode: (nodeId: string | null) => void;
  markNodeCompleted: (nodeId: string, result?: any) => void;
  markNodeFailed: (nodeId: string, error?: string) => void;
  resetExecution: () => void;

  // Log actions
  addLog: (level: LogLevel, message: string, nodeId?: string, details?: any) => void;
  clearLogs: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  // Initial state
  isRunning: false,
  currentNodeId: null,
  completedNodes: new Set(),
  failedNodes: new Set(),
  results: new Map(),
  startTime: null,
  endTime: null,
  logs: [],

  // Execution actions
  startExecution: () => {
    set({
      isRunning: true,
      currentNodeId: null,
      completedNodes: new Set(),
      failedNodes: new Set(),
      results: new Map(),
      startTime: Date.now(),
      endTime: null,
    });
    get().addLog('info', 'Workflow execution started');
  },

  stopExecution: () => {
    set({
      isRunning: false,
      currentNodeId: null,
      endTime: Date.now(),
    });
    get().addLog('info', 'Workflow execution stopped');
  },

  setCurrentNode: (nodeId) => {
    set({ currentNodeId: nodeId });
    if (nodeId) {
      get().addLog('info', 'Processing node', nodeId);
    }
  },

  markNodeCompleted: (nodeId, result) => {
    set((state) => {
      const newCompleted = new Set(state.completedNodes);
      newCompleted.add(nodeId);
      const newResults = new Map(state.results);
      if (result !== undefined) {
        newResults.set(nodeId, result);
      }
      return { completedNodes: newCompleted, results: newResults };
    });
    get().addLog('success', 'Node completed', nodeId);
  },

  markNodeFailed: (nodeId, error) => {
    set((state) => {
      const newFailed = new Set(state.failedNodes);
      newFailed.add(nodeId);
      return { failedNodes: newFailed };
    });
    get().addLog('error', error || 'Node failed', nodeId);
  },

  resetExecution: () => {
    set({
      isRunning: false,
      currentNodeId: null,
      completedNodes: new Set(),
      failedNodes: new Set(),
      results: new Map(),
      startTime: null,
      endTime: null,
    });
  },

  // Log actions
  addLog: (level, message, nodeId, details) => {
    const entry: LogEntry = {
      id: nanoid(),
      timestamp: Date.now(),
      level,
      message,
      nodeId,
      details,
    };
    set((state) => ({
      logs: [...state.logs, entry],
    }));
  },

  clearLogs: () => set({ logs: [] }),
}));

// Selectors
export const selectIsNodeRunning = (nodeId: string) => (state: ExecutionState) =>
  state.currentNodeId === nodeId;

export const selectIsNodeCompleted = (nodeId: string) => (state: ExecutionState) =>
  state.completedNodes.has(nodeId);

export const selectNodeResult = (nodeId: string) => (state: ExecutionState) =>
  state.results.get(nodeId);
