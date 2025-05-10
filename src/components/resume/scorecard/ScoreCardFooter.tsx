
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export const ScoreCardFooter: React.FC = () => {
  return (
    <div className="flex justify-between items-center w-full">
      <p className="text-xs text-muted-foreground">
        {new Date().toLocaleDateString()} Analysis
      </p>
      <Button size="sm" variant="ghost" className="h-8 gap-1">
        <Download className="h-3.5 w-3.5" />
        <span className="text-xs">Export Report</span>
      </Button>
    </div>
  );
};
