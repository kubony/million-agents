import { useCallback } from 'react';
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
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
} from '@xyflow/react';

import InputNode from '../nodes/InputNode';
import SubagentNode from '../nodes/SubagentNode';
import SkillNode from '../nodes/SkillNode';
import McpNode from '../nodes/McpNode';
import OutputNode from '../nodes/OutputNode';
import { useWorkflowStore } from '../../stores/workflowStore';
import { usePanelStore } from '../../stores/panelStore';
import { validateConnection } from '../../utils/connectionValidator';

const nodeTypes: NodeTypes = {
  input: InputNode,
  subagent: SubagentNode,
  skill: SkillNode,
  mcp: McpNode,
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

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(applyNodeChanges(changes, nodes as Node[]) as typeof nodes);
    },
    [nodes, setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      // Validate connection
      if (!validateConnection(params, nodes as Node[])) {
        return;
      }

      setEdges(addEdge({ ...params, animated: true }, edges));
      storeAddEdge({
        id: `e-${params.source}-${params.target}`,
        source: params.source!,
        target: params.target!,
        animated: true,
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
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      defaultEdgeOptions={{
        animated: true,
        style: { strokeDasharray: '5 5' },
      }}
      connectionLineStyle={{ strokeDasharray: '5 5' }}
      snapToGrid
      snapGrid={[15, 15]}
      connectionRadius={40}
      connectOnClick={true}
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
            case 'mcp':
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
