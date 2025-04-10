
import React, { useEffect, useState } from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { BulletDonutChart } from './chart/ChartComponents';
import { prepareBulletChartData } from './chart/BulletChartData';
import { WordBalanceDistribution } from './chart/WordBalanceDistribution';

interface BulletPointChartProps {
  bullet: BulletAnalysis;
}

const BulletPointChart: React.FC<BulletPointChartProps> = ({
  bullet
}) => {
  const [chartKey, setChartKey] = useState(Date.now()); // Add key for forcing re-render
  
  // Log bullet data for debugging
  console.log("BulletPointChart - Received bullet:", bullet);
  
  // Force re-render when bullet changes
  useEffect(() => {
    console.log("BulletPointChart - Bullet changed, forcing re-render");
    setChartKey(Date.now());
  }, [bullet]);

  // Get formatted chart data
  const { dataWithPercent, bullet_total } = prepareBulletChartData(bullet);
  
  console.log("BulletPointChart - Prepared chart data:", dataWithPercent);

  return (
    <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm" key={chartKey}>
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <h3 className="text-md font-semibold text-center mb-4">Bullet Anatomy</h3>
          <BulletDonutChart data={dataWithPercent} totalScore={bullet_total} />
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold">Distribution</h3>
          </div>
          
          <WordBalanceDistribution wordBalance={bullet.word_balance} />
        </div>
      </div>
    </div>
  );
};

export default BulletPointChart;
