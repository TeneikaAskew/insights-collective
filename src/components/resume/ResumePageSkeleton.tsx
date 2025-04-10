
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const ResumePageSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto">
      <div className="flex flex-col space-y-8">
        <h1 className="text-2xl font-bold">Resume Management</h1>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[500px] w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </div>
    </div>
  );
};

export default ResumePageSkeleton;
