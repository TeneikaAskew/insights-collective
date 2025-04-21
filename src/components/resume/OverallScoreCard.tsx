import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Get user ID if authenticated
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id;

interface OverallScoreCardProps {
  letterGrade: string;
  resumePercent: number;
  elevatorPitch: string;
  themes: string[];
  explanation: string;
  onStartCareerChat: () => void;
  userId?: string; // Add userId to check for initial_assessment
}

// Add this state to your Resume component
const [hasInitialAssessment, setHasInitialAssessment] = useState(false);

// Add this effect to check for initial_assessment
useEffect(() => {
  if (user && resume?.id) {
    logDebug('InitialAssessment', `Checking for initial assessment for resumeId: ${resume.id} and userId: ${user.id}`);
    
    const checkForInitialAssessment = async () => {
      try {
        const { data, error } = await supabase
          .from('resumes')
          .select('initial_assessment')
          .eq('id', resume.id)
          .maybeSingle();
        
        logDebug('InitialAssessment', 'Query result:', { data, error, hasInitialAssessment: !!data?.initial_assessment });
          
        if (!error && data?.initial_assessment) {
          logDebug('InitialAssessment', 'Found initial assessment data, setting hasInitialAssessment to true');
          setHasInitialAssessment(true);
        } else {
          logDebug('InitialAssessment', 'No initial assessment found or error occurred');
        }
      } catch (error) {
        logDebug('InitialAssessment', 'Error checking for initial assessment:', error);
      }
    };
    
    checkForInitialAssessment();
  } else {
    logDebug('InitialAssessment', 'Missing user or resumeId, cannot check for initial assessment', { 
      hasUser: !!user, 
      hasResumeId: !!resume?.id 
    });
  }
}, [user, resume?.id]);


const OverallScoreCard: React.FC<OverallScoreCardProps> = ({
  letterGrade,
  resumePercent,
  elevatorPitch,
  themes,
  explanation,
  onStartCareerChat,
  userId
}) => {
  const [isFlashing, setIsFlashing] = useState(false);
  const [hasRoast, setHasRoast] = useState(false);
  
  // Check if initial_assessment exists for this user
  useEffect(() => {
    console.log("Checking if roast exists yet for: ", userId)
    if (userId) {
      
      const checkForRoast = async () => {
        try {
          const { data, error } = await supabase
            .from('resumes')
            .select('initial_assessment')
            .eq('user_id', userId)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          console.log("user: ", userId, " - Roast data", data)
            
          if (!error && data?.initial_assessment) {
            setHasRoast(true);
          }
        } catch (error) {
          console.error("Error checking for roast:", error);
        }
      };
      
      checkForRoast();
    }
  }, [userId]);
  
  // Setup flashing effect with interval, but only if we have a roast
  useEffect(() => {
    console.log("Does the roast exist? ", hasRoast)
    if (!hasRoast) return;
    
    const flashInterval = setInterval(() => {
      setIsFlashing(prev => !prev);
    }, 1500); // Toggle every 1.5 seconds
    
    return () => clearInterval(flashInterval);
  }, [hasRoast]);
  
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
            hasRoast && isFlashing 
              ? 'bg-teal-600 hover:bg-teal-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Start Resume Improvement Chat
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OverallScoreCard;

// import React, { useState, useEffect } from 'react';
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
//   const [isFlashing, setIsFlashing] = useState(false);
  
//   // Setup flashing effect with interval
//   useEffect(() => {
//     const flashInterval = setInterval(() => {
//       setIsFlashing(prev => !prev);
//     }, 1500); // Toggle every 1.5 seconds
    
//     return () => clearInterval(flashInterval);
//   }, []);
  
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
//         <Button 
//           onClick={onStartCareerChat} 
//           className={`w-full gap-2 transition-colors duration-300 ${
//             isFlashing 
//               ? 'bg-teal-600 hover:bg-teal-700' 
//               : 'bg-blue-600 hover:bg-blue-700'
//           }`}
//         >
//           <MessageSquare className="h-4 w-4" />
//           Chat with Resume Roast Agent
//         </Button>
//       </CardFooter>
//     </Card>
//   );
// };

// export default OverallScoreCard;
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
