
import React from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CourseDetails = () => {
  const { courseId } = useParams();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Course Details</h1>
          <p className="text-muted-foreground">
            Course ID: {courseId}
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Course Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Detailed course information and content will be available here.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CourseDetails;
