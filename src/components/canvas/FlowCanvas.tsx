import { useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type OnConnect,
  type NodeTypes,
  type Node,
  type NodeChange,
  type EdgeChange,
  type OnSelectionChangeFunc,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
} from '@xyflow/react';

import InputNode from '../nodes/InputNode';
import SubagentNode from '../nodes/SubagentNode';
import SkillNode from '../nodes/SkillNode';
import CommandNode from '../nodes/CommandNode';
import HookNode from '../nodes/HookNode';
import OutputNode from '../nodes/OutputNode';
import { useWorkflowStore } from '../../stores/workflowStore';
import { usePanelStore } from '../../stores/panelStore';
import { validateConnection } from '../../utils/connectionValidator';
import { syncEdge, removeEdge as removeEdgeSync, deleteNode } from '../../services/syncService';
import type { WorkflowNode, WorkflowEdge } from '../../types/nodes';

const nodeTypes: NodeTypes = {
  input: InputNode,
  subagent: SubagentNode,
  skill: SkillNode,
  command: CommandNode,
  hook: HookNode,
  output: OutputNode,
};

export default function FlowCanvas() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    addEdge: storeAddEdge,
    setSelectedNode,
  } = useWorkflowStore();

  const openStepPanel = usePanelStore((state) => state.openStepPanel);

  // Track if Shift key is pressed for auto-connect feature
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  // Track the last selection to detect new selections
  const lastSelectionRef = useRef<string[]>([]);

  // Listen for Shift key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
        lastSelectionRef.current = [];
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle selection change for Shift+select auto-connect
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (!isShiftPressed) {
        lastSelectionRef.current = [];
        return;
      }

      const selectedIds = selectedNodes.map(n => n.id);

      // When exactly 2 nodes are selected with Shift
      if (selectedIds.length === 2) {
        const [firstId, secondId] = selectedIds;

        // Check if already connected
        const alreadyConnected = edges.some(
          e => (e.source === firstId && e.target === secondId) ||
               (e.source === secondId && e.target === firstId)
        );

        if (!alreadyConnected) {
          // Determine source and target based on node positions (left to right)
          const node1 = nodes.find(n => n.id === firstId);
          const node2 = nodes.find(n => n.id === secondId);

          if (node1 && node2) {
            let source = firstId;
            let target = secondId;

            // If node1 is to the right of node2, swap them
            if ((node1.position?.x ?? 0) > (node2.position?.x ?? 0)) {
              source = secondId;
              target = firstId;
            }

            // Validate the connection
            const connection = { source, target, sourceHandle: null, targetHandle: null };

            if (validateConnection(connection, nodes as Node[])) {
              const newEdge: WorkflowEdge = {
                id: `e-${source}-${target}`,
                source,
                target,
                animated: true,
              };

              setEdges(addEdge({ ...connection, animated: true }, edges));
              storeAddEdge(newEdge);

              // Sync edge to filesystem
              syncEdge(newEdge, nodes as WorkflowNode[]).catch(err => {
                console.error('Failed to sync edge to filesystem:', err);
              });
            }
          }
        }
      }

      lastSelectionRef.current = selectedIds;
    },
    [isShiftPressed, nodes, edges, setEdges, storeAddEdge]
  );

  // Track pending deletion for confirmation
  const [pendingDeletion, setPendingDeletion] = useState<{
    changes: NodeChange[];
    nodesToDelete: WorkflowNode[];
  } | null>(null);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Check for node deletions that need confirmation
      const deleteChanges = changes.filter(c => c.type === 'remove');
      const otherChanges = changes.filter(c => c.type !== 'remove');

      // Apply non-delete changes immediately
      if (otherChanges.length > 0) {
        setNodes(applyNodeChanges(otherChanges, nodes as Node[]) as typeof nodes);
      }

      // Handle deletions with confirmation
      if (deleteChanges.length > 0) {
        const nodesToDelete = deleteChanges
          .map(c => nodes.find(n => n.id === c.id))
          .filter((n): n is WorkflowNode => n !== undefined && n.type !== 'input' && n.type !== 'output');

        if (nodesToDelete.length > 0) {
          // Show confirmation dialog
          setPendingDeletion({ changes: deleteChanges, nodesToDelete });
        } else {
          // input/output nodes can be deleted without confirmation
          setNodes(applyNodeChanges(deleteChanges, nodes as Node[]) as typeof nodes);
        }
      }
    },
    [nodes, setNodes]
  );

  // Confirm deletion handler
  const confirmDeletion = useCallback(() => {
    if (!pendingDeletion) return;

    const { changes, nodesToDelete } = pendingDeletion;

    // Delete nodes from filesystem
    for (const nodeToDelete of nodesToDelete) {
      deleteNode(nodeToDelete, nodes as WorkflowNode[]).catch(err => {
        console.error('Failed to delete node from filesystem:', err);
      });
    }

    // Apply the deletion changes to UI
    setNodes(applyNodeChanges(changes, nodes as Node[]) as typeof nodes);
    setPendingDeletion(null);
  }, [pendingDeletion, nodes, setNodes]);

  // Cancel deletion handler
  const cancelDeletion = useCallback(() => {
    setPendingDeletion(null);
  }, []);

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Handle edge removals - sync to filesystem
      for (const change of changes) {
        if (change.type === 'remove') {
          const edgeToRemove = edges.find(e => e.id === change.id);
          if (edgeToRemove) {
            removeEdgeSync(edgeToRemove as WorkflowEdge, nodes as WorkflowNode[]).catch(err => {
              console.error('Failed to remove edge from filesystem:', err);
            });
          }
        }
      }
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, nodes, setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      // Validate connection
      if (!validateConnection(params, nodes as Node[])) {
        return;
      }

      const newEdge: WorkflowEdge = {
        id: `e-${params.source}-${params.target}`,
        source: params.source!,
        target: params.target!,
        animated: true,
      };

      setEdges(addEdge({ ...params, animated: true }, edges));
      storeAddEdge(newEdge);

      // Sync edge to filesystem (updates subagent's skills field, etc.)
      syncEdge(newEdge, nodes as WorkflowNode[]).catch(err => {
        console.error('Failed to sync edge to filesystem:', err);
      });
    },
    [nodes, edges, setEdges, storeAddEdge]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
      openStepPanel();
    },
    [setSelectedNode, openStepPanel]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  return (
    <>
      <ReactFlow
        nodes={nodes as Node[]}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 100, y: 100, zoom: 0.7 }}
        defaultEdgeOptions={{
          animated: true,
          style: { strokeDasharray: '5 5' },
        }}
        connectionLineStyle={{ strokeDasharray: '5 5' }}
        snapToGrid
        snapGrid={[15, 15]}
        connectionRadius={40}
        connectOnClick={true}
        selectionOnDrag={false}
        multiSelectionKeyCode="Shift"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#333333"
        />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'input':
                return '#fef3c7';
              case 'subagent':
                return '#4f46e5';
              case 'skill':
                return '#06b6d4';
              case 'command':
                return '#f97316';
              case 'hook':
                return '#ec4899';
              case 'output':
                return '#10b981';
              default:
                return '#6b7280';
            }
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
        />
      </ReactFlow>

      {/* Node Deletion Confirmation Dialog */}
      {pendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4 border border-zinc-700 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">노드 삭제 확인</h3>
            </div>

            <p className="text-zinc-300 mb-4">
              다음 노드를 삭제하시겠습니까? 이 작업은 <span className="text-red-400 font-medium">파일을 삭제</span>하며 되돌릴 수 없습니다.
            </p>

            <ul className="bg-zinc-900 rounded-md p-3 mb-6 space-y-2">
              {pendingDeletion.nodesToDelete.map(node => (
                <li key={node.id} className="flex items-center gap-2 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    node.type === 'skill' ? 'bg-cyan-500/20 text-cyan-300' :
                    node.type === 'subagent' ? 'bg-indigo-500/20 text-indigo-300' :
                    node.type === 'command' ? 'bg-orange-500/20 text-orange-300' :
                    node.type === 'hook' ? 'bg-pink-500/20 text-pink-300' :
                    'bg-zinc-500/20 text-zinc-300'
                  }`}>
                    {node.type}
                  </span>
                  <span className="text-white">{node.data.label}</span>
                </li>
              ))}
            </ul>

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDeletion}
                className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDeletion}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
