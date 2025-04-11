
import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, User } from 'lucide-react';
import { formatDate } from '@/lib/utils';

// Import BlogPost type from the BlogPost page
import { BlogPost } from './BlogPost';

// Same blog posts array from BlogPost.tsx
const blogPosts: BlogPost[] = [
  {
    id: '1',
    title: 'Getting Started with Data Science: A Beginner's Guide',
    slug: 'getting-started-with-data-science',
    excerpt: 'Embark on your data science journey with this comprehensive guide for beginners.',
    content: '',
    coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-01-15',
    author: {
      name: 'Sarah Johnson',
      avatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=Sarah'
    },
    tags: ['Data Science', 'Beginners', 'Learning Path']
  },
  {
    id: '2',
    title: 'The Role of Machine Learning in Modern Business',
    slug: 'role-of-machine-learning-in-modern-business',
    excerpt: 'Discover how machine learning is transforming businesses across industries.',
    content: '',
    coverImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-02-10',
    author: {
      name: 'Michael Chen',
      avatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=Michael'
    },
    tags: ['Machine Learning', 'Business', 'Digital Transformation']
  },
  {
    id: '3',
    title: 'Data Ethics: Building Responsible AI Systems',
    slug: 'data-ethics-building-responsible-ai-systems',
    excerpt: 'Learn about the ethical considerations in AI development and how to build responsible systems.',
    content: '',
    coverImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-02-28',
    author: {
      name: 'Amara Wilson',
      avatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=Amara'
    },
    tags: ['AI Ethics', 'Responsible AI', 'Data Ethics']
  },
  {
    id: '4',
    title: 'Building a Data-Driven Culture in Your Organization',
    slug: 'building-data-driven-culture-in-your-organization',
    excerpt: 'Transform your organization with these strategies for establishing a data-driven culture.',
    content: '',
    coverImage: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-03-15',
    author: {
      name: 'James Rodriguez',
      avatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=James'
    },
    tags: ['Data Culture', 'Organizational Change', 'Data Strategy']
  }
];

const Blog: React.FC = () => {
  return (
    <AppLayout>
      <div className="container py-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Data Blueprint Series</h1>
          <p className="text-xl text-muted-foreground">
            Insights and best practices for data professionals at all levels
          </p>
        </div>
        
        <div className="grid gap-8 mb-12">
          <div className="grid md:grid-cols-2 gap-8">
            {blogPosts.slice(0, 2).map((post) => (
              <Card key={post.id} className="overflow-hidden flex flex-col h-full">
                <Link to={`/resources/blog/${post.slug}`} className="group">
                  <div className="aspect-video w-full overflow-hidden">
                    <img 
                      src={post.coverImage} 
                      alt={post.title} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                    />
                  </div>
                </Link>
                
                <CardContent className="p-5 flex flex-col flex-grow">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                  
                  <Link to={`/resources/blog/${post.slug}`}>
                    <h2 className="text-xl font-bold mb-2 hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                  </Link>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{formatDate(post.publishedAt)}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-1" />
                      <span>{post.author.name}</span>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground mb-4 flex-grow">
                    {post.excerpt}
                  </p>
                  
                  <Button variant="link" className="px-0 w-fit" asChild>
                    <Link to={`/resources/blog/${post.slug}`}>Read more</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Separator />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.slice(2).map((post) => (
              <Card key={post.id} className="overflow-hidden flex flex-col h-full">
                <Link to={`/resources/blog/${post.slug}`} className="group">
                  <div className="aspect-video w-full overflow-hidden">
                    <img 
                      src={post.coverImage} 
                      alt={post.title} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                    />
                  </div>
                </Link>
                
                <CardContent className="p-4 flex flex-col flex-grow">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {post.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  
                  <Link to={`/resources/blog/${post.slug}`}>
                    <h3 className="text-lg font-semibold mb-2 hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                  </Link>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>{formatDate(post.publishedAt)}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <User className="h-3 w-3 mr-1" />
                      <span>{post.author.name}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-grow">
                    {post.excerpt}
                  </p>
                  
                  <Button variant="link" size="sm" className="px-0 w-fit" asChild>
                    <Link to={`/resources/blog/${post.slug}`}>Read more</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Blog;
