// ABOUTME: Standalone route for the career path quiz, reachable while signed in.
// ABOUTME: The home page copy of the quiz is unreachable for members because "/"
// ABOUTME: redirects authenticated visitors to the dashboard before it renders.
import AppLayout from '@/components/layout/AppLayout';
import PageSeo from '@/components/seo/PageSeo';
import QuizSection from '@/components/quiz/QuizSection';

const CareerQuiz = () => (
  <AppLayout>
    <PageSeo
      title="Career Path Quiz — Insights Collective"
      description="Answer ten questions to find out which data career path — AI/ML, Analytics, Data Engineering or Business Intelligence — best matches your skills and interests."
      path="/career-quiz"
    />
    <QuizSection autoStart />
  </AppLayout>
);

export default CareerQuiz;
