
import React from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { BulletDonutChart, DistributionBar, ScoreSummaryBox } from './chart/ChartComponents';
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
    wordBalanceScore = bullet.word_balance_score || 0
  } = prepareBulletChartData(bullet);

  // Extra safety check for dataWithPercent 
  if (!dataWithPercent || !Array.isArray(dataWithPercent)) {
    return (
      <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
        <p>No chart data available.</p>
      </div>
    );
  }

  // Calculate total XYZ score from individual components
  const xyzTotal = 
    (bullet?.xyz_scores?.action || 0) + 
    (bullet?.xyz_scores?.metrics || 0) + 
    (bullet?.xyz_scores?.clarity || 0) + 
    (bullet?.xyz_scores?.industry || 0) + 
    (bullet?.xyz_scores?.achievement || 0);

  return (
    <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
      {/* Score summaries at the top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <ScoreSummaryBox 
          title="Word Balance Score" 
          score={wordBalanceScore}
          maxScore={100}
          description="This score measures how well your bullet balances industry terms, action verbs, metrics, and common words. A high score indicates optimal distribution for ATS scanning."
        />
        
        <ScoreSummaryBox 
          title="XYZ Quality Score" 
          score={xyzTotal}
          maxScore={100}
          description="The XYZ Quality Score evaluates your bullet's action verbs, metrics/results, clarity, industry keywords, and achievement strength. Higher scores indicate stronger resume bullets."
        />
      </div>

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
            {dataWithPercent
              .filter(item => !['word_balance_score', 'bullet_total'].includes(item.name))
              .map((item, index) => (
                <DistributionBar key={`distribution-${item.name}-${index}`} item={item} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulletPointChart;
