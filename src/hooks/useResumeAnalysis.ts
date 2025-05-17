import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResumeAnalysis } from '@/components/assistants/types';
import { useAuth } from '@/contexts/AuthContext';
import { CareerTrack } from '@/data/careerQuizData';

// Career path alignment calculation
interface CareerAlignment {
  path: CareerTrack;
  percentage: number;
  description: string;
}

// Define extensive keyword lists for each career path
const CAREER_KEYWORDS = {
  'AI/ML': [
    // Machine Learning Algorithms & Concepts
    'machine learning', 'deep learning', 'neural network', 'artificial intelligence', 'ai', 'ml', 
    'supervised learning', 'unsupervised learning', 'reinforcement learning', 'nlp', 'natural language processing',
    'computer vision', 'cv', 'image recognition', 'object detection', 'facial recognition',
    'sentiment analysis', 'transfer learning', 'generative ai', 'gans', 'generative adversarial networks',
    'transformers', 'lstm', 'rnn', 'cnn', 'convolutional neural network', 'transformer',
    'attention mechanism', 'bert', 'gpt', 'large language model', 'llm', 'diffusion model',
    'recommendation system', 'recommender system', 'collaborative filtering', 'anomaly detection',
    'classification', 'regression', 'clustering', 'dimensionality reduction',
    
    // ML Tools & Frameworks
    'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'sklearn', 'huggingface', 'transformers',
    'openai', 'langchain', 'llama', 'fastai', 'mxnet', 'caffe', 'theano', 'jax', 'openai gym',
    'mlflow', 'weights & biases', 'wandb', 'ray', 'kubeflow', 'sagemaker', 'vertex ai',
    'hyperparameter tuning', 'model optimization', 'model deployment', 'model inference',
    'vector database', 'rag', 'retrieval augmented generation',
    
    // Statistical & Mathematical Concepts
    'backpropagation', 'gradient descent', 'optimization', 'loss function', 'cost function',
    'regularization', 'dropout', 'batch normalization', 'activation function', 'softmax',
    'relu', 'sigmoid', 'tanh', 'adam', 'sgd', 'rmsprop', 'precision', 'recall', 'f1 score',
    'roc curve', 'auc', 'confusion matrix', 'cross-validation', 'bayesian',
    'markov', 'monte carlo', 'probabilistic model', 'ensemble learning', 'bagging', 'boosting',
    'random forest', 'xgboost', 'adaboost', 'support vector machine', 'svm', 'pca',
    't-sne', 'umap', 'feature extraction', 'feature engineering', 'feature selection',
    
    // AI Research & Applications
    'research', 'paper', 'publication', 'conference', 'neurips', 'icml', 'cvpr', 'iclr',
    'arxiv', 'phd', 'thesis', 'autonomous', 'robotics', 'speech recognition', 'speech synthesis',
    'text to speech', 'tts', 'asr', 'chatbot', 'conversational ai', 'ethics', 'responsible ai',
    'explainable ai', 'xai', 'fairness', 'bias', 'interpretability', 'multimodal', 'few-shot',
    'zero-shot', 'fine-tuning', 'prompt engineering', 'data labeling', 'annotation',
    
    // Programming & Technical Skills
    'python', 'c++', 'cuda', 'gpu', 'distributed computing', 'parallel processing',
    'high performance computing', 'hpc', 'optimization', 'memory management',
    'algorithm design', 'data structures', 'complexity analysis', 'big o',
    
    // MLOps & Production
    'mlops', 'devops', 'ci/cd', 'continuous integration', 'continuous deployment',
    'model monitoring', 'model versioning', 'feature store', 'docker', 'kubernetes',
    'container', 'microservice', 'api', 'rest', 'grpc', 'tracing', 'logging'
  ],
  
  'Analytics': [
    // Data Analysis & Statistical Methods
    'data analysis', 'statistical analysis', 'descriptive statistics', 'inferential statistics',
    'hypothesis testing', 'a/b testing', 'experiment design', 'causal inference', 'correlation',
    'regression analysis', 'multivariate analysis', 'time series analysis', 'forecasting',
    'trend analysis', 'exploratory data analysis', 'eda', 'segmentation', 'clustering',
    'cohort analysis', 'funnel analysis', 'retention analysis', 'churn analysis',
    'customer lifetime value', 'ltv', 'price elasticity', 'demand forecasting',
    'market basket analysis', 'anomaly detection', 'outlier detection',
    
    // Data Visualization & Reporting
    'data visualization', 'dashboard', 'reporting', 'kpi', 'metrics', 'tableau',
    'power bi', 'looker', 'metabase', 'data studio', 'grafana', 'kibana', 'matplotlib',
    'seaborn', 'ggplot2', 'plotly', 'bokeh', 'dataviz', 'chart', 'graph', 'plot',
    'heatmap', 'scatter plot', 'bar chart', 'line chart', 'pie chart', 'histogram',
    'storytelling', 'presentation', 'executive reporting', 'business reporting',
    
    // Technical Skills & Tools
    'sql', 'r', 'python', 'excel', 'spss', 'sas', 'stata', 'minitab', 'pandas', 'numpy',
    'scipy', 'statsmodels', 'scikit-learn', 'jupyter', 'colab', 'rstudio', 'dplyr', 'tidyr',
    'dbt', 'query optimization', 'window functions', 'cte', 'spark', 'databricks',
    'snowflake', 'bigquery', 'redshift', 'athena', 'data quality', 'etl', 'elt',
    
    // Business Analytics & Domains
    'business analytics', 'financial analytics', 'marketing analytics', 'sales analytics',
    'customer analytics', 'product analytics', 'web analytics', 'growth analytics',
    'operations analytics', 'supply chain analytics', 'hr analytics', 'people analytics',
    'healthcare analytics', 'retail analytics', 'marketing mix modeling', 'mmm',
    'attribution modeling', 'roi analysis', 'competitive analysis', 'benchmarking',
    
    // Web & Digital Analytics
    'google analytics', 'adobe analytics', 'gtm', 'tag manager', 'mixpanel',
    'segment', 'amplitude', 'hotjar', 'session recording', 'heatmap', 'conversion rate',
    'cro', 'user journey', 'user flow', 'user behavior', 'event tracking',
    'utm parameters', 'attribution', 'bounce rate', 'engagement', 'pageviews', 'sessions',
    
    // Roles & Skills
    'data analyst', 'business analyst', 'marketing analyst', 'financial analyst',
    'quantitative analyst', 'research analyst', 'insights', 'reporting', 'analytics',
    'measurement', 'metrics', 'performance', 'optimization', 'strategic analysis',
    'decision support', 'data-driven decision making', 'storytelling with data',
    'problem solving', 'critical thinking', 'analytical', 'analytical mindset',
    
    // Methods & Techniques
    'regression', 'linear regression', 'logistic regression', 'multivariate regression',
    'anova', 't-test', 'chi-square', 'confidence interval', 'statistical significance',
    'p-value', 'null hypothesis', 'alternative hypothesis', 'bayesian statistics',
    'monte carlo simulation', 'markov chain', 'factor analysis', 'principal component analysis',
    'random forest', 'decision tree', 'clustering', 'k-means', 'hierarchical clustering'
  ],
  
  'Data Engineering': [
    // Data Infrastructure & Architecture
    'data pipeline', 'etl pipeline', 'elt pipeline', 'data warehouse', 'data lake',
    'data lakehouse', 'data mesh', 'data fabric', 'data architecture', 'database design',
    'schema design', 'star schema', 'snowflake schema', 'dimensional modeling',
    'distributed systems', 'scalability', 'high availability', 'fault tolerance', 
    'disaster recovery', 'data replication', 'data partitioning', 'data sharding',
    'event-driven architecture', 'microservices', 'service-oriented architecture',
    
    // Data Storage & Databases
    'sql', 'nosql', 'relational database', 'mysql', 'postgresql', 'oracle', 'sql server',
    'mongodb', 'dynamodb', 'cassandra', 'hbase', 'bigtable', 'redis', 'elasticsearch',
    'neo4j', 'graph database', 'time series database', 'influxdb', 'timescaledb', 
    'document store', 'key-value store', 'columnar database', 'vertica', 'redshift',
    'snowflake', 'bigquery', 'synapse', 'data modeling', 'indexing', 'query optimization',
    
    // Big Data Technologies
    'hadoop', 'hdfs', 'yarn', 'mapreduce', 'hive', 'pig', 'apache spark', 'spark',
    'apache flink', 'apache beam', 'dataflow', 'apache nifi', 'apache airflow', 'airflow',
    'apache kafka', 'kafka', 'rabbitmq', 'apache pulsar', 'kinesis', 'pubsub',
    'event streaming', 'change data capture', 'cdc', 'apache sqoop', 'flume',
    
    // Cloud Data Engineering
    'aws', 'azure', 'gcp', 's3', 'azure blob storage', 'gcs', 'emr', 'databricks',
    'data factory', 'dataproc', 'lambda', 'azure functions', 'cloud functions',
    'glue', 'athena', 'redshift', 'bigquery', 'snowflake', 'firehose', 'cloud dataflow',
    'cloud composer', 'managed airflow', 'kubernetes', 'container', 'docker', 'terraform',
    'cloudformation', 'pulumi', 'infrastructure as code', 'iac',
    
    // Data Processing & Transformation
    'data transformation', 'data cleansing', 'data normalization', 'data validation',
    'data quality', 'data governance', 'data lineage', 'metadata management',
    'master data management', 'mdm', 'reference data', 'batch processing',
    'stream processing', 'real-time processing', 'etl', 'elt', 'data integration',
    'change data capture', 'incremental loading', 'slowly changing dimension', 'scd',
    
    // Programming & Development Skills
    'python', 'java', 'scala', 'go', 'rust', 'sql', 'pyspark', 'pandas', 'dask',
    'numpy', 'pydantic', 'pytest', 'software engineering', 'version control', 'git',
    'ci/cd', 'bash', 'shell scripting', 'linux', 'unix', 'command line', 'api development',
    'restful api', 'graphql', 'grpc', 'microservices', 'distributed computing',
    
    // Workflow & Orchestration
    'apache airflow', 'airflow', 'dagster', 'prefect', 'luigi', 'workflow orchestration',
    'data workflow', 'dag', 'directed acyclic graph', 'job scheduling', 'dependency management',
    'task management', 'pipeline monitoring', 'data observability', 'alerting',
    'sla management', 'retry mechanism', 'error handling', 'idempotency',
    
    // Modern Data Stack
    'dbt', 'data build tool', 'looker', 'fivetran', 'stitch', 'meltano', 'singer',
    'census', 'hightouch', 'reverse etl', 'metabase', 'mode', 'tableau', 'power bi',
    'great expectations', 'soda', 'monte carlo', 'data quality', 'data testing',
    'data documentation', 'data catalog', 'data discovery', 'data lineage'
  ],
  
  'Business Intelligence': [
    // BI Platforms & Tools
    'business intelligence', 'bi', 'tableau', 'power bi', 'looker', 'qlik', 'qlikview',
    'qlik sense', 'microstrategy', 'sap businessobjects', 'oracle bi', 'cognos',
    'thoughtspot', 'domo', 'sisense', 'yellowfin', 'google data studio', 'gooddata',
    'mode analytics', 'metabase', 'redash', 'superset', 'quicksight', 'sap analytics cloud',
    
    // Reporting & Dashboarding
    'dashboard', 'reporting', 'scorecard', 'kpi dashboard', 'metrics', 'key performance indicators',
    'interactive dashboard', 'executive dashboard', 'operational reporting', 'ad hoc reporting',
    'self-service analytics', 'data storytelling', 'data visualization', 'visualization',
    'chart', 'graph', 'plot', 'infographic', 'data presentation', 'business reporting',
    'financial reporting', 'sales reporting', 'marketing reporting', 'automated reporting',
    'report scheduling', 'drill-down', 'slice and dice', 'pivot', 'cross-tab',
    
    // Data Modeling for BI
    'dimensional modeling', 'star schema', 'snowflake schema', 'fact table', 'dimension table',
    'etl', 'elt', 'data mart', 'data warehouse', 'olap', 'olap cube', 'mdx', 'dax',
    'data modeling', 'logical model', 'physical model', 'semantic layer', 'business model',
    'data transformation', 'calculated field', 'calculated measure', 'aggregation',
    'hierarchies', 'drill path', 'conformed dimension', 'slowly changing dimension',
    
    // SQL & Query Skills
    'sql', 't-sql', 'pl/sql', 'mysql', 'postgresql', 'oracle', 'sql server', 'bigquery',
    'redshift', 'snowflake', 'synapse', 'query optimization', 'query performance',
    'window functions', 'cte', 'common table expression', 'stored procedure',
    'view', 'materialized view', 'database', 'database design', 'schema design',
    
    // Business Analysis & Domain Knowledge
    'business analysis', 'requirements gathering', 'business requirements', 'user stories',
    'stakeholder management', 'business process', 'process improvement', 'business strategy',
    'business metrics', 'financial metrics', 'profit and loss', 'balance sheet',
    'cash flow', 'revenue', 'expenses', 'margin', 'roi', 'cac', 'ltv', 'arpu', 'mrr', 'arr',
    'conversion rate', 'retention rate', 'churn rate', 'growth rate', 'forecasting',
    
    // Industry & Function Knowledge
    'finance', 'accounting', 'marketing', 'sales', 'operations', 'supply chain',
    'manufacturing', 'retail', 'e-commerce', 'healthcare', 'insurance', 'banking',
    'telecommunications', 'media', 'advertising', 'technology', 'saas', 'human resources',
    'customer service', 'customer experience', 'cx', 'user experience', 'ux',
    
    // Advanced Analytics Integration
    'predictive analytics', 'prescriptive analytics', 'statistical analysis',
    'data mining', 'trend analysis', 'regression analysis', 'time series analysis',
    'forecasting', 'what-if analysis', 'scenario planning', 'segmentation',
    'clustering', 'classification', 'machine learning integration', 'r integration',
    'python integration', 'embedded analytics', 'natural language querying', 'nlq',
    
    // Data Governance & Management
    'data governance', 'data quality', 'data stewardship', 'data lineage',
    'metadata management', 'master data management', 'data dictionary',
    'data catalog', 'data glossary', 'data standards', 'data security',
    'access control', 'row-level security', 'column-level security',
    'data privacy', 'compliance', 'gdpr', 'ccpa', 'hipaa'
  ]
};

