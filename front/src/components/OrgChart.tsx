import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react';
import { useEffect, useMemo } from 'react';
import { computeOrgChartLayout } from '../lib/orgChartLayout';
import type { Seat } from '../lib/seatsApi';
import { SeatNode, type SeatNodeData } from './SeatNode';

const NODE_TYPES = { seat: SeatNode };

function buildNodes(seats: Seat[]): Node<SeatNodeData>[] {
  const layout = computeOrgChartLayout(seats);
  return layout.map(({ seat, x, y }) => ({
    id: seat.id,
    type: 'seat',
    position: { x, y },
    data: { seat },
  }));
}

function buildEdges(seats: Seat[]): Edge[] {
  // Crear un Set de IDs válidos para verificar que source existe
  const seatIds = new Set(seats.map((s) => s.id));

  return seats
    .filter((seat) => seat.parentSeatId && seatIds.has(seat.parentSeatId))
    .map((seat) => ({
      id: `e-${seat.parentSeatId}-${seat.id}`,
      source: seat.parentSeatId as string,
      target: seat.id,
      type: 'smoothstep',
      style: {
        stroke: '#60a5fa',
        strokeWidth: 3,
      },
    }));
}

export interface OrgChartProps {
  seats: Seat[];
  onSelectSeat: (seat: Seat) => void;
  onReparent: (seatId: string, parentSeatId: string) => Promise<void>;
}

export function OrgChart(props: OrgChartProps) {
  // Key basada en los IDs de los seats para forzar re-mount cuando cambia la estructura
  const flowKey = useMemo(() => props.seats.map((s) => s.id).sort().join(','), [props.seats]);
  
  return (
    <ReactFlowProvider key={flowKey}>
      <OrgChartInner {...props} />
    </ReactFlowProvider>
  );
}

function OrgChartInner({ seats, onSelectSeat, onReparent }: OrgChartProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SeatNodeData>>(buildNodes(seats));
  const [edges, setEdges] = useEdgesState(buildEdges(seats));
  const { getIntersectingNodes } = useReactFlow();

  useEffect(() => {
    setNodes(buildNodes(seats));
    setEdges(buildEdges(seats));
  }, [seats, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    const seat = seats.find((s) => s.id === node.id);
    if (seat) onSelectSeat(seat);
  };

  const handleNodeDragStop: OnNodeDrag<Node<SeatNodeData>> = (_event, node) => {
    const target = getIntersectingNodes(node).find((candidate) => candidate.id !== node.id);
    const seat = seats.find((s) => s.id === node.id);

    if (!target || !seat || target.id === seat.parentSeatId) {
      setNodes(buildNodes(seats)); // snap back, nothing to persist
      return;
    }

    onReparent(node.id, target.id).finally(() => setNodes(buildNodes(seats)));
  };

  return (
    <div style={{ height: 600 }} data-testid="org-chart-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="rgba(255,255,255,0.25)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
