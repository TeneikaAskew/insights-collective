
import { BarChart, Clock, Award, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import LearningProgressChart from './LearningProgressChart';

const AnalyticsDashboard = () => {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center justify-center mb-4 px-4 py-1 bg-amber-100 rounded-full">
              <BarChart className="w-4 h-4 mr-2 text-amber-600" />
              <span className="text-sm font-medium text-amber-600">Intuitive Dashboard</span>
            </div>
            <h2 className="text-3xl font-bold mb-6">Powerful Analytics</h2>
            <h3 className="text-2xl font-semibold mb-6 text-primary">Monitor Your Learning Progress</h3>
            
            <p className="text-muted-foreground mb-6">
              Track your learning performance in real-time with our comprehensive analytics dashboard. Monitor skill development, 
              course completion, and assessment performance all in one centralized place.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="mr-4 mt-1">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Real-time Learning Analytics</h4>
                  <p className="text-muted-foreground text-sm">
                    Track skill development, course progress, and time spent learning with minute-by-minute updates
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="mr-4 mt-1">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Personalized Recommendations</h4>
                  <p className="text-muted-foreground text-sm">
                    Receive AI-powered suggestions for courses and resources based on your performance and goals
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="mr-4 mt-1">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Goal Tracking</h4>
                  <p className="text-muted-foreground text-sm">
                    Set and monitor custom learning KPIs and receive automated alerts when milestones are achieved
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <Button className="bg-primary hover:bg-primary/90" asChild>
                <Link to="/login">Log in to view Dashboard</Link>
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <Card className="bg-card/90 backdrop-blur border shadow-lg overflow-hidden rounded-lg">
              <div className="p-6">
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Learning Performance Overview</h3>
                  <span className="text-xs text-muted-foreground">Last updated: Today</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Courses Completed</div>
                    <div className="flex items-baseline">
                      <span className="text-2xl font-bold">4</span>
                      <span className="text-xs text-green-500 ml-2">+1 this month</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Skills Acquired</div>
                    <div className="flex items-baseline">
                      <span className="text-2xl font-bold">12</span>
                      <span className="text-xs text-green-500 ml-2">+3 this month</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Avg. Quiz Score</div>
                    <div className="flex items-baseline">
                      <span className="text-2xl font-bold">87%</span>
                      <span className="text-xs text-green-500 ml-2">+5.3%</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Learning Streak</div>
                    <div className="flex items-baseline">
                      <span className="text-2xl font-bold">8 days</span>
                      <span className="text-xs text-amber-500 ml-2">Continue!</span>
                    </div>
                  </div>
                </div>
                
                {/* Learning Progress Chart */}
                <div className="mb-6">
                  <LearningProgressChart />
                </div>
                
                <div className="flex justify-between">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Recommended Next Steps</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Complete "Introduction to Machine Learning" module</li>
                      <li>• Practice Python coding exercises</li>
                      <li>• Review statistics concepts</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Latest Achievements</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Completed SQL Fundamentals</li>
                      <li>• Earned Data Visualization badge</li>
                      <li>• 7-day learning streak</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
            
            <div className="absolute -z-10 w-full h-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl -top-10 -left-10"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnalyticsDashboard;
