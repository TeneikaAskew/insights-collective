
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { BulletAnalysis } from '@/components/assistants/types';
import BulletPointItem from './BulletPointItem';

interface BulletPointsAnalysisCardProps {
  bullets: BulletAnalysis[];
}

const BulletPointsAnalysisCard: React.FC<BulletPointsAnalysisCardProps> = ({ bullets }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bullet Point Analysis</CardTitle>
        <CardDescription>Detailed breakdown and improvement suggestions for bullet points</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="space-y-4">
          {bullets.map((bullet, index) => (
            <BulletPointItem key={index} bullet={bullet} index={index} />
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default BulletPointsAnalysisCard;
