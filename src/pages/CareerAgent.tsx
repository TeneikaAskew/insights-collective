import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import {
  pathwayQuestions,
  quickReplies,
  starterMessages,
  careerAdvicePrompt,
  LOCAL_STORAGE_KEY
} from '@/data/careerPathwayData';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

const CareerAgent: React.FC = () => {
  // Authentication hook
  const { user, isAuthenticated } = useAuth();

  // State
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const [resumeText, setResumeText] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const reportRef = useRef<HTMLDivElement>(null);

  // Initialize or retrieve session ID
  useEffect(() => {
    let sid = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!sid) {
      sid = Date.now().toString();
      localStorage.setItem(LOCAL_STORAGE_KEY, sid);
    }
    setSessionId(sid);

    // Start with welcome messages
    const initMessages = starterMessages.map((text, idx) => ({
      id: `bot_init_${idx}`,
      sender: 'bot' as const,
      text,
    }));
    setMessages(initMessages);
  }, []);

  // Guard: require authentication
  if (!isAuthenticated) {
    return <div className="p-6">Please log in to access your career agent.</div>;
  }

  // Scroll to report when ready
  useEffect(() => {
    if (careerAdviceReport && reportRef.current) {
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth' }), 500);
    }
  }, [careerAdviceReport]);

  // Save answer to database
  const saveAnswerToDatabase = async (questionId: number, answer: string) => {
    if (user && sessionId) {
      try {
        await supabase.from('career_pathway_answers').insert({
          user_id: user.id,
          session_id: sessionId,
          question: pathwayQuestions.find(q => q.id === questionId)?.label || String(questionId),
          answer,
        });
        console.log(`[saveAnswerToDatabase] Saved answer for question ${questionId}:`, answer);
      } catch (err) {
        console.error('Error saving answer:', err);
      }
    }
  };

  // Helpers for report formatting
  const extractSection = (text: string, start: string, ends: string[]): string => {
    const i = text.indexOf(start);
    if (i === -1) return '';
    let endIdx = text.length;
    for (const marker of ends) {
      const idx = text.indexOf(marker, i + start.length);
      if (idx !== -1 && idx < endIdx) endIdx = idx;
    }
    return text.substring(i + start.length, endIdx).trim();
  };

  const cleanText = (text: string): string => text.replace(/\*\*/g, '').trim();

  const formatNumberedList = (content: string): string => {
    if (!content) return '';
    const items = content.split(/\d+\.\s/).filter(item => item.trim());
    return items.map((item, i) =>
      `<div class="mb-2"><span class="inline-block bg-amber-200 text-amber-800 rounded-full w-6 h-6 text-center mr-2">${i+1}</span>${cleanText(item)}</div>`
    ).join('');
  };

  const formatSkillsTable = (tableText: string): string => {
    if (!tableText) return '<tr><td colspan="2">No skills data</td></tr>';
    return tableText.split('\n').filter(r => r.startsWith('|') && !r.includes('---')).map(row => {
      const cells = row.split('|').filter(c => c.trim());
      return cells.length >= 2
        ? `<tr><td>${cells[0].trim()}</td><td>${cells[1].trim()}</td></tr>`
        : '';
    }).join('');
  };

  const formatCareerPathwayReport = (raw: string): string => {
    if (/<h|<div|<p>/.test(raw)) return raw;
    const nameMatch = raw.match(/\*\*Personalized Career Advice Report for (.*?)\*\*/);
    const userName = nameMatch?.[1] || 'You';
    const sections = {
      summary: extractSection(raw,'Summary:', ['Recommended Roles:', 'Skills and Matching Courses:']),
      recommendedRoles: extractSection(raw,'Recommended Roles:', ['Skills and Matching Courses:']),
      skills: extractSection(raw,'Skills and Matching Courses:', ['Next-Step Career Recommendations:']),
      nextSteps: extractSection(raw,'Next-Step Career Recommendations:', ['Roles that Might be Right for You:']),
      rightRoles: extractSection(raw,'Roles that Might be Right for You:', ['Path to Your Aspirational Role:']),
      path: extractSection(raw,'Path to Your Aspirational Role:', ['Remote Work Considerations:', 'By following']),
      remote: extractSection(raw,'Remote Work Considerations:', ['By following']),
      conclusion: raw.includes('By following') ? raw.substring(raw.indexOf('By following')) : ''
    };
    let skillsTable = '';
    if (sections.skills) {
      const m = sections.skills.match(/\| Skill \| Course \|[\s\S]*?(?=\*\*|$)/);
      skillsTable = m?.[0] || '';
    }
    return `
<div><h1>Personalized Career Pathway Report for ${userName}</h1>
<section><h2>Summary</h2><p>${cleanText(sections.summary)}</p></section>
<section><h2>Recommended Roles</h2>${formatNumberedList(sections.recommendedRoles)}</section>
<section><h2>Skills</h2><table><tbody>${formatSkillsTable(skillsTable)}</tbody></table></section>
<section><h2>Next Steps</h2>${formatNumberedList(sections.nextSteps)}</section>
<section><h2>Right Roles</h2>${formatNumberedList(sections.rightRoles)}</section>
<section><h2>Path</h2>${formatNumberedList(sections.path)}</section>
${sections.remote ? `<section><h2>Remote</h2>${formatNumberedList(sections.remote)}</section>` : ''}
<section><p>${cleanText(sections.conclusion)}</p></section>
</div>`;
  };

  const handleReportError = (msg: string) => setMessages(prev => [...prev,{ id:`bot_error_${Date.now()}`, sender:'bot', text:`Error: ${msg}`}]);

  // Generate career report
  const generateCareerAdviceReport = async (txt?: string) => {
    setMessages(prev=>[...prev,{ id:`bot_${Date.now()}`, sender:'bot', text:'Generating report…'}]);
    if (!user) return;
    const payload = { prompt:careerAdvicePrompt, PathwayQuestions:pathwayQuestions, pathwayAnswers:answers, resumeText:txt||null };
    try {
      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice',{method:'POST',body:JSON.stringify(payload)});
      if (error) throw error;
      const raw = typeof data==='string'?data:data.generatedText;
      const html = formatCareerPathwayReport(raw);
      setCareerAdviceReport(html);
      setMessages(prev=>[...prev,{ id:`bot_done_${Date.now()}`, sender:'bot', text:'Your report is ready!'}]);
    } catch(e) { handleReportError(e instanceof Error?e.message:'Failed to get career advice'); }
  };

  // Chat input handling
  const handleUserMessage = async (text:string) => {
    setMessages(prev=>[...prev,{id:`user_${Date.now()}`,sender:'user',text}]);
    const q = pathwayQuestions[currentQuestionIndex];
    setAnswers(prev=>({...prev,[q.id]:text}));
    await saveAnswerToDatabase(q.id,text);
    if (currentQuestionIndex < pathwayQuestions.length-1) setCurrentQuestionIndex(i=>i+1);
    else generateCareerAdviceReport(resumeText);
  };

  const handleFileUpload = (file:File) => {
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = e => { setResumeText(e.target?.result as string); setIsUploading(false);};
    reader.readAsText(file);
  };

  const currentQuestion = pathwayQuestions[currentQuestionIndex];

  return (
    <AppLayout>
      <div className="p-4 max-w-3xl mx-auto">
        {messages.map(m=>(<div key={m.id} className={m.sender==='user'?'text-right':'text-left'}><span>{m.text}</span></div>))}
        <div className="mt-4">
          {currentQuestionIndex===0 && (
            <input type="file" accept=".txt" onChange={e=>e.target.files?.[0]&&handleFileUpload(e.target.files[0])} />
          )}
          {currentQuestion && (
            <div className="mt-4">
              <p className="font-semibold">{currentQuestion.label}</p>
              <input
                type="text"
                placeholder={currentQuestion.placeholder}
                onKeyDown={e=>e.key==='Enter'&&(handleUserMessage(e.currentTarget.value),e.currentTarget.value='')}
                className="border p-2 w-full"
              />
              {currentQuestionIndex===0 && quickReplies.map((r,i)=>(<button key={i} onClick={()=>handleUserMessage(r)} className="m-1 px-3 py-1 bg-gray-200 rounded">{r}</button>))}
            </div>
          )}
        </div>
        {careerAdviceReport && <div ref={reportRef} className="mt-6" dangerouslySetInnerHTML={{__html:careerAdviceReport}} />}
      </div>
    </AppLayout>
  );
};

export default CareerAgent;
