// ABOUTME: Latest Data Blueprint Series posts on the landing page.
// ABOUTME: Renders nothing when there are no published posts, so the section can never sit empty.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getAllBlogPosts } from '@/services/blogService';
import { BlogPost } from '@/types/blog';
import { Button } from '@/components/ui/button';
import { Reveal, stagger } from './motion/Reveal';

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const BlueprintSeries = () => {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog', 'landing-latest'],
    queryFn: getAllBlogPosts,
    staleTime: 5 * 60 * 1000,
  });

  const published = (posts as BlogPost[])
    .filter((p) => (p as any).status === 'published' || !(p as any).status)
    .slice(0, 4);

  // No posts, no section — better than a heading over an empty list.
  if (isLoading || published.length === 0) return null;

  return (
    <section className="py-20" id="blueprint">
      <div className="container mx-auto px-4 max-w-6xl">
        <Reveal>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-studio-ink">
                Data Blueprint Series
              </h2>
              <p className="mt-3 text-studio-muted max-w-2xl">
                Guides on choosing a path, building a portfolio, and getting through the hiring
                process.
              </p>
            </div>
            <Button asChild variant="ghost" className="text-studio-lavDeep hover:text-studio-lavDeeper">
              <Link to="/blog" className="flex items-center gap-1.5">
                All articles <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>

        <ul className="mt-8 border-t border-studio-border">
          {published.map((post, i) => (
            <Reveal key={post.slug} delay={stagger(i)} as="li">
              <Link
                to={`/blog/${post.slug}`}
                className="grid sm:grid-cols-[76px_minmax(0,1fr)_auto] gap-x-5 gap-y-1 items-baseline py-5 border-b border-studio-border hover:bg-studio-cardWarm transition-colors px-2 -mx-2"
              >
                <span className="text-xs text-studio-muted tabular-nums">
                  {formatDate(post.publishedAt)}
                </span>
                <span className="font-semibold text-studio-ink">{post.title}</span>
                {post.category && (
                  <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-studio-peachDeep whitespace-nowrap">
                    {post.category}
                  </span>
                )}
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default BlueprintSeries;
