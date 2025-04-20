import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { MessageSquare } from 'lucide-react';

interface OverallScoreCardProps {
  letterGrade: string;
  resumePercent: number;
  elevatorPitch: string;
  themes: string[];
  explanation: string;
  onStartCareerChat: () => void;
}

const OverallScoreCard: React.FC<OverallScoreCardProps> = ({
  letterGrade,
  resumePercent,
  elevatorPitch,
  themes,
  explanation,
  onStartCareerChat
}) => {
  const [isFlashing, setIsFlashing] = useState(false);
  
  // Setup flashing effect with interval
  useEffect(() => {
    const flashInterval = setInterval(() => {
      setIsFlashing(prev => !prev);
    }, 1500); // Toggle every 1.5 seconds
    
    return () => clearInterval(flashInterval);
  }, []);
  
  const getLetterGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return "text-green-600";
      case 'B':
        return "text-emerald-600";
      case 'C':
        return "text-yellow-600";
      case 'D':
        return "text-orange-600";
      default:
        return "text-red-600";
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Resume Score</span>
          <span className={`text-3xl font-bold ${getLetterGradeColor(letterGrade)}`}>
            {letterGrade} ({resumePercent}%)
          </span>
        </CardTitle>
        <CardDescription>
          Overall assessment of your resume based on industry standards and best practices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={resumePercent} className="h-2" />
        
        <div className="bg-accent/20 border border-accent rounded-md p-4">
          <p className="font-medium mb-2">Elevator Pitch:</p>
          <p className="text-sm italic">{elevatorPitch}</p>
        </div>
        
        <div>
          <h3 className="font-medium mb-2">Key Improvement Themes:</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {themes.map((theme, index) => <li key={index}>{theme}</li>)}
          </ul>
        </div>
        
        <Separator />
        
        <div>
          <h3 className="font-medium mb-2">Detailed Explanation:</h3>
          <p className="text-sm">{explanation}</p>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-100">
          <h3 className="font-medium mb-2 text-blue-800">What's next? Let's talk about your experience:</h3>
          <p className="text-sm italic text-blue-700">
            What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onStartCareerChat} 
          className={`w-full gap-2 transition-colors duration-300 ${
            isFlashing 
              ? 'bg-teal-600 hover:bg-teal-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Chat with Resume Roast Agent
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OverallScoreCard;
// import React from 'react';
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Progress } from '@/components/ui/progress';
// import { Separator } from '@/components/ui/separator';
// import { MessageSquare } from 'lucide-react';

// interface OverallScoreCardProps {
//   letterGrade: string;
//   resumePercent: number;
//   elevatorPitch: string;
//   themes: string[];
//   explanation: string;
//   onStartCareerChat: () => void;
// }

// const OverallScoreCard: React.FC<OverallScoreCardProps> = ({
//   letterGrade,
//   resumePercent,
//   elevatorPitch,
//   themes,
//   explanation,
//   onStartCareerChat
// }) => {
//   const getLetterGradeColor = (grade: string) => {
//     switch (grade) {
//       case 'A':
//         return "text-green-600";
//       case 'B':
//         return "text-emerald-600";
//       case 'C':
//         return "text-yellow-600";
//       case 'D':
//         return "text-orange-600";
//       default:
//         return "text-red-600";
//     }
//   };
  
//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle className="flex justify-between items-center">
//           <span>Resume Score</span>
//           <span className={`text-3xl font-bold ${getLetterGradeColor(letterGrade)}`}>
//             {letterGrade} ({resumePercent}%)
//           </span>
//         </CardTitle>
//         <CardDescription>
//           Overall assessment of your resume based on industry standards and best practices
//         </CardDescription>
//       </CardHeader>
//       <CardContent className="space-y-4">
//         <Progress value={resumePercent} className="h-2" />
        
//         <div className="bg-accent/20 border border-accent rounded-md p-4">
//           <p className="font-medium mb-2">Elevator Pitch:</p>
//           <p className="text-sm italic">{elevatorPitch}</p>
//         </div>
        
//         <div>
//           <h3 className="font-medium mb-2">Key Improvement Themes:</h3>
//           <ul className="list-disc pl-5 space-y-1 text-sm">
//             {themes.map((theme, index) => <li key={index}>{theme}</li>)}
//           </ul>
//         </div>
        
//         <Separator />
        
//         <div>
//           <h3 className="font-medium mb-2">Detailed Explanation:</h3>
//           <p className="text-sm">{explanation}</p>
//         </div>
        
//         <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-100">
//           <h3 className="font-medium mb-2 text-blue-800">What's next? Let's talk about your experience:</h3>
//           <p className="text-sm italic text-blue-700">
//             What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?
//           </p>
//         </div>
//       </CardContent>
//       <CardFooter>
//         <Button onClick={onStartCareerChat} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
//           <MessageSquare className="h-4 w-4" />
//           Start Resume Improvement Chat
//         </Button>
//       </CardFooter>
//     </Card>
//   );
// };

// export default OverallScoreCard;
