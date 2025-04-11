
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ArrowRight, Bookmark } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

const blueprintEntries = [
  {
    id: 1,
    title: "What Is Data Science?",
    description: "A deep dive into the definition, evolution, and real-world application of data science—from business intelligence to machine learning. Understand how curiosity, coding, and communication converge to turn data into insight.",
    tag: "Fundamentals",
    slug: "what-is-data-science",
    publishedAt: "2025-03-15"
  },
  {
    id: 2,
    title: "Core Roles in a Data Team",
    description: "Explore the anatomy of a modern data team. Learn how analysts, data scientists, engineers, and product managers collaborate—and the tools and skills each role brings to the table.",
    tag: "Team Dynamics",
    slug: "core-roles-data-team",
    publishedAt: "2025-03-22"
  },
  {
    id: 3,
    title: "The Data Science Lifecycle",
    description: "From problem framing to data collection, modeling, and monitoring—get familiar with the iterative workflow that powers every successful data science initiative.",
    tag: "Processes",
    slug: "data-science-lifecycle",
    publishedAt: "2025-03-29"
  },
  {
    id: 4,
    title: "How to Start a Career in Data Science",
    description: "Academic track? Bootcamp? Self-taught? This post breaks down the key entry points, essential skills, portfolio strategies, and mindset shifts to launch your career with confidence.",
    tag: "Career Entry",
    slug: "start-career-data-science",
    publishedAt: "2025-04-05"
  },
  {
    id: 5,
    title: "Responsible AI & Ethics in Data Science",
    description: "Bias, fairness, transparency—explore the ethical considerations behind model development. Learn the principles, tools, and team dynamics that make AI not just smart, but responsible.",
    tag: "Ethics",
    slug: "responsible-ai-ethics",
    publishedAt: "2025-04-12"
  },
  {
    id: 6,
    title: "Wisdom From the Field – Career Lessons",
    description: "Hear from top data scientists across LinkedIn, Airbnb, and Google. What do they wish they knew earlier? This post curates their most powerful lessons on failure, communication, impact, and lifelong learning.",
    tag: "Industry Insights",
    slug: "career-lessons-data-science",
    publishedAt: "2025-04-19"
  },
  {
    id: 7,
    title: "Tools of the Trade",
    description: "Build your data science toolkit with the languages, libraries, and platforms used by the pros. From Python and SQL to MLflow and Streamlit—get a hands-on guide to working smarter.",
    tag: "Technology",
    slug: "data-science-tools",
    publishedAt: "2025-04-26"
  },
  {
    id: 8,
    title: "Data Science Career Paths",
    description: "Map out your growth. Whether you aspire to stay technical, lead teams, specialize in ML, or pivot into product, this guide lays out the real-world trajectories and how to navigate them.",
    tag: "Career Growth",
    slug: "data-science-career-paths",
    publishedAt: "2025-05-03"
  },
  {
    id: 9,
    title: "Resume & Portfolio Tips",
    description: "Your resume gets you the interview. Your portfolio gets you the job. Learn how to craft results-driven bullet points, showcase real-world projects, and stand out in a crowded field.",
    tag: "Job Search",
    slug: "resume-portfolio-tips",
    publishedAt: "2025-05-10"
  },
  {
    id: 10,
    title: "Case Studies That Inspire",
    description: "Real-world wins from the field—like predicting air traffic delays, detecting mental health crises, or optimizing multi-touch marketing. These examples show the impact data science has across industries.",
    tag: "Applications",
    slug: "data-science-case-studies",
    publishedAt: "2025-05-17"
  }
];

const DataBlueprintSeries = () => {
  return (
    <AppLayout>
      <div className="container mx-auto max-w-5xl py-8">
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

        {/* Featured Entries Section */}
        <div className="mb-16">
          <div className="flex items-center mb-6">
            <BookOpen className="h-6 w-6 mr-2 text-primary" />
            <h2 className="text-2xl font-bold">Featured Entries</h2>
          </div>
          
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
