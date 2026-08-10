
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Check overnight latency and error metrics for deployed AI services in production"
      },
      {
        "time": "10:00 AM",
        "activity": "Wrap a data scientist's PyTorch model into a Python inference API"
      },
      {
        "time": "12:00 PM",
        "activity": "Step away for lunch and skim release notes for the cloud APIs you use"
      },
      {
        "time": "1:00 PM",
        "activity": "Debug a Kubernetes pod that keeps restarting under peak inference load"
      },
      {
        "time": "2:30 PM",
        "activity": "Meet product managers to scope requirements for an upcoming AI feature"
      },
      {
        "time": "3:30 PM",
        "activity": "Review a teammate's pull request and fix a failing CI/CD stage"
      },
      {
        "time": "4:30 PM",
        "activity": "Document API endpoints and update the Docker image build instructions"
      }
    ],
    projectTimeline: [
      {
        "title": "Service Architecture Design",
        "duration": "1 week",
        "description": "You define how a data science model becomes a production service, agreeing on interfaces, latency targets and scaling limits before writing code.",
        "activities": [
          "Review model requirements with the data scientists",
          "Draft API contract and expected request volumes",
          "Choose serving pattern and cloud infrastructure"
        ]
      },
      {
        "title": "Model Integration Build",
        "duration": "2-3 weeks",
        "description": "You implement the service in Python, package it with Docker, and wire it into existing systems so other engineers can call it reliably.",
        "activities": [
          "Build inference endpoints and input validation",
          "Containerize the model with reproducible dependencies",
          "Integrate with upstream services and authentication"
        ]
      },
      {
        "title": "Scale and Reliability Testing",
        "duration": "1-2 weeks",
        "description": "You push the service under realistic load, tune resource limits on Kubernetes, and close the gaps that only appear at production traffic.",
        "activities": [
          "Load test to find throughput and latency ceilings",
          "Tune autoscaling, batching and resource requests",
          "Add retries, timeouts and graceful failure paths"
        ]
      },
      {
        "title": "Deployment and Monitoring",
        "duration": "1 week",
        "description": "You ship the service through the CI/CD pipeline, watch its first days in production, and hand documentation to the teams that depend on it.",
        "activities": [
          "Roll out gradually through the CI/CD pipeline",
          "Set alerts on latency, errors and cost",
          "Publish API docs and on-call runbook"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Join the client stand-up to review AI roadmap progress and blockers"
      },
      {
        "time": "10:00 AM",
        "activity": "White-board a solution architecture for the client's document processing use case"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch with the IT leader to hear where adoption is stalling"
      },
      {
        "time": "1:00 PM",
        "activity": "Score two vendor ML platforms against the readiness assessment criteria"
      },
      {
        "time": "2:30 PM",
        "activity": "Build an ROI model estimating payback period for the proposed pilot"
      },
      {
        "time": "3:30 PM",
        "activity": "Draft an executive briefing translating pilot metrics into business impact"
      },
      {
        "time": "4:30 PM",
        "activity": "Prepare workshop materials on AI governance for next week's session"
      }
    ],
    projectTimeline: [
      {
        "title": "Readiness Assessment",
        "duration": "2 weeks",
        "description": "You interview business and IT leaders to judge whether the organization has the data, skills and governance to adopt AI successfully.",
        "activities": [
          "Run discovery workshops with business unit heads",
          "Audit data maturity and platform capabilities",
          "Score candidate use cases by value and feasibility"
        ]
      },
      {
        "title": "AI Strategy and Roadmap",
        "duration": "2-3 weeks",
        "description": "You turn the assessment into a sequenced roadmap tied to business objectives, with an ROI framework the executive team can hold you to.",
        "activities": [
          "Prioritize use cases into a phased roadmap",
          "Define ROI framework and success measures",
          "Recommend platforms, partners and governance model"
        ]
      },
      {
        "title": "Pilot Design and Build",
        "duration": "4-6 weeks",
        "description": "You guide the client and technology partners through a bounded pilot, keeping scope tight enough to prove value within one quarter.",
        "activities": [
          "Scope the pilot and agree acceptance criteria",
          "Guide the delivery team through implementation",
          "Advise on ethical risks and approval gates"
        ]
      },
      {
        "title": "Impact Review and Scaling",
        "duration": "2 weeks",
        "description": "You measure what the pilot actually delivered, brief the C-suite honestly, and set out what scaling would cost and require.",
        "activities": [
          "Measure pilot results against the ROI framework",
          "Present findings and decision options to executives",
          "Plan change management for wider rollout"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Review last night's CI test run and triage the failed cases"
      },
      {
        "time": "10:00 AM",
        "activity": "Write PyTest cases covering edge inputs for the new model version"
      },
      {
        "time": "12:00 PM",
        "activity": "Break for lunch while a long regression suite finishes running"
      },
      {
        "time": "1:00 PM",
        "activity": "Compare model accuracy against benchmark thresholds and flag the regressions"
      },
      {
        "time": "2:30 PM",
        "activity": "Pair with a data scientist to reproduce a failing prediction path"
      },
      {
        "time": "3:30 PM",
        "activity": "Run bias-detection tools across held-out slices and record the results"
      },
      {
        "time": "4:30 PM",
        "activity": "Update the quality dashboard and raise defects for sprint planning"
      }
    ],
    projectTimeline: [
      {
        "title": "Test Plan Design",
        "duration": "1 week",
        "description": "You define what passing means for an upcoming model, agreeing benchmarks and failure thresholds with the data scientists and product owner.",
        "activities": [
          "Map model behaviors that must be tested",
          "Set accuracy and latency benchmark thresholds",
          "Collect edge-case and adversarial input examples"
        ]
      },
      {
        "title": "Automation Framework Build",
        "duration": "2 weeks",
        "description": "You build the reusable Python test harness so every future model version is validated automatically rather than checked by hand.",
        "activities": [
          "Write PyTest suites for accuracy and regression",
          "Add fixtures for versioned datasets and models",
          "Wire the suite into the CI/CD pipeline"
        ]
      },
      {
        "title": "Execution and Troubleshooting",
        "duration": "1-2 weeks",
        "description": "You run the full suite against release candidates, investigate every failure with the modeling team, and retest until behavior is stable.",
        "activities": [
          "Execute regression and stress runs on candidates",
          "Reproduce and isolate failing prediction cases",
          "Retest fixes and track defect burn-down"
        ]
      },
      {
        "title": "Reporting and Release Sign-Off",
        "duration": "1 week",
        "description": "You summarize test coverage and residual risk in a report that MLOps and product owners use to approve the production release.",
        "activities": [
          "Publish coverage and benchmark comparison results",
          "Document known limitations and residual risks",
          "Hand monitoring checks to the MLOps engineers"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Check overnight HPC cluster jobs and inspect experiment logs for anomalies"
      },
      {
        "time": "10:00 AM",
        "activity": "Prototype a new algorithm variant in C++ and profile its runtime"
      },
      {
        "time": "12:00 PM",
        "activity": "Eat lunch while annotating a recent paper from the research databases"
      },
      {
        "time": "1:00 PM",
        "activity": "Run controlled experiments comparing your algorithm against established baselines"
      },
      {
        "time": "2:30 PM",
        "activity": "Present preliminary results at the group seminar and absorb the critique"
      },
      {
        "time": "3:30 PM",
        "activity": "Mentor a junior researcher on experiment design and version control habits"
      },
      {
        "time": "4:30 PM",
        "activity": "Draft the methods section of your conference paper submission"
      }
    ],
    projectTimeline: [
      {
        "title": "Problem Framing",
        "duration": "3-4 weeks",
        "description": "You survey the literature to find an unsolved computing problem worth attacking, then state a hypothesis precise enough to test experimentally.",
        "activities": [
          "Survey prior work in research databases",
          "Identify the gap existing algorithms leave open",
          "Write a research proposal with success criteria"
        ]
      },
      {
        "title": "Algorithm Prototyping",
        "duration": "4-6 weeks",
        "description": "You implement candidate algorithms in Python or C++ and iterate on the mathematical formulation until one shows genuine promise.",
        "activities": [
          "Implement candidate algorithms with scientific libraries",
          "Prove correctness and analyze complexity bounds",
          "Profile prototypes and discard weak variants"
        ]
      },
      {
        "title": "Experimental Validation",
        "duration": "4-6 weeks",
        "description": "You run large experiment sweeps on HPC clusters against strong baselines, checking that the advantage holds across datasets and settings.",
        "activities": [
          "Schedule large experiment sweeps on HPC clusters",
          "Benchmark against published baseline results",
          "Test sensitivity to dataset and parameter changes"
        ]
      },
      {
        "title": "Publication and Transfer",
        "duration": "4-6 weeks",
        "description": "You write up the work for a top conference, respond to reviewers, and help product teams judge what is ready to build on.",
        "activities": [
          "Write and submit the conference paper",
          "Release reproducible code and experiment configs",
          "Brief product teams on transfer opportunities"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Sync with the customer to clear blockers on their pipeline deployment"
      },
      {
        "time": "10:00 AM",
        "activity": "Build a proof-of-concept in the demo environment using cloud AI APIs"
      },
      {
        "time": "12:00 PM",
        "activity": "Take lunch between customer calls and clear your support inbox"
      },
      {
        "time": "1:00 PM",
        "activity": "Troubleshoot an authentication failure blocking the client's data ingestion job"
      },
      {
        "time": "2:30 PM",
        "activity": "Walk the client's data engineers through the architecture you configured"
      },
      {
        "time": "3:30 PM",
        "activity": "Log product gaps and feature requests for the product managers"
      },
      {
        "time": "4:30 PM",
        "activity": "Write a knowledge-base article covering the fix you shipped today"
      }
    ],
    projectTimeline: [
      {
        "title": "Customer Onboarding",
        "duration": "1-2 weeks",
        "description": "You learn the customer's data landscape and goals, then agree what a successful adoption of the platform will look like for them.",
        "activities": [
          "Map existing data sources and environments",
          "Agree success criteria with client stakeholders",
          "Provision sandbox access and starter datasets"
        ]
      },
      {
        "title": "Proof-of-Concept Build",
        "duration": "2-3 weeks",
        "description": "You build a working demo against the customer's own data so their team can see the AI capability solving their actual problem.",
        "activities": [
          "Wire customer data into the demo environment",
          "Build the POC against real customer data",
          "Demo results and gather technical objections"
        ]
      },
      {
        "title": "Pilot Deployment",
        "duration": "3-4 weeks",
        "description": "You move the proof-of-concept into the customer's own cloud environment, fixing integration and permission issues alongside their data engineers.",
        "activities": [
          "Deploy into the customer's cloud environment",
          "Troubleshoot integration, quota and permission issues",
          "Train customer engineers on daily operation"
        ]
      },
      {
        "title": "Adoption and Handover",
        "duration": "1-2 weeks",
        "description": "You confirm the customer can run the solution without you, capture their feedback for product, and document everything for future support.",
        "activities": [
          "Review usage metrics against agreed success criteria",
          "File prioritized product feedback with product managers",
          "Publish runbooks and knowledge-base articles"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Review overnight Monte Carlo runs and sanity-check the output distributions"
      },
      {
        "time": "10:00 AM",
        "activity": "Meet leadership to sharpen the decision question behind a pricing change"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch away from the desk to reset before the modeling block"
      },
      {
        "time": "1:00 PM",
        "activity": "Code scenario analyses in Python comparing three market expansion options"
      },
      {
        "time": "2:30 PM",
        "activity": "Work with finance to quantify downside risk and expected ROI"
      },
      {
        "time": "3:30 PM",
        "activity": "Update the dashboard tracking outcomes of last quarter's decisions"
      },
      {
        "time": "4:30 PM",
        "activity": "Build slides framing the trade-offs as clear choices for executives"
      }
    ],
    projectTimeline: [
      {
        "title": "Framing the Decision",
        "duration": "1 week",
        "description": "You work with executives to convert a vague strategic worry into a specific decision with defined options, constraints and success measures.",
        "activities": [
          "Interview executives on the choice they face",
          "Define options, constraints and decision criteria",
          "Identify data needed to separate the options"
        ]
      },
      {
        "title": "Model and Simulation Build",
        "duration": "2 weeks",
        "description": "You build the quantitative backbone in Python or R, modeling each option's outcomes and the uncertainty around them.",
        "activities": [
          "Assemble inputs with the data analysts",
          "Build decision tree and simulation models",
          "Run Monte Carlo scenarios across key assumptions"
        ]
      },
      {
        "title": "Validation and Sensitivity",
        "duration": "1 week",
        "description": "You stress the model against history and challenge its assumptions with finance so the recommendation survives hard questions in the room.",
        "activities": [
          "Backtest model against historical outcomes",
          "Run sensitivity analysis on fragile assumptions",
          "Pressure-test findings with the finance team"
        ]
      },
      {
        "title": "Recommendation and Follow-Through",
        "duration": "1-2 weeks",
        "description": "You present the trade-offs as a clear recommendation, facilitate the decision workshop, and set up tracking of what actually happens next.",
        "activities": [
          "Present options and risk-adjusted recommendation to leadership",
          "Facilitate the decision workshop with product strategists",
          "Stand up a dashboard tracking realized outcomes"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Check overnight GPU cluster jobs and inspect loss curves for divergence"
      },
      {
        "time": "10:00 AM",
        "activity": "Read new papers on diffusion sampling and note ideas worth testing"
      },
      {
        "time": "12:00 PM",
        "activity": "Eat lunch while a checkpoint evaluation sweep runs in the background"
      },
      {
        "time": "1:00 PM",
        "activity": "Modify the transformer architecture and launch a controlled ablation run"
      },
      {
        "time": "2:30 PM",
        "activity": "Score generated samples by hand and catalog the failure modes"
      },
      {
        "time": "3:30 PM",
        "activity": "Review bias and safety findings with the ethics board reviewers"
      },
      {
        "time": "4:30 PM",
        "activity": "Document hyper-parameter results and push training code to the repository"
      }
    ],
    projectTimeline: [
      {
        "title": "Architecture Research",
        "duration": "3-4 weeks",
        "description": "You study current generative architectures and run small-scale experiments to decide which design is worth committing serious GPU budget to.",
        "activities": [
          "Review recent generative modeling literature",
          "Run small-scale architecture and data ablations",
          "Estimate compute budget and training schedule"
        ]
      },
      {
        "title": "Large-Scale Training",
        "duration": "4-6 weeks",
        "description": "You train the model across GPU clusters, babysitting loss curves and intervening when instability, data issues or throughput problems appear.",
        "activities": [
          "Launch distributed training across GPU clusters",
          "Monitor loss curves and recover from instability",
          "Tune hyper-parameters and checkpoint intermediate models"
        ]
      },
      {
        "title": "Evaluation and Safety Review",
        "duration": "2-3 weeks",
        "description": "You measure output quality quantitatively and qualitatively, then work through bias and misuse concerns with the ethics board before anything ships.",
        "activities": [
          "Benchmark sample quality against reference models",
          "Probe for bias and unsafe generations",
          "Agree mitigations with the ethics board"
        ]
      },
      {
        "title": "Release or Submission",
        "duration": "2-3 weeks",
        "description": "You either hand the optimized model to ML engineers for serving or write the results up for a research conference, often both.",
        "activities": [
          "Optimize model for inference cost and latency",
          "Hand off weights and evaluation notes to engineers",
          "Draft the paper and present internal findings"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Refresh Tableau dashboards and confirm overnight data loads completed cleanly"
      },
      {
        "time": "10:00 AM",
        "activity": "Write SQL to answer an ad-hoc question about churn by segment"
      },
      {
        "time": "12:00 PM",
        "activity": "Pause for lunch and skim the weekly marketing performance summary"
      },
      {
        "time": "1:00 PM",
        "activity": "Meet the product manager to understand context behind a KPI drop"
      },
      {
        "time": "2:30 PM",
        "activity": "Build Power BI visuals showing the trend and its likely drivers"
      },
      {
        "time": "3:30 PM",
        "activity": "Write a short insights memo with three concrete recommended actions"
      },
      {
        "time": "4:30 PM",
        "activity": "Ask data engineers to fix a broken field in the reporting table"
      }
    ],
    projectTimeline: [
      {
        "title": "Question and KPI Scoping",
        "duration": "1 week",
        "description": "You pin down what business question a declining metric really raises, and which KPIs would settle it for marketing and finance.",
        "activities": [
          "Interview marketing and finance on the question",
          "Agree the KPIs that define success",
          "List data sources and known reporting gaps"
        ]
      },
      {
        "title": "Data Pull and Validation",
        "duration": "1 week",
        "description": "You extract the data in SQL, reconcile it against trusted reports, and resolve quality issues with the data engineers before analyzing anything.",
        "activities": [
          "Write SQL extracts across the relevant tables",
          "Reconcile totals against existing trusted reports",
          "Escalate data quality issues to data engineers"
        ]
      },
      {
        "title": "Deep-Dive Analysis",
        "duration": "1-2 weeks",
        "description": "You segment, compare and test until the pattern behind the metric is explainable rather than merely visible in a chart.",
        "activities": [
          "Segment the metric by cohort and channel",
          "Test candidate explanations against the data",
          "Draft visuals that make the pattern obvious"
        ]
      },
      {
        "title": "Readout and Dashboard",
        "duration": "1 week",
        "description": "You present the findings and recommendations to stakeholders, then turn the one-off analysis into a dashboard they can watch themselves.",
        "activities": [
          "Present findings and recommendations to stakeholders",
          "Build a Tableau dashboard for ongoing tracking",
          "Document definitions and methodology for reuse"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Check overnight pipeline runs and restart a stuck model training job"
      },
      {
        "time": "10:00 AM",
        "activity": "Containerize a newly approved model and push the Docker image"
      },
      {
        "time": "12:00 PM",
        "activity": "Break for lunch once the staging deployment finishes rolling out"
      },
      {
        "time": "1:00 PM",
        "activity": "Add automated validation gates to the CI/CD pipeline before promotion"
      },
      {
        "time": "2:30 PM",
        "activity": "Join infrastructure stand-up with SREs about Kubernetes autoscaling limits"
      },
      {
        "time": "3:30 PM",
        "activity": "Investigate drift alerts in MLflow against the training baseline"
      },
      {
        "time": "4:30 PM",
        "activity": "Review cloud spend per model and right-size the serving nodes"
      }
    ],
    projectTimeline: [
      {
        "title": "Pipeline Design",
        "duration": "1 week",
        "description": "You map how a model should travel from a data scientist's notebook to production, defining the stages, artifacts and approvals along the way.",
        "activities": [
          "Map current handoffs with the data scientists",
          "Define pipeline stages, artifacts and registry layout",
          "Choose infrastructure and access control model"
        ]
      },
      {
        "title": "CI/CD Implementation",
        "duration": "2 weeks",
        "description": "You build the automated path that packages, tests and deploys models with Docker, Kubernetes and MLflow so releases stop being manual.",
        "activities": [
          "Automate build, containerization and registry publishing",
          "Add automated validation gates before promotion",
          "Deploy to staging with reproducible Kubernetes manifests"
        ]
      },
      {
        "title": "Monitoring Rollout",
        "duration": "1-2 weeks",
        "description": "You instrument production models for drift, latency and failures, and agree with data scientists what an alert should actually trigger.",
        "activities": [
          "Instrument drift, latency and error metrics",
          "Set alert thresholds and escalation paths",
          "Wire rollback to a previous model version"
        ]
      },
      {
        "title": "Cost and Performance Tuning",
        "duration": "1 week",
        "description": "You measure real serving cost and throughput, then tune infrastructure until the pipeline is both fast enough and defensibly priced.",
        "activities": [
          "Profile serving cost per model and request",
          "Right-size nodes, replicas and batching settings",
          "Report savings and reliability gains to stakeholders"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Scan industry news and deal announcements affecting your target sectors"
      },
      {
        "time": "10:00 AM",
        "activity": "Update the LBO model in Excel with revised debt assumptions"
      },
      {
        "time": "12:00 PM",
        "activity": "Quick lunch at your desk while prepping for the management call"
      },
      {
        "time": "1:00 PM",
        "activity": "Join a management call and press on customer concentration risk"
      },
      {
        "time": "2:30 PM",
        "activity": "Size the addressable market using research databases and expert calls"
      },
      {
        "time": "3:30 PM",
        "activity": "Run sensitivity analysis on exit multiples and entry leverage"
      },
      {
        "time": "4:30 PM",
        "activity": "Draft investment memo sections for this week's committee meeting"
      }
    ],
    projectTimeline: [
      {
        "title": "Sourcing and Screening",
        "duration": "2 weeks",
        "description": "You screen targets in a sector against the fund's criteria, building quick views on which companies deserve real diligence time.",
        "activities": [
          "Build a target long list from research databases",
          "Screen financials against fund investment criteria",
          "Log promising targets and outreach in the CRM"
        ]
      },
      {
        "title": "Preliminary Valuation",
        "duration": "1-2 weeks",
        "description": "You analyze the target's financial statements and build a first LBO model to test whether the returns can plausibly clear the hurdle.",
        "activities": [
          "Normalize historical financials and margin trends",
          "Build the first LBO and valuation model",
          "Test entry price against target return thresholds"
        ]
      },
      {
        "title": "Deep Diligence",
        "duration": "3-4 weeks",
        "description": "You dig into the market, customers and risks alongside the deal team, industry experts and legal advisors, updating the model as facts arrive.",
        "activities": [
          "Size the market and map competitive position",
          "Run expert calls on customers and churn",
          "Refine model with diligence findings and legal flags"
        ]
      },
      {
        "title": "Investment Committee",
        "duration": "1 week",
        "description": "You assemble the investment memo and supporting analysis so the committee can judge the thesis, the downside and the proposed structure.",
        "activities": [
          "Write the investment memo and thesis summary",
          "Prepare sensitivity tables and downside cases",
          "Present analysis and field committee questions"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Review activation and retention metrics in the product analytics suite"
      },
      {
        "time": "10:00 AM",
        "activity": "Check the running A/B test for sample ratio mismatch and early noise"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch with a UX researcher comparing session findings against your metrics"
      },
      {
        "time": "1:00 PM",
        "activity": "Write SQL to size the drop-off happening midway through onboarding"
      },
      {
        "time": "2:30 PM",
        "activity": "Design the next experiment with the product manager and set guardrails"
      },
      {
        "time": "3:30 PM",
        "activity": "Build a BI dashboard tracking feature health for the launch review"
      },
      {
        "time": "4:30 PM",
        "activity": "Post an experiment readout covering lift, confidence and next steps"
      }
    ],
    projectTimeline: [
      {
        "title": "Funnel Instrumentation",
        "duration": "1 week",
        "description": "You work with engineers to make sure every step of the onboarding funnel is tracked correctly before you draw any conclusions from it.",
        "activities": [
          "Audit existing event tracking for gaps",
          "Specify new events with the engineers",
          "Validate data landing in the analytics suite"
        ]
      },
      {
        "title": "Experiment Design",
        "duration": "1 week",
        "description": "You turn a product hypothesis about the drop-off into a testable experiment with a primary metric, sample size and guardrails.",
        "activities": [
          "Define hypothesis and primary success metric",
          "Calculate sample size and required run time",
          "Agree guardrail metrics with the product manager"
        ]
      },
      {
        "title": "Launch and Monitoring",
        "duration": "2-3 weeks",
        "description": "You launch the test on the A/B platform and watch it daily for imbalance or harm, resisting the urge to call it early.",
        "activities": [
          "Launch the variant and verify assignment balance",
          "Monitor guardrails for user harm daily",
          "Hold the test to its planned duration"
        ]
      },
      {
        "title": "Readout and Rollout",
        "duration": "1 week",
        "description": "You analyze results by segment, share an honest readout, and help the product team decide whether to ship, iterate or abandon.",
        "activities": [
          "Analyze lift overall and by user segment",
          "Publish readout with confidence intervals and caveats",
          "Recommend ship, iterate or stop decision"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Review yesterday's validation run and log defects against quality metrics"
      },
      {
        "time": "10:00 AM",
        "activity": "Draft the test strategy for a model heading into release review"
      },
      {
        "time": "12:00 PM",
        "activity": "Take a proper break outside before the afternoon fairness review"
      },
      {
        "time": "1:00 PM",
        "activity": "Measure subgroup performance with bias tools and document the disparities"
      },
      {
        "time": "2:30 PM",
        "activity": "Walk the compliance team through the evidence your audit trail captures"
      },
      {
        "time": "3:30 PM",
        "activity": "Automate a fairness check inside the CI/CD gate for future releases"
      },
      {
        "time": "4:30 PM",
        "activity": "Set acceptance criteria with the product owner and update quality docs"
      }
    ],
    projectTimeline: [
      {
        "title": "Quality Criteria Definition",
        "duration": "1 week",
        "description": "You agree with product owners and compliance what accuracy, fairness and robustness standards a model must meet before it can ship.",
        "activities": [
          "Agree accuracy and fairness acceptance criteria",
          "Identify protected groups and sensitive use cases",
          "Confirm evidence compliance teams will require"
        ]
      },
      {
        "title": "Validation Automation",
        "duration": "2 weeks",
        "description": "You turn those criteria into automated checks that run on every model version, so quality is enforced rather than periodically inspected.",
        "activities": [
          "Automate accuracy and robustness test suites",
          "Add bias tooling to the validation flow",
          "Integrate checks as CI/CD release gates"
        ]
      },
      {
        "title": "Bias and Robustness Evaluation",
        "duration": "2 weeks",
        "description": "You run the model against skewed, noisy and adversarial inputs, then work with data scientists on the weaknesses you surface.",
        "activities": [
          "Evaluate performance across subgroup slices",
          "Probe robustness with noisy and adversarial inputs",
          "Review remediation options with the data scientists"
        ]
      },
      {
        "title": "QA Report and Sign-Off",
        "duration": "1 week",
        "description": "You document quality metrics, unresolved risks and monitoring needs in a report that compliance and product owners sign before deployment.",
        "activities": [
          "Compile quality metrics and fairness evidence",
          "Record residual risks and recommended monitoring",
          "Obtain sign-off from compliance and product owners"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Check overnight training runs on HPC and log the metric deltas"
      },
      {
        "time": "10:00 AM",
        "activity": "Read recent literature and pick one method worth reproducing this week"
      },
      {
        "time": "12:00 PM",
        "activity": "Attend the lunch seminar and question the visiting speaker's results"
      },
      {
        "time": "1:00 PM",
        "activity": "Prototype the algorithm in Python and test it on internal data"
      },
      {
        "time": "2:30 PM",
        "activity": "Discuss with product teams whether the result transfers to their problem"
      },
      {
        "time": "3:30 PM",
        "activity": "Mentor an intern through their ablation study and review their code"
      },
      {
        "time": "4:30 PM",
        "activity": "Draft the experiments section of an upcoming conference paper"
      }
    ],
    projectTimeline: [
      {
        "title": "Hypothesis and Design",
        "duration": "2 weeks",
        "description": "You choose a research question with a plausible product payoff, then design experiments precise enough that a negative result still teaches something.",
        "activities": [
          "Review literature and pick a tractable question",
          "Design experiments and choose evaluation metrics",
          "Agree the applied payoff with product managers"
        ]
      },
      {
        "title": "Prototype and Baselines",
        "duration": "3-4 weeks",
        "description": "You implement the method and reproduce credible baselines, since a new approach only means something measured against the honest alternative.",
        "activities": [
          "Implement the method with standard ML libraries",
          "Reproduce published baselines on shared datasets",
          "Work with data engineers on training datasets"
        ]
      },
      {
        "title": "Experimentation and Analysis",
        "duration": "4 weeks",
        "description": "You run experiment sweeps on HPC, analyze where the method wins and fails, and let interns own well-scoped ablations.",
        "activities": [
          "Run parameter sweeps and ablations on HPC",
          "Analyze failure cases and generalization limits",
          "Supervise interns running supporting experiments"
        ]
      },
      {
        "title": "Publication and Handoff",
        "duration": "3 weeks",
        "description": "You write the paper, share reproducible code, and help engineering understand what would be needed to run the method in a product.",
        "activities": [
          "Write and submit the conference paper",
          "Package reproducible code and experiment configs",
          "Brief engineering on productionization requirements"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Rehearse the demo flow and verify sandbox data loads before the call"
      },
      {
        "time": "10:00 AM",
        "activity": "Run a live solution demo for the prospect's technical evaluators"
      },
      {
        "time": "12:00 PM",
        "activity": "Eat between meetings while updating opportunity notes in the CRM"
      },
      {
        "time": "1:00 PM",
        "activity": "Diagram a target architecture mapping their data sources to cloud services"
      },
      {
        "time": "2:30 PM",
        "activity": "Code a scoped proof-of-concept proving the integration path actually works"
      },
      {
        "time": "3:30 PM",
        "activity": "Answer the client IT team's security and integration questions"
      },
      {
        "time": "4:30 PM",
        "activity": "Debrief with sales on objections and write up the proposed solution"
      }
    ],
    projectTimeline: [
      {
        "title": "Discovery and Scoping",
        "duration": "1 week",
        "description": "You meet the prospect's business and IT people to understand the problem, their existing stack, and what would count as proof.",
        "activities": [
          "Interview business and client IT stakeholders",
          "Document current data stack and constraints",
          "Define evaluation criteria with the sales team"
        ]
      },
      {
        "title": "Solution Architecture",
        "duration": "1-2 weeks",
        "description": "You design a target architecture on cloud platforms and AI APIs that fits their constraints, then socialize it before building anything.",
        "activities": [
          "Draft target architecture and integration points",
          "Validate security and compliance requirements",
          "Review the design with product teams"
        ]
      },
      {
        "title": "Proof-of-Concept Build",
        "duration": "2-3 weeks",
        "description": "You build a narrow but real implementation against their data, focused on the one or two risks that would kill the deal.",
        "activities": [
          "Build the POC against representative client data",
          "Prove the riskiest integration assumptions first",
          "Prepare demo narrative for business stakeholders"
        ]
      },
      {
        "title": "Validation and Handoff",
        "duration": "1 week",
        "description": "You present results to the client, resolve remaining technical objections, and transfer the design to implementation partners for delivery.",
        "activities": [
          "Present POC results and technical validation",
          "Resolve outstanding objections with client IT",
          "Hand architecture and notes to implementation partners"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Join the data engineering stand-up and review overnight Spark job failures"
      },
      {
        "time": "10:00 AM",
        "activity": "Update Terraform modules that provision new BigQuery datasets and service accounts"
      },
      {
        "time": "12:00 PM",
        "activity": "Break for lunch while skimming cloud release notes with teammates"
      },
      {
        "time": "1:00 PM",
        "activity": "Repartition a Spark job to cut load times into Redshift"
      },
      {
        "time": "2:30 PM",
        "activity": "Design review with data scientists on the feature pipeline they need"
      },
      {
        "time": "3:30 PM",
        "activity": "Migrate another batch of on-prem tables and reconcile row counts"
      },
      {
        "time": "4:30 PM",
        "activity": "Check IAM policies and storage encryption settings with the security team"
      }
    ],
    projectTimeline: [
      {
        "title": "Cloud Architecture Design",
        "duration": "Week 1",
        "description": "You map the on-prem warehouse, choose target cloud services, and design the landing, staging, and serving layers with cost estimates.",
        "activities": [
          "Inventory source tables, volumes, and refresh windows",
          "Draft target architecture and storage layout",
          "Estimate monthly compute and storage costs"
        ]
      },
      {
        "title": "Pipeline Build",
        "duration": "Weeks 2-3",
        "description": "You provision infrastructure with Terraform and build the Spark and serverless jobs that move and transform data into the warehouse.",
        "activities": [
          "Write Terraform for buckets, warehouse, and roles",
          "Build Spark ingestion and transformation jobs",
          "Add orchestration, retries, and failure alerting"
        ]
      },
      {
        "title": "Migration & Validation",
        "duration": "Weeks 3-4",
        "description": "You backfill historical data, run the old and new pipelines in parallel, and prove the cloud outputs match the legacy system.",
        "activities": [
          "Backfill history and verify row counts",
          "Run parallel loads against legacy outputs",
          "Resolve type and timezone mismatches"
        ]
      },
      {
        "title": "Tuning & Handover",
        "duration": "Week 4",
        "description": "You optimize partitioning and cluster sizing to control spend, lock down access, then document the pipeline for the wider team.",
        "activities": [
          "Tune partitioning, clustering, and cluster sizing",
          "Apply least-privilege IAM and audit logging",
          "Document runbooks and hand off to on-call"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Review overnight data-quality scorecards and flag domains breaching their thresholds"
      },
      {
        "time": "10:00 AM",
        "activity": "Draft retention and classification policy language for the customer data domain"
      },
      {
        "time": "12:00 PM",
        "activity": "Step away for lunch and read a regulatory update newsletter"
      },
      {
        "time": "1:00 PM",
        "activity": "Meet the compliance team about evidence needed for the upcoming audit"
      },
      {
        "time": "2:30 PM",
        "activity": "Update catalog entries and confirm ownership assignments with data stewards"
      },
      {
        "time": "3:30 PM",
        "activity": "Run a stewardship workshop on applying the new classification rules"
      },
      {
        "time": "4:30 PM",
        "activity": "Log policy exceptions and set the governance council agenda"
      }
    ],
    projectTimeline: [
      {
        "title": "Policy Development",
        "duration": "3-4 weeks",
        "description": "You draft classification, retention, and access policies for a priority data domain, reconciling regulatory obligations with how the business actually works.",
        "activities": [
          "Map regulatory obligations to data domains",
          "Draft classification and retention standards",
          "Socialize drafts with legal and security"
        ]
      },
      {
        "title": "Rollout & Cataloging",
        "duration": "4 weeks",
        "description": "You publish the approved policies, name stewards for each domain, and record ownership and sensitivity in the data catalog.",
        "activities": [
          "Assign stewards to every critical dataset",
          "Tag sensitivity and ownership in the catalog",
          "Publish policies and exception request process"
        ]
      },
      {
        "title": "Quality Metric Tracking",
        "duration": "4 weeks",
        "description": "You define data-quality measures for the domain, baseline current performance, and start reporting compliance trends to stewards and leadership.",
        "activities": [
          "Define completeness, accuracy, and timeliness measures",
          "Baseline current quality across key tables",
          "Publish monthly compliance scorecards for each domain"
        ]
      },
      {
        "title": "Audit Prep & Training",
        "duration": "3 weeks",
        "description": "You assemble evidence for the compliance audit, close outstanding gaps, and train staff so the standards hold without your daily prompting.",
        "activities": [
          "Collect policy and control evidence packages",
          "Remediate gaps found in readiness review",
          "Deliver training sessions for stewards and IT"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Sketch wireframes for the executive revenue dashboard before opening Tableau"
      },
      {
        "time": "10:00 AM",
        "activity": "Build the trended KPI view in Tableau and check color contrast"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch away from screens, then browse a visualization gallery"
      },
      {
        "time": "1:00 PM",
        "activity": "Walk product owners through the prototype and capture layout feedback"
      },
      {
        "time": "2:30 PM",
        "activity": "Rebuild a cluttered marketing chart as a simple ranked bar"
      },
      {
        "time": "3:30 PM",
        "activity": "Prototype a D3.js interaction the standard BI tools cannot render"
      },
      {
        "time": "4:30 PM",
        "activity": "Publish the updated workbook and note changes for the style guide"
      }
    ],
    projectTimeline: [
      {
        "title": "Requirements Gathering",
        "duration": "1 week",
        "description": "You interview executives and BI teammates to learn which decisions the dashboard must support and which numbers they already trust.",
        "activities": [
          "Interview executives about the decisions they make",
          "Audit existing reports for duplicate metrics",
          "Agree the handful of headline measures"
        ]
      },
      {
        "title": "Prototyping & Feedback",
        "duration": "1-2 weeks",
        "description": "You sketch layouts on paper, then build clickable mockups so stakeholders can react to structure and hierarchy before any data work hardens.",
        "activities": [
          "Sketch layout options and information hierarchy",
          "Build clickable mockups in Tableau or Power BI",
          "Test chart choices with a few users"
        ]
      },
      {
        "title": "Production Build",
        "duration": "2-3 weeks",
        "description": "You build the real dashboard against live data, applying accessible color, consistent formatting, and interactions that survive slow connections and small screens.",
        "activities": [
          "Connect live data and validate every figure",
          "Apply accessible palette and consistent formatting",
          "Tune filters, tooltips, and load performance"
        ]
      },
      {
        "title": "Launch & Style Guide",
        "duration": "1 week",
        "description": "You publish the dashboard, teach people how to read it, and fold the new patterns into the organization's visualization style guide.",
        "activities": [
          "Run walkthrough sessions for each audience",
          "Update the style guide with new patterns",
          "Collect usage feedback and fix rough edges"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Check overnight KPI refreshes and investigate any metric that moved sharply"
      },
      {
        "time": "10:00 AM",
        "activity": "Refine SQL definitions so retention counts match the finance ledger"
      },
      {
        "time": "12:00 PM",
        "activity": "Grab lunch with operations and hear their reporting frustrations"
      },
      {
        "time": "1:00 PM",
        "activity": "Rebuild the weekly performance dashboard using the corrected metric logic"
      },
      {
        "time": "2:30 PM",
        "activity": "Meet finance to reconcile revenue figures before the board pack"
      },
      {
        "time": "3:30 PM",
        "activity": "Run trend analysis in Excel to explain last month's fulfillment dip"
      },
      {
        "time": "4:30 PM",
        "activity": "Draft an insights memo recommending two operational fixes for leadership"
      }
    ],
    projectTimeline: [
      {
        "title": "Metric Discovery",
        "duration": "1-2 weeks",
        "description": "You work with finance, operations, and product to decide which KPIs actually reflect performance and how each should be defined precisely.",
        "activities": [
          "Interview each function about their targets",
          "Draft precise definitions and calculation rules",
          "Confirm data sources exist for every metric"
        ]
      },
      {
        "title": "Dashboard Development",
        "duration": "2-3 weeks",
        "description": "You write the SQL behind each KPI, build the dashboard in your BI tool, and add breakdowns people will inevitably ask for.",
        "activities": [
          "Write and test SQL for each KPI",
          "Build dashboard views by team and region",
          "Add trend lines and target comparisons"
        ]
      },
      {
        "title": "Validation & Rollout",
        "duration": "2 weeks",
        "description": "You reconcile every number against finance and operational records, fix the gaps, then train each team on reading their own view.",
        "activities": [
          "Reconcile figures against finance and ops records",
          "Fix definition mismatches surfaced in review",
          "Train teams on interpreting their dashboard"
        ]
      },
      {
        "title": "Impact Review",
        "duration": "2 weeks",
        "description": "You track whether the metrics changed any decisions, retire the views nobody opens, and recommend improvements to leadership based on early trends.",
        "activities": [
          "Review dashboard usage and open questions",
          "Retire metrics nobody acts on",
          "Present trend findings and recommendations to leadership"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Extend the entity relationship diagram covering new subscription and billing entities"
      },
      {
        "time": "10:00 AM",
        "activity": "Review taxonomy naming with UX designers so labels match user language"
      },
      {
        "time": "12:00 PM",
        "activity": "Break for lunch and sketch schema alternatives in a notebook"
      },
      {
        "time": "1:00 PM",
        "activity": "Consult developers on schema options for their new application"
      },
      {
        "time": "2:30 PM",
        "activity": "Document metadata standards and naming conventions for the modeling review"
      },
      {
        "time": "3:30 PM",
        "activity": "Present the domain model to the architecture board for approval"
      },
      {
        "time": "4:30 PM",
        "activity": "Work through indexing and partitioning implications with the DBAs"
      }
    ],
    projectTimeline: [
      {
        "title": "Discovery & Audit",
        "duration": "2-3 weeks",
        "description": "You inventory the existing schemas, vocabularies, and content structures, then document where duplication and inconsistent naming are hurting users and developers.",
        "activities": [
          "Inventory current schemas and naming conventions",
          "Interview developers and UX on pain points",
          "Document redundancy and structural gaps"
        ]
      },
      {
        "title": "Modeling & Taxonomy Design",
        "duration": "3-4 weeks",
        "description": "You build the conceptual and logical models, define the taxonomy and metadata framework, and validate both against real user tasks.",
        "activities": [
          "Draft conceptual and logical data models",
          "Design taxonomy and controlled vocabularies",
          "Validate structures against real user tasks"
        ]
      },
      {
        "title": "Implementation Guidance",
        "duration": "3-4 weeks",
        "description": "You translate the models into physical schema recommendations, review developer implementations, and adjust the design where performance realities demand compromise.",
        "activities": [
          "Turn logical models into physical schema guidance",
          "Review developer implementations against the model",
          "Adjust design for performance constraints"
        ]
      },
      {
        "title": "Governance Handoff",
        "duration": "2 weeks",
        "description": "You publish the standards, register the models and taxonomy with the governance function, and set the process for approving future changes.",
        "activities": [
          "Publish modeling and naming standards",
          "Register models with the governance function",
          "Define change review and approval process"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Sweep overnight OSINT feeds and tag items against standing collection requirements"
      },
      {
        "time": "10:00 AM",
        "activity": "Run pattern analysis linking incident reports across two research databases"
      },
      {
        "time": "12:00 PM",
        "activity": "Pause for lunch and trade source leads with fellow analysts"
      },
      {
        "time": "1:00 PM",
        "activity": "Draft a threat brief with confidence levels and clear sourcing notes"
      },
      {
        "time": "2:30 PM",
        "activity": "Brief the security team on an emerging risk to overseas sites"
      },
      {
        "time": "3:30 PM",
        "activity": "Corroborate a single-source claim before it enters the reporting system"
      },
      {
        "time": "4:30 PM",
        "activity": "Archive findings and update the collection plan with new gaps"
      }
    ],
    projectTimeline: [
      {
        "title": "Collection Planning",
        "duration": "1 week",
        "description": "You turn a leadership question into specific intelligence requirements, then decide which sources and platforms can realistically answer each one.",
        "activities": [
          "Break the question into intelligence requirements",
          "Map requirements to available sources",
          "Set collection schedule and reporting cadence"
        ]
      },
      {
        "title": "Deep-Dive Analysis",
        "duration": "2-3 weeks",
        "description": "You gather and evaluate material from open and internal sources, weigh source reliability, and test alternative explanations against the evidence.",
        "activities": [
          "Collect and grade material by source reliability",
          "Build timelines and link charts of activity",
          "Test alternative explanations against the evidence"
        ]
      },
      {
        "title": "Report Production",
        "duration": "1-2 weeks",
        "description": "You write the assessment with clear judgments and confidence levels, have peers challenge it, then brief executives and policy makers directly.",
        "activities": [
          "Write assessment with judgments and confidence levels",
          "Run peer review to challenge assumptions",
          "Brief executives and policy makers"
        ]
      },
      {
        "title": "Post-Action Review",
        "duration": "1 week",
        "description": "You check which judgments held up, record what the collection plan missed, and feed those lessons into the next requirements cycle.",
        "activities": [
          "Compare judgments against what actually happened",
          "Document collection gaps and source weaknesses",
          "Update standing requirements for the next cycle"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Run the overnight duplicate-record report across the customer master domain"
      },
      {
        "time": "10:00 AM",
        "activity": "Resolve survivorship conflicts where two source systems disagree on addresses"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch break, then a quick pass through the stewardship inbox"
      },
      {
        "time": "1:00 PM",
        "activity": "Adjust matching rules in the MDM platform and rerun profiling"
      },
      {
        "time": "2:30 PM",
        "activity": "Sync with the ETL team about a supplier feed breaking golden records"
      },
      {
        "time": "3:30 PM",
        "activity": "Help a business unit steward correct mismatched product hierarchy codes"
      },
      {
        "time": "4:30 PM",
        "activity": "Record weekly data-quality metrics in the metadata repository"
      }
    ],
    projectTimeline: [
      {
        "title": "Profiling & Rule Design",
        "duration": "3 weeks",
        "description": "You profile every source contributing to the domain, measure how badly records disagree, and design the matching and survivorship rules accordingly.",
        "activities": [
          "Profile each source system for the domain",
          "Quantify duplicates and conflicting attributes",
          "Draft matching, merge, and survivorship rules"
        ]
      },
      {
        "title": "Golden Record Build",
        "duration": "3-4 weeks",
        "description": "You configure the MDM platform, load source data, and tune the rules until the generated golden records survive steward review.",
        "activities": [
          "Configure match rules in the MDM platform",
          "Load sources and generate candidate golden records",
          "Tune thresholds after steward review batches"
        ]
      },
      {
        "title": "Integration & Sync",
        "duration": "3 weeks",
        "description": "You work with ETL teams so downstream systems consume the mastered records, and build the exception queue for cases automation cannot settle.",
        "activities": [
          "Publish mastered records to downstream systems",
          "Build exception queue for unmatched records",
          "Test round-trip updates from source systems"
        ]
      },
      {
        "title": "Monitoring & Stewardship",
        "duration": "2-3 weeks",
        "description": "You set up ongoing quality monitoring, train the business stewards who will own daily exceptions, and hand the process to governance.",
        "activities": [
          "Build quality dashboards and threshold alerts",
          "Train stewards on exception resolution",
          "Document standards and hand off to governance"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Check overnight job logs for stored procedures that ran unusually long"
      },
      {
        "time": "10:00 AM",
        "activity": "Read an execution plan and add a covering index for the slow report"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch, then a walk to shake off a stubborn query bug"
      },
      {
        "time": "1:00 PM",
        "activity": "Write a stored procedure powering the BI analysts' new sales report"
      },
      {
        "time": "2:30 PM",
        "activity": "Review a developer's schema change for normalization and indexing problems"
      },
      {
        "time": "3:30 PM",
        "activity": "Commit migration scripts to version control and open a pull request"
      },
      {
        "time": "4:30 PM",
        "activity": "Deploy migrations to staging with the DBA and verify backups"
      }
    ],
    projectTimeline: [
      {
        "title": "Requirement Intake",
        "duration": "3-5 days",
        "description": "You meet the BI analysts requesting a new reporting dataset, pin down the grain and filters, and check which tables can supply it.",
        "activities": [
          "Clarify report grain, filters, and refresh needs",
          "Trace required fields to source tables",
          "Flag missing data and modeling changes needed"
        ]
      },
      {
        "title": "Schema & Query Development",
        "duration": "2 weeks",
        "description": "You design the supporting tables or views, write the stored procedures, and keep everything in version control alongside repeatable migration scripts.",
        "activities": [
          "Design supporting tables, views, and keys",
          "Write stored procedures and transformation logic",
          "Version migration scripts in source control"
        ]
      },
      {
        "title": "QA & Performance Tuning",
        "duration": "1-2 weeks",
        "description": "You validate results against known figures, then profile execution plans and add indexing until the report runs within its window.",
        "activities": [
          "Validate output against known reference figures",
          "Profile execution plans on production-sized data",
          "Add indexes and rewrite costly joins"
        ]
      },
      {
        "title": "Release & Monitoring",
        "duration": "1 week",
        "description": "You deploy through staging with the DBA, confirm backup and rollback paths, then watch runtimes and locking for the first weeks.",
        "activities": [
          "Deploy migrations through staging to production",
          "Confirm backup and rollback procedures",
          "Monitor runtimes and blocking after release"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Triage new AI project intake forms and rank them by risk"
      },
      {
        "time": "10:00 AM",
        "activity": "Score a proposed model against the risk framework and document mitigations"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch while catching up on newly published regulatory guidance"
      },
      {
        "time": "1:00 PM",
        "activity": "Work with legal on disclosure wording for an automated decision"
      },
      {
        "time": "2:30 PM",
        "activity": "Update the model inventory and policy library after a deployment change"
      },
      {
        "time": "3:30 PM",
        "activity": "Brief executives on residual risk in the customer-facing assistant rollout"
      },
      {
        "time": "4:30 PM",
        "activity": "Run a short training for data teams on model documentation duties"
      }
    ],
    projectTimeline: [
      {
        "title": "Framework Development",
        "duration": "4 weeks",
        "description": "You adapt an established risk framework to your organization, defining risk tiers, review gates, and the documentation every AI system must carry.",
        "activities": [
          "Map regulatory obligations to AI use cases",
          "Define risk tiers and required review gates",
          "Draft model documentation and disclosure templates"
        ]
      },
      {
        "title": "Intake & Tool Rollout",
        "duration": "3-4 weeks",
        "description": "You stand up the intake process and model inventory so every AI project is registered, tiered, and routed to the right reviewers.",
        "activities": [
          "Launch intake forms and triage workflow",
          "Populate the model inventory with existing systems",
          "Configure policy management and approval routing"
        ]
      },
      {
        "title": "Assessment & Remediation",
        "duration": "4-6 weeks",
        "description": "You run risk assessments across registered systems, work with data teams on mitigations, and escalate the cases that cannot be brought into tolerance.",
        "activities": [
          "Assess registered models against the framework",
          "Agree mitigation plans with data teams",
          "Escalate systems exceeding risk tolerance"
        ]
      },
      {
        "title": "Audit & Education",
        "duration": "3 weeks",
        "description": "You assemble audit evidence, report residual risk to executives, and train teams so governance steps happen before deployment rather than after.",
        "activities": [
          "Compile evidence for internal and external audit",
          "Report residual risk to executives",
          "Deliver training for engineering and product teams"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Review monitoring dashboards for overnight autoscaling events and error spikes"
      },
      {
        "time": "10:00 AM",
        "activity": "Write infrastructure-as-code for a new environment and open the merge request"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch, then a coffee catch-up with the on-call DevOps engineer"
      },
      {
        "time": "1:00 PM",
        "activity": "Fix a flaky CI/CD deployment step blocking the developers' release"
      },
      {
        "time": "2:30 PM",
        "activity": "Right-size instances and commitments after reading the monthly cost report"
      },
      {
        "time": "3:30 PM",
        "activity": "Tighten network and security group rules flagged in configuration review"
      },
      {
        "time": "4:30 PM",
        "activity": "Run the incident post-mortem and assign follow-up automation work"
      }
    ],
    projectTimeline: [
      {
        "title": "Infrastructure Design",
        "duration": "1-2 weeks",
        "description": "You design the environment for a new product workload, covering networking, scaling, redundancy, and the cost envelope leadership has approved.",
        "activities": [
          "Design network topology and account structure",
          "Choose compute, scaling, and redundancy approach",
          "Model expected cost at projected load"
        ]
      },
      {
        "title": "Automated Deployment",
        "duration": "2-3 weeks",
        "description": "You codify the whole environment in infrastructure-as-code and wire it into CI/CD so builds reach production without manual console work.",
        "activities": [
          "Write reusable infrastructure-as-code modules for each tier",
          "Build CI/CD pipelines for application deploys",
          "Peer review and promote through environments"
        ]
      },
      {
        "title": "Monitoring & Optimization",
        "duration": "2 weeks",
        "description": "You instrument the stack with metrics, logs, and alerts, then tune autoscaling and instance choices against what real traffic actually does.",
        "activities": [
          "Instrument metrics, logs, and alert thresholds",
          "Tune autoscaling policies against real traffic",
          "Cut waste found in cost and usage reports"
        ]
      },
      {
        "title": "Resilience Testing",
        "duration": "1-2 weeks",
        "description": "You rehearse failure, restoring from backups and failing over regions, then rewrite the runbooks based on what actually broke.",
        "activities": [
          "Run failover and backup restore drills",
          "Measure recovery time against agreed targets",
          "Update runbooks and on-call documentation"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Triage overnight SIEM alerts and close out the false positives"
      },
      {
        "time": "10:00 AM",
        "activity": "Review vulnerability scanner output and prioritize critical findings for patching"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch break, then skim new advisories over coffee"
      },
      {
        "time": "1:00 PM",
        "activity": "Tighten over-permissive IAM roles surfaced by the least-privilege review"
      },
      {
        "time": "2:30 PM",
        "activity": "Walk DevOps through encryption requirements for a new data store"
      },
      {
        "time": "3:30 PM",
        "activity": "Read the penetration test report and log remediation tickets"
      },
      {
        "time": "4:30 PM",
        "activity": "Write up yesterday's incident timeline for the compliance team"
      }
    ],
    projectTimeline: [
      {
        "title": "Security Assessment",
        "duration": "2 weeks",
        "description": "You assess the cloud estate against a control baseline, scanning workloads and reviewing identity, encryption, and logging coverage across every account.",
        "activities": [
          "Scan workloads and misconfigured cloud services",
          "Review IAM permissions and key management",
          "Rank findings by exploitability and blast radius"
        ]
      },
      {
        "title": "Remediation Sprint",
        "duration": "3-4 weeks",
        "description": "You fix the highest-risk findings alongside DevOps, enforcing encryption and least privilege, and add guardrails that stop the same drift returning.",
        "activities": [
          "Close critical findings with owning teams",
          "Enforce encryption and least-privilege defaults",
          "Add preventive guardrails and policy checks"
        ]
      },
      {
        "title": "Detection & Compliance",
        "duration": "2-3 weeks",
        "description": "You tune SIEM rules so real threats surface above the noise, then evidence the control set for the compliance audit.",
        "activities": [
          "Tune SIEM detections and reduce alert noise",
          "Map controls to the compliance framework",
          "Assemble audit evidence with compliance colleagues"
        ]
      },
      {
        "title": "Incident Readiness",
        "duration": "1-2 weeks",
        "description": "You rehearse a cloud breach scenario with security and DevOps, time the response, and rewrite the playbooks where the exercise exposed gaps.",
        "activities": [
          "Run a tabletop exercise with responders",
          "Test containment and credential rotation steps",
          "Revise incident playbooks and escalation paths"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Join stand-up and pick up the checkout redesign ticket"
      },
      {
        "time": "10:00 AM",
        "activity": "Build the React component from the designer's latest mockup"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch, then pair briefly on a stubborn layout bug"
      },
      {
        "time": "1:00 PM",
        "activity": "Extend the Node.js endpoint and write the accompanying database migration"
      },
      {
        "time": "2:30 PM",
        "activity": "Wire the front end to a data scientist's scoring service"
      },
      {
        "time": "3:30 PM",
        "activity": "Write unit and integration tests, then push through the CI pipeline"
      },
      {
        "time": "4:30 PM",
        "activity": "Review a teammate's pull request and leave specific comments"
      }
    ],
    projectTimeline: [
      {
        "title": "Sprint Planning",
        "duration": "2-3 days",
        "description": "You break the feature into tickets with product and design, agree the API contract, and flag the database changes the work will need.",
        "activities": [
          "Break the feature into estimated tickets",
          "Agree API contract with consumers",
          "Identify schema and migration changes"
        ]
      },
      {
        "title": "Feature Development",
        "duration": "1 week",
        "description": "You build the interface against the design files and the backing endpoints in parallel, keeping branches small and reviewable in Git.",
        "activities": [
          "Build React components from design files",
          "Implement backend endpoints and data access",
          "Open small pull requests for review"
        ]
      },
      {
        "title": "Integration & Testing",
        "duration": "3-4 days",
        "description": "You connect the front end to real services, including any model endpoint from the data scientists, and cover the flow with automated tests.",
        "activities": [
          "Connect UI to live APIs and services",
          "Write unit and end-to-end tests",
          "Fix defects found in QA review"
        ]
      },
      {
        "title": "Release & Retrospective",
        "duration": "2-3 days",
        "description": "You ship through the CI/CD pipeline behind a flag, watch errors and performance with DevOps, then run the team retrospective.",
        "activities": [
          "Deploy behind a feature flag",
          "Watch error rates and performance after release",
          "Run retrospective and log follow-up work"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Review catalog entries harvested overnight and fill in missing descriptions"
      },
      {
        "time": "10:00 AM",
        "activity": "Curate tags and business terms for the finance data domain"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch, then a look through analyst search logs for gaps"
      },
      {
        "time": "1:00 PM",
        "activity": "Audit column-level lineage from the ETL tool into the catalog"
      },
      {
        "time": "2:30 PM",
        "activity": "Meet the governance team to confirm owners for orphaned datasets"
      },
      {
        "time": "3:30 PM",
        "activity": "Write glossary definitions with a steward and link related terms"
      },
      {
        "time": "4:30 PM",
        "activity": "Reshape the taxonomy so analysts can find shipment tables faster"
      }
    ],
    projectTimeline: [
      {
        "title": "Catalog Rollout",
        "duration": "3-4 weeks",
        "description": "You connect the catalog to priority source systems, harvest technical metadata automatically, and confirm the crawlers see the tables analysts actually use.",
        "activities": [
          "Connect catalog to priority source systems",
          "Configure harvesting and refresh schedules",
          "Verify coverage of high-traffic datasets"
        ]
      },
      {
        "title": "Metadata Enrichment",
        "duration": "4-5 weeks",
        "description": "You add the context machines cannot infer: business definitions, owners, sensitivity tags, and lineage from ETL jobs through to reporting tables.",
        "activities": [
          "Write business definitions and glossary terms",
          "Tag ownership, sensitivity, and certification status",
          "Trace and document lineage through ETL jobs"
        ]
      },
      {
        "title": "Discoverability Tuning",
        "duration": "2-3 weeks",
        "description": "You test how analysts actually search, then reshape taxonomy, synonyms, and naming so the right dataset appears in the first few results.",
        "activities": [
          "Test real analyst searches against the catalog",
          "Add synonyms and refine taxonomy branches",
          "Retire or merge duplicate catalog entries"
        ]
      },
      {
        "title": "Stewardship & Alignment",
        "duration": "2-3 weeks",
        "description": "You train stewards to maintain their own entries and agree with governance how metadata quality will be measured going forward.",
        "activities": [
          "Train stewards on maintaining their entries",
          "Agree metadata completeness targets with governance",
          "Set review cadence for stale entries"
        ]
      }
    ],
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
    },
    schedule: [
      {
        "time": "9:00 AM",
        "activity": "Check serving dashboards for overnight latency spikes and error rates"
      },
      {
        "time": "10:00 AM",
        "activity": "Wrap a data scientist's trained model behind a versioned inference API"
      },
      {
        "time": "12:00 PM",
        "activity": "Lunch, then read a paper the research channel is discussing"
      },
      {
        "time": "1:00 PM",
        "activity": "Add a feature flag so product can ramp the model gradually"
      },
      {
        "time": "2:30 PM",
        "activity": "Benchmark batching and caching to bring p95 latency down"
      },
      {
        "time": "3:30 PM",
        "activity": "Rebuild the Docker image and roll out to the staging cluster"
      },
      {
        "time": "4:30 PM",
        "activity": "Work with QA on test cases for unexpected model outputs"
      }
    ],
    projectTimeline: [
      {
        "title": "Model Integration",
        "duration": "1-2 weeks",
        "description": "You take a notebook model from the data scientists and turn it into versioned, testable code with reproducible dependencies and preprocessing.",
        "activities": [
          "Port notebook code into a versioned package",
          "Pin dependencies and reproduce training outputs",
          "Move preprocessing into shared serving code"
        ]
      },
      {
        "title": "Service & API Build",
        "duration": "2-3 weeks",
        "description": "You build the inference service around the model, define the API contract product teams will call, and containerize it for the cluster.",
        "activities": [
          "Define and document the inference API contract",
          "Build the service with validation and fallbacks",
          "Containerize and add health checks"
        ]
      },
      {
        "title": "Performance Tuning",
        "duration": "1-2 weeks",
        "description": "You load-test the service, then cut latency and cost through batching, caching, and right-sized resources until it meets the agreed targets.",
        "activities": [
          "Load-test against expected production traffic",
          "Apply batching, caching, and model optimizations",
          "Right-size CPU, memory, and replica counts"
        ]
      },
      {
        "title": "Release & Monitoring",
        "duration": "1-2 weeks",
        "description": "You ship behind a flag with a gradual ramp, then monitor latency, errors, and prediction drift alongside the data scientists.",
        "activities": [
          "Roll out gradually behind a feature flag",
          "Add latency, error, and drift monitoring",
          "Set alerts and rollback procedure with DevOps"
        ]
      }
    ],
  }
];
