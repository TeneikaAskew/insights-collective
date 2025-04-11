
import React from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Calendar, User, Tag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

// Define blog post structure
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  publishedAt: string;
  author: {
    name: string;
    avatar: string;
  };
  tags: string[];
}

// Sample blog posts data for Data Blueprint series
const blogPosts: BlogPost[] = [
  {
    id: '1',
    title: 'Getting Started with Data Science: A Beginner\'s Guide',
    slug: 'getting-started-with-data-science',
    excerpt: 'Embark on your data science journey with this comprehensive guide for beginners.',
    content: `
      <h2>What is Data Science?</h2>
      <p>Data science combines mathematics, statistics, programming, and domain expertise to extract insights and knowledge from data. It's an interdisciplinary field that uses scientific methods, processes, algorithms, and systems to extract knowledge from structured and unstructured data.</p>
      
      <h2>Essential Skills for Data Scientists</h2>
      <p>To become a successful data scientist, you need a combination of technical and soft skills:</p>
      <ul>
        <li><strong>Programming:</strong> Python, R, SQL</li>
        <li><strong>Statistics and Mathematics:</strong> Linear algebra, calculus, probability</li>
        <li><strong>Data Visualization:</strong> Matplotlib, Seaborn, Tableau</li>
        <li><strong>Machine Learning:</strong> Supervised and unsupervised learning algorithms</li>
        <li><strong>Big Data Tools:</strong> Hadoop, Spark</li>
        <li><strong>Communication:</strong> Ability to explain complex concepts to non-technical stakeholders</li>
        <li><strong>Domain Knowledge:</strong> Understanding of the industry you're working in</li>
      </ul>
      
      <h2>Getting Started: Learning Path</h2>
      <p>Here's a recommended learning path for beginners:</p>
      <ol>
        <li>Learn programming basics (Python is recommended for beginners)</li>
        <li>Study statistics and probability fundamentals</li>
        <li>Master data manipulation and analysis with pandas</li>
        <li>Learn data visualization techniques</li>
        <li>Study machine learning algorithms and when to use them</li>
        <li>Work on real-world projects to build your portfolio</li>
      </ol>
      
      <h2>Resources for Beginners</h2>
      <p>Here are some excellent resources to start your data science journey:</p>
      <ul>
        <li>Online courses: Coursera, edX, Udacity</li>
        <li>Books: "Python for Data Analysis" by Wes McKinney, "Introduction to Statistical Learning"</li>
        <li>Communities: Kaggle, Stack Overflow, Reddit's r/datascience</li>
        <li>Podcasts: Data Skeptic, Linear Digressions</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Data science is a vast and rewarding field with endless opportunities for learning and growth. By following a structured learning path and consistently practicing your skills, you can build a successful career in this exciting field.</p>
    `,
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
    content: `
      <h2>The Business Impact of Machine Learning</h2>
      <p>Machine learning is revolutionizing how businesses operate, make decisions, and create value. From predictive analytics to process automation, ML technologies are creating competitive advantages across industries.</p>
      
      <h2>Key Business Applications</h2>
      <p>Here are some of the most impactful applications of machine learning in business:</p>
      
      <h3>Customer Experience and Personalization</h3>
      <p>Machine learning enables hyper-personalization by analyzing customer behavior, preferences, and past interactions to deliver tailored experiences:</p>
      <ul>
        <li>Recommendation engines (like those used by Netflix and Amazon)</li>
        <li>Dynamic pricing strategies</li>
        <li>Personalized marketing campaigns</li>
        <li>Chatbots and virtual assistants</li>
      </ul>
      
      <h3>Process Automation and Efficiency</h3>
      <p>Businesses are using ML to automate repetitive tasks and optimize operations:</p>
      <ul>
        <li>Intelligent document processing</li>
        <li>Supply chain optimization</li>
        <li>Predictive maintenance for equipment</li>
        <li>Quality control automation</li>
      </ul>
      
      <h3>Risk Management and Fraud Detection</h3>
      <p>ML algorithms excel at identifying patterns and anomalies in data:</p>
      <ul>
        <li>Credit risk assessment</li>
        <li>Fraud detection in financial transactions</li>
        <li>Cybersecurity threat detection</li>
        <li>Insurance claims analysis</li>
      </ul>
      
      <h3>Business Intelligence and Decision Making</h3>
      <p>ML transforms raw data into actionable insights:</p>
      <ul>
        <li>Sales forecasting</li>
        <li>Market trend analysis</li>
        <li>Customer churn prediction</li>
        <li>Business performance optimization</li>
      </ul>
      
      <h2>Implementation Challenges</h2>
      <p>Despite the benefits, businesses face several challenges when implementing ML:</p>
      <ul>
        <li>Data quality and quantity requirements</li>
        <li>Skill gaps and talent acquisition</li>
        <li>Integration with existing systems</li>
        <li>Ethical and regulatory considerations</li>
        <li>Measuring ROI and performance</li>
      </ul>
      
      <h2>Getting Started with ML in Your Business</h2>
      <p>To successfully implement machine learning in your business:</p>
      <ol>
        <li>Identify specific business problems that ML can solve</li>
        <li>Assess your data readiness and infrastructure</li>
        <li>Start with pilot projects to demonstrate value</li>
        <li>Build or acquire necessary talent</li>
        <li>Develop a scalable ML strategy</li>
      </ol>
      
      <h2>Conclusion</h2>
      <p>Machine learning is no longer just a technological advantage but a business necessity. Organizations that effectively leverage ML can gain significant competitive advantages through improved efficiency, enhanced customer experiences, and data-driven decision-making.</p>
    `,
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
    content: `
      <h2>The Importance of Ethical AI</h2>
      <p>As artificial intelligence systems become more pervasive in our society, the ethical implications of these technologies grow increasingly significant. Responsible AI development is not just a moral imperative but also essential for building sustainable and trustworthy technology.</p>
      
      <h2>Key Ethical Challenges in AI</h2>
      
      <h3>Bias and Fairness</h3>
      <p>AI systems learn from historical data, which often contains human biases:</p>
      <ul>
        <li>Algorithmic bias can perpetuate or amplify existing social inequalities</li>
        <li>Unfair outcomes can affect marginalized groups disproportionately</li>
        <li>Representation issues in training data can lead to poor performance for certain demographics</li>
      </ul>
      
      <h3>Privacy and Data Rights</h3>
      <p>AI systems typically require large amounts of data, raising important privacy concerns:</p>
      <ul>
        <li>Informed consent for data collection and usage</li>
        <li>Data minimization principles</li>
        <li>Right to be forgotten</li>
        <li>Protection against re-identification attacks</li>
      </ul>
      
      <h3>Transparency and Explainability</h3>
      <p>Many modern AI systems function as "black boxes":</p>
      <ul>
        <li>Difficulty in understanding how decisions are made</li>
        <li>Challenges in identifying and correcting errors</li>
        <li>Legal and regulatory requirements for explainability in high-stakes domains</li>
      </ul>
      
      <h3>Accountability and Governance</h3>
      <p>Who is responsible when AI systems cause harm?</p>
      <ul>
        <li>Legal frameworks for AI accountability</li>
        <li>Organizational governance structures</li>
        <li>Liability and insurance considerations</li>
      </ul>
      
      <h2>Frameworks for Ethical AI Development</h2>
      <p>Several frameworks have emerged to guide ethical AI development:</p>
      <ul>
        <li><strong>Value-sensitive design:</strong> Incorporating human values throughout the design process</li>
        <li><strong>Ethics by design:</strong> Building ethical considerations into every stage of development</li>
        <li><strong>Algorithmic impact assessments:</strong> Evaluating potential societal impacts before deployment</li>
        <li><strong>Ethics review boards:</strong> Independent oversight of AI projects</li>
      </ul>
      
      <h2>Practical Steps for Building Ethical AI Systems</h2>
      <ol>
        <li><strong>Diverse teams:</strong> Include people with varied backgrounds and perspectives</li>
        <li><strong>Representative data:</strong> Ensure training data reflects diverse populations</li>
        <li><strong>Regular bias auditing:</strong> Test systems for unfair outcomes</li>
        <li><strong>Transparent documentation:</strong> Document design choices, limitations, and intended uses</li>
        <li><strong>Feedback mechanisms:</strong> Create channels for users to report issues</li>
        <li><strong>Ongoing monitoring:</strong> Continuously evaluate systems after deployment</li>
      </ol>
      
      <h2>The Role of Regulation and Industry Standards</h2>
      <p>The regulatory landscape for AI ethics is evolving:</p>
      <ul>
        <li>EU's Artificial Intelligence Act</li>
        <li>Industry self-regulation efforts</li>
        <li>Standards bodies like IEEE and ISO</li>
        <li>Corporate ethical principles and guidelines</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Building ethical AI systems requires intentional effort, interdisciplinary collaboration, and a commitment to human values. By incorporating ethical considerations throughout the AI development lifecycle, we can create technologies that benefit humanity while minimizing potential harms.</p>
    `,
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
    content: `
      <h2>The Power of Data-Driven Decision Making</h2>
      <p>Organizations that leverage data effectively gain significant competitive advantages, including better decision-making, increased operational efficiency, and improved customer experiences. However, building a truly data-driven culture requires more than just implementing technologies—it demands a fundamental shift in organizational mindset and practices.</p>
      
      <h2>Key Elements of a Data-Driven Culture</h2>
      
      <h3>Leadership Commitment</h3>
      <p>Leadership plays a crucial role in establishing a data-driven culture:</p>
      <ul>
        <li>Executives must champion data initiatives and lead by example</li>
        <li>Strategic alignment of data objectives with business goals</li>
        <li>Investment in necessary resources and infrastructure</li>
        <li>Recognition and rewards for data-driven behaviors</li>
      </ul>
      
      <h3>Data Literacy and Skills Development</h3>
      <p>Employees at all levels need appropriate data skills:</p>
      <ul>
        <li>Basic data literacy training for all staff</li>
        <li>Advanced analytics training for specialized roles</li>
        <li>Continuous learning opportunities</li>
        <li>Communities of practice for knowledge sharing</li>
      </ul>
      
      <h3>Data Accessibility and Democratization</h3>
      <p>Making data available to those who need it:</p>
      <ul>
        <li>Self-service analytics tools</li>
        <li>Clear data governance policies that enable rather than restrict</li>
        <li>User-friendly dashboards and visualization tools</li>
        <li>Reduction of data silos across departments</li>
      </ul>
      
      <h3>Data Quality and Trust</h3>
      <p>Building confidence in organizational data:</p>
      <ul>
        <li>Consistent data definitions and taxonomies</li>
        <li>Data quality monitoring and improvement processes</li>
        <li>Clear documentation of data sources and limitations</li>
        <li>Transparency about how metrics are calculated</li>
      </ul>
      
      <h3>Processes and Workflows</h3>
      <p>Embedding data in everyday operations:</p>
      <ul>
        <li>Decision-making frameworks that require data inputs</li>
        <li>Regular review of key metrics and KPIs</li>
        <li>Experimentation and A/B testing culture</li>
        <li>Feedback loops to measure outcomes of decisions</li>
      </ul>
      
      <h2>Common Obstacles and How to Overcome Them</h2>
      
      <h3>Resistance to Change</h3>
      <p>Strategies to address resistance:</p>
      <ul>
        <li>Start with small wins to demonstrate value</li>
        <li>Identify and empower internal champions</li>
        <li>Address fears about job security or skill gaps</li>
        <li>Communicate benefits to individuals, not just the organization</li>
      </ul>
      
      <h3>Legacy Systems and Technical Debt</h3>
      <p>Approaches to technical challenges:</p>
      <ul>
        <li>Phased modernization approaches</li>
        <li>API layers to connect disparate systems</li>
        <li>Cloud migration strategies</li>
        <li>Data mesh architectures for complex organizations</li>
      </ul>
      
      <h3>Lack of Necessary Skills</h3>
      <p>Addressing skills gaps:</p>
      <ul>
        <li>Training and upskilling programs</li>
        <li>Strategic hiring for critical capabilities</li>
        <li>Partnerships with consulting firms or academic institutions</li>
        <li>Promoting internal mobility to leverage domain knowledge</li>
      </ul>
      
      <h2>Measuring Progress in Your Data Culture Journey</h2>
      <p>Key indicators to track:</p>
      <ul>
        <li>Percentage of decisions supported by data analysis</li>
        <li>Data literacy scores across the organization</li>
        <li>Usage rates of data platforms and tools</li>
        <li>Time spent on data preparation vs. analysis</li>
        <li>Employee perception of data accessibility and usefulness</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Building a data-driven culture is a journey that requires patience, persistence, and a multifaceted approach. By focusing on people, processes, and technology in tandem, organizations can transform how they operate and create sustainable competitive advantages through data.</p>
    `,
    coverImage: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-03-15',
    author: {
      name: 'James Rodriguez',
      avatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=James'
    },
    tags: ['Data Culture', 'Organizational Change', 'Data Strategy']
  }
];

