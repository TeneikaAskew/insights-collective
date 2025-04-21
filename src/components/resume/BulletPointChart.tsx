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
  return <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
      <style>{`
        :root {
          --color-hard-soft: #1E40AF; /* Primary blue for Hard & Soft Skills */
          --color-action: #D97706;    /* Amber for Action Words */
          --color-measurable: #0D9488; /* Teal for Measurable Results */
          --color-common: #6B7280;    /* Gray for Common Words */
        }
      `}</style>
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
              {/* Goal header removed as per user request */}
            </div>
          </div>
          
          <div className="space-y-4">
            {dataWithPercent.map((item, index) => <DistributionBar key={`distribution-${item.name}-${index}`} item={item} />)}
          </div>
        </div>
      </div>
    </div>;
};
export default BulletPointChart;