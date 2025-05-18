import { Metadata } from 'next';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StarResponseList } from '@/components/star-responses/StarResponseList';
import { AddStarResponseButton } from '@/components/star-responses/AddStarResponseButton';

export const metadata: Metadata = {
  title: 'STAR Responses | Interview Prep Suite',
  description: 'Practice and evaluate your behavioral interview responses.',
};

export default function StarResponsesPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="STAR Responses"
        description="Practice and evaluate your behavioral interview responses."
      >
        <AddStarResponseButton />
      </DashboardHeader>
      <StarResponseList />
    </DashboardShell>
  );
} 