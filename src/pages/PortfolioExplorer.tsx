
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useResumeData } from '@/hooks/resume/useResumeData';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Github, Star, Users, Calendar, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ResumeReminderBox from '@/components/portfolio/ResumeReminderBox';

// Mock portfolio projects data
const portfolioProjects = [
  {
    id: 1,
    title: "Customer Churn Prediction Model",
    description: "Machine learning model to predict customer churn using Python, scikit-learn, and pandas.",
    technologies: ["Python", "Scikit-learn", "Pandas", "Jupyter", "SQL"],
    difficulty: "Intermediate",
    estimatedHours: 15,
    category: "Machine Learning",
    githubUrl: "https://github.com/example/churn-prediction",
    demoUrl: "https://example.com/churn-demo",
    popularity: 4.8,
    completions: 1247,
    lastUpdated: "2024-01-15"
  },
  {
    id: 2,
    title: "Sales Dashboard with Tableau",
    description: "Interactive sales dashboard showcasing KPIs, trends, and regional performance metrics.",
    technologies: ["Tableau", "SQL", "Excel", "Data Visualization"],
    difficulty: "Beginner",
    estimatedHours: 8,
    category: "Data Visualization",
    githubUrl: "https://github.com/example/sales-dashboard",
    demoUrl: "https://public.tableau.com/example",
    popularity: 4.6,
    completions: 892,
    lastUpdated: "2024-01-20"
  },
  {
    id: 3,
    title: "Real-time Data Pipeline with Apache Kafka",
    description: "End-to-end data pipeline processing streaming data using Kafka, Spark, and Elasticsearch.",
    technologies: ["Apache Kafka", "Spark", "Elasticsearch", "Docker", "Python"],
    difficulty: "Advanced",
    estimatedHours: 25,
    category: "Data Engineering",
    githubUrl: "https://github.com/example/kafka-pipeline",
    demoUrl: null,
    popularity: 4.9,
    completions: 456,
    lastUpdated: "2024-01-18"
  },
  {
    id: 4,
    title: "A/B Testing Analysis Framework",
    description: "Statistical framework for designing and analyzing A/B tests with Python and R.",
    technologies: ["R", "Python", "Statistics", "Hypothesis Testing", "Power Analysis"],
    difficulty: "Intermediate",
    estimatedHours: 12,
    category: "Statistics",
    githubUrl: "https://github.com/example/ab-testing",
    demoUrl: "https://example.com/ab-testing-demo",
    popularity: 4.7,
    completions: 723,
    lastUpdated: "2024-01-22"
  },
  {
    id: 5,
    title: "Natural Language Processing Sentiment Analysis",
    description: "Build a sentiment analysis model using BERT and deploy it as a REST API.",
    technologies: ["Python", "BERT", "PyTorch", "Flask", "Docker", "NLP"],
    difficulty: "Advanced",
    estimatedHours: 20,
    category: "NLP",
    githubUrl: "https://github.com/example/sentiment-analysis",
    demoUrl: "https://example.com/sentiment-demo",
    popularity: 4.8,
    completions: 634,
    lastUpdated: "2024-01-25"
  },
  {
    id: 6,
    title: "Financial Portfolio Optimization",
    description: "Optimize investment portfolios using modern portfolio theory and Python.",
    technologies: ["Python", "NumPy", "SciPy", "Finance", "Optimization"],
    difficulty: "Intermediate",
    estimatedHours: 18,
    category: "Finance",
    githubUrl: "https://github.com/example/portfolio-optimization",
    demoUrl: null,
    popularity: 4.5,
    completions: 389,
    lastUpdated: "2024-01-12"
  }
];

const PortfolioExplorer = () => {
  const { user } = useAuth();
  const { resume, loading: resumeLoading } = useResumeData();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [filteredProjects, setFilteredProjects] = useState(portfolioProjects);

  const categories = ['All', 'Machine Learning', 'Data Visualization', 'Data Engineering', 'Statistics', 'NLP', 'Finance'];
  const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced'];

  useEffect(() => {
    let filtered = portfolioProjects;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(project => project.category === selectedCategory);
    }

    if (selectedDifficulty !== 'All') {
      filtered = filtered.filter(project => project.difficulty === selectedDifficulty);
    }

    setFilteredProjects(filtered);
  }, [selectedCategory, selectedDifficulty]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const handleStartProject = (projectId: number) => {
    toast({
      title: "Project Started",
      description: "You can now access the project resources and begin working on it.",
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Portfolio Explorer
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover and build data science projects to enhance your portfolio
          </p>
        </div>

        {/* Resume Reminder Box - only show if user doesn't have a resume */}
        {!resumeLoading && !resume && (
          <ResumeReminderBox />
        )}

        {/* Filters */}
        <div className="mb-8 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Difficulty</h3>
            <div className="flex flex-wrap gap-2">
              {difficulties.map((difficulty) => (
                <Badge
                  key={difficulty}
                  variant={selectedDifficulty === difficulty ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedDifficulty(difficulty)}
                >
                  {difficulty}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{project.title}</CardTitle>
                    <Badge className={getDifficultyColor(project.difficulty)}>
                      {project.difficulty}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{project.popularity}</span>
                  </div>
                </div>
                <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                  {project.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <div className="space-y-4 flex-1">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Technologies
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {project.technologies.map((tech) => (
                        <Badge key={tech} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{project.estimatedHours}h</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>{project.completions}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => handleStartProject(project.id)}
                  >
                    Start Project
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                        <Github className="h-4 w-4 mr-1" />
                        Code
                      </a>
                    </Button>
                    {project.demoUrl && (
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Demo
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No projects found matching your criteria. Try adjusting your filters.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PortfolioExplorer;
