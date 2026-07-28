// ABOUTME: Expandable profiles for the four career tracks on the landing page.
// ABOUTME: Content comes from trackPersonas/courseRecommendations so it always matches the quiz result.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, BrainCircuit, BarChart3, Database, Presentation } from 'lucide-react';
import { trackPersonas, courseRecommendations, CareerTrack } from '@/data/careerQuizData';
import { Reveal, stagger } from './motion/Reveal';

const ICONS: Record<CareerTrack, React.ComponentType<{ className?: string }>> = {
  'AI/ML': BrainCircuit,
  Analytics: BarChart3,
  'Data Engineering': Database,
  'Business Intelligence': Presentation,
};

/** Beginner courses for a track, straight from the quiz's own recommendation table. */
function starterCourses(track: CareerTrack) {
  return (
    courseRecommendations.find((r) => r.track === track && r.level === 'Beginner')?.courses ?? []
  );
}

const CareerPaths = () => {
  const [open, setOpen] = useState<CareerTrack | null>(null);

  return (
    <section className="py-20" id="career-paths">
      <div className="container mx-auto px-4 max-w-6xl">
        <Reveal>
          <h2 className="text-3xl md:text-4xl font-bold text-studio-ink">
            Find Your Data Career Path
          </h2>
          <p className="mt-3 text-studio-muted max-w-2xl">
            Not ready for the quiz? Read the four profiles and pick directly. These are the same
            tracks, tools and roles the quiz returns.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-5 mt-10">
          {trackPersonas.map((persona, i) => {
            const Icon = ICONS[persona.track];
            const isOpen = open === persona.track;
            const courses = starterCourses(persona.track);
            const panelId = `path-panel-${persona.track.replace(/[^a-z]/gi, '-').toLowerCase()}`;

            return (
              <Reveal key={persona.track} delay={stagger(i)} as="article" className="h-full">
                <div
                  className={`studio-card h-full p-6 transition-shadow ${
                    isOpen ? 'shadow-[0_14px_34px_-18px_rgba(90,80,120,0.45)]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 h-10 w-10 rounded-xl bg-studio-lavChip text-studio-lavDeep grid place-items-center">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-studio-ink">{persona.track}</h3>
                      <p className="text-sm text-studio-muted">
                        {persona.sampleRoles.slice(0, 2).join(' · ')}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-[15px] leading-relaxed text-studio-muted">
                    {persona.description}
                  </p>

                  <dl className="mt-4 text-sm">
                    <div className="flex justify-between gap-4 py-1">
                      <dt className="text-studio-muted">Tools</dt>
                      <dd className="font-semibold text-studio-ink text-right">
                        {persona.tools.slice(0, 3).join(' · ')}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 py-1">
                      <dt className="text-studio-muted">Starter courses</dt>
                      <dd className="font-semibold text-studio-ink text-right">{courses.length}</dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : persona.track)}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-studio-lavDeep hover:text-studio-lavDeeper"
                  >
                    {isOpen ? 'Hide profile' : 'Read the full profile'}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div id={panelId} className="mt-4 pt-4 border-t border-studio-border">
                      <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-studio-lavDeep">
                        Ideal for
                      </h4>
                      <p className="mt-2 text-sm text-studio-muted">{persona.idealFor}</p>

                      <h4 className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-studio-lavDeep">
                        Sample roles
                      </h4>
                      <ul className="mt-2 space-y-1.5 text-sm text-studio-muted">
                        {persona.sampleRoles.map((role) => (
                          <li key={role} className="relative pl-4">
                            <span className="absolute left-0 text-studio-peachDeep font-bold">›</span>
                            {role}
                          </li>
                        ))}
                      </ul>

                      {courses.length > 0 && (
                        <>
                          <h4 className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-studio-lavDeep">
                            Where to start
                          </h4>
                          <ul className="mt-2 space-y-1.5 text-sm text-studio-muted">
                            {courses.map((c) => (
                              <li key={c.id} className="relative pl-4">
                                <span className="absolute left-0 text-studio-peachDeep font-bold">›</span>
                                {c.title}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      <Link
                        to="/explore-data-careers"
                        className="mt-4 inline-block text-sm font-semibold text-studio-lavDeep hover:text-studio-lavDeeper"
                      >
                        Explore this path →
                      </Link>
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CareerPaths;
