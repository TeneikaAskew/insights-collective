
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
    bullet_total,
    word_balance_score
  } = prepareBulletChartData(bullet);

  // Filter out the last bar for each section (word_balance_score and xyz_total)
  const filteredData = dataWithPercent.filter(item => 
    item.name !== "Word Balance Score" && item.name !== "Story Score"
  );

  // Extra safety check for dataWithPercent 
  if (!filteredData || !Array.isArray(filteredData)) {
    return (
      <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
        <p>No chart data available.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
      {/* Explanation boxes for the scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
          <h4 className="font-semibold text-blue-700 mb-2">Word Balance Score: {word_balance_score}/100</h4>
          <p className="text-sm text-gray-700">
            This score measures how well your bullet point balances different types of words. 
            A higher word balance indicates effective use of action verbs, metrics, industry terms,
            and other key components that make your bullet points stand out.
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-100">
          <h4 className="font-semibold text-indigo-700 mb-2">Story Score: {bullet_total}/100</h4>
          <p className="text-sm text-gray-700">
            The Story Score evaluates how compelling and complete your bullet point is as a professional achievement.
            It measures the presence of the XYZ elements: action verbs, metrics/results, clarity, industry keywords,
            and achievement focus.
          </p>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <h3 className="text-md font-semibold text-center mb-4">Do you have a good plot?</h3>
          <BulletDonutChart data={filteredData} totalScore={bullet_total} />
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold">Breakdown</h3>
            <div className="flex items-center space-x-8">
              <span className="text-sm font-medium">Score</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {filteredData.map((item, index) => (
              <DistributionBar key={`distribution-${item.name}-${index}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulletPointChart;
