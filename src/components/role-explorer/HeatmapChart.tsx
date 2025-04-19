
import React from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

interface HeatmapDataItem {
  role: string;
  [industry: string]: number | string; // industry name keys with demand values
}

interface HeatmapChartProps {
  data: HeatmapDataItem[];
  industries: string[];
  roles: string[];
}

const COLORS = [
  '#f0f9e8',
  '#bae4bc',
  '#7bccc4',
  '#43a2ca',
  '#0868ac',
  '#084081',
]

const HeatmapChart: React.FC<HeatmapChartProps> = ({ data, industries, roles }) => {
  // Flatten data for heatmap coloring; max to normalize
  const values: number[] = [];
  data.forEach((item) => {
    industries.forEach(ind => {
      const val = item[ind];
      if (typeof val === 'number') values.push(val);
    });
  });
  const maxVal = Math.max(...values, 1);

  // Map values to color ranges
  const getColor = (value: number) => {
    const index = Math.floor((value / maxVal) * (COLORS.length - 1));
    return COLORS[index] || COLORS[0];
  };

  // Data layout: one Bar per industry, each with values per role as bars.
  // Recharts doesn't support true heatmap natively; so we use Bars and Cells.

  return (
    <ResponsiveContainer width="100%" height={roles.length * 40 + 80}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 20, right: 50, left: 100, bottom: 20 }}
        barCategoryGap={5}
      >
        <XAxis
          type="number"
          domain={[0, maxVal]}
          hide
        />
        <YAxis
          dataKey="role"
          type="category"
          width={180}
          tick={{ fill: '#4c51bf', fontWeight: 'bold' }}
        />
        <Tooltip
          formatter={(value: number) => value.toFixed(2)}
          cursor={{ fill: 'rgba(255,255,255,0.1)' }}
        />
        <Legend />
        {industries.map((industry, i) => (
          <Bar
            key={industry}
            dataKey={industry}
            stackId="a"
            maxBarSize={30}
            isAnimationActive={false}
            label={{ position: 'right', fill: '#374151', fontSize: 12 }}
          >
            {data.map((entry) => (
              <Cell key={`${entry.role}-${industry}`} fill={getColor(Number(entry[industry]) || 0)} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default HeatmapChart;

