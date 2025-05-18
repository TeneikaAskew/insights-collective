import { Metadata } from 'next';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { JobDescriptionList } from '@/components/job-descriptions/JobDescriptionList';
import { AddJobDescriptionButton } from '@/components/job-descriptions/AddJobDescriptionButton';

export const metadata: Metadata = {
  title: 'Job Descriptions | Interview Prep Suite',
  description: 'Manage your job descriptions and generate study guides.',
};

export default function JobDescriptionsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Job Descriptions"
        description="Add and manage job descriptions to generate personalized study guides."
      >
        <AddJobDescriptionButton />
      </DashboardHeader>
      <JobDescriptionList />
    </DashboardShell>
  );
} 