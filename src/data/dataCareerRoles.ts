
// Define the type for career roles data structure
export interface DataCareerRole {
  id: string;
  title: string;
  category: string;
  shortDescription: string;
  longDescription: string;
  responsibilities: string[];
  tools: string[];
  skills?: string[];
  collaborators: string[];
  dayInLife: string;
  monthInLife: string;
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
    category: "Analytics & BI",
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
    category: "Technical & Engineering",
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
    category: "Technical & Engineering",
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
    category: "Analytics & BI",
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
    category: "Technical & Engineering",
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
  }
];
