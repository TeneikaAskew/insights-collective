import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BulletAnalysis } from '@/components/assistants/types';
import BulletPointItem from './BulletPointItem';
import BulletPointChart from './BulletPointChart';
import { Check, Edit2, X, Loader2 } from 'lucide-react';
import { HighlightedBulletText } from './text/BulletTextParser';
import { ScoreWithIcon } from './chart/ChartComponents';

interface BulletPointsAnalysisCardProps {
  bullets: BulletAnalysis[];
  isAnalyzing?: boolean; // Add a prop to indicate if analysis is in progress
}

const BulletPointsAnalysisCard: React.FC<BulletPointsAnalysisCardProps> = ({
  bullets = [], // Provide default empty array
  isAnalyzing = false // Default to false
}) => {
  const [selectedBulletIndex, setSelectedBulletIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [editedBullet, setEditedBullet] = useState<BulletAnalysis | null>(null);
  const [hasImprovements, setHasImprovements] = useState(false);

  // Check if bullets have rewritten property to determine if improvements are loaded
  useEffect(() => {
    if (bullets && bullets.length > 0) {
      // Check if at least one bullet has a rewritten property that's different from the original
      const improvements = bullets.some(bullet => 
        bullet.rewritten && bullet.rewritten !== bullet.original
      );
      setHasImprovements(improvements);
    }
  }, [bullets]);

  // If no bullets are available, show a placeholder
  if (!bullets || bullets.length === 0) {
    return <Card>
        <CardHeader>
          <CardTitle>Resume Bullet Analysis</CardTitle>
          <CardDescription>
            No bullet points found in your resume. Upload a resume with well-formatted bullet points to see detailed analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-gray-400">
          <p>No bullet points to analyze</p>
        </CardContent>
      </Card>;
  }

  // Safely select the bullet (handle case where selectedBulletIndex is out of range)
  const selectedBullet = bullets[selectedBulletIndex < bullets.length ? selectedBulletIndex : 0] || bullets[0];

  // Display the edited bullet or the original selected bullet
  const displayBullet = editedBullet || selectedBullet;

  // Handle edit button click
  const handleEdit = () => {
    setEditedText(selectedBullet?.rewritten || selectedBullet?.original || "");
    setIsEditing(true);
  };

  // Handle save button click
  const handleSave = () => {
    // Create a simulated analysis of the edited text
    // In a real implementation, you would call the actual analysis API
    const improvedBullet = {
      ...selectedBullet,
      rewritten: editedText,
      // Simulate improved scores based on edits
      bullet_total: Math.min(45, (selectedBullet?.bullet_total || 0) + 5),
      xyz_scores: {
        hard_soft: Math.min(5, (selectedBullet?.xyz_scores?.hard_soft || 0) + 0.5),
        action_words: Math.min(5, (selectedBullet?.xyz_scores?.action_words || 0) + 0.5),
        measurable_results: Math.min(5, (selectedBullet?.xyz_scores?.measurable_results || 0) + 0.5),
        clarity_focus: Math.min(5, (selectedBullet?.xyz_scores?.clarity_focus || 0) + 0.5)
      },
      word_balance_score: Math.min(25, (selectedBullet?.word_balance_score || 0) + 2),
      word_balance: {
        industry_pct: Math.min(45, (selectedBullet?.word_balance?.industry_pct || 0) + 5),
        common_pct: Math.max(25, (selectedBullet?.word_balance?.common_pct || 0) - 2),
        action_pct: Math.min(15, (selectedBullet?.word_balance?.action_pct || 0) + 2),
        metric_pct: Math.min(15, (selectedBullet?.word_balance?.metric_pct || 0) + 2)
      }
    };
    setEditedBullet(improvedBullet);
    setIsEditing(false);
  };

  // Handle cancel button click
  const handleCancel = () => {
    setIsEditing(false);
  };

  // Determine if we should show improvements or original bullets
  const showImprovements = hasImprovements && !isAnalyzing;

  // Get the appropriate rewritten text to display (improved or original)
  const getRewrittenText = () => {
    if (isAnalyzing) {
      return "Generating improvement...";
    }
    
    if (displayBullet?.rewritten && displayBullet.rewritten !== displayBullet.original) {
      return displayBullet.rewritten;
    }
    
    return "No improvements available yet";
  };

  // Get improvement tips to display
  const getTips = () => {
    if (isAnalyzing) {
      return "Analyzing your resume bullet points...";
    }
    
    if (displayBullet?.tips) {
      // If tips is an array, join with periods, otherwise return as is
      if (Array.isArray(displayBullet.tips)) {
        return displayBullet.tips.join('. ');
      }
      return displayBullet.tips;
    }
    
    return "Add more specific technical skills or leadership traits. Start with a stronger action verb and avoid passive language. Include quantifiable results (%, $, or other metrics). Make this more concise, aiming for 25 words or fewer.";
  };

  // Render loading overlay when analyzing
  const renderLoadingOverlay = () => {
    if (isAnalyzing) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 rounded-lg">
          <Loader2 className="animate-spin h-8 w-8 mb-4 text-blue-600" />
          <p className="text-lg font-medium text-gray-700">
            {isAnalyzing ? "Analyzing your resume..." : "Generating improved bullet points..."}
          </p>
          <p className="text-sm text-gray-500 mt-2 text-center max-w-md">
            Our AI is analyzing your resume bullets and creating enhanced versions with better metrics and action verbs.
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="relative">
      {renderLoadingOverlay()}
      <CardHeader className={isAnalyzing ? "opacity-50" : ""}>
        <CardTitle className="text-center">Storytelling Analysis</CardTitle>
        <CardDescription className="text-center">Every bullet on your resume should tell a story, this is a breakdown of your resume bullet points with improvement suggestions to enhance that story.</CardDescription>
      </CardHeader>
      <CardContent className={`space-y-6 ${isAnalyzing ? "opacity-50" : ""}`}>
        {/* Bullet selection with wider dropdown */}
        <div>
          <label className="block text-sm font-medium mb-2">Select a bullet point:</label>
          <select 
            className="w-full border rounded p-2 text-ellipsis overflow-hidden" 
            value={selectedBulletIndex} 
            onChange={e => {
              setSelectedBulletIndex(parseInt(e.target.value));
              setEditedBullet(null); // Reset edited bullet when selection changes
              setIsEditing(false); // Exit edit mode when selection changes
            }} 
            style={{
              maxWidth: '100%',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            disabled={isAnalyzing}
          >
            {bullets.map((bullet, idx) => (
              <option 
                key={idx} 
                value={idx} 
                style={{
                  maxWidth: '100%',
                  whiteSpace: 'normal'
                }}
              >
                {bullet?.original || `Bullet point ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
        
        {/* Highlighted bullet text above the charts */}
        <div className="text-center py-2">
          <div className="mt-2 text-lg">
            <HighlightedBulletText text={selectedBullet?.original || ''} />
          </div>
        </div>
        
        {/* Main visualization for the selected bullet */}
        {displayBullet && <BulletPointChart bullet={displayBullet} />}
        
        {/* Original vs Rewritten section */}
        <div className="space-y-4 mt-6 border-t pt-4">
          <div>
            <h4 className="text-md font-semibold mb-2">Original:</h4>
            <div className="text-sm bg-slate-50 p-3 rounded">
              <HighlightedBulletText text={displayBullet?.original || ''} />
            </div>
          </div>
          
          <div>
            <h4 className="text-md font-semibold mb-2 flex items-center">
              <span>Suggested Improvement:</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-2 h-6 p-1" 
                onClick={isEditing ? undefined : handleEdit} 
                disabled={isEditing || isAnalyzing || !hasImprovements}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </h4>
            
            {isEditing ? (
              <div className="space-y-2">
                <Textarea 
                  value={editedText} 
                  onChange={e => setEditedText(e.target.value)} 
                  className="min-h-[100px] text-sm" 
                  placeholder="Edit your bullet point here..." 
                />
                <div className="flex space-x-2 justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancel} 
                    className="flex items-center"
                  >
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleSave} 
                    className="flex items-center"
                  >
                    <Check className="h-4 w-4 mr-1" /> Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 p-3 rounded text-gray-700">
                {getRewrittenText()}
              </div>
            )}
          </div>
        </div>
        
        {/* Suggested Improved Bullet Analysis Visualization */}
        {showImprovements && displayBullet?.rewritten && displayBullet.rewritten !== displayBullet.original && (
          <div className="mt-6 border-t pt-4">
            {/* Improved bullet text display */}
            <div className="text-center mb-4">
              <div className="text-lg">
                <HighlightedBulletText text={displayBullet?.rewritten || ''} />
              </div>
            </div>
            
            {/* We're reusing the BulletPointChart component for the improved version */}
            <BulletPointChart bullet={{
              ...displayBullet,
              original: displayBullet.rewritten,
              // For this example, we're creating an improved version with better scores
              bullet_total: Math.min(45, displayBullet.bullet_total + 10),
              xyz_scores: {
                hard_soft: Math.min(5, displayBullet.xyz_scores.hard_soft + 1),
                action_words: Math.min(5, displayBullet.xyz_scores.action_words + 1),
                measurable_results: Math.min(5, displayBullet.xyz_scores.measurable_results + 1),
                clarity_focus: Math.min(5, displayBullet.xyz_scores.clarity_focus + 1)
              },
              word_balance_score: Math.min(25, displayBullet.word_balance_score + 5),
              word_balance: {
                industry_pct: Math.min(45, displayBullet.word_balance.industry_pct + 5),
                common_pct: Math.max(25, displayBullet.word_balance.common_pct - 2),
                action_pct: Math.min(15, displayBullet.word_balance.action_pct + 2),
                metric_pct: Math.min(15, displayBullet.word_balance.metric_pct + 2)
              }
            }} />
          </div>
        )}
        {/* Score Breakdown section */}
<div className="mt-6 border-t pt-4">
  <h4 className="text-lg font-semibold mb-4">Score Breakdown:</h4>
  
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <h5 className="font-medium text-sm mb-2">Word Balance ({displayBullet?.word_balance_score || 0}/25)</h5>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Industry:</span>
          <span className="font-medium">{displayBullet?.word_balance?.industry_pct || 0}%</span>
        </div>
        <div className="flex justify-between">
          <span>Common:</span>
          <span className="font-medium">{displayBullet?.word_balance?.common_pct || 0}%</span>
        </div>
        <div className="flex justify-between">
          <span>Action:</span>
          <span className="font-medium">{displayBullet?.word_balance?.action_pct || 0}%</span>
        </div>
        <div className="flex justify-between">
          <span>Metric:</span>
          <span className="font-medium">{displayBullet?.word_balance?.metric_pct || 0}%</span>
        </div>
      </div>
    </div>
    
    <div>
      <h5 className="font-medium text-sm mb-2">XYZ Quality ({
        (displayBullet?.xyz_scores?.action || 0) + 
        (displayBullet?.xyz_scores?.metrics || 0) + 
        (displayBullet?.xyz_scores?.clarity || 0) + 
        (displayBullet?.xyz_scores?.industry || 0) + 
        (displayBullet?.xyz_scores?.achievement || 0)
      }/100)</h5>
      <div className="space-y-2">
        <ScoreWithIcon score={displayBullet?.xyz_scores?.action || 0} maxScore={10} label="Action Words" />
        <ScoreWithIcon score={displayBullet?.xyz_scores?.metrics || 0} maxScore={30} label="Metrics/Results" />
        <ScoreWithIcon score={displayBullet?.xyz_scores?.clarity || 0} maxScore={15} label="Clarity/Conciseness" />
        <ScoreWithIcon score={displayBullet?.xyz_scores?.industry || 0} maxScore={25} label="Industry Keywords" />
        <ScoreWithIcon score={displayBullet?.xyz_scores?.achievement || 0} maxScore={20} label="Achievement Focus" />
      </div>
    </div>
  </div>
</div>
        {/* Score Breakdown section */}
        {/* <div className="mt-6 border-t pt-4">
          <h4 className="text-lg font-semibold mb-4">Score Breakdown:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-sm mb-2">Word Balance ({displayBullet?.word_balance_score || 0}/25)</h5>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Industry:</span>
                  <span className="font-medium">{displayBullet?.word_balance?.industry_pct || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Common:</span>
                  <span className="font-medium">{displayBullet?.word_balance?.common_pct || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Action:</span>
                  <span className="font-medium">{displayBullet?.word_balance?.action_pct || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Metric:</span>
                  <span className="font-medium">{displayBullet?.word_balance?.metric_pct || 0}%</span>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-sm mb-2">XYZ Quality ({(displayBullet?.xyz_scores?.hard_soft || 0) + (displayBullet?.xyz_scores?.action_words || 0) + (displayBullet?.xyz_scores?.measurable_results || 0) + (displayBullet?.xyz_scores?.clarity_focus || 0)}/20)</h5>
              <div className="space-y-2">
                <ScoreWithIcon score={displayBullet?.xyz_scores?.hard_soft || 0} maxScore={5} label="Hard/Soft Skills" />
                <ScoreWithIcon score={displayBullet?.xyz_scores?.action_words || 0} maxScore={5} label="Action Words" />
                <ScoreWithIcon score={displayBullet?.xyz_scores?.measurable_results || 0} maxScore={5} label="Measurable Results" />
                <ScoreWithIcon score={displayBullet?.xyz_scores?.clarity_focus || 0} maxScore={5} label="Clarity & Focus" />
              </div>
            </div>
          </div>
        </div> */}
        
        {/* Improvement Tips */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-md font-semibold mb-2">Improvement Tips:</h4>
          <p className="text-md text-slate-700">
            {getTips()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BulletPointsAnalysisCard;

// import React, { useState } from 'react';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Accordion } from '@/components/ui/accordion';
// import { Button } from '@/components/ui/button';
// import { Textarea } from '@/components/ui/textarea';
// import { BulletAnalysis } from '@/components/assistants/types';
// import BulletPointItem from './BulletPointItem';
// import BulletPointChart from './BulletPointChart';
// import { Check, Edit2, X } from 'lucide-react';
// import { HighlightedBulletText } from './text/BulletTextParser';
// import { ScoreWithIcon } from './chart/ChartComponents';
// interface BulletPointsAnalysisCardProps {
//   bullets: BulletAnalysis[];
// }
// const BulletPointsAnalysisCard: React.FC<BulletPointsAnalysisCardProps> = ({
//   bullets = [] // Provide default empty array
// }) => {
//   const [selectedBulletIndex, setSelectedBulletIndex] = useState(0);
//   const [isEditing, setIsEditing] = useState(false);
//   const [editedText, setEditedText] = useState("");
//   const [editedBullet, setEditedBullet] = useState<BulletAnalysis | null>(null);

//   // If no bullets are available, show a placeholder
//   if (!bullets || bullets.length === 0) {
//     return <Card>
//         <CardHeader>
//           <CardTitle>Resume Bullet Analysis</CardTitle>
//           <CardDescription>
//             No bullet points found in your resume. Upload a resume with well-formatted bullet points to see detailed analysis.
//           </CardDescription>
//         </CardHeader>
//         <CardContent className="h-64 flex items-center justify-center text-gray-400">
//           <p>No bullet points to analyze</p>
//         </CardContent>
//       </Card>;
//   }

//   // Safely select the bullet (handle case where selectedBulletIndex is out of range)
//   const selectedBullet = bullets[selectedBulletIndex < bullets.length ? selectedBulletIndex : 0] || bullets[0];

//   // Display the edited bullet or the original selected bullet
//   const displayBullet = editedBullet || selectedBullet;

//   // Handle edit button click
//   const handleEdit = () => {
//     setEditedText(selectedBullet?.rewritten || "");
//     setIsEditing(true);
//   };

//   // Handle save button click
//   const handleSave = () => {
//     // Create a simulated analysis of the edited text
//     // In a real implementation, you would call the actual analysis API
//     const improvedBullet = {
//       ...selectedBullet,
//       rewritten: editedText,
//       // Simulate improved scores based on edits
//       bullet_total: Math.min(45, (selectedBullet?.bullet_total || 0) + 5),
//       xyz_scores: {
//         hard_soft: Math.min(5, (selectedBullet?.xyz_scores?.hard_soft || 0) + 0.5),
//         action_words: Math.min(5, (selectedBullet?.xyz_scores?.action_words || 0) + 0.5),
//         measurable_results: Math.min(5, (selectedBullet?.xyz_scores?.measurable_results || 0) + 0.5),
//         clarity_focus: Math.min(5, (selectedBullet?.xyz_scores?.clarity_focus || 0) + 0.5)
//       },
//       word_balance_score: Math.min(25, (selectedBullet?.word_balance_score || 0) + 2),
//       word_balance: {
//         industry_pct: Math.min(45, (selectedBullet?.word_balance?.industry_pct || 0) + 5),
//         common_pct: Math.max(25, (selectedBullet?.word_balance?.common_pct || 0) - 2),
//         action_pct: Math.min(15, (selectedBullet?.word_balance?.action_pct || 0) + 2),
//         metric_pct: Math.min(15, (selectedBullet?.word_balance?.metric_pct || 0) + 2)
//       }
//     };
//     setEditedBullet(improvedBullet);
//     setIsEditing(false);
//   };

//   // Handle cancel button click
//   const handleCancel = () => {
//     setIsEditing(false);
//   };
//   return <Card>
//       <CardHeader>
//         <CardTitle className="text-center">Storytelling Analysis</CardTitle>
//         <CardDescription className="text-center">Every bullet on your resume should tell a story, this ia a breakdown of your resume bullet points with improvement suggestions to enhance that story.</CardDescription>
//       </CardHeader>
//       <CardContent className="space-y-6">
//         {/* Bullet selection with wider dropdown */}
//         <div>
//           <label className="block text-sm font-medium mb-2">Select a bullet point:</label>
//           <select className="w-full border rounded p-2 text-ellipsis overflow-hidden" value={selectedBulletIndex} onChange={e => {
//           setSelectedBulletIndex(parseInt(e.target.value));
//           setEditedBullet(null); // Reset edited bullet when selection changes
//           setIsEditing(false); // Exit edit mode when selection changes
//         }} style={{
//           maxWidth: '100%',
//           textOverflow: 'ellipsis',
//           whiteSpace: 'nowrap'
//         }}>
//             {bullets.map((bullet, idx) => <option key={idx} value={idx} style={{
//             maxWidth: '100%',
//             whiteSpace: 'normal'
//           }}>
//                 {bullet?.original || `Bullet point ${idx + 1}`}
//               </option>)}
//           </select>
//         </div>
        
//         {/* Highlighted bullet text above the charts */}
//         <div className="text-center py-2">
//           <div className="mt-2 text-lg">
//             <HighlightedBulletText text={selectedBullet?.original || ''} />
//           </div>
//         </div>
        
//         {/* Main visualization for the selected bullet */}
//         {displayBullet && <BulletPointChart bullet={displayBullet} />}
        
//         {/* Original vs Rewritten section */}
//         <div className="space-y-4 mt-6 border-t pt-4">
//           <div>
            
            
//           </div>
          
//           <div>
//             <h4 className="text-md font-semibold mb-2 flex items-center">
//               <span>Suggested Improvement:</span>
//               <Button variant="ghost" size="sm" className="ml-2 h-6 p-1" onClick={isEditing ? undefined : handleEdit} disabled={isEditing}>
//                 <Edit2 className="h-4 w-4" />
//               </Button>
//             </h4>
            
//             {isEditing ? <div className="space-y-2">
//                 <Textarea value={editedText} onChange={e => setEditedText(e.target.value)} className="min-h-[100px] text-sm" placeholder="Edit your bullet point here..." />
//                 <div className="flex space-x-2 justify-end">
//                   <Button variant="outline" size="sm" onClick={handleCancel} className="flex items-center">
//                     <X className="h-4 w-4 mr-1" /> Cancel
//                   </Button>
//                   <Button variant="default" size="sm" onClick={handleSave} className="flex items-center">
//                     <Check className="h-4 w-4 mr-1" /> Save
//                   </Button>
//                 </div>
//               </div> : <div className="bg-green-50 p-3 rounded text-gray-700">
//                 {displayBullet?.rewritten || "No suggestion available"}
//               </div>}
//           </div>
//         </div>
        
//         {/* Suggested Improved Bullet Analysis Visualization */}
//         {displayBullet?.rewritten && <div className="mt-6 border-t pt-4">
            
            
//             {/* Improved bullet text display */}
//             <div className="text-center mb-4">
//               <div className="text-lg">
//                 <HighlightedBulletText text={displayBullet?.rewritten || ''} />
//               </div>
//             </div>
            
//             {/* We're reusing the BulletPointChart component for the improved version */}
//             <BulletPointChart bullet={{
//           ...displayBullet,
//           original: displayBullet.rewritten,
//           // For this example, we're creating an improved version with better scores
//           bullet_total: Math.min(45, displayBullet.bullet_total + 10),
//           xyz_scores: {
//             hard_soft: Math.min(5, displayBullet.xyz_scores.hard_soft + 1),
//             action_words: Math.min(5, displayBullet.xyz_scores.action_words + 1),
//             measurable_results: Math.min(5, displayBullet.xyz_scores.measurable_results + 1),
//             clarity_focus: Math.min(5, displayBullet.xyz_scores.clarity_focus + 1)
//           },
//           word_balance_score: Math.min(25, displayBullet.word_balance_score + 5),
//           word_balance: {
//             industry_pct: Math.min(45, displayBullet.word_balance.industry_pct + 5),
//             common_pct: Math.max(25, displayBullet.word_balance.common_pct - 2),
//             action_pct: Math.min(15, displayBullet.word_balance.action_pct + 2),
//             metric_pct: Math.min(15, displayBullet.word_balance.metric_pct + 2)
//           }
//         }} />
//           </div>}
        
//         {/* Score Breakdown section */}
//         <div className="mt-6 border-t pt-4">
//           <h4 className="text-lg font-semibold mb-4">Score Breakdown:</h4>
          
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             <div>
//               <h5 className="font-medium text-sm mb-2">Word Balance ({displayBullet?.word_balance_score || 0}/25)</h5>
//               <div className="space-y-2">
//                 <div className="flex justify-between">
//                   <span>Industry:</span>
//                   <span className="font-medium">{displayBullet?.word_balance?.industry_pct || 0}%</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span>Common:</span>
//                   <span className="font-medium">{displayBullet?.word_balance?.common_pct || 0}%</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span>Action:</span>
//                   <span className="font-medium">{displayBullet?.word_balance?.action_pct || 0}%</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span>Metric:</span>
//                   <span className="font-medium">{displayBullet?.word_balance?.metric_pct || 0}%</span>
//                 </div>
//               </div>
//             </div>
            
//             <div>
//               <h5 className="font-medium text-sm mb-2">XYZ Quality ({(displayBullet?.xyz_scores?.hard_soft || 0) + (displayBullet?.xyz_scores?.action_words || 0) + (displayBullet?.xyz_scores?.measurable_results || 0) + (displayBullet?.xyz_scores?.clarity_focus || 0)}/20)</h5>
//               <div className="space-y-2">
//                 <ScoreWithIcon score={displayBullet?.xyz_scores?.hard_soft || 0} maxScore={5} label="Hard/Soft Skills" />
//                 <ScoreWithIcon score={displayBullet?.xyz_scores?.action_words || 0} maxScore={5} label="Action Words" />
//                 <ScoreWithIcon score={displayBullet?.xyz_scores?.measurable_results || 0} maxScore={5} label="Measurable Results" />
//                 <ScoreWithIcon score={displayBullet?.xyz_scores?.clarity_focus || 0} maxScore={5} label="Clarity & Focus" />
//               </div>
//             </div>
//           </div>
//         </div>
        
//         {/* Improvement Tips */}
//         <div className="mt-6 border-t pt-4">
//           <h4 className="text-md font-semibold mb-2">Improvement Tips:</h4>
//           <p className="text-lg font-bold text-slate-950">
//             {displayBullet?.tips || "Add more specific technical skills or leadership traits. Start with a stronger action verb and avoid passive language. Include quantifiable results (%, $, or other metrics). Make this more concise, aiming for 25 words or fewer."}
//           </p>
//         </div>
        
//         {/* Display all bullets in an Accordion */}
        
//       </CardContent>
//     </Card>;
// };
// export default BulletPointsAnalysisCard;