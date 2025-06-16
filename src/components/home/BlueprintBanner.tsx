
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Bookmark, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Mock blueprint entries
const blueprintEntries = [
  {
    id: 1,
    title: "Getting Started in Data Science",
    description: "Essential skills and resources for beginners in the data field",
    category: "Fundamentals",
    readTime: "8 min read",
  },
  {
    id: 2,
    title: "Choosing Your Data Career Path",
    description: "Compare different data roles and find your ideal specialization",
    category: "Career Planning",
    readTime: "10 min read",
  },
  {
    id: 3,
    title: "Building Your First Data Portfolio",
    description: "Projects and case studies to showcase your skills to employers",
    category: "Portfolio",
    readTime: "12 min read",
  },
  {
    id: 4,
    title: "Technical Interview Preparation",
    description: "Practice problems and strategies for data science interviews",
    category: "Interviews",
    readTime: "15 min read",
  },
];

const BlueprintBanner = () => {
  return (
    <section className="py-16 bg-blueprint-gradient relative">
      <div className="container mx-auto px-4">
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-accent/10 shadow-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <div className="mb-4">
                <Badge variant="outline" className="border-primary/30 text-primary font-medium">
                  Learning Resource
                </Badge>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-bold mb-3 font-display">The Data Blueprint Series</h2>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                A 10-part guide to breaking in, leveling up, and leading in data careers
              </p>
              <p className="text-muted-foreground mb-6">
                Whether you're just starting or plotting your next move, this series distills key insights
                and advice to help you navigate modern data careers.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button variant="default" asChild className="shadow-md hover:shadow-lg transition-all duration-300">
                  <Link to="/data-blueprint-series" className="flex items-center gap-2">
                    Explore the series <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/data-blueprint-series" className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4" /> Save for later
                  </Link>
                </Button>
              </div>
            </div>
            
            <div className="w-full md:w-1/3 flex justify-center">
              <div className="relative">
                <div className="aspect-square max-w-[250px] bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm border border-white/30 shadow-xl">
                  <Badge className="absolute -top-3 -right-3 bg-primary text-white px-3 py-1 shadow-md">
                    NEW
                  </Badge>
                  <BookOpen className="h-16 w-16 text-primary mb-4" />
                  <span className="text-xl font-semibold">10-Part Series</span>
                  <span className="text-sm mt-2">Updated Weekly</span>
                </div>
                {/* Decorative elements */}
                <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-accent/10 rounded-full blur-xl"></div>
                <div className="absolute -top-4 -left-4 w-16 h-16 bg-primary/10 rounded-full blur-xl"></div>
              </div>
            </div>
          </div>
          
          {/* Blueprint carousel */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Featured Guides</h3>
              <Link to="/data-blueprint-series" className="text-primary font-medium flex items-center hover:underline">
                View all guides <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            
            <Carousel className="w-full max-w-5xl mx-auto">
              <CarouselContent>
                {blueprintEntries.map((entry) => (
                  <CarouselItem key={entry.id} className="sm:basis-1/2 md:basis-1/3 lg:basis-1/3 p-1">
                    <Link to="/data-blueprint-series">
                      <Card className="hover:shadow-md transition-all border-border/50 h-full flex flex-col">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="secondary" className="bg-secondary/10 text-secondary font-medium text-xs">
                              {entry.category}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{entry.readTime}</span>
                          </div>
                          <CardTitle className="text-lg line-clamp-2">{entry.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                          <CardDescription className="line-clamp-3">
                            {entry.description}
                          </CardDescription>
                        </CardContent>
                        <CardFooter className="mt-auto pt-0">
                          <Button variant="ghost" size="sm" className="p-0 h-auto text-primary flex items-center">
                            Read more <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </CardFooter>
                      </Card>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="hidden md:block">
                <CarouselPrevious className="left-0" />
                <CarouselNext className="right-0" />
              </div>
            </Carousel>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BlueprintBanner;
