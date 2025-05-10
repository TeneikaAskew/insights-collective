
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, MessageSquare } from 'lucide-react';
import { Chart } from '@/components/ui/chart';
import html2pdf from 'html2pdf.js';

interface OverallScoreCardProps {
  letterGrade: string;
  resumePercent: number;
  elevatorPitch: string;
  themes: string[];
  explanation: string;
  onStartCareerChat: () => void;
  userId?: string;
  hasAnalysis?: boolean;
  careerAlignments?: Array<{
    role: string;
    percent: number;
  }>;
}

const OverallScoreCard: React.FC<OverallScoreCardProps> = ({
  letterGrade,
  resumePercent,
  elevatorPitch,
  themes,
  explanation,
  onStartCareerChat,
  userId,
  hasAnalysis,
  careerAlignments,
}) => {
  const handleExportReport = () => {
    // Create a temporary div to hold the content
    const element = document.createElement('div');
    element.className = 'pdf-export-container';
    element.style.width = '1100px'; // Set width for landscape mode
    element.style.padding = '40px';
    
    // Add the report title
    const title = document.createElement('h1');
    title.textContent = 'Resume Analysis Report';
    title.style.marginBottom = '20px';
    title.style.color = '#333';
    title.style.textAlign = 'center';
    element.appendChild(title);
    
    // Get the analysis section content
    const resumeGradeSection = document.createElement('div');
    resumeGradeSection.style.pageBreakAfter = 'always';
    resumeGradeSection.style.marginBottom = '30px';
    
    const gradeTitle = document.createElement('h2');
    gradeTitle.textContent = 'Resume Grade';
    gradeTitle.style.marginBottom = '15px';
    resumeGradeSection.appendChild(gradeTitle);
    
    const gradeContent = document.createElement('div');
    gradeContent.innerHTML = `
      <p><strong>Letter Grade:</strong> ${letterGrade}</p>
      <p><strong>Overall Score:</strong> ${resumePercent}%</p>
      <p><strong>Analysis:</strong> ${explanation}</p>
      <p><strong>Elevator Pitch:</strong> ${elevatorPitch}</p>
      <p><strong>Key Themes:</strong> ${themes.join(', ')}</p>
    `;
    resumeGradeSection.appendChild(gradeContent);
    
    element.appendChild(resumeGradeSection);
    
    // Career alignments section
    if (careerAlignments && careerAlignments.length > 0) {
      const alignmentsSection = document.createElement('div');
      alignmentsSection.style.pageBreakAfter = 'always';
      alignmentsSection.style.marginBottom = '30px';
      
      const alignmentsTitle = document.createElement('h2');
      alignmentsTitle.textContent = 'Career Alignments';
      alignmentsTitle.style.marginBottom = '15px';
      alignmentsSection.appendChild(alignmentsTitle);
      
      const alignmentsContent = document.createElement('div');
      careerAlignments.forEach(alignment => {
        const p = document.createElement('p');
        p.textContent = `Your resume shows ${alignment.percent}% alignment with ${alignment.role} roles.`;
        alignmentsContent.appendChild(p);
      });
      alignmentsSection.appendChild(alignmentsContent);
      
      element.appendChild(alignmentsSection);
    }
    
    // Get bullet points analysis if available
    const bulletPointsAnalysis = document.getElementById('bullet-points-analysis');
    if (bulletPointsAnalysis) {
      const bulletSection = document.createElement('div');
      bulletSection.style.pageBreakAfter = 'always';
      
      const bulletTitle = document.createElement('h2');
      bulletTitle.textContent = 'Bullet Points Analysis';
      bulletTitle.style.marginBottom = '15px';
      bulletSection.appendChild(bulletTitle);
      
      // Clone the bullet points content without interactive elements
      const clonedContent = bulletPointsAnalysis.cloneNode(true) as HTMLElement;
      // Remove any buttons or interactive elements
      const buttons = clonedContent.querySelectorAll('button');
      buttons.forEach(button => button.remove());
      bulletSection.appendChild(clonedContent);
      
      element.appendChild(bulletSection);
    }
    
    // Get key insights if available
    const keyInsightsSection = document.getElementById('key-insights-section');
    if (keyInsightsSection) {
      const insightsSection = document.createElement('div');
      
      const insightsTitle = document.createElement('h2');
      insightsTitle.textContent = 'Key Insights';
      insightsTitle.style.marginBottom = '15px';
      insightsSection.appendChild(insightsTitle);
      
      // Clone the insights content without interactive elements
      const clonedContent = keyInsightsSection.cloneNode(true) as HTMLElement;
      // Remove any buttons or interactive elements
      const buttons = clonedContent.querySelectorAll('button');
      buttons.forEach(button => button.remove());
      insightsSection.appendChild(clonedContent);
      
      element.appendChild(insightsSection);
    }
    
    // Configure pdf options
    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: 'resume-analysis-report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, logging: false },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    // Generate and download PDF
    html2pdf().set(opt).from(element).save();
  };

  return (
    <Card className="h-full">
      <CardContent className="p-6 space-y-5 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-2xl font-bold">Resume Grade</h3>
            <p className="text-muted-foreground text-sm">Analysis based on industry standards</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="text-4xl font-bold">{letterGrade}</div>
            <div className="text-sm text-muted-foreground">{resumePercent}%</div>
          </div>
        </div>

        {resumePercent > 0 && (
          <div className="w-full">
            <Chart
              type="radialBar"
              width="100%"
              height={100}
              series={[resumePercent]}
              options={{
                chart: {
                  toolbar: {
                    show: false,
                  },
                },
                plotOptions: {
                  radialBar: {
                    hollow: {
                      size: '50%',
                    },
                    dataLabels: {
                      show: true,
                      name: {
                        show: false,
                      },
                      value: {
                        show: false,
                      },
                    },
                  },
                },
                colors: ['#6366f1'],
                labels: ['Progress'],
              }}
            />
          </div>
        )}

        <div className="flex-grow">
          {elevatorPitch && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Elevator Pitch</h4>
              <p className="mt-1">{elevatorPitch}</p>
            </div>
          )}

          {themes && themes.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Key Themes</h4>
              <div className="flex flex-wrap gap-2 mt-1">
                {themes.map((theme, i) => (
                  <div
                    key={i}
                    className="text-xs px-2 py-1 bg-accent/40 text-accent-foreground rounded"
                  >
                    {theme}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Expert Analysis</h4>
            <p className="mt-1">{explanation}</p>
          </div>

          {/* Career alignment metrics moved here */}
          {careerAlignments && careerAlignments.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Career Alignments</h4>
              <div className="space-y-2 mt-2">
                {careerAlignments.map((alignment, index) => (
                  <div 
                    key={index} 
                    className="bg-muted/50 p-3 rounded-md text-sm"
                  >
                    Your resume shows {alignment.percent}% alignment with {alignment.role} roles.
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-primary-foreground/10 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-base">Get Personalized Coaching</h4>
                <p className="text-sm text-muted-foreground">
                  Speak with our AI career coach for detailed guidance on how to address these improvement areas.
                </p>
                <Button
                  className="mt-3 w-full sm:w-auto"
                  onClick={onStartCareerChat}
                  disabled={!hasAnalysis}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Start Career Chat
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString()} Analysis
          </div>
          <Button variant="outline" size="sm" onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OverallScoreCard;
