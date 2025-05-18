import { Metadata } from 'next';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StudyGuideList } from '@/components/study-guides/StudyGuideList';
import { StudyGuideProgress } from '@/components/dashboard/StudyGuideProgress';

export const metadata: Metadata = {
  title: 'Study Guides | Interview Prep Suite',
  description: 'Review and practice with your personalized study guides.',
};

export default function StudyGuidesPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Study Guides"
        description="Review and practice with your personalized study guides."
      />
      <div className="grid gap-4 md:grid-cols-7">
        <StudyGuideList className="col-span-4" />
        <StudyGuideProgress className="col-span-3" />
      </div>
    </DashboardShell>
  );
} 