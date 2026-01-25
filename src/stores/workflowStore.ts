import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { WorkflowNode, WorkflowEdge, NodeStatus, WorkflowNodeData } from '../types/nodes';

interface WorkflowState {
  // State
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  workflowId: string;
  workflowName: string;
  isDraft: boolean;

  // Node actions
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, data: Partial<WorkflowNodeData>) => void;
  updateNodeStatus: (id: string, status: NodeStatus, progress?: number) => void;
  removeNode: (id: string) => void;
  setSelectedNode: (id: string | null) => void;

  // Edge actions
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;

  // Workflow actions
  setWorkflowName: (name: string) => void;
  loadWorkflow: (data: { nodes: WorkflowNode[]; edges: WorkflowEdge[]; name?: string }) => void;
  mergeExistingConfig: (nodes: WorkflowNode[]) => void;
  clearWorkflow: () => void;
  newWorkflow: () => void;

  // Bulk updates (for React Flow)
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      // Initial state
      nodes: [],
      edges: [],
      selectedNodeId: null,
      workflowId: nanoid(),
      workflowName: 'Untitled Workflow',
      isDraft: true,

      // Node actions
      addNode: (node) =>
        set((state) => ({
          nodes: [...state.nodes, node],
        })),

      updateNode: (id, data) =>
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n
          ) as WorkflowNode[],
        })),

      updateNodeStatus: (id, status, progress) =>
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, status, progress: progress ?? n.data.progress } }
              : n
          ) as WorkflowNode[],
        })),

      removeNode: (id) =>
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source !== id && e.target !== id),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        })),

      setSelectedNode: (id) =>
        set({ selectedNodeId: id }),

      // Edge actions
      addEdge: (edge) =>
        set((state) => ({
          edges: [...state.edges, edge],
        })),

      removeEdge: (id) =>
        set((state) => ({
          edges: state.edges.filter((e) => e.id !== id),
        })),

      // Workflow actions
      setWorkflowName: (name) =>
        set({ workflowName: name }),

      loadWorkflow: (data) =>
        set({
          nodes: data.nodes,
          edges: data.edges,
          workflowName: data.name || 'Imported Workflow',
          selectedNodeId: null,
        }),

      mergeExistingConfig: (loadedNodes) =>
        set((state) => {
          // 로드된 노드의 ID 세트 (파일시스템에 실제 존재하는 것들)
          const loadedIds = new Set(loadedNodes.map(n => n.id));

          // 기존 노드 중:
          // - config에서 로드된 노드 (ID가 skill-, subagent-, command-, hook- 으로 시작)는
          //   파일시스템에 없으면 제거
          // - 사용자가 직접 만든 노드 (nanoid로 생성된 ID)는 유지
          const configPrefixes = ['skill-', 'subagent-', 'command-', 'hook-'];
          const isConfigNode = (id: string) => configPrefixes.some(p => id.startsWith(p));

          const existingNodes = state.nodes.filter(n => {
            if (isConfigNode(n.id)) {
              // config 노드는 파일시스템에 있어야 유지
              return loadedIds.has(n.id);
            }
            // 사용자 노드는 항상 유지
            return true;
          });

          // 새로 로드된 노드 중 기존에 없는 것 추가
          const existingIds = new Set(existingNodes.map(n => n.id));
          const newNodes = loadedNodes.filter(n => !existingIds.has(n.id));

          return {
            nodes: [...existingNodes, ...newNodes],
          };
        }),

      clearWorkflow: () =>
        set({
          nodes: [],
          edges: [],
          selectedNodeId: null,
        }),

      newWorkflow: () =>
        set({
          nodes: [],
          edges: [],
          selectedNodeId: null,
          workflowId: nanoid(),
          workflowName: 'Untitled Workflow',
          isDraft: true,
        }),

      // Bulk updates
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
    }),
    {
      name: 'workflow-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        workflowId: state.workflowId,
        workflowName: state.workflowName,
      }),
    }
  )
);

// Selectors
export const selectSelectedNode = (state: WorkflowState) =>
  state.nodes.find((n) => n.id === state.selectedNodeId);

export const selectNodeById = (id: string) => (state: WorkflowState) =>
  state.nodes.find((n) => n.id === id);

export const selectIncomingEdges = (nodeId: string) => (state: WorkflowState) =>
  state.edges.filter((e) => e.target === nodeId);

export const selectOutgoingEdges = (nodeId: string) => (state: WorkflowState) =>
  state.edges.filter((e) => e.source === nodeId);
