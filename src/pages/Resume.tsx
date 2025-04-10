
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import ResumeLoginWall from '@/components/resume/ResumeLoginWall';
import ResumePageSkeleton from '@/components/resume/ResumePageSkeleton';
import ResumePageContent from '@/components/resume/ResumePageContent';
import { useResumeInit } from '@/components/resume/ResumePageInit';

const Resume = () => {
  const { isAuthenticated, isLoading, resumeHookData, analysisHookData } = useResumeInit();

  if (!isAuthenticated) {
    return <ResumeLoginWall />;
  }

  if (isLoading) {
    return (
      <AppLayout>
        <ResumePageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ResumePageContent 
        resumeHookData={resumeHookData}
        analysisHookData={analysisHookData}
      />
    </AppLayout>
  );
};

export default Resume;
