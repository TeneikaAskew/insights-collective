
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ArrowRight, Bookmark, Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';

interface BlueprintEntry {
  id: number;
  title: string;
  description: string;
  tag: string;
  slug: string;
  publishedAt: string;
}

const getTagFromBlogTags = (tags: string[]): string => {
  // Filter out "Data Blueprint Series" tag and return the specific tag
  const specificTag = tags.find(tag => tag !== 'Data Blueprint Series');
  return specificTag || 'General';
};

const DataBlueprintSeries = () => {
  const [blueprintEntries, setBlueprintEntries] = useState<BlueprintEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllBlogPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select(`
            id,
            title,
            excerpt,
            slug,
            published_at,
            blog_post_tags(tag_name),
            blog_categories!blog_posts_category_id_fkey(name)
          `)
          .eq('status', 'published')
          .order('published_at', { ascending: false });

        if (error) throw error;

        const entries: BlueprintEntry[] = (data || []).map((post, index) => ({
          id: index + 1, // Use index + 1 for the number display
          title: post.title,
          description: post.excerpt || '',
          tag: (post.blog_categories as any)?.name || 'General',
          slug: post.slug,
          publishedAt: new Date(post.published_at).toISOString().split('T')[0]
        }));

        setBlueprintEntries(entries);
      } catch (error) {
        console.error('Error loading blog posts:', error);
        // Fallback to empty array - the page will still show with other content
        setBlueprintEntries([]);
      } finally {
        setLoading(false);
      }
    };

    loadAllBlogPosts();
  }, []);

  return (
    <AppLayout fullWidth>
      <div className="container mx-auto max-w-5xl py-8 max-w-full">
        {/* Header Section */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">The Data Blueprint Series</h1>
          <h2 className="text-2xl text-muted-foreground mb-8">
            A 10-Part Guide to Breaking In, Leveling Up, and Leading in Data Careers
          </h2>
          <div className="bg-gradient-to-r from-primary/20 to-secondary/20 p-6 rounded-lg">
            <p className="text-lg">
              Whether you're just starting out or plotting your next big move in the world of data, the 
              Data Blueprint Series is your go-to guide for navigating modern data careers. From defining 
              what data science really is, to choosing the right tools and career path, this 10-part series 
              distills top industry insights, frameworks, and field-tested advice to help you launch, grow, 
              and lead in the data world.
            </p>
            <p className="text-lg mt-4">
              Drawing on insights from field guides, interview handbooks, and real-world practitioners, 
              each blog delivers a digestible, actionable take on everything from resumes to responsible AI.
            </p>
          </div>
        </div>

        {/* All Blog Posts Section */}
        <div className="mb-16">
          <div className="flex items-center mb-6">
            <BookOpen className="h-6 w-6 mr-2 text-primary" />
            <h2 className="text-2xl font-bold">All Blog Posts</h2>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {blueprintEntries.map((entry) => (
                <Card key={entry.id} className="h-full flex flex-col hover:shadow-md transition-shadow">
                  <CardContent className="p-6 flex-grow flex flex-col">
                    <div className="mb-4 flex justify-between items-start">
                      <Badge variant="outline" className="mb-2">
                        {entry.tag}
                      </Badge>
                      <span className="text-3xl font-bold text-primary/40">
                        {String(entry.id).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{entry.title}</h3>
                    <p className="text-muted-foreground mb-4 flex-grow">{entry.description}</p>
                    <Button variant="ghost" className="self-start" asChild>
                      <Link to={`/blog/${entry.slug}`}>
                        Read more <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* What's Next Section */}
        <div className="mb-16 bg-secondary/20 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">🧠 What's Next?</h2>
          <p className="text-lg mb-4">You'll also explore:</p>
          <ul className="space-y-2 pl-6 list-disc">
            <li className="text-lg">Building an ethical and responsible AI practice</li>
            <li className="text-lg">Learning from top data professionals</li>
            <li className="text-lg">Crafting a standout resume and portfolio</li>
            <li className="text-lg">Discovering career path options</li>
            <li className="text-lg">Mastering the tools of the trade</li>
            <li className="text-lg">Real-world case studies to spark inspiration</li>
          </ul>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-primary/10 p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Ready to accelerate your data career?</h2>
          <p className="text-lg mb-6">
            ✨ Bookmark this page and check back weekly as we release the full 10-part series to help you 
            navigate your data career journey—whether you're just starting out or scaling toward leadership.
          </p>
          <Button size="lg" className="gap-2">
            <Bookmark className="h-5 w-5" />
            Bookmark This Series
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default DataBlueprintSeries;
