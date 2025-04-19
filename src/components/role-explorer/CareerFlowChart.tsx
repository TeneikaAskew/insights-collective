
import React from 'react';

interface FlowNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface FlowLink {
  source: string;
  target: string;
}

interface CareerFlowChartProps {
  nodes: FlowNode[];
  links: FlowLink[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

const nodeRadius = 60;

const CareerFlowChart: React.FC<CareerFlowChartProps> = ({
  nodes,
  links,
  selectedNodeId,
  onSelectNode,
}) => {
  return (
    <svg
      width="100%"
      height={nodes.length * 150}
      role="img"
      aria-label="Career journey flow diagram"
      className="bg-white dark:bg-[#1A1F2C] rounded-lg shadow-md p-4"
      style={{ minHeight: 400 }}
    >
      {/* Lines */}
      {links.map(({ source, target }, idx) => {
        const sourceNode = nodes.find((n) => n.id === source);
        const targetNode = nodes.find((n) => n.id === target);
        if (!sourceNode || !targetNode) return null;

        const startX = sourceNode.x + nodeRadius;
        const startY = sourceNode.y;
        const endX = targetNode.x - nodeRadius;
        const endY = targetNode.y;

        // Smooth curved path
        const path = `M${startX},${startY} C${(startX + endX) / 2},${startY} ${(startX + endX) / 2},${endY} ${endX},${endY}`;

        return (
          <path
            key={idx}
            d={path}
            stroke="#6b7280"
            strokeWidth={2}
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        );
      })}

      {/* Arrowhead marker */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
          fill="#6b7280"
        >
          <polygon points="0 0, 10 3.5, 0 7" />
        </marker>
      </defs>

      {/* Nodes */}
      {nodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        return (
          <g
            key={node.id}
            transform={`translate(${node.x},${node.y})`}
            tabIndex={0}
            role="button"
            aria-pressed={isSelected}
            aria-label={`Career step: ${node.label}`}
            onClick={() => onSelectNode(node.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onSelectNode(node.id);
              }
            }}
            className="cursor-pointer"
            style={{ outline: isSelected ? '2px solid #7c3aed' : 'none' }}
          >
            <circle
              cx={0}
              cy={0}
              r={isSelected ? nodeRadius : nodeRadius - 8}
              fill={isSelected ? '#7c3aed' : '#a78bfa'}
              stroke="#6b7280"
              strokeWidth={2}
            />
            <text
              x={0}
              y={5}
              textAnchor="middle"
              fill={isSelected ? 'white' : '#3f3f46'}
              fontWeight={isSelected ? 'bold' : 'normal'}
              fontSize={12}
              pointerEvents="none"
            >
              {node.label.length > 20 ? node.label.slice(0, 17) + '...' : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default CareerFlowChart;

