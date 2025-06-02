
import { BookOpen, MessageSquare, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ExploreTools = () => {
  const navigate = useNavigate();

  const tools = [
    {
      title: "Course Library",
      description: "Access comprehensive courses in data science, analytics, and machine learning with hands-on projects.",
      icon: BookOpen,
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-500",
      path: "/courses"
    },
    {
      title: "Interview Prep",
      description: "Practice technical interviews, coding challenges, and behavioral questions with AI-powered feedback.",
      icon: MessageSquare,
      bgColor: "bg-green-500/10",
      iconColor: "text-green-500",
      path: "/interview-prep"
    },
    {
      title: "Portfolio Explorer",
      description: "Build and showcase your data science portfolio with professional templates and project ideas.",
      icon: User,
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-500",
      path: "/portfolio-explorer"
    },
    {
      title: "Resume Analyzer",
      description: "Get AI-powered resume feedback and optimization suggestions tailored for data science roles.",
      icon: FileText,
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-500",
      path: "/resume"
    }
  ];

  return (
    <section className="py-16 bg-secondary/30" data-tour="tools">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center mb-4 px-4 py-1 bg-primary/10 rounded-full">
            <BookOpen className="w-4 h-4 mr-2 text-primary" />
            <span className="text-sm font-medium text-primary">Learning Platform</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">Explore Our Data Science Learning Tools</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Everything you need to accelerate your data science career - from learning and practice to portfolio building and job preparation.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          {tools.map((tool, index) => (
            <div 
              key={index}
              className="flex flex-col items-center p-6 bg-card rounded-lg shadow-sm text-center hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(tool.path)}
            >
              <div className={`w-16 h-16 rounded-full ${tool.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <tool.icon className={`h-8 w-8 ${tool.iconColor}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{tool.title}</h3>
              <p className="text-muted-foreground text-sm">
                {tool.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button 
            variant="outline" 
            size="lg" 
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => navigate('/dashboard')}
          >
            Explore All Features →
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ExploreTools;
