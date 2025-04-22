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

  // Session and state
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);

  // Initialize or retrieve session ID
  useEffect(() => {
    let sid = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!sid) {
      sid = Date.now().toString();
      localStorage.setItem(LOCAL_STORAGE_KEY, sid);
    }
    setSessionId(sid);
  }, []);

  // Guard: require authentication
  if (!isAuthenticated) {
    return <div>Please log in to access your career agent.</div>;
  }

  // Save individual answers
  const saveAnswerToDatabase = async (questionId: string, answer: string) => {
    if (user && sessionId) {
      try {
        await supabase
          .from('career_pathway_answers')
          .insert({ user_id: user.id, session_id: sessionId, question: questionId, answer });
      } catch (error) {
        console.error('Error saving answer:', error);
      }
    }
  };

  // Helpers for formatting the report
  function extractSection(text: string, sectionStart: string, possibleEnds: string[]): string {
    if (!text.includes(sectionStart)) return '';
    const startIdx = text.indexOf(sectionStart) + sectionStart.length;
    let endIdx = text.length;
    for (const marker of possibleEnds) {
      const idx = text.indexOf(marker, startIdx);
      if (idx !== -1 && idx < endIdx) endIdx = idx;
    }
    return text.substring(startIdx, endIdx).trim();
  }

  function cleanText(text: string): string {
    return text.replace(/\*\*/g, '').trim();
  }

  function formatNumberedList(content: string): string {
    if (!content) return '';
    const hasNumbers = /\d+\.\s/.test(content);
    if (hasNumbers) {
      const items = content.split(/\d+\.\s/).filter(i => i.trim());
      return items
        .map(
          (item, idx) =>
            `<div class="mb-2"><span class="inline-block bg-amber-200 text-amber-800 rounded-full w-6 h-6 text-center mr-2">${
              idx + 1
            }</span>${cleanText(item)}</div>`
        )
        .join('');
    }
    return `<p>${cleanText(content)}</p>`;
  }

  function formatSkillsTable(tableText: string): string {
    if (!tableText) {
      return '<tr><td colspan="2" class="border border-amber-300 px-4 py-2">No skills data</td></tr>';
    }
    const rows = tableText
      .split('\n')
      .filter(r => r.trim().startsWith('|'))
      .filter(r => !r.includes('---'));
    return rows
      .map(row => {
        const cells = row.split('|').filter(c => c.trim());
        return cells.length >= 2
          ? `<tr><td class="border border-amber-300 px-4 py-2">${cells[0].trim()}</td><td class="border border-amber-300 px-4 py-2">${cells[1].trim()}</td></tr>`
          : '';
      })
      .join('');
  }

  // Build formatted HTML report
  const formatCareerPathwayReport = (rawReport: string): string => {
    try {
      if (/<h|<div|<p>/.test(rawReport)) return rawReport;
      const nameMatch = rawReport.match(/\*\*Personalized Career Advice Report for (.*?)\*\*/);
      const userName = nameMatch ? nameMatch[1] : 'You';
      const sections = {
        summary: extractSection(rawReport, 'Summary:', ['Recommended Roles:', 'Skills and Matching Courses:']),
        recommendedRoles: extractSection(rawReport, 'Recommended Roles:', ['Skills and Matching Courses:']),
        skills: extractSection(rawReport, 'Skills and Matching Courses:', ['Next-Step Career Recommendations:']),
        nextSteps: extractSection(rawReport, 'Next-Step Career Recommendations:', ['Roles that Might be Right for You:']),
        rightRoles: extractSection(rawReport, 'Roles that Might be Right for You:', ['Path to Your Aspirational Role:']),
        path: extractSection(rawReport, 'Path to Your Aspirational Role:', ['Remote Work Considerations:', 'By following']),
        remote: extractSection(rawReport, 'Remote Work Considerations:', ['By following']),
        conclusion: rawReport.includes('By following') ? rawReport.substring(rawReport.indexOf('By following')) : ''
      };
      let skillsTable = '';
      if (sections.skills) {
        const m = sections.skills.match(/\| Skill \| Course \|[\s\S]*?(?=\*\*|$)/);
        skillsTable = m ? m[0] : '';
      }
      return `
<div class="career-pathway-report">
  <h1 class="text-xl font-bold text-amber-600 mb-4">Personalized Career Pathway Report for ${userName}</h1>
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Summary</h2>
    <p class="mb-2">${cleanText(sections.summary)}</p>
  </section>
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Recommended Roles</h2>
    <div class="pl-4">${formatNumberedList(sections.recommendedRoles)}</div>
  </section>
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Skills and Matching Courses</h2>
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse">
        <thead>
          <tr class="bg-amber-100">
            <th class="border border-amber-300 px-4 py-2 text-left">Skill</th>
            <th class="border border-amber-300 px-4 py-2 text-left">Course</th>
          </tr>
        </thead>
        <tbody>${formatSkillsTable(skillsTable)}</tbody>
      </table>
    </div>
  </section>
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Next-Step Career Recommendations</h2>
    <div class="pl-4">${formatNumberedList(sections.nextSteps)}</div>
  </section>
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Roles that Might be Right for You</h2>
    <div class="pl-4">${formatNumberedList(sections.rightRoles)}</div>
  </section>
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Path to Your Aspirational Role</h2>
    <div class="pl-4">${formatNumberedList(sections.path)}</div>
  </section>
  ${sections.remote ? `
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Remote Work Considerations</h2>
    <div class="pl-4">${formatNumberedList(sections.remote)}</div>
  </section>
  ` : ''}
  <section class="mt-6 p-4 bg-amber-50 border-l-4 border-amber-500">
    <p class="italic">${cleanText(sections.conclusion)}</p>
  </section>
</div>`;
    } catch (e) {
      console.error('Formatting error:', e);
      return rawReport;
    }
  };

  // Handle errors
  const handleReportError = (errorMessage: string) => {
    setCareerAdviceReport('');
    const display = errorMessage.includes('Rate limit reached')
      ? `API rate limit reached. ${errorMessage}`
      : errorMessage;
    setMessages(prev => [...prev, { id: `bot_error_${Date.now()}`, sender: 'bot', text: `Error: ${display}` }]);
  };

  // Generate career pathway report
  const generateCareerAdviceReport = async (resumeText?: string) => {
    setMessages(prev => [...prev, { id: `bot_${Date.now()}`, sender: 'bot', text: "I'm working on your report…" }]);
    if (!user) return;
    const payload = { prompt: careerAdvicePrompt, PathwayQuestions: pathwayQuestions, pathwayAnswers: answers, resumeText: resumeText || null };
    try {
      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', { method: 'POST', body: JSON.stringify(payload) });
      if (error) throw error;
      const resultText = typeof data === 'string' ? data : data.generatedText;
      const formatted = formatCareerPathwayReport(resultText);
      setCareerAdviceReport(formatted);
      setMessages(prev => [...prev, { id: `bot_done_${Date.now()}`, sender: 'bot', text: 'Your report is ready!' }]);
    } catch (e) {
      handleReportError(e instanceof Error ? e.message : 'Failed to get career advice.');
    }
  };

  // Scroll report into view when ready
  useEffect(() => {
    if (careerAdviceReport && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [careerAdviceReport]);

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4">
        {/* Chat messages */}
        {messages.map(m => (
          <div key={m.id} className={`p-2 rounded ${m.sender === 'bot' ? 'bg-gray-100' : 'bg-blue-100 self-end'}`}>
            {m.text}
          </div>
        ))}
        {/* Controls to answer pathwayQuestions / invoke generateCareerAdviceReport */}
        {/* ...your UI for collecting answers goes here... */}
        {/* Render formatted report */}
        {careerAdviceReport && (
          <div
            ref={reportRef}
            className="career-advice-report p-6 mt-6 rounded-lg bg-white border border-amber-300 shadow-lg"
            dangerouslySetInnerHTML={{ __html: careerAdviceReport }}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default CareerAgent;
