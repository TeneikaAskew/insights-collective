
// Career Pathway Data
// This file contains the questions and data structures for the Career Pathway feature

export interface PathwayQuestion {
  id: string;
  label: string;
  placeholder: string;
}

export const pathwayQuestions: PathwayQuestion[] = [
  {
    id: "q1",
    label: "Interest in Career Pathway",
    placeholder: "Choose the statement that best describes your interest in exploring your career pathway?",
  },
  {
    id: "q2",
    label: "Ideal Next Job",
    placeholder: "So if you woke up tomorrow in your ideal next job, what would that look like?",
  },
  {
    id: "q3",
    label: "Future Vision",
    placeholder: "Fast forward 5 years, where do you see yourself?",
  },
  {
    id: "q4",
    label: "Desired Role",
    placeholder: "What role would you really want to be in?",
  },
  {
    id: "q5",
    label: "Seniority Level",
    placeholder: "How senior would this role be?",
  },
  {
    id: "q6",
    label: "Career Pivot",
    placeholder: "Are you thinking about a career pivot? What role would make better use of your talents?",
  },
  {
    id: "q7",
    label: "Strengths",
    placeholder: "What would you say are the strengths that set you apart?",
  },
  {
    id: "q8",
    label: "Weaknesses",
    placeholder: "What are some skills or abilities that should not feature prominently in your next role?",
  },
  {
    id: "q9",
    label: "Career Obstacles",
    placeholder: "What do you see as the biggest obstacle to moving ahead in your career?",
  },
  {
    id: "q10",
    label: "Past Role Insights",
    placeholder: "What makes work exciting and satisfying? What makes it boring or frustrating?",
  },
  {
    id: "q11",
    label: "Self-Reflection",
    placeholder: "What aspect of your personality is your biggest positive? What has hindered your success?",
  },
  {
    id: "q12",
    label: "Top Career Priorities",
    placeholder: "What are your top priorities in your career at this time?",
  },
  {
    id: "q13",
    label: "Work Engagement",
    placeholder: "When you get lost in your work, what are you working on? Activities you'd like to do more?",
  },
];

export const quickReplies = [
  "I am not happy in my current job (or I am currently in transition) and would like to find another one",
  "I am interested in exploring other career paths aligned with my skills and experience",
  "I would like to explore logical next steps and overcome obstacles in my current career path",
  "I am a recent or soon-to-be college grad looking for potential career paths",
];

export const starterMessages = [
  "I will recommend the best route to your aspirational role, step-by-step. I'll also show you the most promising alternative career paths.",
  "You'll find specific recommendations on how to fill gaps in your key skills. I will even create a dynamite first draft of your professional pitch! Sound good? Okay, let's do this. It should take less than 8 minutes to answer my questions.",
  "Choose the statement that best describes your interest in exploring your career pathway",
];

export const careerAdvicePrompt = `Here are outputs from a career chat:
- A set of recommended roles with descriptions & salary bands
- A table of skills and matching courses
- A narrative of next-step career recommendations
- A 'Roles that might be right for you' list
- A 'Path to your aspirational role' carousel
Please combine these data points with the user's pathway answers to generate a personalized career pathway report.`;

export const LOCAL_STORAGE_KEY = "careerPathwayChat";
