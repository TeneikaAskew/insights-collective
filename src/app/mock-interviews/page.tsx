import { Metadata } from 'next';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { MockInterviewList } from '@/components/mock-interviews/MockInterviewList';
import { AvailabilityCalendar } from '@/components/mock-interviews/AvailabilityCalendar';
import { ScheduleInterviewButton } from '@/components/mock-interviews/ScheduleInterviewButton';

export const metadata: Metadata = {
  title: 'Mock Interviews | Interview Prep Suite',
  description: 'Schedule and manage your mock interview sessions.',
};

export default function MockInterviewsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Mock Interviews"
        description="Schedule and manage your mock interview sessions."
      >
        <ScheduleInterviewButton />
      </DashboardHeader>
      <div className="grid gap-4 md:grid-cols-7">
        <MockInterviewList className="col-span-4" />
        <AvailabilityCalendar className="col-span-3" />
      </div>
    </DashboardShell>
  );
} 