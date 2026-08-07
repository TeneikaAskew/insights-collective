import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCareerPathwayResults } from '@/hooks/useCareerPathwayResults';
import { useResume } from '@/hooks/resume/useResume';
import { pathwayQuestions, quickReplies } from '@/data/careerPathwayData';
import { CareerReportData } from '@/components/assistants/types';
import { Map } from 'lucide-react';

import StudioChat from '@/components/career/studio/StudioChat';
import ReportCanvas, { ALL_REVEALED } from '@/components/career/studio/ReportCanvas';
import ActionPlanSection from '@/components/career/studio/ActionPlanSection';
import PathwayViewSwitch, {
  PATHWAY_PANEL_ID,
  PLAN_PANEL_ID,
  type PathwayView,
} from '@/components/career/studio/PathwayViewSwitch';
import { useCoachChat } from '@/components/career/studio/useCoachChat';
import {
  INTRO_MESSAGES,
  WELCOME_BACK_MESSAGE,
  RESUME_FOUND_MESSAGE,
  RESUME_MISSING_MESSAGE,
  GENERATING_MESSAGE,
  DONE_MESSAGE,
  DONE_UNSAVED_MESSAGE,
  ackFor,
  actIndexForQuestion,
  actIntro,
  questionText,
} from '@/components/career/studio/coachScript';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CareerPathway');

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Phase =
  | 'loading'        // restoring saved state
  | 'chat'           // answering questions
  | 'resume-choice'  // existing resume found — use it or upload new
  | 'resume-upload'  // waiting for a file
  | 'generating'     // report being generated
  | 'ready'          // report on the canvas
  | 'resume-error'   // saved-resume lookup failed, retry available
  | 'error';         // generation failed, retry available

/** The results hook returns a placeholder report when nothing is saved yet. */
const isRealReport = (report?: CareerReportData | null): report is CareerReportData =>
  !!report && ((report.recommendedRoles?.length ?? 0) > 0 || (report.keyTakeaways?.length ?? 0) > 0);

