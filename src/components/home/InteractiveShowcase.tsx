
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, LineChart, PieChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Cell, Pie, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { BarChart2, PieChart as PieIcon, LineChart as LineIcon, ArrowRight } from 'lucide-react';

// Sample data for charts
const barData = [
  { name: 'Python', value: 85, color: '#3b82f6' },
  { name: 'SQL', value: 75, color: '#8b5cf6' },
  { name: 'R', value: 55, color: '#ec4899' },
  { name: 'Tableau', value: 65, color: '#f59e0b' },
  { name: 'Excel', value: 80, color: '#10b981' },
];

const lineData = [
  { month: 'Jan', learners: 4000, completions: 2400 },
  { month: 'Feb', learners: 3000, completions: 1398 },
  { month: 'Mar', learners: 2000, completions: 9800 },
  { month: 'Apr', learners: 2780, completions: 3908 },
  { month: 'May', learners: 1890, completions: 4800 },
  { month: 'Jun', learners: 2390, completions: 3800 },
  { month: 'Jul', learners: 3490, completions: 4300 },
];

const pieData = [
  { name: 'Data Engineer', value: 40, color: '#3b82f6' },
  { name: 'Data Analyst', value: 30, color: '#8b5cf6' },
  { name: 'Data Scientist', value: 20, color: '#ec4899' },
  { name: 'ML Engineer', value: 10, color: '#10b981' },
];

const InteractiveShowcase = () => {
  const [activeTab, setActiveTab] = useState('skills');

  return (
    <section className="py-20 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">Data Skills In Demand</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Explore interactive visualizations showing most in-demand data skills, career trends, and industry distributions.
          </p>
        </div>

        <Tabs defaultValue="skills" value={activeTab} onValueChange={setActiveTab} className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-8">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="skills" className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                <span className="hidden sm:inline">Top Skills</span>
              </TabsTrigger>
              <TabsTrigger value="growth" className="flex items-center gap-2">
                <LineIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Growth Trends</span>
              </TabsTrigger>
              <TabsTrigger value="roles" className="flex items-center gap-2">
                <PieIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Data Roles</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <Card className="border shadow-lg overflow-hidden">
            <CardContent className="p-6">
              <TabsContent value="skills" className="mt-0">
                <h3 className="text-xl font-semibold mb-4">Most In-Demand Data Skills</h3>
                <p className="text-muted-foreground mb-6">
                  Based on analysis of job postings across major tech hubs in the last quarter.
                </p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Market Demand']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="growth" className="mt-0">
                <h3 className="text-xl font-semibold mb-4">Growth Trends in Data Learning</h3>
                <p className="text-muted-foreground mb-6">
                  Tracking the growth of learners and course completions over time.
                </p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="learners" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="completions" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="roles" className="mt-0">
                <h3 className="text-xl font-semibold mb-4">Data Professional Roles Distribution</h3>
                <p className="text-muted-foreground mb-6">
                  Current distribution of data professional roles in the job market.
                </p>
                <div className="h-80 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, 'Market Share']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>

        <div className="flex justify-center mt-10">
          <Button asChild variant="outline" className="group">
            <Link to="/explore-data-careers" className="flex items-center">
              Explore Career Insights 
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default InteractiveShowcase;
