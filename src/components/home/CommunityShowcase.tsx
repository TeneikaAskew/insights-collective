
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquare, Users, Bookmark, Award } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';

const testimonials = [
  {
    id: 1,
    content: "The forum discussions complement the course material perfectly. I got unstuck on a complex data pipeline thanks to the community's help.",
    author: {
      name: "Alex Thompson",
      role: "Data Engineer at Acme Inc.",
      avatar: "https://i.pravatar.cc/150?img=11"
    }
  },
  {
    id: 2,
    content: "Being able to connect with other learners working on the same challenges helped me stick with the program and ultimately land a role in analytics.",
    author: {
      name: "Sarah Johnson",
      role: "Analytics Manager",
      avatar: "https://i.pravatar.cc/150?img=20"
    }
  },
  {
    id: 3,
    content: "The virtual study groups made all the difference in my learning journey. We solve problems together and share different approaches.",
    author: {
      name: "Miguel Rodriguez",
      role: "ML Engineer",
      avatar: "https://i.pravatar.cc/150?img=13"
    }
  }
];

const CommunityShowcase = () => {
  const { navigateWithAuth } = useAuthenticatedNavigation();

  const handleJoinCommunity = () => {
    navigateWithAuth('/forums', {
      requireAuth: true,
      message: "Join our community by creating an account",
      title: "Authentication Required"
    });
  };

  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">Learn Together, Grow Together</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Join a vibrant community of data professionals, share experiences, solve problems collaboratively, and build your professional network.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/10 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-800/50 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Discussion Forums</h3>
                <p className="text-muted-foreground text-sm">
                  Course-specific forums for questions, insights and collaborative problem-solving
                </p>
                <p className="mt-3 text-blue-600 dark:text-blue-400 text-sm font-medium">25+ active forums</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/10 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-800/50 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Study Groups</h3>
                <p className="text-muted-foreground text-sm">
                  Join virtual study groups for focused learning and peer accountability
                </p>
                <p className="mt-3 text-purple-600 dark:text-purple-400 text-sm font-medium">40+ weekly sessions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/10 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 bg-amber-100 dark:bg-amber-800/50 rounded-full flex items-center justify-center mb-4">
                  <Bookmark className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Resource Sharing</h3>
                <p className="text-muted-foreground text-sm">
                  Curated libraries of industry resources and learner-shared content
                </p>
                <p className="mt-3 text-amber-600 dark:text-amber-400 text-sm font-medium">500+ shared resources</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/10 dark:to-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center mb-4">
                  <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Mentorship</h3>
                <p className="text-muted-foreground text-sm">
                  Connect with experienced professionals for guidance and career advice
                </p>
                <p className="mt-3 text-green-600 dark:text-green-400 text-sm font-medium">50+ active mentors</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <h3 className="text-2xl font-semibold mb-8 text-center">Community Success Stories</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(testimonial => (
              <Card key={testimonial.id} className="border shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardContent className="pt-6">
                  <div className="flex flex-col h-full">
                    <blockquote className="text-muted-foreground italic mb-6 flex-grow">
                      "{testimonial.content}"
                    </blockquote>
                    <div className="flex items-center mt-auto pt-4 border-t">
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarImage src={testimonial.author.avatar} alt={testimonial.author.name} />
                        <AvatarFallback>{testimonial.author.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{testimonial.author.name}</p>
                        <p className="text-xs text-muted-foreground">{testimonial.author.role}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Button 
            onClick={handleJoinCommunity}
            className="bg-primary hover:bg-primary/90 text-white px-6 shadow-md hover:shadow-lg transition-shadow duration-300"
          >
            Join Our Community <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Already a member? <Link to="/login" className="text-primary hover:underline">Sign in</Link> to access the community features.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CommunityShowcase;