const CareerPathway: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { uploading: resumeUploading, uploadResume } = useResume();
  const { data: savedResults, isLoading: resultsLoading, isError: resultsError } = useCareerPathwayResults();
  const queryClient = useQueryClient();
  const coach = useCoachChat();

  const [phase, setPhase] = useState<Phase>('loading');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [report, setReport] = useState<CareerReportData | null>(null);
  const [revealStage, setRevealStage] = useState(0);
  const [savedOk, setSavedOk] = useState(true);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  // True once a report was generated in this session — the cached action plan
  // from a previous pathway must not be shown against a fresh report.
  const [generatedThisSession, setGeneratedThisSession] = useState(false);
  // Which half of the finished pathway is on screen. The plan is a peer view
  // rather than a section below the report, so neither is a scroll away.
  const [view, setView] = useState<PathwayView>('pathway');
  const [milestones, setMilestones] = useState<{ done: number; total: number } | null>(null);

  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const answersRef = useRef<Record<string, string>>({});
  const resumeTextRef = useRef<string>('');
  const initializedRef = useRef(false);
  const headerRef = useRef<HTMLElement>(null);
  const reducedRef = useRef(
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  const userName =
    (user as { first_name?: string })?.first_name ||
    (user?.user_metadata as { first_name?: string })?.first_name ||
    user?.email?.split('@')[0] ||
    'there';

  // ---------------- conversation flow ----------------

  const askQuestion = useCallback(async (index: number) => {
    const g = coach.genRef.current;
    setCurrentQuestion(index);
    setAwaitingInput(false);
    if (index > 0 && actIndexForQuestion(index) !== actIndexForQuestion(index - 1)) {
      const intro = actIntro(actIndexForQuestion(index));
      if (intro) {
        await coach.say(intro);
        if (g !== coach.genRef.current) return;
        await sleep(280);
      }
    }
    await coach.say(questionText(index));
    if (g !== coach.genRef.current) return;
    setShowQuickReplies(index === 0);
    setAwaitingInput(true);
  }, [coach]);

  const startResumeStep = useCallback(async () => {
    const g = coach.genRef.current;
    setAwaitingInput(false);
    setShowQuickReplies(false);
    // Query the latest resume text directly — the hook's cached copy can be stale.
    let text = '';
    if (user?.id) {
      const { data, error } = await supabase
        .from('resumes')
        .select('text')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (g !== coach.genRef.current) return;
      // Without this check a failed read looked identical to "no resume on
      // file", so the coach told a user who HAD uploaded one that it was
      // missing and asked them to upload it again.
      if (error) {
        logger.error('Could not read the saved resume', error);
        await coach.say(
          "I couldn't reach your saved resume just now — that's on us, not you. Try again in a moment.",
        );
        if (g !== coach.genRef.current) return;
        // A phase with a retry, not a bare return. This step runs with input
        // already disabled (see the top of this callback), so returning here
        // left the composer dead and neither resume control on screen: the
        // coach said "try again" while offering no way to do so, and finishing
        // the pathway meant reloading or starting over.
        setPhase('resume-error');
        return;
      }
      text = data?.text ?? '';
    }
    if (g !== coach.genRef.current) return;
    resumeTextRef.current = text;
    if (text) {
      await coach.say(RESUME_FOUND_MESSAGE);
      if (g !== coach.genRef.current) return;
      setPhase('resume-choice');
    } else {
      await coach.say(RESUME_MISSING_MESSAGE);
      if (g !== coach.genRef.current) return;
      setPhase('resume-upload');
    }
  }, [coach, user?.id]);

  const generateReport = useCallback(async (resumeText: string) => {
    const g = coach.genRef.current;
    resumeTextRef.current = resumeText;
    setPhase('generating');
    setRevealStage(0);
    await coach.say(GENERATING_MESSAGE);
    try {
      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
        body: { answers: answersRef.current, resumeText },
      });
      if (error) throw new Error(error.message);
      if (!data || data.error) throw new Error(data?.error || 'No report returned');
      if (g !== coach.genRef.current) return;

      const freshReport = data as CareerReportData;
      setReport(freshReport);

      let saveFailed = false;
      if (user?.id) {
        const { error: saveError } = await supabase.from('career_pathway_results').insert({
          user_id: user.id,
          session_id: sessionIdRef.current,
          report: JSON.stringify(freshReport),
        });
        if (saveError) {
          logger.error('Error saving career pathway report:', saveError);
          saveFailed = true;
        } else {
          // The cached results (old report + old action plan) are stale now.
          void queryClient.invalidateQueries({ queryKey: ['careerPathwayResults', user.id] });
        }
      }
      setSavedOk(!saveFailed);
      setGeneratedThisSession(true);

      // Reveal the canvas one card at a time — the generation is the show.
      for (let stage = 1; stage <= ALL_REVEALED; stage++) {
        if (g !== coach.genRef.current) return;
        setRevealStage(stage);
        await sleep(reducedRef.current ? 80 : 650);
      }
      await coach.say(saveFailed ? DONE_UNSAVED_MESSAGE : DONE_MESSAGE);
      if (g !== coach.genRef.current) return;
      setPhase('ready');
    } catch (e) {
      logger.error('Report generation failed:', e);
      if (g !== coach.genRef.current) return;
      await coach.say('Something went wrong while generating your report. Give it a moment, then hit retry below.');
      if (g !== coach.genRef.current) return;
      setPhase('error');
    }
  }, [coach, user?.id]);

  const handleAnswer = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || phase !== 'chat' || !awaitingInput) return;
    const g = coach.genRef.current;
    const index = currentQuestion;
    const question = pathwayQuestions[index];

    setAwaitingInput(false);
    setShowQuickReplies(false);
    setInputValue('');
    coach.addUser(text);
    answersRef.current = { ...answersRef.current, [question.id]: text };

    if (user?.id) {
      const { error } = await supabase.from('career_pathway_answers').insert({
        user_id: user.id,
        session_id: sessionIdRef.current,
        question: question.id,
        answer: text,
      });
      if (error) {
        logger.error('Error saving answer:', error);
        toast({
          title: 'Answer not saved',
          description: 'Your answer could not be saved — your progress may not survive a refresh.',
          variant: 'destructive',
        });
      }
    }
    if (g !== coach.genRef.current) return;

    await coach.readPause(text);
    if (g !== coach.genRef.current) return;
    await coach.say(ackFor(index, text));
    if (g !== coach.genRef.current) return;
    await sleep(280);

    if (index + 1 < pathwayQuestions.length) {
      await askQuestion(index + 1);
    } else {
      await startResumeStep();
    }
  }, [phase, awaitingInput, currentQuestion, coach, user?.id, toast, askQuestion, startResumeStep]);

  const handleResumeUpload = useCallback(async () => {
    if (!resumeFile || !user?.id) return;
    const g = coach.genRef.current;
    const ok = await uploadResume(resumeFile);
    setResumeFile(null);
    if (g !== coach.genRef.current) return;
    if (!ok) {
      await coach.say("That upload didn't go through — try again with a PDF or DOCX.");
      return;
    }
    const { data, error } = await supabase
      .from('resumes')
      .select('text')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (g !== coach.genRef.current) return;

    // The report is the deliverable of this whole flow and the user is expected
    // to act on it. Generating one from `data?.text ?? ''` meant that a failed
    // read — or a stored row whose text extraction produced nothing — still
    // yielded a confident, personalised-looking career plan built from no resume
    // at all. Refuse instead, and say which of the two happened.
    if (error) {
      logger.error('Could not read the resume after upload', error);
      await coach.say(
        "Your resume uploaded, but I couldn't read it back just now, so I've held off on the report rather than build one without it. Try again in a moment.",
      );
      return;
    }

    const resumeText = data?.text?.trim() ?? '';
    if (!resumeText) {
      await coach.say(
        "Your file uploaded, but I couldn't pull any text out of it — that happens with scanned or image-only PDFs. Upload a text-based PDF or DOCX and I'll build your report from it.",
      );
      return;
    }

    await generateReport(resumeText);
  }, [resumeFile, user?.id, uploadResume, coach, generateReport]);

  const beginFresh = useCallback(async () => {
    const g = coach.genRef.current;
    setPhase('chat');
    for (const line of INTRO_MESSAGES) {
      await coach.say(line);
      if (g !== coach.genRef.current) return;
      await sleep(300);
    }
    await askQuestion(0);
  }, [coach, askQuestion]);

  const handleStartOver = useCallback(async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('career_pathway_answers')
      .update({ is_reset: true, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_reset', false);
    if (error) {
      logger.error('Error resetting answers:', error);
      toast({ title: 'Couldn’t start over', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    coach.reset();
    answersRef.current = {};
    sessionIdRef.current = crypto.randomUUID();
    setReport(null);
    setRevealStage(0);
    setSavedOk(true);
    setInputValue('');
    setResumeFile(null);
    setView('pathway');
    setMilestones(null);
    void beginFresh();
  }, [user?.id, coach, toast, beginFresh]);

  // ---------------- restore on load ----------------

  useEffect(() => {
    if (!user?.id || resultsLoading || initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      // "Start over" can land while this restore is still loading answers.
      // reset() bumps the coach generation, so a change means the user has
      // already begun a retake and restoring the saved report would silently
      // undo their click.
      const g = coach.genRef.current;
      const hasRealReport = !resultsError && isRealReport(savedResults?.report);
      const showSavedReport = () => {
        setReport(savedResults!.report);
        setRevealStage(ALL_REVEALED);
        setSavedOk(true);
        coach.restore([{ sender: 'bot', text: WELCOME_BACK_MESSAGE }]);
        setPhase('ready');
      };

      // Check active answers BEFORE restoring a saved report: after "Start
      // over", a mid-retake refresh must resume the conversation — the old
      // report would otherwise hijack the retake.
      const { data: previousAnswers, error } = await supabase
        .from('career_pathway_answers')
        .select('question, answer, created_at')
        .eq('user_id', user.id)
        .eq('is_reset', false)
        .order('created_at', { ascending: true });

      if (g !== coach.genRef.current) return;

      if (error) {
        logger.error('Error loading previous answers:', error);
        if (hasRealReport) showSavedReport();
        else void beginFresh();
        return;
      }

      const answersMap: Record<string, string> = {};
      previousAnswers?.forEach((row) => { answersMap[row.question] = row.answer; });
      answersRef.current = answersMap;

      let nextIndex = 0;
      while (nextIndex < pathwayQuestions.length && answersMap[pathwayQuestions[nextIndex].id]) {
        nextIndex += 1;
      }

      // No active answers — a saved report is genuinely the latest state.
      if (nextIndex === 0) {
        if (hasRealReport) showSavedReport();
        else void beginFresh();
        return;
      }

      // A fully answered conversation with a saved report is the normal
      // returning-user case (answers are not reset after generation).
      if (nextIndex >= pathwayQuestions.length && hasRealReport) {
        showSavedReport();
        return;
      }

      // Active retake in progress — rebuild the transcript instantly, then
      // continue with the live cadence.
      const history: Array<{ sender: 'user' | 'bot'; text: string }> = [
        { sender: 'bot', text: 'Welcome back — picking up where we left off.' },
      ];
      for (let i = 0; i < nextIndex; i++) {
        history.push({ sender: 'bot', text: questionText(i) });
        history.push({ sender: 'user', text: answersMap[pathwayQuestions[i].id] });
      }
      coach.restore(history);
      setPhase('chat');
      if (nextIndex < pathwayQuestions.length) {
        void askQuestion(nextIndex);
      } else {
        void startResumeStep();
      }
    })();
  }, [user?.id, resultsLoading, resultsError, savedResults, coach, beginFresh, askQuestion, startResumeStep]);

  // ---------------- render ----------------

  if (!isAuthenticated) {
    return (
      <AppLayout fullWidth>
        <div className="ss-wash min-h-full py-16 px-6" data-testid="career-pathway-signin">
          <div className="ss-card bg-card max-w-md mx-auto p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-ss-lav-chip grid place-content-center mb-5">
              <Map className="h-8 w-8 text-ss-lav-deep" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Your career pathway</h1>
            <p className="text-muted-foreground mb-6">
              A short conversation with your career coach, a personalized pathway, and a week-by-week action plan.
              Sign in to begin.
            </p>
            <Link
              to="/login?redirect=%2Fcareer-pathway"
              state={{ from: { pathname: '/career-pathway' } }}
              className="inline-block rounded-full bg-ss-lav-deep text-white text-sm font-bold px-6 py-3 transition-colors hover:bg-ss-lav-deep/90"
            >
              Sign in to continue
            </Link>
            <p className="text-sm text-muted-foreground mt-4">
              Don’t have an account? <Link to="/register" className="text-ss-lav-deep hover:underline">Register</Link>
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // The switch only means something once there is a plan view to switch to.
  const showViewSwitch = phase === 'ready' && !!report;
  const activeView: PathwayView = showViewSwitch ? view : 'pathway';

  // Switching swaps the whole page body, so land at the top of the new view
  // rather than wherever the previous one was scrolled to. AppLayout locks the
  // viewport and scrolls its <main> instead, so window.scrollTo does nothing —
  // scroll the element that actually owns the overflow.
  const changeView = (next: PathwayView) => {
    setView(next);
    headerRef.current?.scrollIntoView({
      behavior: reducedRef.current ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const composerDisabled = !awaitingInput || phase !== 'chat';
  const composerPlaceholder =
    phase === 'ready' ? 'Your pathway is ready — use “Start over” to retake it'
      : phase === 'generating' ? 'Maya is working on your report…'
        : phase === 'resume-choice' || phase === 'resume-upload' ? 'Choose an option above'
          // Without its own case this fell through to "Maya is typing…", which
          // is untrue while she is waiting on a retry the user has to press.
          : phase === 'resume-error' ? 'Use the button above to try again'
            : coach.composing || !awaitingInput ? 'Maya is typing…'
            : 'Type your answer…';

  return (
    <AppLayout fullWidth>
      <div className="ss-wash min-h-full py-10 px-4 sm:px-6" data-testid="career-pathway-page">
        <div className="max-w-6xl mx-auto">
          <header
            ref={headerRef}
            className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4 scroll-mt-4"
          >
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight [text-wrap:balance]">
                Hey {userName}, here's your career insights.
              </h1>
              <p className="text-muted-foreground mt-2 max-w-3xl">
                Based on your assessment, we've created personalized recommendations to help you build a
                fulfilling career path aligned with your strengths and goals.
              </p>
            </div>
            {showViewSwitch && (
              <PathwayViewSwitch value={activeView} onChange={changeView} milestones={milestones} />
            )}
          </header>

          <div
            id={PATHWAY_PANEL_ID}
            role={showViewSwitch ? 'tabpanel' : undefined}
            aria-labelledby={showViewSwitch ? `${PATHWAY_PANEL_ID}-tab` : undefined}
            hidden={activeView !== 'pathway'}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 items-start">
              <div className="flex flex-col gap-4">
                <StudioChat
                  messages={coach.messages}
                  composing={coach.composing}
                  currentAct={actIndexForQuestion(currentQuestion)}
                  actsDone={phase === 'generating' || phase === 'ready' || phase === 'resume-choice' || phase === 'resume-upload'}
                  inputValue={inputValue}
                  onInputChange={setInputValue}
                  onSubmit={() => void handleAnswer(inputValue)}
                  inputDisabled={composerDisabled}
                  placeholder={composerPlaceholder}
                  headerAction={
                    <button
                      type="button"
                      data-testid="start-over"
                      onClick={() => void handleStartOver()}
                      className="text-xs font-bold rounded-full border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:text-ss-bad hover:border-ss-bad"
                    >
                      Start over
                    </button>
                  }
                >
                  {showQuickReplies && phase === 'chat' && awaitingInput && (
                    <div className="flex flex-col gap-2 ml-10 mt-1">
                      {quickReplies.map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          data-testid="quick-reply"
                          onClick={() => void handleAnswer(reply)}
                          className="text-left text-sm text-ss-lav-deep border-[1.5px] border-ss-lav rounded-3xl px-4 py-2.5 bg-card/70 transition-colors hover:bg-ss-lav-chip focus:outline-none focus-visible:ring-2 focus-visible:ring-ss-lav"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}

                  {phase === 'resume-choice' && (
                    <div className="flex flex-col gap-2 ml-10 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          coach.addUser('Use my resume on file');
                          void generateReport(resumeTextRef.current);
                        }}
                        className="text-left text-sm text-ss-lav-deep border-[1.5px] border-ss-lav rounded-3xl px-4 py-2.5 bg-card/70 transition-colors hover:bg-ss-lav-chip"
                      >
                        Use my resume on file
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          coach.addUser('Upload a new resume');
                          setPhase('resume-upload');
                        }}
                        className="text-left text-sm text-ss-lav-deep border-[1.5px] border-ss-lav rounded-3xl px-4 py-2.5 bg-card/70 transition-colors hover:bg-ss-lav-chip"
                      >
                        Upload a new resume
                      </button>
                    </div>
                  )}

                  {phase === 'resume-upload' && (
                    <div className="ml-10 mt-1 rounded-[18px] border-2 border-dashed border-ss-lav bg-card/60 p-4">
                      <label htmlFor="resume-upload-input" className="block text-sm font-bold mb-2">
                        Upload your resume (PDF or DOCX)
                      </label>
                      <input
                        id="resume-upload-input"
                        type="file"
                        accept=".pdf,.docx"
                        disabled={resumeUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const okType = file.type === 'application/pdf' ||
                            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                          if (okType) {
                            setResumeFile(file);
                          } else {
                            toast({
                              title: 'Invalid file type',
                              description: 'Only PDF or DOCX files are allowed.',
                              variant: 'destructive',
                            });
                          }
                        }}
                        className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-ss-lav-chip file:text-ss-lav-deep hover:file:bg-ss-lav-chip/70"
                      />
                      {resumeFile && (
                        <button
                          type="button"
                          onClick={() => void handleResumeUpload()}
                          disabled={resumeUploading}
                          className="mt-3 rounded-full bg-ss-lav-deep text-white text-sm font-bold px-5 py-2.5 transition-colors hover:bg-ss-lav-deep/90 disabled:opacity-60"
                        >
                          {resumeUploading ? 'Uploading…' : 'Upload and continue'}
                        </button>
                      )}
                    </div>
                  )}

                  {phase === 'resume-error' && (
                    <div className="ml-10 mt-1">
                      <button
                        type="button"
                        onClick={() => void startResumeStep()}
                        className="rounded-full bg-ss-lav-deep text-white text-sm font-bold px-5 py-2.5 transition-colors hover:bg-ss-lav-deep/90"
                      >
                        Try loading my resume again
                      </button>
                    </div>
                  )}

                  {phase === 'error' && (
                    <div className="ml-10 mt-1">
                      <button
                        type="button"
                        onClick={() => void generateReport(resumeTextRef.current)}
                        className="rounded-full bg-ss-lav-deep text-white text-sm font-bold px-5 py-2.5 transition-colors hover:bg-ss-lav-deep/90"
                      >
                        Retry generating my report
                      </button>
                    </div>
                  )}
                </StudioChat>

                {phase === 'ready' && report && (
                  <div data-testid="pathway-savebar" className="ss-card ss-card-warm flex items-center gap-3 flex-wrap rounded-full px-6 py-3.5 animate-fade-in">
                    <span className="font-bold text-sm">Your pathway is ready</span>
                    {savedOk ? (
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-ss-good-chip text-ss-good">
                        Saved to your profile
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-ss-bad-chip text-ss-bad">
                        Not saved — may not persist
                      </span>
                    )}
                    <button
                      type="button"
                      data-testid="get-action-plan"
                      onClick={() => changeView('plan')}
                      className="ml-auto rounded-full bg-ss-lav-deep text-white text-sm font-bold px-5 py-2 transition-colors hover:bg-ss-lav-deep/90"
                    >
                      Get action plan
                    </button>
                  </div>
                )}
              </div>

              <div className="lg:sticky lg:top-6">
                <ReportCanvas report={report} revealStage={revealStage} />
              </div>
            </div>
          </div>

          {/* Kept mounted while the pathway view is on screen: unmounting would
              drop the fetched plan and re-run its progress load on every switch. */}
          {phase === 'ready' && (
            <div
              id={PLAN_PANEL_ID}
              role={showViewSwitch ? 'tabpanel' : undefined}
              aria-labelledby={showViewSwitch ? `${PLAN_PANEL_ID}-tab` : undefined}
              hidden={activeView !== 'plan'}
            >
              {/* A plan cached from a previous pathway must not appear against a
                  freshly generated report — the user regenerates from the new one. */}
              <ActionPlanSection
                initialActionPlan={generatedThisSession ? null : (savedResults?.actionPlan as any) ?? null}
                onMilestoneProgress={setMilestones}
              />
            </div>
          )}

          {report && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/explore-data-careers')}
                className="rounded-full border border-border text-sm font-bold px-6 py-3 transition-colors hover:border-ss-lav"
              >
                Explore all data careers
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CareerPathway;
