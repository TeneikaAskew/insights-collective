
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export default function SurveyConfirmation() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="container max-w-2xl py-10">
        <Card className="border-t-4 border-t-green-500">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Submission Successful!</CardTitle>
            <CardDescription className="text-base">
              Thank you for completing the form.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">
              Your response has been recorded. We'll review your submission and get back to you if necessary.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to Home
            </Button>
            {slug && (
              <Button onClick={() => navigate(`/survey/${slug}`)}>
                Submit Another Response
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
}
