import React from 'react';
import { Helmet } from 'react-helmet-async';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Users, Clock, Filter, Search, PlusCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import LoginWall from '@/components/common/LoginWall';

// Mock forum categories
const forumCategories = [
  {
    id: '1',
    title: 'Data Engineering',
    description: 'Discussions about ETL processes, data pipelines, and data infrastructure',
    threads: 45,
    participants: 128,
    lastPost: '2 hours ago',
    icon: '🔧'
  },
  {
    id: '2',
    title: 'Data Science & ML',
    description: 'Share ML models, algorithms, and data science techniques',
    threads: 63,
    participants: 214,
    lastPost: '30 minutes ago',
    icon: '🧠'
  },
  {
    id: '3',
    title: 'Analytics & Visualization',
    description: 'Tips and discussions about data visualization and analytics tools',
    threads: 38,
    participants: 167,
    lastPost: '1 day ago',
    icon: '📊'
  },
  {
    id: '4',
    title: 'Business Intelligence',
    description: 'Business applications of data, KPIs, and reporting solutions',
    threads: 29,
    participants: 95,
    lastPost: '5 hours ago',
    icon: '📈'
  },
  {
    id: '5',
    title: 'Career Development',
    description: 'Resume tips, interview preparation, and career advancement',
    threads: 54,
    participants: 231,
    lastPost: '1 hour ago',
    icon: '👔'
  },
  {
    id: '6',
    title: 'General Discussion',
    description: 'Off-topic conversations, introductions, and community building',
    threads: 42,
    participants: 187,
    lastPost: '45 minutes ago',
    icon: '💬'
  }
];

// Mock recent threads
const recentThreads = [
  {
    id: '101',
    title: 'Best practices for optimizing Spark jobs?',
    author: 'data_wizard',
    replies: 12,
    views: 256,
    category: 'Data Engineering',
    lastActivity: '2 hours ago',
    isHot: true
  },
  {
    id: '102',
    title: 'Comparing XGBoost vs LightGBM performance',
    author: 'ml_enthusiast',
    replies: 24,
    views: 312,
    category: 'Data Science & ML',
    lastActivity: '30 minutes ago',
    isHot: true
  },
  {
    id: '103',
    title: 'Designing effective dashboard layouts for executives',
    author: 'viz_designer',
    replies: 8,
    views: 174,
    category: 'Analytics & Visualization',
    lastActivity: '6 hours ago',
    isHot: false
  },
  {
    id: '104',
    title: 'Transitioning from analyst to data scientist: advice needed',
    author: 'career_changer',
    replies: 19,
    views: 289,
    category: 'Career Development',
    lastActivity: '1 hour ago',
    isHot: true
  },
  {
    id: '105',
    title: 'Setting up a modern data stack for startups',
    author: 'startup_cto',
    replies: 15,
    views: 203,
    category: 'Data Engineering',
    lastActivity: '4 hours ago',
    isHot: false
  }
];

