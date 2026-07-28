// ABOUTME: The six-step platform journey, rendered as a horizontal stepper.
// ABOUTME: Replaces the old 2x3 card grid, which made the page read as three near-identical grids.
import { Book, BarChart2, Star, GraduationCap, PieChart, Award, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Reveal, stagger } from './motion/Reveal';

const steps = [
  {
    number: 1,
    title: 'Choose Your Path',
    description:
      'Explore curriculum in Data Engineering, AI/ML, Analytics, or Business Intelligence based on your interests and career goals.',
    icon: Book,
    link: '/courses',
    linkText: 'Explore paths',
  },
  {
    number: 2,
    title: 'Personalized Learning',
    description:
      'Receive recommendations tailored to your skill level, learning style, and career objectives.',
    icon: BarChart2,
    link: '/explore-data-careers',
    linkText: 'Take assessment',
  },
  {
    number: 3,
    title: 'Master Fundamentals',
    description:
      'Build a foundation in statistics, programming, and data manipulation — essential skills for any data professional.',
    icon: Star,
    link: '/courses',
    linkText: 'Browse courses',
  },
  {
    number: 4,
    title: 'Applied Projects',
    description:
      'Apply what you learn to real-world scenarios through hands-on projects that employers recognise.',
    icon: GraduationCap,
    link: '/courses',
    linkText: 'Browse projects',
  },
  {
    number: 5,
    title: 'Track Progress',
    description:
      'Monitor your skill development, course completion, and assessment results in one dashboard.',
    icon: PieChart,
    link: '/dashboard',
    linkText: 'View dashboard',
  },
  {
    number: 6,
    title: 'Earn Certification',
    description:
      'Showcase your expertise with certifications and strengthen your professional profile.',
    icon: Award,
    link: '/courses',
    linkText: 'View certifications',
  },
];

const LearningJourney = () => {
  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4 max-w-6xl">
        <Reveal>
          <h2 className="text-3xl md:text-4xl font-bold text-studio-ink">Your Learning Journey</h2>
          <p className="mt-3 text-studio-muted max-w-2xl">
            Six steps from picking a direction to having something to show for it. Each one is a
            place on the platform you can start today.
          </p>
        </Reveal>

        {/* The rail: one row of six on wide screens, wrapping to three then two.
            The connector sits behind the nodes and is hidden once the row wraps. */}
        <div className="relative mt-12">
          <div
            className="hidden xl:block absolute left-0 right-0 top-6 h-px bg-studio-border"
            aria-hidden="true"
          />
          <ol className="relative grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {steps.map((step, i) => (
              <Reveal key={step.number} delay={stagger(i)} as="li">
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3">
                    <span className="w-12 h-12 shrink-0 rounded-full bg-studio-card border border-studio-border flex items-center justify-center text-studio-lavDeep">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-studio-muted">
                      Step {step.number}
                    </span>
                  </div>

                  <h3 className="mt-4 font-semibold text-studio-ink">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-studio-muted flex-grow">
                    {step.description}
                  </p>

                  <Link
                    to={step.link}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-studio-lavDeep hover:text-studio-lavDeeper group"
                  >
                    {step.linkText}
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal delay={0.2}>
          <div className="mt-14 flex justify-center">
            <Button
              size="lg"
              asChild
              className="rounded-full bg-studio-lavDeep hover:bg-studio-lavDeeper text-white px-8 py-6 h-auto text-base"
            >
              <Link to="/courses" className="flex items-center">
                Start your learning journey <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default LearningJourney;
