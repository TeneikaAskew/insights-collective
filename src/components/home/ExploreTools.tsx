
import { Search, LineChart, Code, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ExploreTools = () => {
  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center mb-4 px-4 py-1 bg-primary/10 rounded-full">
            <Search className="w-4 h-4 mr-2 text-primary" />
            <span className="text-sm font-medium text-primary">Professional Toolset</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">Explore Our Professional Data Science Tools</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Insights Collective offers a comprehensive suite of tools designed to enhance your learning journey. 
            All powered by cutting-edge AI technology to accelerate your data science skills.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <div className="flex flex-col items-center p-6 bg-card rounded-lg shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Learning Tools</h3>
            <p className="text-muted-foreground text-sm">
              Interactive notebooks, code editors, and visualization tools to enhance your learning experience.
            </p>
          </div>

          <div className="flex flex-col items-center p-6 bg-card rounded-lg shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <LineChart className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI-Powered Tools</h3>
            <p className="text-muted-foreground text-sm">
              Leverage machine learning algorithms for code completion, error detection, and personalized learning.
            </p>
          </div>

          <div className="flex flex-col items-center p-6 bg-card rounded-lg shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Code className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Development Tools</h3>
            <p className="text-muted-foreground text-sm">
              Integration with industry-standard development environments and version control systems.
            </p>
          </div>

          <div className="flex flex-col items-center p-6 bg-card rounded-lg shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Content Tools</h3>
            <p className="text-muted-foreground text-sm">
              Access to datasets, case studies, and industry examples to practice your data science skills.
            </p>
          </div>
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" size="lg" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            Browse All Tools →
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ExploreTools;
