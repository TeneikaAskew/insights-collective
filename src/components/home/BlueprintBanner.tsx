
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BlueprintBanner = () => {
  return (
    <section className="py-12 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">The Data Blueprint Series</h2>
            <p className="text-lg mb-4">
              A 10-part guide to breaking in, leveling up, and leading in data careers
            </p>
            <p className="text-muted-foreground">
              Whether you're just starting or plotting your next move, this series distills key insights
              and advice to help you navigate modern data careers.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="default" asChild className="gap-2">
                <Link to="/data-blueprint">
                  Explore the series <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="gap-2">
                <Link to="/data-blueprint">
                  <Bookmark className="h-4 w-4" /> Bookmark
                </Link>
              </Button>
            </div>
          </div>
          <div className="w-full md:w-1/3 flex justify-center">
            <div className="aspect-square max-w-[250px] bg-primary/20 rounded-lg flex flex-col items-center justify-center p-6 text-center">
              <BookOpen className="h-16 w-16 text-primary mb-4" />
              <span className="text-xl font-semibold">10-Part Series</span>
              <span className="text-sm mt-2">Updated Weekly</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BlueprintBanner;