const ForumListPage = () => {
  const { isAuthenticated } = useAuth();
  const { navigateWithAuth } = useAuthenticatedNavigation();

  // If not authenticated, show a limited view with login wall
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Helmet>
          <title>Community Forums | Insights Collective</title>
        </Helmet>
        
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Community Forums</h1>
            <p className="text-muted-foreground mb-8">
              Join our community of data professionals to discuss techniques, share experiences, and grow together.
            </p>
            
            {/* Preview of forum categories */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {forumCategories.slice(0, 4).map((category) => (
                <Card key={category.id} className="border hover:border-primary/30 transition-colors duration-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>
                          <span className="mr-2">{category.icon}</span>
                          {category.title}
                        </CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        <span>{category.threads} threads</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        <span>{category.participants} participants</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <LoginWall 
              message="Join our community forums to participate in discussions, ask questions, and connect with other data professionals."
              visibleItems={4}
              totalItems={forumCategories.length}
            >
              <div className="mt-8 max-w-md mx-auto text-center">
                <p className="text-sm text-muted-foreground">
                  Our forums host discussions on data engineering, machine learning, analytics, 
                  career development, and more. Create an account to join the conversation.
                </p>
              </div>  
            </LoginWall>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Helmet>
        <title>Community Forums | Insights Collective</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Community Forums</h1>
            <p className="text-muted-foreground">
              Join discussions, ask questions, and connect with other data professionals
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button className="flex items-center" onClick={() => navigateWithAuth('/forums/new-post', { requireAuth: true })}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Thread
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col-reverse md:flex-row gap-6">
          <div className="md:w-3/4">
            <Tabs defaultValue="categories">
              <TabsList className="mb-4">
                <TabsTrigger value="categories">Forum Categories</TabsTrigger>
                <TabsTrigger value="recent">Recent Discussions</TabsTrigger>
                <TabsTrigger value="popular">Popular Threads</TabsTrigger>
              </TabsList>
              
              <TabsContent value="categories" className="space-y-4">
                {forumCategories.map((category) => (
                  <Card key={category.id} className="border hover:border-primary/30 transition-colors duration-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>
                            <span className="mr-2">{category.icon}</span>
                            <Link to={`/forums/${category.id}`} className="hover:text-primary transition-colors">
                              {category.title}
                            </Link>
                          </CardTitle>
                          <CardDescription>{category.description}</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/forums/${category.id}`}>View Threads</Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          <span>{category.threads} threads</span>
                        </div>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{category.participants} participants</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>Last post: {category.lastPost}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              
              <TabsContent value="recent" className="space-y-4">
                {recentThreads.map((thread) => (
                  <Card key={thread.id} className="border hover:border-primary/30 transition-colors duration-200">
                    <CardContent className="py-4">
                      <div className="flex justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Link to={`/forums/thread/${thread.id}`} className="font-medium text-lg hover:text-primary transition-colors">
                              {thread.title}
                            </Link>
                            {thread.isHot && (
                              <Badge className="bg-red-100 text-red-600 hover:bg-red-100">Hot</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>By {thread.author}</span>
                            <Badge variant="outline">{thread.category}</Badge>
                            <span className="flex items-center">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {thread.replies} replies
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {thread.lastActivity}
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/forums/thread/${thread.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              
              <TabsContent value="popular" className="space-y-4">
                {recentThreads
                  .sort((a, b) => b.views - a.views)
                  .map((thread) => (
                    <Card key={thread.id} className="border hover:border-primary/30 transition-colors duration-200">
                      <CardContent className="py-4">
                        <div className="flex justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Link to={`/forums/thread/${thread.id}`} className="font-medium text-lg hover:text-primary transition-colors">
                                {thread.title}
                              </Link>
                              <Badge className="bg-blue-100 text-blue-600 hover:bg-blue-100">
                                {thread.views} views
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>By {thread.author}</span>
                              <Badge variant="outline">{thread.category}</Badge>
                              <span className="flex items-center">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {thread.replies} replies
                              </span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/forums/thread/${thread.id}`}>View</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                ))}
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="md:w-1/4 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Search Forums</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search discussions..."
                    className="pl-8"
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Filter Discussions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {['Data Engineering', 'ML/AI', 'Analytics', 'BI', 'Career'].map(cat => (
                      <Badge key={cat} variant="outline" className="cursor-pointer hover:bg-muted">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Time Period</label>
                  <div className="flex flex-wrap gap-2">
                    {['Today', 'This Week', 'This Month', 'All Time'].map(time => (
                      <Badge key={time} variant="outline" className="cursor-pointer hover:bg-muted">
                        {time}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  <Filter className="h-4 w-4 mr-2" /> Apply Filters
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Forum Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Threads:</span>
                    <span className="font-medium">271</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Members:</span>
                    <span className="font-medium">1,024</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Now:</span>
                    <span className="font-medium">42</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default ForumListPage;