// Helper function to escape special regex characters
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

// Helper function to count keywords in resume text
const countKeywordsInResume = (resumeText: string, keywordList: string[]): number => {
  if (!resumeText) return 0;
  
  // Convert text to lowercase for case-insensitive matching
  const lowerText = resumeText.toLowerCase();
  
  // Count occurrences of each keyword
  let count = 0;
  
  for (const keyword of keywordList) {
    try {
      // Escape special regex characters in the keyword
      const escapedKeyword = escapeRegExp(keyword);
      
      // Create regex to find whole word/phrase matches
      // This helps avoid counting substrings within other words
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'g');
      const matches = lowerText.match(regex);
      
      if (matches) {
        count += matches.length;
        // Optional: log matched keywords for debugging
        // console.log(`Found ${matches.length} matches for '${keyword}'`);
      }
    } catch (error) {
      // If there's an error with a specific keyword, log it and continue
      console.warn(`Error matching keyword '${keyword}': ${error.message}`);
    }
  }
  
  return count;
};

// Add these new types at the top of the file
interface PollingConfig {
  initialInterval: number;
  maxInterval: number;
  maxAttempts: number;
  backoffFactor: number;
}

export function useResumeAnalysis() {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [careerAlignments, setCareerAlignments] = useState<CareerAlignment[]>([]);
  const [isPollingForImprovements, setIsPollingForImprovements] = useState(false);
  const [improvedBullets, setImprovedBullets] = useState<any[] | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const hasLoadedAnalysis = useRef(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pollingStatus, setPollingStatus] = useState<'idle' | 'polling' | 'completed' | 'error'>('idle');
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const backoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset analysis state when user changes
  useEffect(() => {
    if (!user) {
      setAnalysis(null);
      hasLoadedAnalysis.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (user && !hasLoadedAnalysis.current) {
      hasLoadedAnalysis.current = true;

      const savedAnalysis = localStorage.getItem(`resume_analysis_${user.id}`);
      console.log("Loading analysis from localStorage:", savedAnalysis ? "Found" : "Not found");

      if (savedAnalysis) {
        try {
          const parsedAnalysis = JSON.parse(savedAnalysis);
          setAnalysis(parsedAnalysis);
          calculateCareerAlignments(parsedAnalysis);
        } catch (error) {
          console.error('Error parsing saved analysis:', error);
        }
      }
      
      // Also try to load the resume text for keyword analysis
      const resumeText = localStorage.getItem(`resume_text_${user.id}`);
      if (resumeText && savedAnalysis) {
        try {
          const parsedAnalysis = JSON.parse(savedAnalysis);
          
          // Perform keyword analysis on the resume text
          analyzeKeywordsInResume(resumeText, parsedAnalysis);
        } catch (error) {
          console.error('Error analyzing keywords in resume:', error);
        }
      }
    }
  }, [user]);

  // Clean up the interval when component unmounts
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Replace the existing pollForImprovedBullets function with this improved version
  const pollForImprovedBullets = async (userId: string) => {
    if (!userId) return;

    const config: PollingConfig = {
      initialInterval: 3000, // Start with 3 seconds
      maxInterval: 15000,    // Max 15 seconds between attempts
      maxAttempts: 20,       // More attempts but with backoff
      backoffFactor: 1.5     // Increase interval by 50% each attempt
    };

    setIsPollingForImprovements(true);
    setPollingStatus('polling');
    setPollingAttempt(0);

    const poll = async (attempt: number) => {
      if (attempt >= config.maxAttempts) {
        console.log('Max polling attempts reached');
        setIsPollingForImprovements(false);
        setPollingStatus('error');
        toast({
          title: "Analysis Taking Longer Than Expected",
          description: "We'll keep working on your improvements in the background. Check back in a few minutes.",
          variant: "default"
        });
        return;
      }

      try {
        // Load career goals from local storage
        const careerGoals = localStorage.getItem(`career_goals_${userId}`);
        
        const { data, error } = await supabase.functions.invoke('resume-analyzer', {
          body: { 
            action: 'improve-bullets',
            userId: userId,
            careerGoals: careerGoals || undefined
          }
        });

        if (error) {
          console.error("Error polling for improved bullets:", error);
          throw error;
        }

        if (data?.improved_bullets && data.improved_bullets.length > 0) {
          console.log("Received improved bullets:", data.improved_bullets.length);
          
          // Update the analysis with improved bullets
          setImprovedBullets(data.improved_bullets);
          setAnalysis(prevAnalysis => {
            if (!prevAnalysis) return prevAnalysis;
            return {
              ...prevAnalysis,
              bullets: data.improved_bullets
            };
          });
          
          setIsPollingForImprovements(false);
          setPollingStatus('completed');
          
          toast({
            title: "Resume Analysis Completed",
            description: "We've enhanced your bullet points with suggestions for improvement!",
          });
          return;
        }

        // Calculate next interval with exponential backoff
        const nextInterval = Math.min(
          config.initialInterval * Math.pow(config.backoffFactor, attempt),
          config.maxInterval
        );

        // Update polling attempt for UI feedback
        setPollingAttempt(attempt + 1);

        // Schedule next attempt
        backoffTimeoutRef.current = setTimeout(() => {
          poll(attempt + 1);
        }, nextInterval);

      } catch (err) {
        console.error("Error in polling:", err);
        setIsPollingForImprovements(false);
        setPollingStatus('error');
        
        toast({
          title: "Error Checking Improvements",
          description: "We encountered an issue while checking for improvements. Please try again later.",
          variant: "destructive"
        });
      }
    };

    // Start polling
    poll(0);

    // Cleanup function
    return () => {
      if (backoffTimeoutRef.current) {
        clearTimeout(backoffTimeoutRef.current);
      }
      setIsPollingForImprovements(false);
      setPollingStatus('idle');
    };
  };

  // Add cleanup in useEffect
  useEffect(() => {
    return () => {
      if (backoffTimeoutRef.current) {
        clearTimeout(backoffTimeoutRef.current);
      }
    };
  }, []);

  // Analyze keywords in the resume and update the analysis
  const analyzeKeywordsInResume = (resumeText: string, analysisData: ResumeAnalysis) => {
    if (!resumeText || !analysisData) return analysisData;
    
    // Create a copy of the analysis data
    const updatedAnalysis = { ...analysisData };
    
    // Count keywords for each career path
    updatedAnalysis.ai_ml_keywords_count = countKeywordsInResume(resumeText, CAREER_KEYWORDS['AI/ML']);
    updatedAnalysis.analytics_keywords_count = countKeywordsInResume(resumeText, CAREER_KEYWORDS['Analytics']);
    updatedAnalysis.data_engineering_keywords_count = countKeywordsInResume(resumeText, CAREER_KEYWORDS['Data Engineering']);
    updatedAnalysis.bi_keywords_count = countKeywordsInResume(resumeText, CAREER_KEYWORDS['Business Intelligence']);
    
    // Log the keyword counts
    console.log('Keyword counts:', {
      'AI/ML': updatedAnalysis.ai_ml_keywords_count,
      'Analytics': updatedAnalysis.analytics_keywords_count,
      'Data Engineering': updatedAnalysis.data_engineering_keywords_count,
      'Business Intelligence': updatedAnalysis.bi_keywords_count
    });
    
    // Update the analysis state and localStorage
    setAnalysis(updatedAnalysis);
    localStorage.setItem(`resume_analysis_${user?.id}`, JSON.stringify(updatedAnalysis));
    console.log("Updated Analysis: ", updatedAnalysis)
    
    return updatedAnalysis;
  };

  // Calculate career alignments based on resume analysis
  const calculateCareerAlignments = async (analysisData: ResumeAnalysis) => {
    if (!analysisData) return;

    let quizTopPath: CareerTrack | null = null;
    
    if (user) {
      try {
        const { data: quizAttempt, error } = await supabase
          .from('career_quiz_attempts')
          .select('top_recommended_path')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!error && quizAttempt?.top_recommended_path) {
          quizTopPath = quizAttempt.top_recommended_path as CareerTrack;
        }
      } catch (error) {
        console.error('Error fetching quiz attempt:', error);
      }
    }
    
    if (!quizTopPath) {
      quizTopPath = localStorage.getItem('recommendedCareerPath') as CareerTrack;
    }
    console.log("Data Quiz Top Paths: ", quizTopPath);

    const careerPaths: CareerTrack[] = ['AI/ML', 'Analytics', 'Data Engineering', 'Business Intelligence'];
    
    const sortedPaths = quizTopPath 
      ? [quizTopPath, ...careerPaths.filter(p => p !== quizTopPath)]
      : careerPaths;
    
    const alignments: CareerAlignment[] = sortedPaths.slice(0, 3).map(path => {
      let keywordCount = 0;
      switch(path) {
        case 'AI/ML':
          keywordCount = analysisData.ai_ml_keywords_count || 0;
          break;
        case 'Analytics':
          keywordCount = analysisData.analytics_keywords_count || 0;
          break;
        case 'Data Engineering':
          keywordCount = analysisData.data_engineering_keywords_count || 0;
          break;
        case 'Business Intelligence':
          keywordCount = analysisData.bi_keywords_count || 0;
          break;
      }
      
      console.log(`Keyword count for ${path}: ${keywordCount}`);
      
      // More realistic percentage calculation
      let percentage = 0;
      
      // For very low keyword counts (1-2)
      if (keywordCount <= 2) {
        percentage = 15 + (keywordCount * 10);
      }
      // For low keyword counts (3-5)
      else if (keywordCount <= 5) {
        percentage = 30 + (keywordCount * 5);
      }
      // For medium keyword counts (6-10)
      else if (keywordCount <= 10) {
        percentage = 40 + (keywordCount * 3);
      }
      // For medium-high keyword counts (11-20)
      else if (keywordCount <= 20) {
        percentage = 55 + ((keywordCount - 10) * 2);
      }
      // For high keyword counts (21+)
      else {
        percentage = 75 + Math.min((keywordCount - 20), 20);
      }
      
      // Consider resume quality for adjustment
      const resumeScore = analysisData.resume_percent || 50;
      const qualityFactor = resumeScore / 100;
      percentage = Math.round(percentage * qualityFactor);
      
      // Add quiz bonus if applicable
      if (path === quizTopPath) {
        percentage = Math.min(percentage + 5, 95);
      }
      
      // Cap maximum percentage at 95% unless it's an exceptional match
      if (keywordCount < 50) {
        percentage = Math.min(percentage, 90);
      }
      
      // Generate description
      const description = `Your resume shows ${percentage}% alignment with ${path} roles.`;
      
      console.log(`Final percentage for ${path}: ${percentage}%`);
      
      return { path, percentage, description };
    });
    
    setCareerAlignments(alignments);
  };

  // Fetch the resume assessment (roast) and store it in the database
  const fetchAndStoreAssessment = async (resumeText: string, userId: string) => {
    try {
      // Call the Edge Function to get the roast
      const { data, error } = await supabase.functions.invoke('resume-analyzer', {
        body: { 
          action: 'get-roast',
          resumeText: resumeText,
          userId: userId
        }
      });
      
      if (error) {
        console.error("Error fetching assessment:", error);
        throw error;
      }
      
      if (data && data.roast) {
        // Update the resume record with the initial assessment
        const { error: updateError } = await supabase
          .from('resumes')
          .update({ resume_roast: data.roast })
          .eq('user_id', userId);
          
        if (updateError) {
          console.error('Error storing assessment in database:', updateError);
        } else {
          console.log('Initial assessment stored successfully');
        }
        
        return data.roast;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching resume assessment:', error);
      return null;
    }
  };

  const analyzeResume = async (text: string): Promise<boolean> => {
    if (!text || !user) {
      console.log("Cannot analyze: missing text or user");
      return false;
    }
    
    // Reset all states at the start
    setAnalysis(null);
    hasLoadedAnalysis.current = false;
    setIsAnalyzing(true);
    setIsPollingForImprovements(false);
    setPollingStatus('idle');
    setPollingAttempt(0);
    
    // Clear localStorage cache for this user before starting a new analysis
    localStorage.removeItem(`resume_analysis_${user.id}`);
    localStorage.removeItem(`resume_text_${user.id}`);
    
    console.log("Starting resume analysis with text of length:", text.length);
    
    try {
      // Store the resume text in localStorage for potential later use
      localStorage.setItem(`resume_text_${user.id}`, text);
      
      // Check if there are career goals stored in localStorage
      const careerGoals = localStorage.getItem(`career_goals_${user.id}`);
      
      console.log("[Resume Analysis] Starting initial resume analysis...");
      
      const { data: analysisData, error } = await supabase.functions.invoke('resume-analyzer', {
        body: { 
          resumeText: text,
          userId: user.id,
          careerGoals: careerGoals || undefined
        }
      });

      console.log("[Resume Analysis] Initial analysis completed", {
        success: !!analysisData && !error,
        hasError: !!error
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }
      
      if (!analysisData || typeof analysisData !== 'object' || Object.keys(analysisData).length === 0) {
        throw new Error("Invalid or empty analysis data returned");
      }
      
      // Validate required fields
      const requiredFields = ['resume_percent', 'letter_grade', 'themes'];
      const missingFields = requiredFields.filter(field => !(field in analysisData));
      
      if (missingFields.length > 0) {
        throw new Error(`Analysis missing required fields: ${missingFields.join(', ')}`);
      }
      
      // Clean and enhance the analysis data
      const cleanedData = cleanAnalysisOutput(analysisData);
      cleanedData.resume_id = user.id;
      
      // Perform keyword analysis
      const enhancedData = analyzeKeywordsInResume(text, cleanedData as ResumeAnalysis);
      
      // Update states and storage
      setAnalysis(enhancedData as ResumeAnalysis);
      localStorage.setItem(`resume_analysis_${user.id}`, JSON.stringify(enhancedData));
      calculateCareerAlignments(enhancedData as ResumeAnalysis);
      hasLoadedAnalysis.current = true;

      // Start polling for improvements
      console.log("[Resume Analysis] Triggering improve-bullets analysis...");
      supabase.functions.invoke('resume-analyzer', {
        body: { 
          action: 'improve-bullets',
          userId: user.id,
          careerGoals: careerGoals || undefined
        }
      }).then(() => {
        console.log("[Resume Analysis] Improve-bullets request sent successfully");
        pollForImprovedBullets(user.id);
      }).catch((err) => {
        console.error("[Resume Analysis] Error triggering improve-bullets:", err);
      });
      
      // Update the analysis in the resume record
      try {
        const updateData = { 
          analysis: enhancedData,
          updated_at: new Date().toISOString()
        };
        
        if (careerGoals) {
          updateData.career_goals = careerGoals;
        }
        
        await supabase
          .from('resumes')
          .update(updateData)
          .eq('user_id', user.id);
          
        console.log("[Resume Analysis] Successfully stored analysis in resume record");
      } catch (updateErr) {
        console.error("Error updating resume record:", updateErr);
      }
      
      toast({
        title: "Initial Resume Analysis Complete",
        description: `Your resume received a grade of ${enhancedData.letter_grade} (${enhancedData.resume_percent}%). We're generating detailed bullet point improvements in the background.`,
      });
      
      return true;
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysis(null);
      hasLoadedAnalysis.current = false;
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to analyze resume. Please try again.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Clean up any AI prompt markers or formatting artifacts
  const cleanAnalysisOutput = (data: any) => {
    if (!data) return data;
    
    const cleanedData = { ...data };
    
    // Clean text fields by removing prompt indicators like "*", "##", "- ***" etc.
    if (cleanedData.elevator_pitch) {
      cleanedData.elevator_pitch = cleanedData.elevator_pitch
        .replace(/\*\*|\*|##|```|\[\[.*?\]\]|\n/g, '')
        .trim();
    }
    
    if (cleanedData.explanation) {
      cleanedData.explanation = cleanedData.explanation
        .replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
        .replace(/^.*?:(.*)/gm, '$1') // Remove field labels like "Resume Grade Explanation:"
        .trim();
    }
    
    // Clean up theme entries
    if (cleanedData.themes && Array.isArray(cleanedData.themes)) {
      cleanedData.themes = cleanedData.themes.map((theme: string) => 
        theme.replace(/^[-*\s]*\*\*\*|^\s*-\s*\*\*\*|\*\*\*|:/g, '')
          .replace(/^\s*[–-]\s*/g, '')
          .trim()
      );
    }
    
    // Clean up bullet entries
    if (cleanedData.bullets && Array.isArray(cleanedData.bullets)) {
      cleanedData.bullets = cleanedData.bullets.map((bullet: any) => {
        if (bullet.improved_bullet) {
          bullet.improved_bullet = bullet.improved_bullet
            .replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
            .trim();
        }
        if (bullet.explanation) {
          bullet.explanation = bullet.explanation
            .replace(/\*\*|\*|##|```|\[\[.*?\]\]/g, '')
            .trim();
        }
        return bullet;
      });
    }
    
    return cleanedData;
  };

  return {
    analysis,
    setAnalysis,
    isAnalyzing,
    isPollingForImprovements,
    setIsPollingForImprovements,
    pollingStatus,
    setPollingStatus,
    pollingAttempt,
    improvedBullets,
    analyzeResume,
    careerAlignments,
    fetchAndStoreAssessment,
    analyzeKeywordsInResume,
    CAREER_KEYWORDS,
    pollForImprovedBullets
  };
}
