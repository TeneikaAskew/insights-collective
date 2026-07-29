// ABOUTME: The career exploration + enhancement toolkit on the landing page.
// ABOUTME: Replaces ExploreTools, which mislabelled these as "Data Science Learning Tools".
import { Link } from 'react-router-dom';
import {
  Compass,
  BookOpen,
  Mic,
  LayoutDashboard,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal, stagger } from './motion/Reveal';
import ToolWorkbench from './ToolWorkbench';

/**
 * These are career tools, not data-science tools — a resume review, interview
 * practice and a portfolio serve any target role. The Course Library keeps its
 * data framing because the catalog genuinely is data content.
 */
const TOOLS = [
  {
    icon: Compass,
    title: 'Career Pathway',
    description:
      'Explore where each path leads, what it asks for, and which skills to build before you commit.',
    link: '/career-pathway',
  },
  {
    icon: BookOpen,
    title: 'Course Library',
    description:
      'Access comprehensive courses in data science, analytics, and machine learning with hands-on projects.',
    link: '/courses',
  },
  {
    icon: Mic,
    title: 'Interview Prep',
    description:
      'Practice technical interviews, coding challenges, and behavioral questions with AI-powered feedback.',
    link: '/interview-prep',
  },
  {
    icon: LayoutDashboard,
    title: 'Portfolio Explorer',
    description:
      'Build and showcase your portfolio with professional templates and project ideas.',
    link: '/portfolio-explorer',
  },
  {
    icon: FileText,
    title: 'Resume Analyzer',
    description:
      'Get AI-powered resume feedback and optimization suggestions tailored to the roles you are targeting.',
    link: '/resume',
  },
];

const CareerTools = () => (
  <section className="py-20 border-y border-studio-border bg-studio-cardWarm" id="career-tools">
    <div className="container mx-auto px-4 max-w-6xl">
      <Reveal>
        <h2 className="text-3xl md:text-4xl font-bold text-studio-ink">
          Career Exploration &amp; Enhancement Tools
        </h2>
        <p className="mt-3 text-studio-muted max-w-2xl">
          Everything you need to find a direction and strengthen how you show up for it. Try them
          here before you make an account.
        </p>
      </Reveal>

      {/* The live previews. Everything below them is the full toolkit. */}
      <ToolWorkbench />

      <div className="grid gap-5 mt-14 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool, i) => {
          const Icon = tool.icon;
          return (
            <Reveal key={tool.title} delay={stagger(i)} as="article" className="h-full">
              <Link
                to={tool.link}
                className="studio-card h-full p-6 flex flex-col transition-transform duration-200 hover:-translate-y-1 focus-visible:-translate-y-1 outline-none focus-visible:ring-2 focus-visible:ring-studio-lavDeep"
              >
                <span className="h-10 w-10 rounded-xl bg-studio-lavChip text-studio-lavDeep grid place-items-center mb-4">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-bold text-studio-ink">{tool.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-studio-muted flex-1">
                  {tool.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-studio-lavDeep">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={0.12}>
        <div className="mt-10 flex justify-center">
          <Button
            asChild
            variant="outline"
            className="rounded-full border-studio-border text-studio-ink hover:bg-studio-card"
          >
            <Link to="/register">Create a free account to use them</Link>
          </Button>
        </div>
      </Reveal>
    </div>
  </section>
);

export default CareerTools;
