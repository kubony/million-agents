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

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Handle node deletions - sync to filesystem
      for (const change of changes) {
        if (change.type === 'remove') {
          const nodeToDelete = nodes.find(n => n.id === change.id);
          if (nodeToDelete) {
            deleteNode(nodeToDelete as WorkflowNode).catch(err => {
              console.error('Failed to delete node from filesystem:', err);
            });
          }
        }
      }
      setNodes(applyNodeChanges(changes, nodes as Node[]) as typeof nodes);
    },
    [nodes, setNodes]
  );

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
  );
}
