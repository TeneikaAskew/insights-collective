import React from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { BulletDonutChart, DistributionBar } from './chart/ChartComponents';
import { prepareBulletChartData, BULLET_CATEGORIES } from './chart/BulletChartData';

interface BulletPointChartProps {
  bullet: BulletAnalysis;
}

const BulletPointChart: React.FC<BulletPointChartProps> = ({
  bullet
}) => {
  // Safety check - if bullet is null or undefined, render nothing
  if (!bullet) return null;

  // Get formatted chart data
  const {
    dataWithPercent,
    bullet_total
  } = prepareBulletChartData(bullet);

  // Extra safety check for dataWithPercent 
  if (!dataWithPercent || !Array.isArray(dataWithPercent)) {
    return (
      <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
        <p>No chart data available.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <h3 className="text-md font-semibold text-center mb-4">Do you have a good plot?</h3>
          <BulletDonutChart data={dataWithPercent} totalScore={bullet_total} />
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold">Breakdown</h3>
            <div className="flex items-center space-x-8">
              <span className="text-sm font-medium">Score</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {dataWithPercent.map((item, index) => (
              <DistributionBar key={`distribution-${item.name}-${index}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulletPointChart;
