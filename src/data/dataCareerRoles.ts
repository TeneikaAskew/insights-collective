
// Define the type for career roles data structure
export interface DataCareerRole {
  id: string;
  title: string;
  category: string;
  shortDescription: string;
  longDescription?: string;
  responsibilities?: string[];
  tools?: string[];
  skills?: string[];
  collaborators?: string[];
  dayInLife?: string;
  monthInLife?: string;
  schedule?: {
    time: string;
    activity: string;
  }[];
  projectTimeline?: {
    title: string;
    duration: string;
    description: string;
    activities?: string[];
  }[];
  careerPath?: {
    description: string;
    progressionSteps: {
      title: string;
      description: string;
      timePeriod?: string;
    }[];
  };
  courses?: {
    id: string;
    title: string;
    description: string;
  }[];
}

// Career roles data
export const dataCareerRoles: DataCareerRole[] = [
  {
    id: "data-analyst",
    title: "Data Analyst",
    category: "Analytics",
    shortDescription: "Transform raw data into actionable insights to drive business decisions.",
    longDescription: "Data Analysts collect, process, and analyze data to help organizations make better decisions. They identify trends, create visualizations, and communicate findings to stakeholders across the business. Their work bridges the gap between data and decision-making, making complex information accessible and useful.",
    responsibilities: [
      "Collect and clean data from various sources",
      "Perform statistical analysis to identify patterns and trends",
      "Create dashboards and visualizations for stakeholders",
      "Collaborate with teams to understand business questions",
      "Develop and maintain regular reporting processes",
      "Present findings and recommendations to decision-makers"
    ],
    tools: ["SQL", "Excel", "Tableau/Power BI", "Python/R", "Google Analytics", "Looker"],
    skills: ["Data Visualization", "Statistical Analysis", "Problem Solving", "Communication", "Critical Thinking"],
    collaborators: ["Product Managers", "Marketing Teams", "Business Stakeholders", "Data Engineers", "BI Developers"],
    dayInLife: "A typical day for a Data Analyst involves querying databases, analyzing datasets, building or updating dashboards, and communicating with stakeholders about their data needs. You might start the day checking automated reports, then dive into a specific analysis requested by the marketing team. After lunch, you could update a key dashboard that executives use, then attend a meeting to present your findings on recent customer behavior trends.",
    schedule: [
      { time: "9:00 AM", activity: "Check automated reports and respond to urgent data requests" },
      { time: "10:00 AM", activity: "Query databases and analyze data for a marketing campaign effectiveness report" },
      { time: "12:00 PM", activity: "Lunch break and catch up on industry news" },
      { time: "1:00 PM", activity: "Update executive dashboard with latest KPIs and metrics" },
      { time: "2:30 PM", activity: "Meet with product team to understand their data needs for upcoming features" },
      { time: "3:30 PM", activity: "Clean and prepare data for tomorrow's analysis" },
      { time: "4:30 PM", activity: "Document findings and plan tomorrow's priorities" }
    ],
    monthInLife: "Over the course of a month, a Data Analyst typically works on multiple projects with different stakeholders. You might spend one week analyzing customer segmentation, another week building a new dashboard for the sales team, and the remaining time supporting various ad-hoc requests while maintaining regular reporting. Each month usually includes a mix of recurring tasks like updating dashboards and special projects that dive deeper into specific business questions.",
    projectTimeline: [
      {
        title: "Requirements Gathering",
        duration: "Week 1",
        description: "Work with stakeholders to understand their data needs and define success metrics.",
        activities: [
          "Interview business stakeholders to understand their goals",
          "Document specific metrics and KPIs needed",
          "Identify available data sources and potential gaps",
          "Create project plan with deliverables and timelines"
        ]
      },
      {
        title: "Data Collection & Processing",
        duration: "Week 2",
        description: "Gather all necessary data from various sources and prepare it for analysis.",
        activities: [
          "Write SQL queries to extract relevant data",
          "Clean and transform data to ensure quality",
          "Merge datasets from multiple sources",
          "Document data dictionary and processing methodology"
        ]
      },
      {
        title: "Analysis & Insights",
        duration: "Week 3",
        description: "Perform statistical analysis and extract meaningful insights from the data.",
        activities: [
          "Conduct exploratory data analysis to identify patterns",
          "Apply statistical methods to test hypotheses",
          "Create visualizations to illustrate key findings",
          "Document insights and actionable recommendations"
        ]
      },
      {
        title: "Reporting & Implementation",
        duration: "Week 4",
        description: "Deliver findings to stakeholders and implement ongoing reporting solutions.",
        activities: [
          "Build dashboard for ongoing monitoring",
          "Present findings to stakeholders",
          "Document methodology for future reference",
          "Set up automated reporting if needed"
        ]
      }
    ],
    careerPath: {
      description: "A career as a Data Analyst offers multiple paths for growth, whether advancing to senior analytical roles, specializing in a specific domain, or moving toward data science and machine learning.",
      progressionSteps: [
        {
          title: "Junior Data Analyst",
          description: "Focus on learning data tools, writing basic queries, and supporting experienced analysts with data preparation and visualization.",
          timePeriod: "1-2 years"
        },
        {
          title: "Data Analyst",
          description: "Take ownership of analyses, build dashboards independently, and communicate directly with stakeholders to solve business problems.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Data Analyst",
          description: "Lead complex analytical projects, mentor junior analysts, and work closely with leadership to drive data strategy and decision-making.",
          timePeriod: "4-6 years"
        },
        {
          title: "Analytics Manager / Data Scientist",
          description: "Either manage a team of analysts or pivot toward more advanced statistical modeling and machine learning implementations.",
          timePeriod: "6+ years"
        }
      ]
    },
    courses: [
      {
        id: "da101",
        title: "Introduction to Data Analysis",
        description: "Learn the fundamentals of analyzing data to extract insights."
      },
      {
        id: "sql101",
        title: "SQL for Data Analysis",
        description: "Master SQL queries for retrieving and manipulating data."
      }
    ]
  },
  {
    id: "machine-learning-engineer",
    title: "Machine Learning Engineer",
    category: "AI/ML",
    shortDescription: "Build and deploy machine learning models that power intelligent applications.",
    longDescription: "Machine Learning Engineers develop, optimize, and deploy ML models that solve complex problems and enable AI functionality in applications. They bridge the gap between data science and software engineering, taking models from research to production while ensuring they perform well at scale. They work at the intersection of data science, statistics, and software development.",
    responsibilities: [
      "Design and implement machine learning algorithms",
      "Process and transform large datasets for model training",
      "Optimize models for performance and accuracy",
      "Deploy and monitor models in production environments",
      "Collaborate with data scientists and product teams",
      "Stay current with the latest ML research and techniques"
    ],
    tools: ["Python", "TensorFlow/PyTorch", "Scikit-learn", "Docker", "Kubernetes", "Git", "MLflow"],
    skills: ["Algorithm Design", "Software Engineering", "Statistical Analysis", "Model Deployment", "Performance Optimization"],
    collaborators: ["Data Scientists", "Software Engineers", "DevOps Teams", "Product Managers", "Data Engineers"],
    dayInLife: "As a Machine Learning Engineer, your day revolves around developing, testing, and deploying ML models. You might start by checking model performance metrics from production systems, then work on optimizing a recommendation algorithm, and finally collaborate with software engineers on implementing a new model deployment. You'll regularly code in Python, experiment with different model architectures, and debug issues in your ML pipeline. Communication with data scientists and software teams is key to ensuring models are both accurate and production-ready.",
    schedule: [
      { time: "9:00 AM", activity: "Review model performance metrics and alerts from production systems" },
      { time: "10:00 AM", activity: "Engineering stand-up meeting to coordinate with software team" },
      { time: "10:30 AM", activity: "Work on optimizing hyperparameters for a recommendation algorithm" },
      { time: "12:30 PM", activity: "Lunch break while reading ML research papers" },
      { time: "1:30 PM", activity: "Collaborate with data scientists to implement a new feature extraction pipeline" },
      { time: "3:00 PM", activity: "Debug deployment issues with DevOps team" },
      { time: "4:30 PM", activity: "Document model architecture and implementation details" }
    ],
    monthInLife: "Over a month, you'll typically be involved in the full ML lifecycle for one or more projects. You might spend the first week researching and experimenting with different approaches, the second week implementing the chosen solution, the third week testing and optimizing the model, and the final week deploying it to production and monitoring its initial performance. Throughout this cycle, you'll collaborate with data scientists on model design, software engineers on integration, and DevOps on deployment strategies.",
    projectTimeline: [
      {
        title: "Research & Design",
        duration: "Week 1-2",
        description: "Research potential ML approaches and design the solution architecture.",
        activities: [
          "Review scientific literature for state-of-the-art approaches",
          "Analyze data requirements and availability",
          "Design model architecture and feature engineering pipeline",
          "Create proof-of-concept implementation to validate approach"
        ]
      },
      {
        title: "Implementation & Training",
        duration: "Week 3-4",
        description: "Implement the selected approach and train models with available data.",
        activities: [
          "Develop data preprocessing pipeline",
          "Implement model architecture in TensorFlow/PyTorch",
          "Train models on cloud infrastructure",
          "Conduct initial evaluations and iterative improvements"
        ]
      },
      {
        title: "Optimization & Testing",
        duration: "Week 5-6",
        description: "Optimize model performance and thoroughly test against requirements.",
        activities: [
          "Tune hyperparameters using systematic approaches",
          "Optimize model for inference speed and resource efficiency",
          "Conduct comprehensive testing across various scenarios",
          "Address edge cases and performance issues"
        ]
      },
      {
        title: "Deployment & Monitoring",
        duration: "Week 7-8",
        description: "Deploy model to production and establish monitoring systems.",
        activities: [
          "Package model for deployment (containerization)",
          "Work with DevOps to deploy to production infrastructure",
          "Implement monitoring dashboards and alerting",
          "Document model behavior, limitations, and maintenance procedures"
        ]
      }
    ],
    careerPath: {
      description: "Machine Learning Engineers can advance their careers by deepening their technical expertise, specializing in specific domains, or moving into more strategic roles that bridge ML and business objectives.",
      progressionSteps: [
        {
          title: "Junior ML Engineer",
          description: "Focus on implementing and testing ML models under guidance, learning the tools and practices of the field.",
          timePeriod: "1-2 years"
        },
        {
          title: "Machine Learning Engineer",
          description: "Take ownership of complete ML systems, from design through deployment, and contribute to architectural decisions.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior ML Engineer",
          description: "Lead ML initiatives, design complex systems, mentor junior engineers, and influence ML strategy and infrastructure decisions.",
          timePeriod: "4-6 years"
        },
        {
          title: "ML Architect / Head of ML Engineering",
          description: "Define technical vision for ML systems, make strategic decisions about ML platforms, and manage teams of ML engineers.",
          timePeriod: "6+ years"
        }
      ]
    },
    courses: [
      {
        id: "ml201",
        title: "Deep Learning Fundamentals",
        description: "Explore neural networks and deep learning architectures."
      },
      {
        id: "mlops301",
        title: "MLOps and Model Deployment",
        description: "Learn to deploy and maintain machine learning models in production."
      }
    ]
  },
  {
    id: "data-engineer",
    title: "Data Engineer",
    category: "Data Engineering",
    shortDescription: "Design and build the infrastructure that powers data-driven organizations.",
    longDescription: "Data Engineers develop and maintain the architecture that enables data generation, storage, access, and analysis. They create robust pipelines that transform raw data into formats data scientists and analysts can use. Their work forms the foundation of data-driven decision making by ensuring that high-quality data is available, accessible, and ready for analysis.",
    responsibilities: [
      "Design and implement data pipelines and ETL processes",
      "Build and optimize databases and data warehouses",
      "Ensure data quality, reliability, and accessibility",
      "Create data models and schemas",
      "Implement data security and governance measures",
      "Collaborate with data scientists and analysts on data needs"
    ],
    tools: ["SQL", "Python", "Apache Spark", "Airflow", "Kafka", "AWS/Azure/GCP", "Docker"],
    skills: ["Database Design", "ETL Development", "Data Modeling", "Cloud Infrastructure", "Performance Tuning"],
    collaborators: ["Data Scientists", "Data Analysts", "Software Engineers", "DevOps Teams", "Business Stakeholders"],
    dayInLife: "A typical day as a Data Engineer involves monitoring data pipelines, troubleshooting issues, and developing new data infrastructure. You might begin by checking the status of overnight batch processes, then move on to designing a new data model for an upcoming project. You'll write code to extract data from various sources, transform it to meet business needs, and load it into data warehouses where it can be analyzed. Regular collaboration with data scientists and analysts helps you understand their needs, while working with DevOps ensures your solutions are scalable and reliable.",
    schedule: [
      { time: "9:00 AM", activity: "Check pipeline monitoring dashboards and fix any failed jobs" },
      { time: "10:00 AM", activity: "Engineering team standup meeting" },
      { time: "10:30 AM", activity: "Develop new ETL process for marketing data integration" },
      { time: "12:30 PM", activity: "Lunch break" },
      { time: "1:30 PM", activity: "Meet with data science team to discuss data requirements for new ML model" },
      { time: "2:30 PM", activity: "Optimize query performance in data warehouse" },
      { time: "4:00 PM", activity: "Document new data schemas and update data dictionary" },
      { time: "5:00 PM", activity: "Plan and schedule tomorrow's pipeline deployments" }
    ],
    monthInLife: "During a typical month, you'll likely juggle several projects at different stages. You might spend one week designing a new data integration solution, another implementing and testing it, and the rest of the month supporting existing systems while planning future improvements. You'll attend architecture review meetings, collaborate with cross-functional teams, and continuously improve data infrastructure. Each month usually brings a mix of planned development work and unexpected troubleshooting that keeps the role dynamic and challenging.",
    projectTimeline: [
      {
        title: "Requirements & Architecture",
        duration: "Week 1",
        description: "Gather requirements and design the data architecture solution.",
        activities: [
          "Meet with stakeholders to understand data needs",
          "Analyze existing data sources and quality",
          "Design data models and pipeline architecture",
          "Create technical specifications document"
        ]
      },
      {
        title: "Infrastructure Setup",
        duration: "Week 2",
        description: "Provision and configure necessary infrastructure components.",
        activities: [
          "Set up cloud resources (compute, storage, networking)",
          "Configure database and data warehouse environments",
          "Implement security and access controls",
          "Establish monitoring and logging systems"
        ]
      },
      {
        title: "Pipeline Development",
        duration: "Week 3-4",
        description: "Develop, test, and deploy data processing pipelines.",
        activities: [
          "Write extraction code for source systems",
          "Implement transformation logic",
          "Develop loading processes for target systems",
          "Create scheduling and orchestration workflows"
        ]
      },
      {
        title: "Testing & Optimization",
        duration: "Week 5",
        description: "Test the solution end-to-end and optimize for performance.",
        activities: [
          "Perform functionality testing with sample data",
          "Conduct performance testing under load",
          "Optimize queries and processing efficiency",
          "Address bottlenecks and failure points"
        ]
      },
      {
        title: "Documentation & Handover",
        duration: "Week 6",
        description: "Document the solution and transition to operational support.",
        activities: [
          "Update data dictionaries and catalogs",
          "Create operational runbooks",
          "Train support teams on monitoring and maintenance",
          "Conduct knowledge transfer sessions"
        ]
      }
    ],
    careerPath: {
      description: "A career in Data Engineering offers growth paths toward specialized technical expertise, architectural leadership, or management of data infrastructure teams.",
      progressionSteps: [
        {
          title: "Junior Data Engineer",
          description: "Learn the fundamentals of databases, ETL processes, and data infrastructure while contributing to established projects under guidance.",
          timePeriod: "1-2 years"
        },
        {
          title: "Data Engineer",
          description: "Design and implement data pipelines independently, make architectural decisions for specific systems, and collaborate across teams.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Data Engineer",
          description: "Lead the design of complex data infrastructure, mentor other engineers, and contribute to data strategy and best practices.",
          timePeriod: "4-6 years"
        },
        {
          title: "Lead Data Engineer / Data Architect",
          description: "Define the overall data architecture for the organization, establish standards and patterns, and guide technical decision-making.",
          timePeriod: "6+ years"
        },
        {
          title: "Director of Data Engineering",
          description: "Manage teams of data engineers, align data infrastructure with business strategy, and oversee budgeting and resource allocation.",
          timePeriod: "8+ years"
        }
      ]
    },
    courses: [
      {
        id: "de101",
        title: "Introduction to Data Engineering",
        description: "Learn the fundamentals of data pipelines and data architecture."
      },
      {
        id: "de201",
        title: "ETL Processes and Tools",
        description: "Build efficient data pipelines using modern ETL tools."
      }
    ]
  },
  {
    id: "bi-analyst",
    title: "Business Intelligence Analyst",
    category: "Business Intelligence",
    shortDescription: "Create visualizations and reports that transform data into actionable business insights.",
    longDescription: "Business Intelligence Analysts specialize in turning complex data into clear, actionable reports and dashboards for business stakeholders. They combine technical skills with business acumen to design intuitive visualizations that help organizations monitor performance, identify trends, and make data-driven decisions. Their work focuses on making data accessible and meaningful to non-technical users.",
    responsibilities: [
      "Design and build interactive dashboards and reports",
      "Translate business requirements into analytical solutions",
      "Identify KPIs and metrics that align with business objectives",
      "Create and maintain data models for reporting",
      "Analyze trends and patterns in business data",
      "Train and support business users on BI tools"
    ],
    tools: ["Tableau", "Power BI", "SQL", "Excel", "Looker", "Data Modeling Tools"],
    skills: ["Data Visualization", "Dashboard Design", "SQL", "Business Acumen", "Stakeholder Management"],
    collaborators: ["Business Executives", "Department Managers", "Data Engineers", "Data Analysts", "IT Teams"],
    dayInLife: "A day in the life of a BI Analyst typically involves a mix of dashboard development, data analysis, and stakeholder engagement. You might start your day updating key reports with fresh data, then meet with the sales team to understand their reporting needs. You'll spend time designing intuitive visualizations, writing SQL queries to retrieve the right data, and ensuring your dashboards perform well. You'll also respond to questions from business users, helping them interpret data and find the insights they need to make decisions.",
    schedule: [
      { time: "9:00 AM", activity: "Check and refresh daily operational dashboards" },
      { time: "9:30 AM", activity: "Address urgent reporting requests from executives" },
      { time: "10:30 AM", activity: "Meet with marketing team to gather requirements for new campaign dashboard" },
      { time: "12:00 PM", activity: "Lunch break" },
      { time: "1:00 PM", activity: "Design and develop visualizations for the new marketing dashboard" },
      { time: "3:00 PM", activity: "Train finance team on how to use their new interactive reports" },
      { time: "4:00 PM", activity: "Troubleshoot data discrepancies in quarterly sales report" },
      { time: "5:00 PM", activity: "Document dashboard updates and plan tomorrow's work" }
    ],
    monthInLife: "Over the course of a month, a BI Analyst typically balances maintaining existing reports with developing new dashboards. You might spend the first week of the month updating standard reports for monthly business reviews, then dedicate two weeks to building a new dashboard for an upcoming product launch. The final week could involve training users on new reports, gathering feedback for improvements, and planning future development. Throughout the month, you'll collaborate with various business units to ensure their reporting needs are met.",
    projectTimeline: [
      {
        title: "Requirements Gathering",
        duration: "Week 1",
        description: "Work with stakeholders to define reporting needs and success criteria.",
        activities: [
          "Interview business users about their decision-making needs",
          "Identify key metrics and KPIs to include",
          "Document dashboard specifications and user stories",
          "Create wireframes or mockups for stakeholder approval"
        ]
      },
      {
        title: "Data Preparation",
        duration: "Week 2",
        description: "Access and prepare the necessary data sources for reporting.",
        activities: [
          "Identify required data sources and assess data quality",
          "Write SQL queries to retrieve relevant data",
          "Create data models or views optimized for reporting",
          "Test data accuracy and completeness"
        ]
      },
      {
        title: "Dashboard Development",
        duration: "Week 3",
        description: "Build interactive visualizations and dashboard components.",
        activities: [
          "Develop core visualizations based on approved designs",
          "Implement filters and interactive elements",
          "Create calculated fields and custom metrics",
          "Optimize dashboard performance"
        ]
      },
      {
        title: "Testing & Deployment",
        duration: "Week 4",
        description: "Test, refine, and deploy the dashboard to end users.",
        activities: [
          "Conduct user acceptance testing with stakeholders",
          "Refine visuals based on feedback",
          "Create documentation and user guides",
          "Deploy to production environment and train users"
        ]
      }
    ],
    careerPath: {
      description: "A career in Business Intelligence offers paths toward specialization in advanced analytics, dashboard design, or management of BI functions.",
      progressionSteps: [
        {
          title: "BI Analyst",
          description: "Focus on building reports and dashboards, writing SQL queries, and interpreting data for business stakeholders.",
          timePeriod: "1-3 years"
        },
        {
          title: "Senior BI Analyst",
          description: "Lead complex dashboard projects, mentor junior analysts, and work closely with leadership on strategic reporting initiatives.",
          timePeriod: "3-5 years"
        },
        {
          title: "BI Developer/Architect",
          description: "Design enterprise BI solutions, establish standards and best practices, and create reusable reporting frameworks.",
          timePeriod: "5-7 years"
        },
        {
          title: "BI Manager",
          description: "Lead a team of BI professionals, align reporting strategy with business objectives, and manage BI platforms and tools.",
          timePeriod: "7+ years"
        }
      ]
    },
    courses: [
      {
        id: "bi101",
        title: "Introduction to Business Intelligence",
        description: "Learn the fundamentals of BI tools and reporting techniques."
      },
      {
        id: "viz101",
        title: "Dashboard Design Fundamentals",
        description: "Create effective dashboards that communicate insights clearly."
      }
    ]
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    category: "AI/ML",
    shortDescription: "Apply advanced analytics and machine learning to solve complex business problems.",
    longDescription: "Data Scientists combine statistics, machine learning, and domain expertise to extract insights and build predictive models from data. They work on complex problems that require sophisticated analytical approaches, turning data into actionable knowledge that drives innovation and strategic decision-making. Their work spans from exploratory analysis to deploying algorithmic solutions that transform business operations.",
    responsibilities: [
      "Design and implement machine learning models",
      "Conduct statistical analysis to test hypotheses",
      "Extract insights from large, complex datasets",
      "Collaborate with stakeholders to define problems",
      "Communicate findings to technical and non-technical audiences",
      "Research and implement new analytical techniques"
    ],
    tools: ["Python", "R", "SQL", "Jupyter", "Scikit-learn", "TensorFlow/PyTorch", "Spark"],
    skills: ["Machine Learning", "Statistical Analysis", "Data Visualization", "Problem Formulation", "Communication"],
    collaborators: ["Business Stakeholders", "Product Managers", "ML Engineers", "Data Engineers", "Analysts"],
    dayInLife: "A typical day for a Data Scientist involves a mix of coding, analysis, and communication. You might start by exploring a new dataset, applying statistical methods to identify patterns, then move on to building and evaluating machine learning models. You'll spend time documenting your approach, visualizing results, and meeting with stakeholders to present findings or refine problem statements. The role requires both deep technical work and the ability to translate complex concepts into business value.",
    schedule: [
      { time: "9:00 AM", activity: "Review project priorities and plan analytical approach" },
      { time: "10:00 AM", activity: "Data exploration and feature engineering in Jupyter notebook" },
      { time: "12:00 PM", activity: "Lunch break while reading recent ML research papers" },
      { time: "1:00 PM", activity: "Develop and test machine learning models" },
      { time: "3:00 PM", activity: "Meet with product team to discuss model results and implications" },
      { time: "4:00 PM", activity: "Document methodology and prepare visualizations for stakeholders" },
      { time: "5:00 PM", activity: "Collaborate with ML engineers on model implementation" }
    ],
    monthInLife: "Over a month, a Data Scientist typically moves through different phases of the data science lifecycle across one or more projects. You might spend one week defining a problem and collecting data, another exploring and preparing that data, and subsequent weeks developing models, evaluating results, and presenting findings. Each project brings unique challenges that require creative problem-solving and close collaboration with different teams. Throughout the month, you'll balance long-term strategic projects with shorter analytical requests.",
    projectTimeline: [
      {
        title: "Problem Definition",
        duration: "Week 1",
        description: "Work with stakeholders to define the problem and success metrics.",
        activities: [
          "Meet with business teams to understand the problem domain",
          "Translate business questions into data science problems",
          "Identify success metrics and evaluation criteria",
          "Create project plan and timeline"
        ]
      },
      {
        title: "Data Collection & Exploration",
        duration: "Week 2",
        description: "Gather relevant data and perform exploratory analysis.",
        activities: [
          "Identify and access required data sources",
          "Perform data quality assessment",
          "Conduct exploratory data analysis",
          "Identify patterns, outliers, and potential features"
        ]
      },
      {
        title: "Feature Engineering & Modeling",
        duration: "Week 3-4",
        description: "Prepare features and develop predictive models.",
        activities: [
          "Create derived features from raw data",
          "Select appropriate algorithms for the problem",
          "Train multiple model candidates",
          "Conduct cross-validation and hyperparameter tuning"
        ]
      },
      {
        title: "Evaluation & Deployment",
        duration: "Week 5-6",
        description: "Evaluate model performance and prepare for deployment.",
        activities: [
          "Assess models against success metrics",
          "Conduct sensitivity analysis and interpretability studies",
          "Document model methodology and limitations",
          "Work with engineering teams on implementation"
        ]
      },
      {
        title: "Communication & Iteration",
        duration: "Week 7-8",
        description: "Present findings and refine the approach based on feedback.",
        activities: [
          "Create visualizations of key insights",
          "Present results to stakeholders",
          "Gather feedback for model improvements",
          "Plan next iteration or project phases"
        ]
      }
    ],
    careerPath: {
      description: "A career in Data Science offers diverse paths for advancement, from specialized technical roles to leadership positions that shape organizational strategy.",
      progressionSteps: [
        {
          title: "Junior Data Scientist",
          description: "Focus on learning core techniques and tools while working on well-defined problems under guidance from senior team members.",
          timePeriod: "1-2 years"
        },
        {
          title: "Data Scientist",
          description: "Work independently on complete data science projects, from problem formulation to solution implementation.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Data Scientist",
          description: "Lead complex, high-impact projects, mentor junior scientists, and influence data strategy and best practices.",
          timePeriod: "4-6 years"
        },
        {
          title: "Principal Data Scientist / AI Research Scientist",
          description: "Drive innovation through novel applications of advanced techniques, publish research, and guide organizational data science strategy.",
          timePeriod: "6+ years"
        },
        {
          title: "Director of Data Science / Chief Data Scientist",
          description: "Lead data science teams, align data initiatives with business strategy, and advocate for data-driven approaches at the executive level.",
          timePeriod: "8+ years"
        }
      ]
    },
    courses: [
      {
        id: "ml101",
        title: "Introduction to Machine Learning",
        description: "Learn the fundamentals of machine learning algorithms and techniques."
      },
      {
        id: "stat101",
        title: "Statistics for Machine Learning",
        description: "Understand the statistical concepts behind machine learning models."
      }
    ]
  },
  // Update remaining roles
  {
    id: "ai-engineer",
    title: "AI Engineer",
    category: "AI/ML",
    shortDescription: "Develop and deploy AI solutions for real-world applications.",
    longDescription: "AI Engineers design, build, and implement AI solutions that address specific business needs. They work at the intersection of software engineering and artificial intelligence, using their expertise in machine learning frameworks, cloud platforms, and software development best practices to create robust AI systems that can be deployed at scale. Their role is crucial in bridging the gap between theoretical AI research and practical applications.",
    responsibilities: [
      "Design and develop AI applications and solutions",
      "Implement and optimize machine learning models for production",
      "Create APIs and services to make AI capabilities accessible",
      "Ensure AI systems are scalable, reliable, and efficient",
      "Collaborate with data scientists to implement their models",
      "Address ethical considerations in AI implementation"
    ],
    tools: ["Python", "TensorFlow/PyTorch", "Docker", "Kubernetes", "Cloud APIs", "Git", "CI/CD pipelines"],
    skills: ["Software Engineering", "Machine Learning", "API Design", "Cloud Computing", "Scalability Planning"],
    collaborators: ["Data Scientists", "Product Managers", "Software Engineers", "DevOps Teams", "Business Stakeholders"],
    dayInLife: "An AI Engineer typically begins their day by checking the performance metrics of deployed AI systems and addressing any immediate issues. They might spend the morning coding new features for an AI application, implementing a recently developed machine learning model, or optimizing existing systems for better performance. After lunch, they could collaborate with data scientists to understand a new model's requirements or meet with product managers to gather specifications for upcoming AI features. The afternoon might involve debugging integration issues, documenting API endpoints, or reviewing code from team members. Throughout the day, they balance technical development with ensuring AI systems are reliable, ethical, and aligned with business objectives.",
    monthInLife: "Over the course of a month, an AI Engineer typically works on multiple phases of AI system development. They might spend a week designing the architecture for a new AI service, followed by two weeks of implementation and integration with existing systems. The final week could involve testing, deployment, and monitoring the solution in production. Throughout the month, they collaborate closely with data scientists to understand model requirements, product teams to align with business needs, and operations teams to ensure smooth deployments. They continuously improve their systems based on performance metrics and user feedback while staying current with the latest AI technologies and best practices.",
    careerPath: {
      description: "AI Engineering offers a dynamic career path with opportunities to grow in technical depth, leadership roles, or specialized domains within artificial intelligence.",
      progressionSteps: [
        {
          title: "Junior AI Engineer",
          description: "Focus on implementing AI components and features under guidance, learning the practical aspects of deploying AI systems.",
          timePeriod: "1-2 years"
        },
        {
          title: "AI Engineer",
          description: "Design and build complete AI systems independently, making architectural decisions and optimizing for performance and reliability.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior AI Engineer",
          description: "Lead the development of complex AI solutions, mentor junior engineers, and contribute to strategic technical decisions.",
          timePeriod: "4-6 years"
        },
        {
          title: "AI Architect / Lead AI Engineer",
          description: "Define the technical vision for AI systems across the organization, establish best practices, and guide teams in implementation.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "ai-consultant",
    title: "AI Consultant",
    category: "AI/ML",
    shortDescription: "Advise organizations on AI strategy, implementation, and optimization.",
    longDescription: "AI Consultants help organizations understand, adopt, and benefit from artificial‑intelligence technologies. They assess business needs, recommend AI solutions, and guide implementation, ensuring initiatives align with strategic goals and deliver measurable value.",
    responsibilities: [
      "Assess organizational readiness for AI adoption",
      "Develop AI strategy aligned with business objectives",
      "Recommend appropriate AI solutions for business challenges",
      "Guide implementation and integration of AI technologies",
      "Advise on ethical considerations and governance",
      "Measure and communicate business impact"
    ],
    tools: ["ML Platforms", "Cloud AI Services", "Data Analysis Tools", "Project‑Mgmt Software", "ROI Frameworks"],
    skills: ["AI/ML Knowledge", "Business Strategy", "Solution Architecture", "Change Management", "Stakeholder Communication"],
    collaborators: ["C‑Suite Executives", "IT Leaders", "Data Teams", "Business Unit Heads", "Technology Partners"],
    dayInLife: "A typical day starts with a client stand‑up to review AI roadmap progress, followed by white‑boarding solution architectures. Mid‑day is spent evaluating vendor tools or proof‑of‑concept metrics, and the afternoon involves drafting ROI analyses and executive briefings. Evenings often include staying current with AI trends or preparing workshop materials.",
    monthInLife: "Week 1 focuses on discovery workshops and readiness assessments. Weeks 2‑3 are dedicated to solution design and pilot builds. Week 4 centers on delivering executive presentations, measuring pilot ROI, and planning next‑phase deployments. Travel or virtual sessions with multiple clients are common.",
    careerPath: {
      description: "AI Consultants can evolve into senior advisory roles or transition into leadership of an AI practice.",
      progressionSteps: [
        { 
          title: "Associate AI Consultant", 
          description: "Support discovery and documentation for AI engagements.", 
          timePeriod: "0‑2 yrs" 
        },
        { 
          title: "AI Consultant", 
          description: "Lead client workshops, design AI roadmaps, oversee pilots.", 
          timePeriod: "2‑4 yrs" 
        },
        { 
          title: "Senior / Principal AI Consultant", 
          description: "Own large portfolios, mentor consultants, drive sales.", 
          timePeriod: "4‑7 yrs" 
        },
        { 
          title: "AI Practice Director / VP of AI Strategy", 
          description: "Set org‑wide AI vision, manage P&L, build partnerships.", 
          timePeriod: "7+ yrs" 
        }
      ]
    }
  },
  {
    id: "ai-test-engineer",
    title: "AI Test Engineer",
    category: "AI/ML",
    shortDescription: "Ensure the quality and reliability of AI models through rigorous testing.",
    longDescription: "AI Test Engineers design automated test frameworks and validation suites for AI systems, verifying accuracy, fairness, robustness, and performance before production deployment.",
    responsibilities: [
      "Design and implement testing frameworks",
      "Automate model validation and regression tests",
      "Evaluate performance vs. benchmarks",
      "Identify and troubleshoot model issues",
      "Document testing procedures and results"
    ],
    tools: ["Python", "PyTest", "CI/CD", "Monitoring Systems", "Bias‑Detection Tools"],
    skills: ["Test Automation", "AI Algorithms", "Performance Analysis", "Quality Assurance", "Problem Solving"],
    collaborators: ["Data Scientists", "MLOps Engineers", "QA Teams", "Product Owners"],
    dayInLife: "Begin by reviewing last night's CI test run, triage failures with the data‑science team, and update test cases for new model versions. Mid‑day involves writing automated scripts for edge‑case validation, and late afternoon is spent generating quality dashboards and discussing improvements in sprint planning.",
    monthInLife: "Sprint 1 creates the test plan for an upcoming model. Sprint 2 builds automation and integrates tests into the pipeline. Sprint 3 stress‑tests scalability and bias. Sprint 4 finalizes reports and signs off for production release.",
    careerPath: {
      description: "AI Test Engineers grow into QA leadership or specialized validation roles.",
      progressionSteps: [
        { 
          title: "QA Analyst (AI)", 
          timePeriod: "0‑2 yrs", 
          description: "Manual test execution, assist in test‑plan creation." 
        },
        { 
          title: "AI Test Engineer", 
          timePeriod: "2‑4 yrs", 
          description: "Own automated test suites, integrate with CI/CD." 
        },
        { 
          title: "QA Lead – AI", 
          timePeriod: "4‑6 yrs", 
          description: "Lead quality strategy across multiple AI projects." 
        },
        { 
          title: "Director of AI Quality Engineering", 
          timePeriod: "6+ yrs", 
          description: "Set org‑wide AI validation standards and governance." 
        }
      ]
    }
  },
  {
    id: "computer-information-research-scientist",
    title: "Computer and Information Research Scientist",
    category: "AI/ML",
    shortDescription: "Innovate new computing technologies with an emphasis on AI and ML.",
    longDescription: "These scientists conduct cutting‑edge research, develop novel algorithms, and push the boundaries of computing, often publishing in top conferences and collaborating with cross‑functional teams to bring research into production.",
    responsibilities: [
      "Identify unsolved computing problems",
      "Design and conduct experiments",
      "Publish research findings",
      "Prototype innovative algorithms",
      "Collaborate with academia and industry"
    ],
    tools: ["Python/C++", "Scientific Libraries", "HPC Clusters", "Version Control", "Research Databases"],
    skills: ["Algorithm Design", "Theoretical CS", "Research Methodology", "Academic Writing", "Mathematical Modeling"],
    collaborators: ["Research Scientists", "Engineers", "University Partners", "Product Teams"],
    dayInLife: "Mornings are spent coding experimental prototypes and analyzing results. Midday often includes reading and annotating recent papers. Afternoons involve team seminars, brainstorming sessions, and mentoring junior researchers. Evenings may be devoted to drafting or revising academic papers.",
    monthInLife: "A quarter typically cycles through literature review and proposal writing (month 1), intensive experimentation (month 2), and publication / patent filing plus tech‑transfer meetings (month 3).",
    careerPath: {
      description: "Paths include academia, industrial research leadership, or advanced technical fellow roles.",
      progressionSteps: [
        { 
          title: "Post‑Doctoral Researcher", 
          timePeriod: "0‑2 yrs", 
          description: "Focus on a niche research area, publish papers." 
        },
        { 
          title: "Research Scientist", 
          timePeriod: "2‑5 yrs", 
          description: "Lead projects, secure grants, mentor interns." 
        },
        { 
          title: "Senior / Staff Scientist", 
          timePeriod: "5‑8 yrs", 
          description: "Drive multi‑year research agendas, influence product strategy." 
        },
        { 
          title: "Principal Scientist / Distinguished Fellow", 
          timePeriod: "8+ yrs", 
          description: "Set research vision, shape industry standards, advise executives." 
        }
      ]
    }
  },
  {
    id: "customer-engineer-data-ai",
    title: "Customer Engineer, Data & AI",
    category: "AI/ML",
    shortDescription: "Guide clients in adopting data and AI solutions through technical expertise.",
    longDescription: "Customer Engineers bridge product capabilities with customer needs, delivering demos, proof‑of‑concepts, and hands‑on guidance to ensure successful AI solution adoption.",
    responsibilities: [
      "Provide technical guidance to customers",
      "Build proof‑of‑concept demos",
      "Troubleshoot implementation issues",
      "Collect product feedback",
      "Deliver technical presentations"
    ],
    tools: ["Cloud Platforms", "AI APIs", "Data Tools", "Demo Environments", "Documentation Systems"],
    skills: ["Solution Architecture", "Technical Communication", "Problem Solving", "Project Management", "Customer Empathy"],
    collaborators: ["Sales Engineers", "Product Managers", "Data Engineers", "Client Stakeholders"],
    dayInLife: "Begin with a customer sync to review deployment blockers. Mid‑morning spent coding a POC in a sandbox environment. Afternoon dedicated to troubleshooting, followed by a debrief with the product team and creating knowledge‑base articles.",
    monthInLife: "Early month focuses on onboarding new customers; mid‑month on scaling pilots; end‑month on success metrics, case‑study creation, and internal enablement sessions.",
    careerPath: {
      description: "Progression leads to senior solution roles or customer‑engineering leadership.",
      progressionSteps: [
        { 
          title: "Associate Customer Engineer", 
          timePeriod: "0‑2 yrs", 
          description: "Support demos, assist with troubleshooting." 
        },
        { 
          title: "Customer Engineer", 
          timePeriod: "2‑4 yrs", 
          description: "Own client engagements and POCs." 
        },
        { 
          title: "Senior / Lead Customer Engineer", 
          timePeriod: "4‑6 yrs", 
          description: "Handle strategic accounts, mentor juniors." 
        },
        { 
          title: "Solutions Architect / Field CTO", 
          timePeriod: "6+ yrs", 
          description: "Shape product roadmap with customer insights, lead technical strategy." 
        }
      ]
    }
  },
  {
    id: "decision-scientist",
    title: "Decision Scientist",
    category: "AI/ML",
    shortDescription: "Integrate data insights into strategic decision‑making frameworks.",
    longDescription: "Decision Scientists combine statistical modeling, predictive analytics, and business acumen to quantify trade‑offs and guide leadership toward data‑driven decisions.",
    responsibilities: [
      "Develop decision frameworks",
      "Model scenarios and outcomes",
      "Quantify risk and ROI",
      "Collaborate with executives",
      "Translate analysis into recommendations"
    ],
    tools: ["Python/R", "Decision Trees", "Monte Carlo Simulation", "Optimization Libraries", "Dashboard Tools"],
    skills: ["Statistical Modeling", "Business Strategy", "Communication", "Critical Thinking", "Executive Storytelling"],
    collaborators: ["Executives", "Product Strategists", "Finance Teams", "Data Analysts"],
    dayInLife: "Start by reviewing key metrics and running overnight simulations. Mid‑morning involves meetings with leadership to refine decision hypotheses. Afternoon is spent coding scenario analyses and preparing slides that translate complex findings into strategic options.",
    monthInLife: "Week 1: define strategic questions and data needs. Weeks 2‑3: build and validate decision models. Week 4: deliver recommendations, facilitate workshops, and update frameworks for next cycle.",
    careerPath: {
      description: "Decision Scientists can ascend to strategic leadership roles in data or corporate strategy.",
      progressionSteps: [
        { 
          title: "Decision Analyst", 
          timePeriod: "0‑2 yrs", 
          description: "Support data collection and basic scenario modeling." 
        },
        { 
          title: "Decision Scientist", 
          timePeriod: "2‑4 yrs", 
          description: "Own frameworks, collaborate with senior leaders." 
        },
        { 
          title: "Senior Decision Scientist", 
          timePeriod: "4‑6 yrs", 
          description: "Drive high‑impact strategy projects, mentor team." 
        },
        { 
          title: "Head of Decision Science / VP Strategy", 
          timePeriod: "6+ yrs", 
          description: "Lead org‑wide decision science, influence C‑suite direction." 
        }
      ]
    }
  },
  {
    id: "generative-ai-scientist",
    title: "Generative AI Scientist",
    category: "AI/ML",
    shortDescription: "Develop advanced models that create new content (text, images, audio).",
    longDescription: "Generative AI Scientists research and build models such as transformers, diffusion networks, and GANs, pushing the envelope of content creation and creative AI applications.",
    responsibilities: [
      "Research generative architectures",
      "Train large‑scale models",
      "Optimize for quality and efficiency",
      "Address ethical and bias concerns",
      "Publish and present findings"
    ],
    tools: ["PyTorch/TensorFlow", "Transformers", "GAN Frameworks", "GPU Clusters", "MLOps Pipelines"],
    skills: ["Deep Learning", "NLP/CV", "Model Optimization", "Research", "Ethical AI"],
    collaborators: ["Research Scientists", "Product Teams", "Ethics Boards", "ML Engineers"],
    dayInLife: "Morning GPU job monitoring and loss‑curve checks, followed by literature review of the latest arXiv papers. Afternoon spent experimenting with model architectures, hyper‑parameter tuning, and qualitative sample evaluation. Evening includes documenting results and open‑sourcing code.",
    monthInLife: "Cycle: research sprint (mo 1), large‑scale training & evaluation (mo 2), and deployment or conference submission (mo 3).",
    careerPath: {
      description: "Paths include principal scientist roles or research‑lead positions in cutting‑edge labs.",
      progressionSteps: [
        { 
          title: "Research Engineer", 
          timePeriod: "0‑3 yrs", 
          description: "Implement models, run experiments." 
        },
        { 
          title: "Generative AI Scientist", 
          timePeriod: "3‑6 yrs", 
          description: "Own research agenda, publish papers." 
        },
        { 
          title: "Senior / Staff Scientist", 
          timePeriod: "6‑9 yrs", 
          description: "Lead multi‑model research teams, set technical vision." 
        },
        { 
          title: "Director of Generative AI Research", 
          timePeriod: "9+ yrs", 
          description: "Head research lab, shape industry standards." 
        }
      ]
    }
  },
  {
    id: "insights-analyst",
    title: "Insights Analyst",
    category: "AI/ML, Analytics",
    shortDescription: "Distill raw data into actionable business insights and visualizations.",
    longDescription: "Insights Analysts transform complex datasets into clear recommendations that guide business strategy. They specialize in KPI tracking, visualization, and storytelling for non‑technical stakeholders.",
    responsibilities: [
      "Extract patterns from datasets",
      "Build dashboards & reports",
      "Track KPIs and performance metrics",
      "Provide actionable recommendations",
      "Communicate insights clearly"
    ],
    tools: ["SQL", "Excel", "Tableau/Power BI", "Python/R", "Visualization Libraries"],
    skills: ["Data Analysis", "Business Acumen", "Visualization", "Critical Thinking", "Communication"],
    collaborators: ["Product Managers", "Marketing Teams", "Finance", "Data Engineers"],
    dayInLife: "Kick off by refreshing dashboards, then dive into SQL to answer ad‑hoc questions. Midday involves meeting stakeholders to understand context, followed by building visuals and writing a concise insights memo.",
    monthInLife: "Week 1 KPI refresh; week 2 deep‑dive analysis; week 3 present findings; week 4 iterate dashboards and plan next cycle.",
    careerPath: {
      description: "Insight Analysts can specialize in advanced analytics or progress into leadership.",
      progressionSteps: [
        { 
          title: "Reporting Analyst", 
          timePeriod: "0‑2 yrs", 
          description: "Maintain standard reports." 
        },
        { 
          title: "Insights Analyst", 
          timePeriod: "2‑4 yrs", 
          description: "Deliver strategic insights and data stories." 
        },
        { 
          title: "Senior Insights Analyst", 
          timePeriod: "4‑6 yrs", 
          description: "Lead analytics projects, mentor analysts." 
        },
        { 
          title: "Insights Manager / Director of Business Insights", 
          timePeriod: "6+ yrs", 
          description: "Oversee org‑wide insights strategy." 
        }
      ]
    }
  },
  {
    id: "mlops-engineer",
    title: "MLOps Engineer",
    category: "AI/ML",
    shortDescription: "Deploy and monitor machine‑learning models in production at scale.",
    longDescription: "MLOps Engineers combine DevOps and ML expertise to build pipelines, automate testing, and ensure reliable, cost‑efficient model operations.",
    responsibilities: [
      "Design CI/CD pipelines for ML",
      "Automate testing & validation",
      "Monitor model performance",
      "Manage ML infrastructure",
      "Collaborate with DS & Eng teams"
    ],
    tools: ["Docker", "Kubernetes", "MLflow", "CI/CD", "Cloud Platforms"],
    skills: ["DevOps", "Automation", "System Design", "Machine Learning", "Monitoring"],
    collaborators: ["Data Scientists", "Platform Engineers", "SREs", "Product Teams"],
    dayInLife: "Morning pipeline status check; update deployment scripts; mid‑day infra stand‑up; afternoon containerize new model and deploy; finish with monitoring dashboard tweaks and cost review.",
    monthInLife: "Sprint 1 pipeline build, sprint 2 testing automation, sprint 3 monitoring rollout, sprint 4 cost & performance tuning.",
    careerPath: {
      description: "Growth leads to platform leadership or specialized ML infrastructure roles.",
      progressionSteps: [
        { 
          title: "DevOps / Data Engineer", 
          timePeriod: "0‑2 yrs", 
          description: "Support pipelines and infra." 
        },
        { 
          title: "MLOps Engineer", 
          timePeriod: "2‑4 yrs", 
          description: "Own deployment workflows." 
        },
        { 
          title: "Senior / Lead MLOps Engineer", 
          timePeriod: "4‑6 yrs", 
          description: "Architect enterprise ML platforms." 
        },
        { 
          title: "Platform Engineering Manager / Principal MLOps", 
          timePeriod: "6+ yrs", 
          description: "Drive org‑wide ML platform strategy." 
        }
      ]
    }
  },
  {
    id: "private-equity-analyst",
    title: "Private Equity Analyst",
    category: "AI/ML, Analytics",
    shortDescription: "Analyze investment opportunities using financial and market data.",
    longDescription: "Private Equity Analysts evaluate potential investments by building financial models, conducting market research, and supporting due‑diligence processes.",
    responsibilities: [
      "Analyze financial statements",
      "Build LBO / valuation models",
      "Conduct market research",
      "Support due diligence",
      "Prepare investment memos"
    ],
    tools: ["Excel", "Financial Modeling Software", "Data Tools", "CRM", "Research Databases"],
    skills: ["Financial Analysis", "Valuation", "Market Research", "Presentation", "Data Interpretation"],
    collaborators: ["Deal Teams", "Portfolio Managers", "Industry Experts", "Legal Advisors"],
    dayInLife: "Start with industry news review, update financial models, attend management calls, and prepare slides for investment committee. Afternoon focuses on market sizing and sensitivity analysis.",
    monthInLife: "Weeks 1‑2 sourcing & screening, weeks 3‑4 deep diligence & modeling, end‑month committee presentations.",
    careerPath: {
      description: "Path leads into deal leadership or portfolio strategy roles.",
      progressionSteps: [
        { 
          title: "PE Analyst", 
          timePeriod: "0‑2 yrs", 
          description: "Support modeling and research." 
        },
        { 
          title: "Associate", 
          timePeriod: "2‑4 yrs", 
          description: "Own portions of diligence and deal execution." 
        },
        { 
          title: "Vice President", 
          timePeriod: "4‑7 yrs", 
          description: "Lead deals, manage analysts." 
        },
        { 
          title: "Principal / Partner", 
          timePeriod: "7+ yrs", 
          description: "Source deals, set fund strategy." 
        }
      ]
    }
  },
  {
    id: "product-insights-analyst",
    title: "Product or Product Insights Analyst",
    category: "AI/ML, Analytics",
    shortDescription: "Analyze product usage to inform development and growth strategies.",
    longDescription: "Product Insights Analysts leverage data to understand user behavior, design A/B tests, and guide product teams toward data‑driven decisions.",
    responsibilities: [
      "Track product usage metrics",
      "Design and analyze A/B tests",
      "Identify opportunities for product improvement",
      "Collaborate with PMs on data‑driven changes",
      "Build dashboards to monitor product health"
    ],
    tools: ["SQL", "Google Analytics", "A/B Platforms", "BI Tools", "Product Analytics Suites"],
    skills: ["Data Analysis", "Experiment Design", "Product Thinking", "Communication", "Visualization"],
    collaborators: ["Product Managers", "UX Researchers", "Engineers", "Marketing"],
    dayInLife: "Morning metric review, design or analyze A/B tests, sync with PMs, build quick dashboards, and summarize insights in Slack or Confluence.",
    monthInLife: "Sprint cadence: instrumentation planning, experiment launch, mid‑sprint analysis, end‑sprint retrospective and recommendations.",
    careerPath: {
      description: "Growth into analytics leadership or product management.",
      progressionSteps: [
        { 
          title: "Product Data Analyst", 
          timePeriod: "0‑2 yrs", 
          description: "Maintain product metrics." 
        },
        { 
          title: "Product Insights Analyst", 
          timePeriod: "2‑4 yrs", 
          description: "Drive experimentation and insights." 
        },
        { 
          title: "Senior Insights Analyst / Analytics PM", 
          timePeriod: "4‑6 yrs", 
          description: "Lead product data strategy." 
        },
        { 
          title: "Director of Product Analytics", 
          timePeriod: "6+ yrs", 
          description: "Manage analytics teams, shape product direction." 
        }
      ]
    }
  },
  {
    id: "qa-engineer-ai",
    title: "Quality Assurance Engineer, AI",
    category: "AI/ML",
    shortDescription: "Validate AI models for accuracy, fairness, and robustness.",
    longDescription: "QA Engineers for AI ensure that machine‑learning systems meet performance and ethical standards before deployment.",
    responsibilities: [
      "Develop AI test strategies",
      "Automate validation tests",
      "Assess bias and fairness",
      "Document quality metrics",
      "Collaborate on model improvements"
    ],
    tools: ["Test Frameworks", "Bias Tools", "CI/CD", "Monitoring", "Documentation Systems"],
    skills: ["QA Methodology", "AI Ethics", "Programming", "Analytical Thinking", "Automation"],
    collaborators: ["Data Scientists", "MLOps", "Product Owners", "Compliance Teams"],
    dayInLife: "Review previous test run, design new edge‑case tests, pair with DS to debug, update quality dashboards, document findings.",
    monthInLife: "Week 1 write test plan, weeks 2‑3 automate & execute, week 4 finalize QA report and sign‑off.",
    careerPath: {
      description: "Leads to QA leadership or AI compliance roles.",
      progressionSteps: [
        { 
          title: "QA Analyst (AI)", 
          timePeriod: "0‑2 yrs", 
          description: "Execute manual tests." 
        },
        { 
          title: "QA Engineer, AI", 
          timePeriod: "2‑4 yrs", 
          description: "Automate and lead test suites." 
        },
        { 
          title: "QA Lead – AI", 
          timePeriod: "4‑6 yrs", 
          description: "Own QA strategy across AI products." 
        },
        { 
          title: "Director of AI QA & Compliance", 
          timePeriod: "6+ yrs", 
          description: "Set org‑wide QA governance and standards." 
        }
      ]
    }
  },
  {
    id: "research-scientist",
    title: "Research Scientist/Applied Research Scientist",
    category: "AI/ML",
    shortDescription: "Conduct advanced research and apply findings to real‑world AI problems.",
    longDescription: "Research Scientists design experiments, develop new algorithms, and bridge the gap between academic breakthroughs and product innovations.",
    responsibilities: [
      "Design and conduct research",
      "Publish in top conferences",
      "Prototype algorithms",
      "Collaborate with engineering",
      "Mentor interns and juniors"
    ],
    tools: ["Python/R", "ML Libraries", "Research Tools", "HPC", "Version Control"],
    skills: ["Research Methods", "Machine Learning", "Math", "Scientific Writing", "Critical Thinking"],
    collaborators: ["Academic Partners", "Product Teams", "Data Engineers", "PMs"],
    dayInLife: "Morning experiment checks, literature reading, coding new prototypes, lunch seminar, afternoon data analysis, wrap up with paper drafting.",
    monthInLife: "Cycle: hypothesis & design, experimentation, analysis, publication & tech transfer.",
    careerPath: {
      description: "Progress to senior research leadership or advanced fellow roles.",
      progressionSteps: [
        { 
          title: "Research Engineer", 
          timePeriod: "0‑2 yrs", 
          description: "Implement experiments." 
        },
        { 
          title: "Research Scientist", 
          timePeriod: "2‑5 yrs", 
          description: "Lead research projects." 
        },
        { 
          title: "Senior / Staff Scientist", 
          timePeriod: "5‑8 yrs", 
          description: "Guide multi‑project research." 
        },
        { 
          title: "Principal Scientist / Research Director", 
          timePeriod: "8+ yrs", 
          description: "Set research vision, manage labs." 
        }
      ]
    }
  },
  {
    id: "solution-engineer-data-ai",
    title: "Solution Engineer, Data & AI",
    category: "Analytics",
    shortDescription: "Design and present tailored data & AI solutions to clients.",
    longDescription: "Solution Engineers combine deep technical knowledge with client‑facing skills to architect and demo AI/ML solutions that solve specific business problems.",
    responsibilities: [
      "Design technical solutions",
      "Build proof‑of‑concepts",
      "Present solutions to clients",
      "Collaborate on delivery",
      "Stay current on technology"
    ],
    tools: ["Cloud Platforms", "AI APIs", "Integration Tools", "Presentation Software", "CRM"],
    skills: ["Solution Architecture", "Technical Sales", "Communication", "Project Planning", "AI/ML Knowledge"],
    collaborators: ["Sales Teams", "Product Teams", "Implementation Partners", "Client IT"],
    dayInLife: "Morning client demo, mid‑day architecture diagramming, afternoon POC coding, late‑day internal debrief and documentation.",
    monthInLife: "Discovery & scoping (wk 1), POC build (wk 2‑3), technical validation & hand‑off (wk 4).",
    careerPath: {
      description: "Leads into solution architecture leadership or product roles.",
      progressionSteps: [
        { 
          title: "Associate Solution Engineer", 
          timePeriod: "0‑2 yrs", 
          description: "Support demos and solution design." 
        },
        { 
          title: "Solution Engineer", 
          timePeriod: "2‑4 yrs", 
          description: "Own client solutions end‑to‑end." 
        },
        { 
          title: "Senior Solution Engineer / Solutions Architect", 
          timePeriod: "4‑6 yrs", 
          description: "Lead complex deals and mentor team." 
        },
        { 
          title: "Director of Solutions Engineering", 
          timePeriod: "6+ yrs", 
          description: "Manage solution teams, set technical pre‑sales strategy." 
        }
      ]
    }
  },
  {
    id: "cloud-data-engineer",
    title: "Cloud Data Engineer",
    category: "Data Engineering",
    shortDescription: "Build scalable data pipelines on cloud platforms for analytics and AI.",
    longDescription: "Cloud Data Engineers design, implement, and optimize data architectures and ETL processes in cloud environments.",
    responsibilities: [
      "Design cloud data architectures",
      "Build ETL pipelines",
      "Optimize cost & performance",
      "Implement security & compliance",
      "Migrate on‑prem data to cloud"
    ],
    tools: ["AWS/Azure/GCP", "BigQuery/Redshift", "Spark", "Terraform", "Serverless"],
    skills: ["Cloud Architecture", "Data Engineering", "ETL Design", "Cost Optimization", "Security"],
    collaborators: ["Data Engineers", "Data Scientists", "DevOps", "Security Teams"],
    dayInLife: "Morning stand‑up, Terraform updates, Spark job tuning, lunch design review, afternoon data migration tasks, finish with IAM policy checks.",
    monthInLife: "Week 1 architecture design, weeks 2‑3 pipeline build, week 4 performance tuning & documentation.",
    careerPath: {
      description: "Leads into cloud data architecture or platform engineering leadership.",
      progressionSteps: [
        { 
          title: "Junior Data Engineer", 
          timePeriod: "0‑2 yrs", 
          description: "Build basic pipelines." 
        },
        { 
          title: "Cloud Data Engineer", 
          timePeriod: "2‑4 yrs", 
          description: "Own cloud data workflows." 
        },
        { 
          title: "Senior / Lead Cloud Data Engineer", 
          timePeriod: "4‑6 yrs", 
          description: "Architect enterprise data platforms." 
        },
        { 
          title: "Principal Data Engineer / Cloud Data Architect", 
          timePeriod: "6+ yrs", 
          description: "Set cloud data strategy and best practices." 
        }
      ]
    }
  },
  {
    id: "data-governance-analyst",
    title: "Data Governance Analyst",
    category: "Analytics",
    shortDescription: "Implement policies and practices to ensure data quality, compliance, and security.",
    longDescription: "Data Governance Analysts develop standards, monitor compliance, and drive data quality across the organization.",
    responsibilities: [
      "Develop governance policies",
      "Monitor compliance",
      "Establish data quality metrics",
      "Create data catalogs",
      "Train staff on governance"
    ],
    tools: ["Data Catalogs", "Compliance Software", "Metadata Tools", "Documentation", "Training Platforms"],
    skills: ["Data Management", "Regulatory Knowledge", "Policy Development", "Communication", "Risk Assessment"],
    collaborators: ["Compliance Teams", "Data Stewards", "Security", "IT"],
    dayInLife: "Morning data‑quality checks, policy drafting, compliance meeting, catalog update, afternoon stewardship workshop.",
    monthInLife: "Policy rollout (mo 1), metric tracking (mo 2), audit prep & training (mo 3).",
    careerPath: {
      description: "Progress into data governance leadership or CDO‑track roles.",
      progressionSteps: [
        { 
          title: "Data Steward", 
          timePeriod: "0‑2 yrs", 
          description: "Maintain data definitions." 
        },
        { 
          title: "Data Governance Analyst", 
          timePeriod: "2‑4 yrs", 
          description: "Implement policies and metrics." 
        },
        { 
          title: "Senior DG Analyst / DG Manager", 
          timePeriod: "4‑6 yrs", 
          description: "Lead governance programs." 
        },
        { 
          title: "Director of Data Governance / CDO", 
          timePeriod: "6+ yrs", 
          description: "Own enterprise data governance strategy." 
        }
      ]
    }
  },
  {
    id: "data-visualization-specialist",
    title: "Data Visualization Specialist",
    category: "Business Intelligence",
    shortDescription: "Create compelling visual stories that make complex data accessible.",
    longDescription: "Data Viz Specialists design dashboards and visualizations using best‑practice design and storytelling principles to drive data‑informed decisions.",
    responsibilities: [
      "Design visualizations & dashboards",
      "Translate data into stories",
      "Apply design principles",
      "Gather stakeholder requirements",
      "Stay current with viz trends"
    ],
    tools: ["Tableau", "Power BI", "D3.js", "Design Software", "Color Tools"],
    skills: ["Visual Design", "Storytelling", "UX", "Data Analysis", "Communication"],
    collaborators: ["BI Teams", "Product Owners", "Marketing", "Executives"],
    dayInLife: "Sketch dashboard wireframes, build visuals in Tableau, meet stakeholders, iterate design, publish updates.",
    monthInLife: "Requirements gathering, prototyping, production build, training & style‑guide update.",
    careerPath: {
      description: "Can specialize in advanced viz or lead BI storytelling teams.",
      progressionSteps: [
        { 
          title: "BI Developer", 
          timePeriod: "0‑2 yrs", 
          description: "Build basic dashboards." 
        },
        { 
          title: "Data Viz Specialist", 
          timePeriod: "2‑4 yrs", 
          description: "Own visualization projects." 
        },
        { 
          title: "Senior Viz / Storytelling Lead", 
          timePeriod: "4‑6 yrs", 
          description: "Set viz standards, mentor team." 
        },
        { 
          title: "Director of Data Storytelling", 
          timePeriod: "6+ yrs", 
          description: "Drive enterprise‑wide data storytelling strategy." 
        }
      ]
    }
  },
  {
    id: "data-metrics-analyst",
    title: "Data and Metrics Analyst",
    category: "Analytics",
    shortDescription: "Design and track metrics to measure business performance.",
    longDescription: "Metrics Analysts define KPIs, build dashboards, and analyze trends to drive continuous improvement across the organization.",
    responsibilities: [
      "Define KPIs",
      "Build performance dashboards",
      "Analyze metric trends",
      "Report to stakeholders",
      "Recommend improvements"
    ],
    tools: ["BI Tools", "SQL", "Excel", "Stat Software", "Viz Tools"],
    skills: ["Metric Design", "Analysis", "Business Acumen", "Reporting", "Critical Thinking"],
    collaborators: ["Finance", "Operations", "Product", "Leadership"],
    dayInLife: "Morning KPI check, SQL query refinement, dashboard update, meeting with finance, insights memo drafting.",
    monthInLife: "Metric discovery, dashboard development, validation & rollout, impact review.",
    careerPath: {
      description: "Can move into analytics strategy or operations leadership.",
      progressionSteps: [
        { 
          title: "Reporting Analyst", 
          timePeriod: "0‑2 yrs", 
          description: "Maintain metrics." 
        },
        { 
          title: "Metrics Analyst", 
          timePeriod: "2‑4 yrs", 
          description: "Design new KPIs, analyze trends." 
        },
        { 
          title: "Senior Metrics Analyst", 
          timePeriod: "4‑6 yrs", 
          description: "Lead metric strategy, mentor analysts." 
        },
        { 
          title: "Analytics Strategy Manager", 
          timePeriod: "6+ yrs", 
          description: "Drive org‑wide performance measurement." 
        }
      ]
    }
  },
  {
    id: "information-architect",
    title: "Information Architect",
    category: "Business Intelligence",
    shortDescription: "Design information systems and data models for usability and scalability.",
    longDescription: "Information Architects create data models, taxonomies, and metadata frameworks that ensure information is structured for accessibility and growth.",
    responsibilities: [
      "Design data models & schemas",
      "Develop metadata frameworks",
      "Ensure usability & scalability",
      "Collaborate on enterprise architecture",
      "Document standards"
    ],
    tools: ["Modeling Tools", "DB Design Software", "Taxonomy Systems", "Documentation Platforms"],
    skills: ["Information Design", "Data Modeling", "Systems Thinking", "UX", "Communication"],
    collaborators: ["Enterprise Architects", "DBAs", "Developers", "UX Designers"],
    dayInLife: "Create ER diagrams, review taxonomy with UX, document metadata, consult on new app schemas, attend architecture board.",
    monthInLife: "Discovery & audit, modeling & taxonomy design, implementation guidance, governance hand‑off.",
    careerPath: {
      description: "Leads to enterprise architecture or chief data architect roles.",
      progressionSteps: [
        { 
          title: "Data Modeler", 
          timePeriod: "0‑2 yrs", 
          description: "Build logical data models." 
        },
        { 
          title: "Information Architect", 
          timePeriod: "2‑4 yrs", 
          description: "Design enterprise info structures." 
        },
        { 
          title: "Senior / Enterprise Information Architect", 
          timePeriod: "4‑6 yrs", 
          description: "Set data standards org‑wide." 
        },
        { 
          title: "Chief Data Architect", 
          timePeriod: "6+ yrs", 
          description: "Own enterprise data architecture vision." 
        }
      ]
    }
  },
  {
    id: "intelligence-analyst",
    title: "Intelligence Analyst",
    category: "Business Intelligence",
    shortDescription: "Provide actionable intelligence by analyzing diverse data sources.",
    longDescription: "Intelligence Analysts collect, interpret, and present data to identify risks, opportunities, and strategic insights in security, defense, or business contexts.",
    responsibilities: [
      "Collect and analyze data",
      "Identify patterns and trends",
      "Produce intelligence reports",
      "Assess risks and opportunities",
      "Present findings"
    ],
    tools: ["Analysis Software", "Viz Tools", "Intel Platforms", "Research DBs", "Reporting Systems"],
    skills: ["Analytical Thinking", "Research", "Domain Expertise", "Communication", "Critical Evaluation"],
    collaborators: ["Security Teams", "Executives", "Analysts", "Policy Makers"],
    dayInLife: "Gather OSINT feeds, run pattern analysis, draft threat brief, present to stakeholders, archive findings.",
    monthInLife: "Collection plan setup, deep‑dive analysis, report cycle, post‑action review.",
    careerPath: {
      description: "Path to intelligence leadership or strategic risk roles.",
      progressionSteps: [
        { 
          title: "Junior Intelligence Analyst", 
          timePeriod: "0‑2 yrs", 
          description: "Assist in data collection and basic analysis." 
        },
        { 
          title: "Intelligence Analyst", 
          timePeriod: "2‑4 yrs", 
          description: "Own analytical reports." 
        },
        { 
          title: "Senior Intelligence Analyst", 
          timePeriod: "4‑6 yrs", 
          description: "Lead intel projects, mentor team." 
        },
        { 
          title: "Director of Intelligence / Chief Intelligence Officer", 
          timePeriod: "6+ yrs", 
          description: "Set intelligence strategy and operations." 
        }
      ]
    }
  },
  {
    id: "mdm-analyst",
    title: "Master Data Management (MDM) Analyst",
    category: "Analytics",
    shortDescription: "Ensure master‑data consistency and quality across systems.",
    longDescription: "MDM Analysts define and enforce standards to keep master data accurate and synchronized, supporting enterprise analytics and operations.",
    responsibilities: [
      "Maintain master‑data standards",
      "Ensure data consistency",
      "Implement data‑quality processes",
      "Resolve data discrepancies",
      "Support integration initiatives"
    ],
    tools: ["MDM Platforms", "Data‑Quality Tools", "ETL", "Profiling Tools", "Metadata Repos"],
    skills: ["Data Management", "Data Modeling", "Data Quality", "Process Design", "Problem Solving"],
    collaborators: ["Data Stewards", "ETL Teams", "Business Units", "Governance"],
    dayInLife: "Run duplicate‑record report, resolve conflicts, update MDM rules, sync with ETL, document quality metrics.",
    monthInLife: "Data profiling & rule design, golden‑record implementation, monitoring & stewardship training.",
    careerPath: {
      description: "Move into data‑quality leadership or enterprise MDM architecture.",
      progressionSteps: [
        { 
          title: "Data Steward", 
          timePeriod: "0‑2 yrs", 
          description: "Manage data definitions." 
        },
        { 
          title: "MDM Analyst", 
          timePeriod: "2‑4 yrs", 
          description: "Implement MDM processes." 
        },
        { 
          title: "Senior MDM Analyst / MDM Lead", 
          timePeriod: "4‑6 yrs", 
          description: "Oversee enterprise MDM initiatives." 
        },
        { 
          title: "Master Data Manager / MDM Architect", 
          timePeriod: "6+ yrs", 
          description: "Set master‑data strategy and architecture." 
        }
      ]
    }
  },
  {
    id: "sql-developer",
    title: "SQL Developer",
    category: "Data Engineering",
    shortDescription: "Design and optimize relational databases and SQL queries.",
    longDescription: "SQL Developers create and maintain database schemas, optimize queries, and support data analysis needs across the business.",
    responsibilities: [
      "Design database schemas",
      "Write and optimize SQL",
      "Develop stored procedures",
      "Troubleshoot performance issues",
      "Support reporting"
    ],
    tools: ["SQL", "DBMS", "Query Optimizers", "Version Control", "Modeling Tools"],
    skills: ["SQL Programming", "DB Design", "Performance Tuning", "Troubleshooting", "Data Modeling"],
    collaborators: ["Data Engineers", "BI Analysts", "Developers", "DBAs"],
    dayInLife: "Write stored procedures, tune slow queries, collaborate on schema changes, deploy migrations, verify backups.",
    monthInLife: "Requirement intake, query dev, QA & performance testing, release & monitoring.",
    careerPath: {
      description: "Progress to database engineering or data‑platform leadership.",
      progressionSteps: [
        { 
          title: "Junior SQL Developer", 
          timePeriod: "0‑2 yrs", 
          description: "Develop queries and reports." 
        },
        { 
          title: "SQL Developer", 
          timePeriod: "2‑4 yrs", 
          description: "Optimize and manage databases." 
        },
        { 
          title: "Senior SQL Developer / Database Engineer", 
          timePeriod: "4‑6 yrs", 
          description: "Architect DB solutions, mentor team." 
        },
        { 
          title: "Database Architect / Data Platform Lead", 
          timePeriod: "6+ yrs", 
          description: "Set enterprise data‑platform strategy." 
        }
      ]
    }
  },
  {
    id: "ai-governance-officer",
    title: "AI Governance Officer",
    category: "Business Intelligence",
    shortDescription: "Ensure AI systems align with ethical guidelines and regulations.",
    longDescription: "AI Governance Officers create frameworks, policies, and risk‑mitigation strategies to guide responsible AI deployment.",
    responsibilities: [
      "Develop governance frameworks",
      "Ensure regulatory compliance",
      "Assess ethical considerations",
      "Mitigate AI risks",
      "Educate stakeholders"
    ],
    tools: ["Risk Frameworks", "Policy Management", "Compliance Software", "Documentation", "Training Tools"],
    skills: ["AI Ethics", "Risk Management", "Policy Development", "Compliance", "Stakeholder Management"],
    collaborators: ["Legal", "Compliance", "Data Teams", "Executives"],
    dayInLife: "Review new AI project proposals, perform risk assessment, update governance policy, brief executives, conduct compliance training.",
    monthInLife: "Policy development, tool rollout, audit & reporting, stakeholder training.",
    careerPath: {
      description: "Leads to executive roles in responsible AI or risk management.",
      progressionSteps: [
        { 
          title: "Policy Analyst", 
          timePeriod: "0‑2 yrs", 
          description: "Support policy research." 
        },
        { 
          title: "AI Governance Officer", 
          timePeriod: "2‑4 yrs", 
          description: "Own governance frameworks." 
        },
        { 
          title: "Senior Governance Lead", 
          timePeriod: "4‑6 yrs", 
          description: "Manage org‑wide AI risk." 
        },
        { 
          title: "Head of Responsible AI / VP AI Compliance", 
          timePeriod: "6+ yrs", 
          description: "Oversee global AI risk & compliance strategy." 
        }
      ]
    }
  },
  {
    id: "cloud-engineer",
    title: "Cloud Engineer",
    category: "Data Engineering",
    shortDescription: "Deploy, manage, and optimize cloud infrastructure.",
    longDescription: "Cloud Engineers architect and automate cloud solutions, ensuring scalability, security, and cost efficiency.",
    responsibilities: [
      "Design cloud infrastructure",
      "Automate deployments",
      "Optimize cost & performance",
      "Implement security best practices",
      "Troubleshoot issues"
    ],
    tools: ["AWS/Azure/GCP", "IaC Tools", "CI/CD", "Monitoring", "Security Tools"],
    skills: ["Cloud Architecture", "Automation", "Networking", "Security", "Cost Optimization"],
    collaborators: ["DevOps", "Security Teams", "Developers", "Product"],
    dayInLife: "Deploy infrastructure via IaC, optimize autoscaling, patch security groups, review costs, incident post‑mortem.",
    monthInLife: "Architecture design, deployment, monitoring/tuning, disaster‑recovery testing.",
    careerPath: {
      description: "Growth into cloud architecture or principal engineering roles.",
      progressionSteps: [
        { 
          title: "Cloud Engineer", 
          timePeriod: "0‑2 yrs", 
          description: "Implement cloud resources." 
        },
        { 
          title: "Senior Cloud Engineer", 
          timePeriod: "2‑4 yrs", 
          description: "Optimize and secure large cloud estates." 
        },
        { 
          title: "Cloud Architect", 
          timePeriod: "4‑6 yrs", 
          description: "Design enterprise cloud strategy." 
        },
        { 
          title: "Principal Cloud Engineer / Practice Lead", 
          timePeriod: "6+ yrs", 
          description: "Set org‑wide cloud vision and best practices." 
        }
      ]
    }
  },
  {
    id: "cloud-security-engineer",
    title: "Cloud Security Engineer",
    category: "Data Engineering",
    shortDescription: "Secure cloud environments and ensure compliance.",
    longDescription: "Cloud Security Engineers design and implement security controls, monitor threats, and respond to incidents in cloud infrastructures.",
    responsibilities: [
      "Implement cloud security controls",
      "Monitor threats & vulnerabilities",
      "Ensure compliance",
      "Conduct security assessments",
      "Respond to incidents"
    ],
    tools: ["Cloud Security Services", "IAM", "Encryption", "SIEM", "Vulnerability Scanners"],
    skills: ["Cloud Security", "Threat Detection", "Compliance", "Risk Assessment", "Incident Response"],
    collaborators: ["Security Teams", "DevOps", "Compliance", "Product"],
    dayInLife: "Run vulnerability scan, triage alerts, implement IAM hardening, pen‑test review, write incident report.",
    monthInLife: "Security assessment, remediation sprint, compliance audit, tabletop exercise.",
    careerPath: {
      description: "Path to security architecture or CISO track.",
      progressionSteps: [
        { 
          title: "Security Analyst", 
          timePeriod: "0‑2 yrs", 
          description: "Monitor security alerts." 
        },
        { 
          title: "Cloud Security Engineer", 
          timePeriod: "2‑4 yrs", 
          description: "Implement cloud security controls." 
        },
        { 
          title: "Security Architect", 
          timePeriod: "4‑6 yrs", 
          description: "Design security frameworks." 
        },
        { 
          title: "Director of Cloud Security / CISO", 
          timePeriod: "6+ yrs", 
          description: "Oversee org‑wide security strategy." 
        }
      ]
    }
  },
  {
    id: "full-stack-developer",
    title: "Full-Stack Developer",
    category: "Data Engineering",
    shortDescription: "Build front‑end and back‑end systems, often integrating AI/ML models.",
    longDescription: "Full‑Stack Developers create end‑to‑end web applications, integrating databases, APIs, and sometimes machine‑learning models.",
    responsibilities: [
      "Design web applications",
      "Implement front‑end UIs",
      "Build back‑end APIs",
      "Integrate databases & external systems",
      "Deploy & maintain applications"
    ],
    tools: ["React/Angular", "Node.js/Python", "Databases", "Git", "CI/CD"],
    skills: ["Front‑end", "Back‑end", "API Design", "DB Management", "Problem Solving"],
    collaborators: ["Designers", "Product", "Data Scientists", "DevOps"],
    dayInLife: "Daily stand‑up, build React feature, connect to Flask API, write tests, deploy via CI, code review.",
    monthInLife: "Two‑week sprints: feature dev, integration, testing, release, retrospective.",
    careerPath: {
      description: "Progression into tech lead or engineering management.",
      progressionSteps: [
        { 
          title: "Software Developer", 
          timePeriod: "0‑2 yrs", 
          description: "Contribute to front‑ or back‑end features." 
        },
        { 
          title: "Full‑Stack Developer", 
          timePeriod: "2‑4 yrs", 
          description: "Own full vertical features." 
        },
        { 
          title: "Senior Full‑Stack Developer", 
          timePeriod: "4‑6 yrs", 
          description: "Lead cross‑team initiatives." 
        },
        { 
          title: "Tech Lead / Engineering Manager", 
          timePeriod: "6+ yrs", 
          description: "Guide team, set architecture direction." 
        }
      ]
    }
  },
  {
    id: "metadata-specialist",
    title: "Metadata Specialist",
    category: "Data Engineering",
    shortDescription: "Manage metadata to improve data discoverability and governance.",
    longDescription: "Metadata Specialists create frameworks, catalogs, and policies to ensure data assets are well‑documented and easily discoverable.",
    responsibilities: [
      "Design metadata frameworks",
      "Maintain data catalogs",
      "Develop standards & policies",
      "Ensure data discoverability",
      "Support governance initiatives"
    ],
    tools: ["Data Catalogs", "Metadata Tools", "Taxonomy Systems", "Documentation", "ETL Tools"],
    skills: ["Metadata Management", "Cataloging", "Info Architecture", "Data Standards", "Communication"],
    collaborators: ["Governance", "Data Stewards", "IT", "Analysts"],
    dayInLife: "Update catalog entries, curate metadata tags, meet DG team, audit lineage, create glossary entry.",
    monthInLife: "Catalog rollout, metadata enrichment, stewardship training, governance alignment.",
    careerPath: {
      description: "Advance to metadata lead or director of data cataloging.",
      progressionSteps: [
        { 
          title: "Data Librarian", 
          timePeriod: "0‑2 yrs", 
          description: "Catalog data assets." 
        },
        { 
          title: "Metadata Specialist", 
          timePeriod: "2‑4 yrs", 
          description: "Own metadata standards." 
        },
        { 
          title: "Senior Metadata Specialist", 
          timePeriod: "4‑6 yrs", 
          description: "Lead metadata strategy." 
        },
        { 
          title: "Director of Data Cataloging", 
          timePeriod: "6+ yrs", 
          description: "Oversee enterprise metadata management." 
        }
      ]
    }
  },
  {
    id: "software-engineer-ai-ml",
    title: "Software Engineer (AI/ML)",
    category: "Data Engineering, AI/ML",
    shortDescription: "Build software systems that integrate machine‑learning models.",
    longDescription: "AI/ML Software Engineers design and implement production systems that serve ML models, ensuring performance, scalability, and reliability.",
    responsibilities: [
      "Develop AI‑enabled software",
      "Integrate ML models into apps",
      "Build APIs & services",
      "Optimize model performance",
      "Collaborate with data scientists"
    ],
    tools: ["Programming Languages", "ML Frameworks", "Docker/K8s", "CI/CD", "Monitoring"],
    skills: ["Software Dev", "ML Integration", "System Design", "API Development", "Performance Tuning"],
    collaborators: ["Data Scientists", "Product Teams", "DevOps", "QA"],
    dayInLife: "Implement feature flag, integrate TensorFlow model, write API, benchmark latency, deploy via Docker.",
    monthInLife: "Model integration, API build, performance tuning, release & monitoring.",
    careerPath: {
      description: "Progression to principal engineer or AI platform architect.",
      progressionSteps: [
        { 
          title: "Software Engineer", 
          timePeriod: "0‑2 yrs", 
          description: "Develop application features." 
        },
        { 
          title: "ML Software Engineer", 
          timePeriod: "2‑4 yrs", 
          description: "Integrate ML models." 
        },
        { 
          title: "Senior ML Engineer", 
          timePeriod: "4‑6 yrs", 
          description: "Lead AI feature development." 
        },
        { 
          title: "Principal Engineer / AI Platform Architect", 
          timePeriod: "6+ yrs", 
          description: "Design org‑wide AI platforms." 
        }
      ]
    }
  }
];
