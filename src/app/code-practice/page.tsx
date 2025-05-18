import { Metadata } from 'next';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CodeChallengeList } from '@/components/code-practice/CodeChallengeList';
import { CodingStats } from '@/components/code-practice/CodingStats';

export const metadata: Metadata = {
  title: 'Code Practice | Interview Prep Suite',
  description: 'Practice technical coding challenges with real-time feedback.',
};

export default function CodePracticePage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Code Practice"
        description="Practice technical coding challenges with real-time feedback."
      />
      <div className="grid gap-4 md:grid-cols-7">
        <CodeChallengeList className="col-span-4" />
        <CodingStats className="col-span-3" />
      </div>
    </DashboardShell>
  );
} 