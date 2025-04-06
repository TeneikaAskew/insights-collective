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
    longDescription: "AI Consultants help organizations understand, adopt, and benefit from artificial intelligence technologies. They assess business needs, recommend appropriate AI solutions, and guide implementation efforts. By bridging technical expertise with business acumen, they ensure AI initiatives align with organizational goals and deliver measurable value.",
    responsibilities: [
      "Assess organizational readiness for AI adoption",
      "Develop AI strategy aligned with business objectives",
      "Recommend appropriate AI solutions for specific business challenges",
      "Guide implementation and integration of AI technologies",
      "Advise on ethical considerations and governance of AI systems",
      "Measure and communicate the business impact of AI initiatives"
    ],
    tools: ["Machine Learning Platforms", "Cloud AI Services", "Data Analysis Tools", "Project Management Software", "ROI Assessment Frameworks"],
    skills: ["AI/ML Technical Knowledge", "Business Strategy", "Solution Architecture", "Change Management", "Stakeholder Communication"],
    collaborators: ["C-Suite Executives", "IT Leaders", "Data Teams", "Business Unit Heads", "External Technology Partners"]
  },
  {
    id: "ai-test-engineer",
    title: "AI Test Engineer",
    category: "AI/ML",
    shortDescription: "Ensures the quality and reliability of AI models by developing and conducting tests, requiring knowledge of AI algorithms, performance metrics, and debugging tools.",
    responsibilities: [
      "Design and implement testing frameworks for AI systems",
      "Develop automated tests for model validation",
      "Evaluate model performance against benchmarks",
      "Identify and troubleshoot issues in AI systems",
      "Document testing procedures and results"
    ],
    tools: ["Python", "Testing Frameworks", "CI/CD Tools", "Monitoring Systems", "Debugging Tools"],
    skills: ["Test Automation", "AI Algorithm Knowledge", "Performance Analysis", "Quality Assurance", "Problem Solving"]
  },
  {
    id: "computer-information-research-scientist",
    title: "Computer and Information Research Scientist",
    category: "AI/ML",
    shortDescription: "Innovates new computing technologies, often focusing on AI and machine learning applications, requiring expertise in algorithms, programming, and a doctoral degree in computer science or related fields.",
    responsibilities: [
      "Conduct research on computing problems and solutions",
      "Develop innovative approaches to computing challenges",
      "Design experiments to test theories and systems",
      "Publish research findings in academic journals",
      "Collaborate with interdisciplinary teams"
    ],
    tools: ["Programming Languages", "Scientific Computing Libraries", "Research Tools", "High-Performance Computing"],
    skills: ["Algorithm Design", "Theoretical Computer Science", "Research Methodology", "Academic Writing", "Mathematical Modeling"]
  },
  {
    id: "customer-engineer-data-ai",
    title: "Customer Engineer, Data & AI",
    category: "AI/ML",
    shortDescription: "Combines technical expertise with customer-facing roles, helping clients adopt data and AI solutions, requiring strong communication, cloud platform knowledge, and data engineering skills.",
    responsibilities: [
      "Provide technical guidance to customers implementing AI solutions",
      "Develop proof-of-concepts and demonstrations",
      "Troubleshoot customer implementation issues",
      "Collaborate with product teams on customer feedback",
      "Present technical solutions to diverse audiences"
    ],
    tools: ["Cloud Platforms", "AI Services", "Data Tools", "Demo Environments", "Documentation Systems"],
    skills: ["Technical Communication", "Customer Service", "Solution Architecture", "Problem Solving", "Project Management"]
  },
  {
    id: "decision-scientist",
    title: "Decision Scientist",
    category: "AI/ML",
    shortDescription: "Specializes in integrating data insights into strategic decision-making processes, requiring skills in statistical modeling, predictive analytics, and tools like Python or R, alongside strong business acumen.",
    responsibilities: [
      "Develop decision-making frameworks based on data",
      "Apply statistical methods to evaluate alternatives",
      "Create models that predict outcomes of decisions",
      "Work with leadership on strategic initiatives",
      "Translate complex analyses into actionable recommendations"
    ],
    tools: ["R/Python", "Statistical Software", "Decision Trees", "Monte Carlo Simulation", "Optimization Tools"],
    skills: ["Decision Analysis", "Statistical Modeling", "Business Strategy", "Executive Communication", "Critical Thinking"]
  },
  {
    id: "generative-ai-scientist",
    title: "Generative AI Scientist",
    category: "AI/ML",
    shortDescription: "Pioneers in AI who develop models capable of creating new content, such as text or images, requiring expertise in deep learning frameworks, natural language processing, and advanced mathematical modeling techniques like transformers.",
    responsibilities: [
      "Research and develop generative AI models",
      "Train large language and image generation models",
      "Optimize models for performance and quality",
      "Address ethical considerations in generative AI",
      "Stay current with rapid developments in the field"
    ],
    tools: ["PyTorch/TensorFlow", "Transformers", "GANs", "NLP Libraries", "GPU Computing"],
    skills: ["Deep Learning", "Natural Language Processing", "Computer Vision", "Research", "Model Architecture Design"]
  },
  {
    id: "insights-analyst",
    title: "Insights Analyst",
    category: "AI/ML, Analytics",
    shortDescription: "Professionals who distill raw data into actionable insights, often creating reports and visualizations for decision-making, requiring strong analytical skills, SQL proficiency, and experience with BI tools.",
    responsibilities: [
      "Extract meaningful patterns from complex datasets",
      "Create reports and visualizations for stakeholders",
      "Develop and track KPIs for business performance",
      "Provide recommendations based on data analysis",
      "Communicate insights to non-technical audiences"
    ],
    tools: ["SQL", "Excel", "BI Tools", "Statistical Software", "Visualization Tools"],
    skills: ["Data Analysis", "Business Acumen", "Communication", "Critical Thinking", "Problem Solving"]
  },
  {
    id: "mlops-engineer",
    title: "MLOps Engineer",
    category: "AI/ML",
    shortDescription: "Professionals ensuring the seamless deployment and monitoring of machine learning models in production, requiring expertise in CI/CD pipelines, containerization (Docker), orchestration (Kubernetes), and tools like MLflow.",
    responsibilities: [
      "Design and implement ML deployment pipelines",
      "Set up monitoring for model performance",
      "Automate testing and validation of ML models",
      "Manage infrastructure for ML workloads",
      "Collaborate with data scientists and engineers"
    ],
    tools: ["Docker", "Kubernetes", "MLflow", "CI/CD Tools", "Cloud Platforms", "Monitoring Systems"],
    skills: ["DevOps", "Machine Learning", "Infrastructure as Code", "Automation", "System Design"]
  },
  {
    id: "private-equity-analyst",
    title: "Private Equity Analyst",
    category: "AI/ML, Analytics",
    shortDescription: "Evaluates investment opportunities by analyzing financial data and market trends, requiring expertise in financial modeling, valuation, and business analytics tools.",
    responsibilities: [
      "Analyze potential investment targets",
      "Build financial models to evaluate deals",
      "Conduct market and industry research",
      "Support due diligence processes",
      "Present investment recommendations"
    ],
    tools: ["Excel", "Financial Modeling Software", "Data Analytics Tools", "CRM Systems", "Research Databases"],
    skills: ["Financial Analysis", "Valuation", "Due Diligence", "Market Research", "Presentation"]
  },
  {
    id: "product-insights-analyst",
    title: "Product or Product Insights Analyst",
    category: "AI/ML, Analytics",
    shortDescription: "Focuses on analyzing product performance and user behavior to inform product development, requiring skills in A/B testing, data analysis, and tools like Google Analytics and SQL.",
    responsibilities: [
      "Track and analyze product usage metrics",
      "Design and analyze A/B tests",
      "Identify opportunities for product improvement",
      "Work with product teams to implement data-driven changes",
      "Create dashboards for monitoring product health"
    ],
    tools: ["SQL", "Google Analytics", "A/B Testing Platforms", "BI Tools", "Product Analytics Software"],
    skills: ["Data Analysis", "User Behavior Analysis", "Product Thinking", "Hypothesis Testing", "Communication"]
  },
  {
    id: "qa-engineer-ai",
    title: "Quality Assurance Engineer, AI",
    category: "AI/ML",
    shortDescription: "Focuses on validating AI models and systems for accuracy, fairness, and robustness, requiring expertise in testing frameworks, programming, and data ethics.",
    responsibilities: [
      "Develop testing strategies for AI systems",
      "Test for bias, fairness, and ethical concerns",
      "Validate model performance and accuracy",
      "Design test cases for edge scenarios",
      "Document and track quality metrics"
    ],
    tools: ["Testing Frameworks", "Bias Detection Tools", "Automated Testing", "Performance Monitoring", "Documentation Systems"],
    skills: ["Quality Assurance", "AI Ethics", "Testing Methodology", "Programming", "Analytical Thinking"]
  },
  {
    id: "research-scientist",
    title: "Research Scientist/Applied Research Scientist",
    category: "AI/ML",
    shortDescription: "Applies advanced research to solve real-world problems, often focusing on machine learning and AI applications, requiring expertise in mathematics, algorithms, and data science.",
    responsibilities: [
      "Conduct research on cutting-edge AI techniques",
      "Develop novel algorithms and approaches",
      "Publish findings in academic conferences and journals",
      "Apply research to solve business problems",
      "Collaborate with engineering teams on implementation"
    ],
    tools: ["Python/R", "Machine Learning Libraries", "Research Tools", "Academic Databases", "Computational Resources"],
    skills: ["Research Methods", "Machine Learning", "Mathematics", "Scientific Writing", "Critical Thinking"]
  },
  {
    id: "solution-engineer-data-ai",
    title: "Solution Engineer, Data & AI",
    category: "AI/ML, Analytics",
    shortDescription: "Designs tailored data and AI solutions to address specific client needs, requiring expertise in cloud platforms, data integration, and AI frameworks.",
    responsibilities: [
      "Design technical solutions to business problems",
      "Create proof-of-concepts and demos",
      "Present technical solutions to clients",
      "Work with implementation teams on solution delivery",
      "Stay current with emerging technologies"
    ],
    tools: ["Cloud Platforms", "AI Services", "Integration Tools", "Presentation Software", "CRM Systems"],
    skills: ["Solution Architecture", "Technical Sales", "Communication", "Project Planning", "AI/ML Knowledge"]
  },
  {
    id: "cloud-data-engineer",
    title: "Cloud Data Engineer",
    category: "Data Engineering",
    shortDescription: "Specializes in designing scalable data pipelines on cloud platforms to enable analytics and AI, requiring expertise in cloud data services (e.g., BigQuery, AWS Redshift), ETL processes, and distributed computing tools like Apache Spark.",
    responsibilities: [
      "Design and implement cloud-based data architectures",
      "Build scalable ETL pipelines on cloud platforms",
      "Optimize data storage and processing for cost and performance",
      "Implement data security and compliance measures",
      "Migrate data workloads to cloud environments"
    ],
    tools: ["AWS/Azure/GCP", "Cloud Data Warehouses", "Serverless Computing", "Spark", "Terraform/CloudFormation"],
    skills: ["Cloud Architecture", "Data Engineering", "ETL Design", "Cost Optimization", "Security"]
  },
  {
    id: "data-governance-analyst",
    title: "Data Governance Analyst",
    category: "Analytics",
    shortDescription: "Focuses on implementing policies and practices to ensure data quality, compliance, and security, requiring knowledge of data management frameworks, compliance standards, and risk mitigation strategies.",
    responsibilities: [
      "Develop and implement data governance policies",
      "Monitor compliance with data regulations",
      "Establish data quality standards and metrics",
      "Create data catalogs and dictionaries",
      "Train staff on data governance practices"
    ],
    tools: ["Data Catalogs", "Metadata Management Tools", "Compliance Software", "Documentation Systems", "Training Platforms"],
    skills: ["Data Management", "Regulatory Knowledge", "Policy Development", "Communication", "Risk Assessment"]
  },
  {
    id: "data-visualization-specialist",
    title: "Data Visualization Specialist",
    category: "Analytics, Business Intelligence",
    shortDescription: "Professionals who craft compelling visual representations of data, making complex information accessible and actionable, requiring skills in visualization tools like Tableau or Power BI, and a strong foundation in data storytelling, design principles, and analytics.",
    responsibilities: [
      "Design effective data visualizations and dashboards",
      "Translate complex data into intuitive visual stories",
      "Apply design principles to enhance data comprehension",
      "Work with stakeholders to understand visualization needs",
      "Stay current with visualization best practices"
    ],
    tools: ["Tableau", "Power BI", "D3.js", "Design Software", "Color Theory Tools"],
    skills: ["Visual Design", "Data Storytelling", "UX Principles", "Data Analysis", "Communication"]
  },
  {
    id: "data-metrics-analyst",
    title: "Data and Metrics Analyst",
    category: "Analytics",
    shortDescription: "Professionals who design and track metrics to measure business performance, requiring expertise in analytics tools, KPI design, and data visualization.",
    responsibilities: [
      "Define and implement key business metrics",
      "Build dashboards to track performance",
      "Analyze metric trends and patterns",
      "Report on business performance to stakeholders",
      "Recommend improvements based on metric analysis"
    ],
    tools: ["BI Tools", "SQL", "Excel", "Statistical Software", "Data Visualization Tools"],
    skills: ["Metric Design", "Data Analysis", "Business Acumen", "Reporting", "Critical Thinking"]
  },
  {
    id: "information-architect",
    title: "Information Architect",
    category: "Business Intelligence",
    shortDescription: "Designs data and information systems for optimal usability and scalability, requiring expertise in data modeling, database design, and information management standards.",
    responsibilities: [
      "Design information structures and taxonomies",
      "Create data models and schemas",
      "Develop metadata frameworks",
      "Ensure information accessibility and usability",
      "Collaborate on enterprise architecture"
    ],
    tools: ["Modeling Tools", "Database Design Software", "Taxonomy Systems", "Documentation Platforms", "UX Tools"],
    skills: ["Information Design", "Data Modeling", "Systems Thinking", "User Experience", "Communication"]
  },
  {
    id: "intelligence-analyst",
    title: "Intelligence Analyst",
    category: "Business Intelligence",
    shortDescription: "Gathers and interprets data to provide actionable intelligence, often in a security or strategic context, requiring analytical skills, programming, and domain expertise in specific industries like defense or business.",
    responsibilities: [
      "Collect and analyze data from diverse sources",
      "Identify patterns and trends in complex information",
      "Produce intelligence reports for decision-makers",
      "Assess risks and opportunities",
      "Present findings to stakeholders"
    ],
    tools: ["Data Analysis Software", "Visualization Tools", "Intelligence Platforms", "Research Databases", "Reporting Systems"],
    skills: ["Analytical Thinking", "Research", "Domain Knowledge", "Communication", "Critical Evaluation"]
  },
  {
    id: "mdm-analyst",
    title: "Master Data Management (MDM) Analyst",
    category: "Analytics",
    shortDescription: "Manages master data to ensure consistency across systems, requiring expertise in data integration, governance, and tools like Informatica MDM or Tibco.",
    responsibilities: [
      "Develop and maintain master data standards",
      "Ensure data consistency across systems",
      "Implement data quality processes",
      "Resolve data discrepancies",
      "Support data integration initiatives"
    ],
    tools: ["MDM Platforms", "Data Quality Tools", "ETL Software", "Data Profiling Tools", "Metadata Repositories"],
    skills: ["Data Management", "Data Modeling", "Data Quality", "Process Design", "Problem Solving"]
  },
  {
    id: "sql-developer",
    title: "SQL Developer",
    category: "Data Engineering",
    shortDescription: "Focused on managing and querying data in relational databases, SQL developers design, optimize, and maintain database systems, requiring expertise in SQL, data modeling, and performance tuning, often in collaboration with data analysts and engineers.",
    responsibilities: [
      "Design and implement database schemas",
      "Write and optimize SQL queries",
      "Develop stored procedures and functions",
      "Troubleshoot performance issues",
      "Support data analysis and reporting needs"
    ],
    tools: ["SQL", "Database Management Systems", "Query Optimization Tools", "Version Control", "Data Modeling Tools"],
    skills: ["SQL Programming", "Database Design", "Performance Tuning", "Troubleshooting", "Data Modeling"]
  },
  {
    id: "ai-governance-officer",
    title: "AI Governance Officer",
    category: "Business Intelligence",
    shortDescription: "Ensures AI systems align with organizational goals and ethical guidelines, requiring skills in risk management, compliance, and a deep understanding of AI lifecycle management.",
    responsibilities: [
      "Develop AI governance frameworks and policies",
      "Ensure compliance with AI regulations and standards",
      "Assess AI systems for ethical considerations",
      "Create risk mitigation strategies for AI deployments",
      "Educate stakeholders on responsible AI practices"
    ],
    tools: ["Risk Assessment Frameworks", "Policy Management Systems", "Compliance Software", "Documentation Platforms", "Training Tools"],
    skills: ["AI Ethics", "Risk Management", "Policy Development", "Compliance", "Stakeholder Management"]
  },
  {
    id: "cloud-engineer",
    title: "Cloud Engineer",
    category: "Data Engineering",
    shortDescription: "Experts in deploying, managing, and optimizing cloud-based infrastructure, Cloud Engineers require proficiency in platforms like AWS, Azure, or Google Cloud, alongside skills in automation, networking, and cloud security.",
    responsibilities: [
      "Design and implement cloud infrastructure",
      "Automate deployment and scaling processes",
      "Optimize cloud resources for cost and performance",
      "Implement cloud security best practices",
      "Troubleshoot infrastructure issues"
    ],
    tools: ["AWS/Azure/GCP", "IaC Tools", "CI/CD Pipelines", "Monitoring Systems", "Security Tools"],
    skills: ["Cloud Architecture", "Automation", "Networking", "Security", "Cost Optimization"]
  },
  {
    id: "cloud-security-engineer",
    title: "Cloud Security Engineer",
    category: "Data Engineering",
    shortDescription: "Focuses on securing cloud environments and ensuring compliance with industry standards, requiring expertise in IAM, network security, encryption, and tools like Cloud Armor or AWS Shield.",
    responsibilities: [
      "Design and implement cloud security controls",
      "Monitor for security threats and vulnerabilities",
      "Ensure compliance with security standards",
      "Conduct security assessments and audits",
      "Respond to security incidents"
    ],
    tools: ["Cloud Security Services", "IAM Systems", "Encryption Tools", "SIEM Solutions", "Vulnerability Scanners"],
    skills: ["Cloud Security", "Threat Detection", "Compliance", "Risk Assessment", "Incident Response"]
  },
  {
    id: "full-stack-developer",
    title: "Full-Stack Developer",
    category: "Data Engineering",
    shortDescription: "Develops and maintains both front-end and back-end systems, often in AI/ML-powered applications, requiring proficiency in programming languages, databases, and frameworks like React, Node.js, and Flask.",
    responsibilities: [
      "Design and develop web applications",
      "Implement front-end user interfaces",
      "Build back-end services and APIs",
      "Integrate with databases and external systems",
      "Deploy and maintain applications"
    ],
    tools: ["JavaScript/TypeScript", "React/Angular/Vue", "Node.js/Python/Java", "Databases", "Git", "CI/CD Tools"],
    skills: ["Front-end Development", "Back-end Development", "API Design", "Database Management", "Problem Solving"]
  },
  {
    id: "metadata-specialist",
    title: "Metadata Specialist",
    category: "Data Engineering",
    shortDescription: "Professionals who manage metadata to improve data discoverability and governance, requiring skills in data cataloging, standards like DCAT, and tools like Data Catalog or Alation.",
    responsibilities: [
      "Design and implement metadata frameworks",
      "Create and maintain data catalogs",
      "Develop metadata standards and policies",
      "Ensure data discoverability and understanding",
      "Support data governance initiatives"
    ],
    tools: ["Data Catalog Platforms", "Metadata Management Tools", "Taxonomy Systems", "Documentation Tools", "ETL Tools"],
    skills: ["Metadata Management", "Data Cataloging", "Information Architecture", "Data Standards", "Communication"]
  },
  {
    id: "software-engineer-ai-ml",
    title: "Software Engineer (AI/ML)",
    category: "Data Engineering, AI/ML",
    shortDescription: "Engineers who build AI-driven applications, integrating machine learning models into software systems, requiring expertise in programming, AI frameworks, and system design.",
    responsibilities: [
      "Develop software that incorporates AI/ML capabilities",
      "Integrate machine learning models into applications",
      "Build APIs and services for AI functionality",
      "Optimize AI model performance in production",
      "Collaborate with data scientists and product teams"
    ],
    tools: ["Programming Languages", "AI/ML Frameworks", "Version Control", "CI/CD Systems", "Containerization"],
    skills: ["Software Development", "AI/ML Integration", "System Design", "API Development", "Performance Optimization"]
  }
];
