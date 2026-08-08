// ABOUTME: Pie label renderer for narrow viewports. Recharts' default callout
// ABOUTME: labels sit outside the circle, where a phone-width chart clips them
// ABOUTME: and they collide; this draws the share inside its own slice instead.

type SliceLabelProps = {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
};

export const renderSliceShare = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: SliceLabelProps) => {
  const radian = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * radian);
  const y = cy + radius * Math.sin(-midAngle * radian);

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
};
