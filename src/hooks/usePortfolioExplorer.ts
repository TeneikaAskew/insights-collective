
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Types
export interface UserProfile {
  interests: string[];
  currentRole: string;
  hobbies: string;
  skills?: string[];
}

export interface TargetRole {
  title: string;
  description: string;
  coreSkills: string[];
  tools: string[];
  deliverables: string[];
  portfolioExamples: {
    title: string;
    type: string;
    description: string;
    link?: string;
  }[];
}

export interface ProjectIdea {
  id: string;
  title: string;
  description: string;
  roleTitle: string;
  requiredSkills: string[];
  effortLevel: string;
  impact: string;
  roadmap?: {
    milestones: {
      name: string;
      description: string;
    }[];
  };
}

export interface UserProject {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  effortLevel: string;
  impact?: string;
  status: 'Idea' | 'Planned' | 'In Progress' | 'Completed';
  created_at?: string;
}

export function usePortfolioExplorer() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    interests: [],
    currentRole: '',
    hobbies: ''
  });
  
  const [targetRoles, setTargetRoles] = useState<TargetRole[]>([]);
  const [projectIdeas, setProjectIdeas] = useState<ProjectIdea[]>([]);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);

  // Mock API call to get data from together-ai edge function
  const fetchAIRecommendations = async (profile: UserProfile) => {
    setLoading(true);
    
    try {
      // In a real implementation, this would call your together-ai edge function
      // const response = await fetch('/api/portfolio-ai', {
      //   method: 'POST',
      //   body: JSON.stringify({ profile, resumeText, actionPlan })
      // });
      // const data = await response.json();
      
      // Mock response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock target roles
      const mockTargetRoles: TargetRole[] = [
        {
          title: "Data Analyst",
          description: "Analyze and interpret data to inform business decisions",
          coreSkills: ["SQL", "Python", "Data Visualization", "Statistical Analysis", "Excel"],
          tools: ["Tableau", "Power BI", "Python", "R", "Excel", "SQL Server"],
          deliverables: [
            "Interactive dashboards showing KPIs",
            "Monthly business reports with insights",
            "Ad-hoc analysis for specific business questions",
            "Data cleaning and processing pipelines"
          ],
          portfolioExamples: [
            {
              title: "Customer Segmentation Analysis",
              type: "Case Study",
              description: "Analysis of customer data to identify key segments for marketing campaigns",
              link: "https://github.com/example/customer-segmentation"
            },
            {
              title: "Sales Performance Dashboard",
              type: "Visualization",
              description: "Interactive dashboard tracking sales KPIs with drill-down capabilities"
            },
            {
              title: "Churn Prediction Model",
              type: "Analytics Project",
              description: "Predictive model to identify customers at risk of churning based on behavior patterns"
            }
          ]
        },
        {
          title: "Frontend Developer",
          description: "Build user interfaces and interactive web applications",
          coreSkills: ["HTML", "CSS", "JavaScript", "React", "Responsive Design"],
          tools: ["React", "Vue.js", "Tailwind CSS", "Figma", "Git", "Jest"],
          deliverables: [
            "Interactive web applications",
            "Responsive website layouts",
            "Component libraries",
            "UI animations and transitions"
          ],
          portfolioExamples: [
            {
              title: "E-commerce Product Page",
              type: "UI Component",
              description: "Product display with image gallery, size selection and add-to-cart functionality",
              link: "https://github.com/example/ecommerce-product-page"
            },
            {
              title: "Weather Dashboard",
              type: "Web App",
              description: "Real-time weather app with location search and 5-day forecast"
            },
            {
              title: "Component Library",
              type: "Open Source",
              description: "Reusable component library built with React and styled-components"
            }
          ]
        }
      ];
      
      // Mock project ideas
      const mockProjectIdeas: ProjectIdea[] = [
        {
          id: uuidv4(),
          title: "Sales Dashboard with Regional Comparison",
          description: "Create an interactive dashboard that shows sales performance across different regions, with drill-down capabilities for deeper analysis.",
          roleTitle: "Data Analyst",
          requiredSkills: ["Tableau", "SQL", "Data Visualization"],
          effortLevel: "Medium (10-15 hours)",
          impact: "High - Shows technical and analytical skills"
        },
        {
          id: uuidv4(),
          title: "Customer Segmentation Analysis",
          description: "Analyze customer data to identify distinct segments based on purchasing behavior, demographics, and engagement metrics.",
          roleTitle: "Data Analyst",
          requiredSkills: ["Python", "Clustering", "Data Visualization", "Statistical Analysis"],
          effortLevel: "High (15-20 hours)",
          impact: "High - Demonstrates analytical thinking"
        },
        {
          id: uuidv4(),
          title: "Responsive E-commerce Product Page",
          description: "Build a fully responsive product page with image gallery, size selection, and add-to-cart functionality.",
          roleTitle: "Frontend Developer",
          requiredSkills: ["HTML", "CSS", "JavaScript", "React"],
          effortLevel: "Medium (8-12 hours)",
          impact: "Medium - Shows core frontend skills"
        },
        {
          id: uuidv4(),
          title: "Interactive Data Visualization Tool",
          description: "Create an interactive tool that allows users to explore a dataset through various visualizations and filters.",
          roleTitle: "Frontend Developer",
          requiredSkills: ["JavaScript", "D3.js", "HTML", "CSS"],
          effortLevel: "High (15-20 hours)",
          impact: "High - Demonstrates advanced frontend capabilities"
        }
      ];
      
      // Update state with mock data
      setTargetRoles(mockTargetRoles);
      setProjectIdeas(mockProjectIdeas);
      
      // Update profile with mock skills
      setUserProfile({
        ...profile,
        skills: ["Excel", "PowerPoint", "Communication", "Project Management"]
      });
      
      toast({
        title: "Profile Analysis Complete",
        description: "We've identified potential career paths based on your profile.",
      });
    } catch (error) {
      console.error("Error fetching AI recommendations:", error);
      toast({
        variant: "destructive",
        title: "Error analyzing profile",
        description: "Something went wrong. Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleProfileSubmit = (data: UserProfile) => {
    setUserProfile(data);
    fetchAIRecommendations(data);
  };
  
  const handleAddProject = (project: ProjectIdea) => {
    // Convert ProjectIdea to UserProject
    const newProject: UserProject = {
      id: uuidv4(),
      title: project.title,
      description: project.description,
      requiredSkills: project.requiredSkills,
      effortLevel: project.effortLevel,
      impact: project.impact,
      status: 'Idea',
      created_at: new Date().toISOString()
    };
    
    setUserProjects(prev => [...prev, newProject]);
    
    toast({
      title: "Project Added",
      description: "Project has been added to your portfolio.",
    });
  };
  
  const handleUpdateProjectStatus = (projectId: string, newStatus: 'Idea' | 'Planned' | 'In Progress' | 'Completed') => {
    setUserProjects(prev => 
      prev.map(project => 
        project.id === projectId 
          ? { ...project, status: newStatus } 
          : project
      )
    );
  };
  
  return {
    loading,
    userProfile,
    targetRoles,
    projectIdeas,
    userProjects,
    handleProfileSubmit,
    handleAddProject,
    handleUpdateProjectStatus
  };
}
