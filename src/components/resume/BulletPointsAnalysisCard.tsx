
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { BulletAnalysis } from '@/components/assistants/types';
import BulletPointItem from './BulletPointItem';
import BulletPointChart from './BulletPointChart';

interface BulletPointsAnalysisCardProps {
  bullets: BulletAnalysis[];
}

const BulletPointsAnalysisCard: React.FC<BulletPointsAnalysisCardProps> = ({ bullets }) => {
  // Select the first bullet for the main visualization display
  const firstBullet = bullets.length > 0 ? bullets[0] : null;
  
  return (
    <div className="space-y-6">
      {/* Main Visualization */}
      {firstBullet && (
        <BulletPointChart bullet={firstBullet} />
      )}
      
      {/* Individual Bullet Analysis */}
      <Accordion type="single" collapsible className="space-y-4">
        {bullets.map((bullet, index) => (
          <BulletPointItem key={index} bullet={bullet} index={index} />
        ))}
      </Accordion>
    </div>
  );
};

export default BulletPointsAnalysisCard;
