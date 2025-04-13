import React, { useState } from 'react';
import {
  CareerTrack,
  QuizQuestion,
  quizQuestions,
  getTrackPersona,
  getCourseRecommendations
} from '@/data/careerQuizData';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import QuizResults from './QuizResults';

const Quiz: React.FC = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [showResults, setShowResults] = useState(false);
  const [scores, setScores] = useState<Record<CareerTrack, number>>({
    'AI/ML': 0,
    'Analytics': 0,
    'Data Engineering': 0,
    'Business Intelligence': 0
  });

  const question = quizQuestions[currentQuestion];
  const totalQuestions = quizQuestions.length;
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  const handleScaleAnswer = (value: number) => {
    setAnswers(prev => ({ ...prev, [question.id]: value }));
  };

  const handleMultipleChoiceAnswer = (optionId: string) => {
    setAnswers(prev => ({ ...prev, [question.id]: optionId }));
  };

  const isQuestionAnswered = () => answers[question.id] !== undefined;

  const handleNext = () => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      calculateScores();
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const calculateScores = () => {
    const newScores: Record<CareerTrack, number> = {
      'AI/ML': 0,
      'Analytics': 0,
      'Data Engineering': 0,
      'Business Intelligence': 0
    };

    quizQuestions.forEach(question => {
      const answer = answers[question.id];
      if (answer !== undefined) {
        if (question.type === 'scale' && question.weights) {
          const value = answer as number;
          Object.entries(question.weights).forEach(([track, weight]) => {
            newScores[track as CareerTrack] += (value / 5) * weight;
          });
        } else if (question.type === 'multiple-choice' && question.options) {
          const selected = question.options.find(opt => opt.id === answer);
          if (selected) {
            Object.entries(selected.weights).forEach(([track, weight]) => {
              newScores[track as CareerTrack] += weight;
            });
          }
        }
      }
    });

    setScores(newScores);
  };

  const resetQuiz = () => {
    setAnswers({});
    setShowResults(false);
    setCurrentQuestion(0);
    setScores({
      'AI/ML': 0,
      'Analytics': 0,
      'Data Engineering': 0,
      'Business Intelligence': 0
    });
  };

  if (showResults) {
    return <QuizResults scores={scores} answers={answers} onReset={resetQuiz} />;
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Question {currentQuestion + 1} of {totalQuestions}</span>
          <span className="text-sm font-medium">{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="text-xl font-semibold mb-6">{question.text}</h3>

          {question.type === 'scale' ? (
            <div className="space-y-6">
              <RadioGroup
                value={answers[question.id]?.toString() || ''}
                onValueChange={value => handleScaleAnswer(parseInt(value))}
                className="grid grid-cols-5 gap-2"
              >
                {[1, 2, 3, 4, 5].map(value => (
                  <div key={value} className="flex flex-col items-center">
                    <RadioGroupItem value={value.toString()} id={`scale-${value}`} />
                    <Label htmlFor={`scale-${value}`} className="mt-2 text-center text-sm">
                      {value === 1
                        ? 'Strongly Disagree'
                        : value === 2
                        ? 'Disagree'
                        : value === 3
                        ? 'Neutral'
                        : value === 4
                        ? 'Agree'
                        : 'Strongly Agree'}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ) : (
            <RadioGroup
              value={answers[question.id]?.toString() || ''}
              onValueChange={handleMultipleChoiceAnswer}
              className="space-y-3"
            >
              {question.options?.map(option => (
                <div key={option.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                  <Label htmlFor={`option-${option.id}`} className="text-base">{option.text}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <Button
          onClick={handleNext}
          disabled={!isQuestionAnswered()}
          className="flex items-center gap-2"
        >
          {currentQuestion < totalQuestions - 1 ? (
            <>Next <ArrowRight className="h-4 w-4" /></>
          ) : (
            'See Results'
          )}
        </Button>
      </div>
    </div>
  );
};

export default Quiz;
// import React, { useState } from 'react';
// import { CareerTrack, QuizQuestion, quizQuestions, getSkillLevel, getTrackPersona, getCourseRecommendations } from '@/data/careerQuizData';
// import { ArrowLeft, ArrowRight, BarChart2, Brain, Database, Presentation } from 'lucide-react';
// import { Card, CardContent } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
// import { Label } from '@/components/ui/label';
// import { Progress } from '@/components/ui/progress';
// import QuizResults from './QuizResults';

// const Quiz: React.FC = () => {
//   const [currentQuestion, setCurrentQuestion] = useState(0);
//   const [answers, setAnswers] = useState<Record<number, number | string>>({});
//   const [showResults, setShowResults] = useState(false);
//   const [scores, setScores] = useState<Record<CareerTrack, number>>({
//     'AI/ML': 0,
//     'Analytics': 0,
//     'Data Engineering': 0,
//     'Business Intelligence': 0
//   });

//   const question = quizQuestions[currentQuestion];
//   const totalQuestions = quizQuestions.length;
//   const progress = ((currentQuestion + 1) / totalQuestions) * 100;

//   const handleScaleAnswer = (value: number) => {
//     const newAnswers = { ...answers, [question.id]: value };
//     setAnswers(newAnswers);
//   };

//   const handleMultipleChoiceAnswer = (optionId: string) => {
//     const newAnswers = { ...answers, [question.id]: optionId };
//     setAnswers(newAnswers);
//   };

//   const isQuestionAnswered = () => {
//     return answers[question.id] !== undefined;
//   };

//   const handleNext = () => {
//     if (currentQuestion < totalQuestions - 1) {
//       setCurrentQuestion(prev => prev + 1);
//     } else {
//       calculateScores();
//       setShowResults(true);
//     }
//   };

//   const handlePrevious = () => {
//     if (currentQuestion > 0) {
//       setCurrentQuestion(prev => prev - 1);
//     }
//   };

//   const calculateScores = () => {
//     const newScores: Record<CareerTrack, number> = {
//       'AI/ML': 0,
//       'Analytics': 0,
//       'Data Engineering': 0,
//       'Business Intelligence': 0
//     };

//     // Calculate scores based on answers
//     quizQuestions.forEach(question => {
//       const answer = answers[question.id];
      
//       if (answer !== undefined) {
//         if (question.type === 'scale' && question.weights) {
//           const value = answer as number;
//           Object.entries(question.weights).forEach(([track, weight]) => {
//             newScores[track as CareerTrack] += value * weight / 5; // Normalize to max of weight
//           });
//         } else if (question.type === 'multiple-choice' && question.options) {
//           const selectedOption = question.options.find(option => option.id === answer);
//           if (selectedOption) {
//             Object.entries(selectedOption.weights).forEach(([track, weight]) => {
//               newScores[track as CareerTrack] += weight;
//             });
//           }
//         }
//       }
//     });

//     setScores(newScores);
//   };

//   const resetQuiz = () => {
//     setCurrentQuestion(0);
//     setAnswers({});
//     setShowResults(false);
//     setScores({
//       'AI/ML': 0,
//       'Analytics': 0,
//       'Data Engineering': 0,
//       'Business Intelligence': 0
//     });
//   };

//   if (showResults) {
//     return <QuizResults scores={scores} answers={answers} onReset={resetQuiz} />;
//   }

//   return (
//     <div className="w-full max-w-3xl mx-auto">
//       <div className="mb-4">
//         <div className="flex justify-between items-center mb-2">
//           <span className="text-sm font-medium">Question {currentQuestion + 1} of {totalQuestions}</span>
//           <span className="text-sm font-medium">{progress.toFixed(0)}% Complete</span>
//         </div>
//         <Progress value={progress} className="h-2" />
//       </div>
      
//       <Card className="mb-6">
//         <CardContent className="pt-6">
//           <h3 className="text-xl font-semibold mb-6">{question.text}</h3>
          
//           {question.type === 'scale' ? (
//             <div className="space-y-6">
//               <RadioGroup 
//                 value={answers[question.id]?.toString() || ''} 
//                 onValueChange={(value) => handleScaleAnswer(parseInt(value))}
//                 className="grid grid-cols-5 gap-2"
//               >
//                 {[1, 2, 3, 4, 5].map((value) => (
//                   <div key={value} className="flex flex-col items-center">
//                     <RadioGroupItem value={value.toString()} id={`scale-${value}`} className="mx-auto" />
//                     <Label htmlFor={`scale-${value}`} className="mt-2 text-center text-sm">
//                       {value === 1 ? 'Strongly Disagree' : 
//                        value === 2 ? 'Disagree' : 
//                        value === 3 ? 'Neutral' : 
//                        value === 4 ? 'Agree' : 
//                        'Strongly Agree'}
//                     </Label>
//                   </div>
//                 ))}
//               </RadioGroup>
//             </div>
//           ) : (
//             <RadioGroup 
//               value={answers[question.id]?.toString() || ''} 
//               onValueChange={(value) => handleMultipleChoiceAnswer(value)}
//               className="space-y-3"
//             >
//               {question.options?.map((option) => (
//                 <div key={option.id} className="flex items-center space-x-2">
//                   <RadioGroupItem value={option.id} id={`option-${option.id}`} />
//                   <Label htmlFor={`option-${option.id}`} className="text-base">
//                     {option.text}
//                   </Label>
//                 </div>
//               ))}
//             </RadioGroup>
//           )}
//         </CardContent>
//       </Card>
      
//       <div className="flex justify-between">
//         <Button 
//           variant="outline" 
//           onClick={handlePrevious} 
//           disabled={currentQuestion === 0}
//           className="flex items-center gap-2"
//         >
//           <ArrowLeft className="h-4 w-4" /> Previous
//         </Button>
        
//         <Button 
//           onClick={handleNext} 
//           disabled={!isQuestionAnswered()}
//           className="flex items-center gap-2"
//         >
//           {currentQuestion < totalQuestions - 1 ? (
//             <>Next <ArrowRight className="h-4 w-4" /></>
//           ) : (
//             'See Results'
//           )}
//         </Button>
//       </div>
//     </div>
//   );
// };

// export default Quiz;
