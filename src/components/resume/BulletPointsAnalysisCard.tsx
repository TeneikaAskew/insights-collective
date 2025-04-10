import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { BulletAnalysis } from '@/components/assistants/types';
import BulletPointItem from './BulletPointItem';
import BulletPointChart from './BulletPointChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
interface BulletPointsAnalysisCardProps {
  bullets: BulletAnalysis[];
}
const BulletPointsAnalysisCard: React.FC<BulletPointsAnalysisCardProps> = ({
  bullets
}) => {
  const [selectedBulletIndex, setSelectedBulletIndex] = useState(0);

  // If no bullets are available, show a placeholder
  if (!bullets || bullets.length === 0) {
    return <Card>
        <CardHeader>
          <CardTitle>Resume Bullet Analysis</CardTitle>
          <CardDescription>
            No bullet points found in your resume. Upload a resume with well-formatted bullet points to see detailed analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-gray-400">
          <p>No bullet points to analyze</p>
        </CardContent>
      </Card>;
  }

  // Select the first bullet or the currently selected one
  const selectedBullet = bullets[selectedBulletIndex];
  return <Card>
      
      <CardContent className="space-y-6">
        {/* Bullet selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Select bullet point to analyze:</label>
          <select className="w-full border rounded p-2" value={selectedBulletIndex} onChange={e => setSelectedBulletIndex(parseInt(e.target.value))}>
            {bullets.map((bullet, idx) => <option key={idx} value={idx}>
                {bullet.original?.substring(0, 60)}...
              </option>)}
          </select>
        </div>
        
        {/* Main visualization for the selected bullet */}
        <BulletPointChart bullet={selectedBullet} />
        
        {/* Accordion for detailed analysis */}
        <div>
          <h3 className="font-semibold mb-2">All Bullet Points Analysis</h3>
          <Accordion type="single" collapsible className="space-y-2">
            {bullets.map((bullet, index) => <BulletPointItem key={index} bullet={bullet} index={index} />)}
          </Accordion>
        </div>
      </CardContent>
    </Card>;
};
export default BulletPointsAnalysisCard;