// Find blog post by slug
const getBlogPostBySlug = (slug: string) => {
  return blogPosts.find(post => post.slug === slug);
};

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const post = getBlogPostBySlug(slug || '');
  
  // Determine if we're in the data-blueprint section
  const isDataBlueprint = location.pathname.includes('/data-blueprint');
  
  // Get the correct base path for links
  const basePath = isDataBlueprint ? '/data-blueprint' : '/resources/blog';
  
  if (!post) {
    return (
      <AppLayout>
        <div className="container py-8">
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold mb-4">Blog Post Not Found</h1>
            <p className="text-muted-foreground mb-6">The article you're looking for doesn't exist or has been removed.</p>
            <Button asChild>
              <Link to="/resources">Back to Resources</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="container py-8 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-6" asChild>
          <Link to={basePath}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to {isDataBlueprint ? "Data Blueprint" : "Blog"}
          </Link>
        </Button>
        
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              <span>{formatDate(post.publishedAt)}</span>
            </div>
            
            <div className="flex items-center">
              <User className="h-4 w-4 mr-1" />
              <span>By {post.author.name}</span>
            </div>
            
            <div className="flex items-center">
              <Tag className="h-4 w-4 mr-1" />
              <span>{post.tags.join(', ')}</span>
            </div>
          </div>
        </div>
        
        <Card className="overflow-hidden mb-8">
          <div className="aspect-video w-full overflow-hidden">
            <img 
              src={post.coverImage} 
              alt={post.title} 
              className="w-full h-full object-cover"
            />
          </div>
        </Card>
        
        <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
        
        <Separator className="my-8" />
        
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={post.author.avatar} />
            <AvatarFallback>{post.author.name.charAt(0)}</AvatarFallback>
          </Avatar>
          
          <div>
            <p className="font-medium">{post.author.name}</p>
            <p className="text-sm text-muted-foreground">Author</p>
          </div>
        </div>
        
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">More from Data Blueprint Series</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {blogPosts
              .filter(bp => bp.id !== post.id)
              .slice(0, 2)
              .map(relatedPost => (
                <Card key={relatedPost.id} className="overflow-hidden">
                  <div className="aspect-video w-full overflow-hidden">
                    <img 
                      src={relatedPost.coverImage} 
                      alt={relatedPost.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4">
                    <h4 className="font-semibold line-clamp-2 mb-2">{relatedPost.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{relatedPost.excerpt}</p>
                    <Button size="sm" variant="link" className="px-0" asChild>
                      <Link to={`${basePath}/${relatedPost.slug}`}>Read more</Link>
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

export default BlogPost;
