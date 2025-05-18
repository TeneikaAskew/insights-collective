import { Metadata } from 'next';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { UpcomingSessions } from '@/components/dashboard/UpcomingSessions';
import { WeeklyProgress } from '@/components/dashboard/WeeklyProgress';
import { StudyGuideProgress } from '@/components/dashboard/StudyGuideProgress';

export const metadata: Metadata = {
  title: 'Dashboard | Interview Prep Suite',
  description: 'Track your interview preparation progress and upcoming sessions.',
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Dashboard"
        description="Track your interview preparation progress and upcoming sessions."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <WeeklyProgress className="col-span-4" />
        <UpcomingSessions className="col-span-3" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <StudyGuideProgress className="col-span-4" />
        <RecentActivity className="col-span-3" />
      </div>
    </DashboardShell>
  );
} 