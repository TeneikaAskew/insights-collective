import React, { useState } from 'react';
import InteractiveCareerReportSection from '@/components/assistants/InteractiveCareerReportSection';
import { parseCareerReport } from '@/components/assistants/utils/CareerReportParser';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CareerReportData } from '@/components/assistants/utils/types';
import { toast } from 'sonner';

import { createLogger } from '@/utils/logger';

const logger = createLogger('TestInteractiveReport');

const TestInteractiveReport = () => {
  const [rawReport, setRawReport] = useState<string>(
    `**Personalized Career Advice Report for Joshua B. Brown**

**Summary:** Based on your quiz answers and resume, we have generated a comprehensive report to guide your career growth in the data field. Your experience in program management, data-driven marketing, and logistics has equipped you with a unique set of skills that can be leveraged to excel in various roles.

**Recommended Roles:**
1. **Data Program Manager**: Oversee data-related projects, ensuring timely completion, budget adherence, and stakeholder satisfaction. Salary band: $80,000 - $110,000 per year.
2. **Business Intelligence Analyst**: Analyze complex data to inform business decisions, drive strategic growth, and optimize operations. Salary band: $60,000 - $90,000 per year.
3. **Operations Research Analyst**: Apply advanced analytical methods to help organizations solve complex problems and make informed decisions. Salary band: $70,000 - $100,000 per year.

**Skills and Matching Courses:**
| Skill | Course |
| --- | --- |
| Data analysis | Data Analysis with Python (Coursera) |
| Program management | Project Management Professional (PMP) Certification (Coursera) |
| Business intelligence | Business Intelligence and Data Visualization (edX) |
| Leadership | Leadership and Management (Udemy) |

**Next-Step Career Recommendations:**
Considering your experience in program management and data-driven marketing, we recommend that you explore roles that leverage your analytical and leadership skills. Your future vision of working in data and desired role as a data professional align with the recommended roles.

**Roles that Might be Right for You:**
1. **Data Scientist**: Develop and implement data-driven solutions to drive business growth and optimization.
2. **Operations Manager**: Oversee the planning, coordination, and execution of data-related projects and programs.
3. **Business Analyst**: Analyze business needs and develop data-driven solutions to drive growth and improvement.

**Path to Your Aspirational Role:**
To achieve your goal of working in data, we recommend the following steps:
1. **Upskill**: Enhance your data analysis and programming skills through online courses or certifications.
2. **Network**: Attend industry events and connect with professionals in your desired field to build relationships and learn about new opportunities.
3. **Gain experience**: Seek out projects or roles that allow you to apply your skills and build a portfolio of data-related work.

**Key Takeaways:**
* Your experience in program management and data-driven marketing is highly valuable in the data field.
* Developing your analytical and leadership skills will be crucial to success in your desired role.
* Exploring different roles and industries will help you find the best fit for your skills and interests.

By following these recommendations, you can create a successful career path in the data field and achieve your long-term goals.
`
  );

  const [parsedReport, setParsedReport] = useState(() => parseCareerReport(rawReport));

  const handleParseReport = () => {
    try {
      const parsed = parseCareerReport(rawReport);
      setParsedReport(parsed);
    } catch (error) {
      logger.error('Error parsing report:', error);
      alert('Error parsing report. Check console for details.');
    }
  };

  const sampleReportData: CareerReportData = {
    userName: "Sample User",
    summary: "This is a sample career report summary.",
    recommendedRoles: [{
      title: "Sample Role",
      description: "Sample description",
      salaryRange: "$80-120K",
      matchPercentage: 90
    }],
    skillsAndCourses: [{
      skill: "Sample Skill",
      course: "Sample Course"
    }],
    careerPathSteps: [{
      title: "Sample Step",
      description: "Sample description"
    }],
    keyTakeaways: ["Sample takeaway"],
    nextStepRecommendations: "Sample recommendations",
    potentialRoles: ["Sample role"]
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Test Interactive Career Report</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Raw Report Text</CardTitle>
            <CardDescription>Edit the raw report text to test the parser</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea 
              className="min-h-[400px] font-mono text-sm"
              value={rawReport}
              onChange={(e) => setRawReport(e.target.value)}
            />
            <Button onClick={handleParseReport} className="mt-4 w-full">
              Parse Report
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Parsed Data</CardTitle>
            <CardDescription>Structured data extracted from the report</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md overflow-auto max-h-[400px]">
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(parsedReport, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Interactive Report Preview</h2>
        <InteractiveCareerReportSection reportData={parsedReport} />
      </div>
    </div>
  );
};

export default TestInteractiveReport;
