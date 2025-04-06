export interface DataCareerRole {
  id: string;
  title: string;
  shortDescription: string;
  longDescription?: string;
  category: string;
  skills: string[];
  tools: string[];
  responsibilities?: string[];
  collaborators?: string[];
  dayInLife?: string;
  monthInLife?: string;
  careerPath?: {
    description?: string;
    progressionSteps?: {
      title: string;
      description: string;
      timePeriod?: string;
    }[];
  };
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
  courses?: {
    id: string;
    title: string;
    description: string;
  }[];
}

export const dataCareerRoles: DataCareerRole[] = [
  {
    id: "ai-consultant",
    title: "AI Consultant",
    shortDescription: "Advise organizations on AI strategy and implementation",
    category: "AI/ML",
    skills: ["Strategic Thinking", "Problem Solving", "Communication", "Project Management", "Business Acumen"],
    tools: ["PowerPoint", "Jupyter", "Azure ML", "Figma", "Miro"],
    responsibilities: [
      "Develop AI strategy and roadmap for clients",
      "Lead workshops and discovery sessions",
      "Design solution architecture for AI implementations",
      "Build business cases and ROI models",
      "Present recommendations to executive stakeholders"
    ],
    collaborators: ["Data Scientists", "Business Stakeholders", "IT Teams", "Executive Leadership"],
    dayInLife: "Begin with a stand‑up call to review client AI road‑map progress; spend late morning white‑boarding a solution architecture; afternoon on‑site or remote workshops to scope pilots; close the day refining ROI estimates and drafting an executive summary.",
    monthInLife: "Typical month cycles through discovery workshops (wk 1), solution design + POC build (wk 2‑3), and pilot review / roadmap updates (wk 4). Travel or virtual sessions with multiple clients are common.",
    careerPath: {
      description: "AI Consultants typically progress from delivering projects to leading teams and ultimately owning client relationships and practice development.",
      progressionSteps: [
        {
          title: "Associate AI Consultant",
          description: "Support senior consultants on client engagements, develop technical skills, and contribute to deliverables.",
          timePeriod: "1-2 years"
        },
        {
          title: "Senior AI Consultant",
          description: "Lead workstreams, manage client relationships, and develop solutions independently.",
          timePeriod: "2-4 years"
        },
        {
          title: "Principal / Engagement Lead",
          description: "Oversee multiple client engagements, lead teams, and contribute to practice development.",
          timePeriod: "4-7 years"
        },
        {
          title: "AI Practice Director / VP of AI Strategy",
          description: "Shape practice direction, build client relationships, and grow the business.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "ai-test-engineer",
    title: "AI Test Engineer",
    shortDescription: "Design and implement tests for AI systems and models",
    category: "AI/ML",
    skills: ["Test Automation", "Critical Thinking", "Statistics", "Python", "Bug Reporting"],
    tools: ["pytest", "TensorFlow", "GitHub Actions", "Jenkins", "Datadog"],
    responsibilities: [
      "Design test cases for machine learning models",
      "Develop automated testing frameworks for AI applications",
      "Identify and report model errors and edge cases",
      "Validate model performance across diverse datasets",
      "Document test results and quality metrics"
    ],
    collaborators: ["Data Scientists", "MLOps Engineers", "Software Developers", "Product Managers"],
    dayInLife: "Start by pulling last night's model build to run regression tests; mid‑morning triage failed cases with DS & MLOps; afternoon writing new pytest suites and bias tests; finish by updating CI dashboards.",
    monthInLife: "First week designs the test plan; next two weeks automate and integrate tests into the pipeline; final week compiles a quality report and leads a go/no‑go meeting before model release.",
    careerPath: {
      description: "AI Test Engineers typically progress from building test cases to designing comprehensive testing frameworks and leading quality initiatives for AI systems.",
      progressionSteps: [
        {
          title: "AI QA Analyst",
          description: "Execute test cases, identify issues, and assist with test automation for AI systems.",
          timePeriod: "1-2 years"
        },
        {
          title: "AI Test Engineer",
          description: "Design test strategies, build automated frameworks, and ensure quality of AI models.",
          timePeriod: "2-4 years"
        },
        {
          title: "QA Lead (AI)",
          description: "Lead testing teams, establish best practices, and collaborate with cross-functional stakeholders.",
          timePeriod: "4-7 years"
        },
        {
          title: "AI Quality Engineering Manager / Director of AI Validation",
          description: "Set quality strategy, build testing centers of excellence, and drive organizational standards.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "applied-scientist",
    title: "Applied Scientist",
    shortDescription: "Develop and implement machine learning models for specific applications",
    longDescription: "Applied Scientists focus on the practical application of machine learning techniques to solve real-world problems. They work on developing, testing, and deploying models that can be used in various industries, such as healthcare, finance, and transportation.",
    category: "AI/ML",
    skills: ["Machine Learning", "Python", "Experiment Design", "Data Analysis", "Model Deployment"],
    tools: ["TensorFlow", "PyTorch", "Scikit-learn", "AWS SageMaker", "Jupyter"],
    responsibilities: [
      "Develop and implement machine learning models for specific applications",
      "Design and conduct experiments to evaluate model performance",
      "Collaborate with engineers to deploy models in production",
      "Analyze data to identify opportunities for improvement",
      "Stay up-to-date with the latest advancements in machine learning"
    ],
    collaborators: ["Data Scientists", "Software Engineers", "Product Managers", "Domain Experts"],
    dayInLife: "Morning: Review model performance metrics and identify areas for improvement. Afternoon: Experiment with new algorithms and techniques to enhance model accuracy. Evening: Collaborate with engineers to deploy models in production.",
    monthInLife: "Week 1: Data collection and preprocessing. Week 2: Model development and training. Week 3: Experimentation and evaluation. Week 4: Deployment and monitoring.",
    careerPath: {
      description: "Applied Scientists typically progress from developing models to leading teams and projects, and eventually becoming research leaders or technical directors.",
      progressionSteps: [
        {
          title: "Junior Applied Scientist",
          description: "Assist with model development, data analysis, and experiment design.",
          timePeriod: "1-2 years"
        },
        {
          title: "Applied Scientist",
          description: "Develop and implement machine learning models for specific applications.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Applied Scientist",
          description: "Lead projects, mentor junior scientists, and develop new algorithms and techniques.",
          timePeriod: "4-7 years"
        },
        {
          title: "Principal Applied Scientist / Research Director",
          description: "Set research direction, lead teams, and drive innovation in machine learning.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "machine-learning-engineer",
    title: "Machine Learning Engineer",
    shortDescription: "Build and deploy machine learning models in production systems",
    longDescription: "Machine Learning Engineers focus on the practical aspects of building and deploying machine learning models. They work on developing scalable and reliable systems that can handle large amounts of data and traffic.",
    category: "AI/ML, Data Engineering",
    skills: ["Machine Learning", "Python", "Cloud Computing", "DevOps", "Software Engineering"],
    tools: ["TensorFlow", "PyTorch", "Kubernetes", "Docker", "AWS"],
    responsibilities: [
      "Build and deploy machine learning models in production systems",
      "Develop scalable and reliable systems for handling large amounts of data",
      "Automate the training and deployment of machine learning models",
      "Monitor model performance and identify areas for improvement",
      "Collaborate with data scientists and software engineers to build end-to-end solutions"
    ],
    collaborators: ["Data Scientists", "Software Engineers", "DevOps Engineers", "Product Managers"],
    dayInLife: "Morning: Monitor model performance and identify areas for improvement. Afternoon: Automate the training and deployment of machine learning models. Evening: Collaborate with data scientists and software engineers to build end-to-end solutions.",
    monthInLife: "Week 1: Infrastructure setup and configuration. Week 2: Model deployment and monitoring. Week 3: Automation and scaling. Week 4: Performance optimization and troubleshooting.",
    careerPath: {
      description: "Machine Learning Engineers typically progress from building and deploying models to leading teams and projects, and eventually becoming engineering managers or technical directors.",
      progressionSteps: [
        {
          title: "Junior Machine Learning Engineer",
          description: "Assist with model deployment, infrastructure setup, and automation.",
          timePeriod: "1-2 years"
        },
        {
          title: "Machine Learning Engineer",
          description: "Build and deploy machine learning models in production systems.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Machine Learning Engineer",
          description: "Lead projects, mentor junior engineers, and develop new systems and tools.",
          timePeriod: "4-7 years"
        },
        {
          title: "Principal Machine Learning Engineer / Engineering Manager",
          description: "Set engineering direction, lead teams, and drive innovation in machine learning infrastructure.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    shortDescription: "Analyze data to identify trends, patterns, and insights",
    longDescription: "Data Scientists use statistical and machine learning techniques to analyze data and extract insights. They work on a variety of problems, such as predicting customer behavior, identifying fraud, and optimizing business processes.",
    category: "AI/ML, Analytics",
    skills: ["Statistics", "Machine Learning", "Python", "Data Visualization", "Communication"],
    tools: ["Python", "R", "Tableau", "SQL", "Jupyter"],
    responsibilities: [
      "Analyze data to identify trends, patterns, and insights",
      "Develop and implement machine learning models",
      "Communicate findings to stakeholders",
      "Collaborate with engineers to deploy models in production",
      "Stay up-to-date with the latest advancements in data science"
    ],
    collaborators: ["Software Engineers", "Product Managers", "Business Analysts", "Domain Experts"],
    dayInLife: "Morning: Analyze data to identify trends and patterns. Afternoon: Develop and implement machine learning models. Evening: Communicate findings to stakeholders.",
    monthInLife: "Week 1: Data collection and preprocessing. Week 2: Model development and training. Week 3: Experimentation and evaluation. Week 4: Communication and deployment.",
    careerPath: {
      description: "Data Scientists typically progress from analyzing data to leading teams and projects, and eventually becoming research leaders or technical directors.",
      progressionSteps: [
        {
          title: "Junior Data Scientist",
          description: "Assist with data analysis, model development, and communication.",
          timePeriod: "1-2 years"
        },
        {
          title: "Data Scientist",
          description: "Analyze data to identify trends, patterns, and insights.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Data Scientist",
          description: "Lead projects, mentor junior scientists, and develop new algorithms and techniques.",
          timePeriod: "4-7 years"
        },
        {
          title: "Principal Data Scientist / Research Director",
          description: "Set research direction, lead teams, and drive innovation in data science.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "business-intelligence-analyst",
    title: "Business Intelligence Analyst",
    shortDescription: "Analyze business data to identify trends and insights",
    category: "Business Intelligence, Analytics",
    skills: ["Data Analysis", "SQL", "Data Visualization", "Communication", "Business Acumen"],
    tools: ["Tableau", "Power BI", "Excel", "SQL", "Python"],
    responsibilities: [
      "Collect and analyze business data to identify trends and insights",
      "Develop and maintain dashboards and reports",
      "Communicate findings to stakeholders",
      "Collaborate with business users to understand their needs",
      "Stay up-to-date with the latest advancements in business intelligence"
    ],
    collaborators: ["Business Users", "Data Scientists", "Software Engineers", "Product Managers"],
    dayInLife: "Morning: Collect and analyze business data. Afternoon: Develop and maintain dashboards and reports. Evening: Communicate findings to stakeholders.",
    monthInLife: "Week 1: Data collection and preprocessing. Week 2: Dashboard development and maintenance. Week 3: Analysis and communication. Week 4: Planning and strategy.",
    careerPath: {
      description: "Business Intelligence Analysts typically progress from analyzing data to leading teams and projects, and eventually becoming business intelligence managers or directors.",
      progressionSteps: [
        {
          title: "Junior Business Intelligence Analyst",
          description: "Assist with data collection, dashboard development, and analysis.",
          timePeriod: "1-2 years"
        },
        {
          title: "Business Intelligence Analyst",
          description: "Collect and analyze business data to identify trends and insights.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Business Intelligence Analyst",
          description: "Lead projects, mentor junior analysts, and develop new dashboards and reports.",
          timePeriod: "4-7 years"
        },
        {
          title: "Business Intelligence Manager / Director",
          description: "Set business intelligence strategy, lead teams, and drive innovation in business intelligence.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "data-engineer",
    title: "Data Engineer",
    shortDescription: "Build and maintain data pipelines and infrastructure",
    category: "Data Engineering",
    skills: ["SQL", "Python", "Cloud Computing", "ETL", "Data Warehousing"],
    tools: ["AWS", "Azure", "GCP", "Spark", "Kafka"],
    responsibilities: [
      "Build and maintain data pipelines and infrastructure",
      "Develop and implement ETL processes",
      "Design and implement data warehouses",
      "Monitor data quality and performance",
      "Collaborate with data scientists and business analysts to understand their needs"
    ],
    collaborators: ["Data Scientists", "Business Analysts", "Software Engineers", "DevOps Engineers"],
    dayInLife: "Morning: Monitor data pipelines and troubleshoot issues. Afternoon: Develop and implement ETL processes. Evening: Design and implement data warehouses.",
    monthInLife: "Week 1: Infrastructure setup and configuration. Week 2: ETL development and implementation. Week 3: Data warehouse design and implementation. Week 4: Monitoring and maintenance.",
    careerPath: {
      description: "Data Engineers typically progress from building and maintaining data pipelines to leading teams and projects, and eventually becoming data engineering managers or directors.",
      progressionSteps: [
        {
          title: "Junior Data Engineer",
          description: "Assist with data pipeline development, infrastructure setup, and ETL processes.",
          timePeriod: "1-2 years"
        },
        {
          title: "Data Engineer",
          description: "Build and maintain data pipelines and infrastructure.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Data Engineer",
          description: "Lead projects, mentor junior engineers, and develop new data pipelines and infrastructure.",
          timePeriod: "4-7 years"
        },
        {
          title: "Data Engineering Manager / Director",
          description: "Set data engineering strategy, lead teams, and drive innovation in data engineering.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "data-architect",
    title: "Data Architect",
    shortDescription: "Design and implement data management systems",
    category: "Data Engineering",
    skills: ["Data Modeling", "Data Governance", "Cloud Computing", "SQL", "ETL"],
    tools: ["AWS", "Azure", "GCP", "Informatica", "Talend"],
    responsibilities: [
      "Design and implement data management systems",
      "Develop and maintain data models",
      "Establish and enforce data governance policies",
      "Collaborate with data engineers and business analysts to understand their needs",
      "Stay up-to-date with the latest advancements in data management"
    ],
    collaborators: ["Data Engineers", "Business Analysts", "Software Engineers", "Data Scientists"],
    dayInLife: "Morning: Design and implement data models. Afternoon: Establish and enforce data governance policies. Evening: Collaborate with data engineers and business analysts.",
    monthInLife: "Week 1: Data modeling and design. Week 2: Data governance and policy development. Week 3: Implementation and testing. Week 4: Monitoring and maintenance.",
    careerPath: {
      description: "Data Architects typically progress from designing and implementing data management systems to leading teams and projects, and eventually becoming data architecture managers or directors.",
      progressionSteps: [
        {
          title: "Junior Data Architect",
          description: "Assist with data modeling, data governance, and implementation.",
          timePeriod: "1-2 years"
        },
        {
          title: "Data Architect",
          description: "Design and implement data management systems.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Data Architect",
          description: "Lead projects, mentor junior architects, and develop new data management systems.",
          timePeriod: "4-7 years"
        },
        {
          title: "Data Architecture Manager / Director",
          description: "Set data architecture strategy, lead teams, and drive innovation in data architecture.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "database-administrator",
    title: "Database Administrator",
    shortDescription: "Manage and maintain databases",
    category: "Data Engineering",
    skills: ["SQL", "Database Management", "Performance Tuning", "Backup and Recovery", "Security"],
    tools: ["MySQL", "PostgreSQL", "Oracle", "SQL Server", "MongoDB"],
    responsibilities: [
      "Manage and maintain databases",
      "Ensure database performance and availability",
      "Implement backup and recovery procedures",
      "Enforce database security policies",
      "Collaborate with developers and system administrators to understand their needs"
    ],
    collaborators: ["Developers", "System Administrators", "Data Engineers", "Security Engineers"],
    dayInLife: "Morning: Monitor database performance and troubleshoot issues. Afternoon: Implement backup and recovery procedures. Evening: Enforce database security policies.",
    monthInLife: "Week 1: Database monitoring and maintenance. Week 2: Backup and recovery testing. Week 3: Security audits and policy enforcement. Week 4: Planning and strategy.",
    careerPath: {
      description: "Database Administrators typically progress from managing and maintaining databases to leading teams and projects, and eventually becoming database administration managers or directors.",
      progressionSteps: [
        {
          title: "Junior Database Administrator",
          description: "Assist with database monitoring, maintenance, and backup and recovery.",
          timePeriod: "1-2 years"
        },
        {
          title: "Database Administrator",
          description: "Manage and maintain databases.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Database Administrator",
          description: "Lead projects, mentor junior administrators, and develop new database management systems.",
          timePeriod: "4-7 years"
        },
        {
          title: "Database Administration Manager / Director",
          description: "Set database administration strategy, lead teams, and drive innovation in database administration.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "analytics-engineer",
    title: "Analytics Engineer",
    shortDescription: "Transform raw data into usable datasets for analysis",
    category: "Analytics, Data Engineering",
    skills: ["SQL", "Data Modeling", "ETL", "Data Warehousing", "Cloud Computing"],
    tools: ["dbt", "Snowflake", "BigQuery", "Redshift", "Airflow"],
    responsibilities: [
      "Transform raw data into usable datasets for analysis",
      "Develop and maintain data models",
      "Build and maintain ETL pipelines",
      "Ensure data quality and consistency",
      "Collaborate with data scientists and business analysts to understand their needs"
    ],
    collaborators: ["Data Scientists", "Business Analysts", "Data Engineers", "Software Engineers"],
    dayInLife: "Morning: Develop and maintain data models. Afternoon: Build and maintain ETL pipelines. Evening: Ensure data quality and consistency.",
    monthInLife: "Week 1: Data modeling and design. Week 2: ETL development and implementation. Week 3: Data quality and testing. Week 4: Monitoring and maintenance.",
    careerPath: {
      description: "Analytics Engineers typically progress from transforming data to leading teams and projects, and eventually becoming analytics engineering managers or directors.",
      progressionSteps: [
        {
          title: "Junior Analytics Engineer",
          description: "Assist with data modeling, ETL development, and data quality.",
          timePeriod: "1-2 years"
        },
        {
          title: "Analytics Engineer",
          description: "Transform raw data into usable datasets for analysis.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Analytics Engineer",
          description: "Lead projects, mentor junior engineers, and develop new data models and ETL pipelines.",
          timePeriod: "4-7 years"
        },
        {
          title: "Analytics Engineering Manager / Director",
          description: "Set analytics engineering strategy, lead teams, and drive innovation in analytics engineering.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "marketing-analyst",
    title: "Marketing Analyst",
    shortDescription: "Analyze marketing data to optimize campaigns and strategies",
    category: "Analytics",
    skills: ["Data Analysis", "SQL", "Data Visualization", "Marketing Automation", "A/B Testing"],
    tools: ["Google Analytics", "Adobe Analytics", "Tableau", "Excel", "HubSpot"],
    responsibilities: [
      "Analyze marketing data to optimize campaigns and strategies",
      "Develop and maintain dashboards and reports",
      "Conduct A/B tests to improve marketing performance",
      "Collaborate with marketing managers to understand their needs",
      "Stay up-to-date with the latest advancements in marketing analytics"
    ],
    collaborators: ["Marketing Managers", "Data Scientists", "Business Analysts", "Product Managers"],
    dayInLife: "Morning: Analyze marketing data and identify trends. Afternoon: Develop and maintain dashboards and reports. Evening: Conduct A/B tests to improve marketing performance.",
    monthInLife: "Week 1: Data collection and preprocessing. Week 2: Dashboard development and maintenance. Week 3: Analysis and communication. Week 4: Planning and strategy.",
    careerPath: {
      description: "Marketing Analysts typically progress from analyzing data to leading teams and projects, and eventually becoming marketing analytics managers or directors.",
      progressionSteps: [
        {
          title: "Junior Marketing Analyst",
          description: "Assist with data collection, dashboard development, and analysis.",
          timePeriod: "1-2 years"
        },
        {
          title: "Marketing Analyst",
          description: "Analyze marketing data to optimize campaigns and strategies.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Marketing Analyst",
          description: "Lead projects, mentor junior analysts, and develop new dashboards and reports.",
          timePeriod: "4-7 years"
        },
        {
          title: "Marketing Analytics Manager / Director",
          description: "Set marketing analytics strategy, lead teams, and drive innovation in marketing analytics.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "financial-analyst",
    title: "Financial Analyst",
    shortDescription: "Analyze financial data to provide insights and recommendations",
    category: "Analytics",
    skills: ["Data Analysis", "Financial Modeling", "SQL", "Data Visualization", "Communication"],
    tools: ["Excel", "Tableau", "Bloomberg Terminal", "FactSet", "Python"],
    responsibilities: [
      "Analyze financial data to provide insights and recommendations",
      "Develop and maintain financial models",
      "Prepare reports and presentations for management",
      "Collaborate with finance managers to understand their needs",
      "Stay up-to-date with the latest advancements in financial analysis"
    ],
    collaborators: ["Finance Managers", "Data Scientists", "Business Analysts", "Investment Bankers"],
    dayInLife: "Morning: Analyze financial data and identify trends. Afternoon: Develop and maintain financial models. Evening: Prepare reports and presentations for management.",
    monthInLife: "Week 1: Data collection and preprocessing. Week 2: Financial model development and maintenance. Week 3: Analysis and communication. Week 4: Planning and strategy.",
    careerPath: {
      description: "Financial Analysts typically progress from analyzing data to leading teams and projects, and eventually becoming finance managers or directors.",
      progressionSteps: [
        {
          title: "Junior Financial Analyst",
          description: "Assist with data collection, financial model development, and analysis.",
          timePeriod: "1-2 years"
        },
        {
          title: "Financial Analyst",
          description: "Analyze financial data to provide insights and recommendations.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Financial Analyst",
          description: "Lead projects, mentor junior analysts, and develop new financial models and reports.",
          timePeriod: "4-7 years"
        },
        {
          title: "Finance Manager / Director",
          description: "Set finance strategy, lead teams, and drive innovation in financial analysis.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "operations-analyst",
    title: "Operations Analyst",
    shortDescription: "Analyze operational data to improve efficiency and productivity",
    category: "Analytics",
    skills: ["Data Analysis", "SQL", "Data Visualization", "Process Improvement", "Communication"],
    tools: ["Excel", "Tableau", "SQL", "Python", "Six Sigma"],
    responsibilities: [
      "Analyze operational data to improve efficiency and productivity",
      "Develop and maintain dashboards and reports",
      "Identify and implement process improvements",
      "Collaborate with operations managers to understand their needs",
      "Stay up-to-date with the latest advancements in operations analysis"
    ],
    collaborators: ["Operations Managers", "Data Scientists", "Business Analysts", "Process Engineers"],
    dayInLife: "Morning: Analyze operational data and identify trends. Afternoon: Develop and maintain dashboards and reports. Evening: Identify and implement process improvements.",
    monthInLife: "Week 1: Data collection and preprocessing. Week 2: Dashboard development and maintenance. Week 3: Analysis and communication. Week 4: Planning and strategy.",
    careerPath: {
      description: "Operations Analysts typically progress from analyzing data to leading teams and projects, and eventually becoming operations managers or directors.",
      progressionSteps: [
        {
          title: "Junior Operations Analyst",
          description: "Assist with data collection, dashboard development, and analysis.",
          timePeriod: "1-2 years"
        },
        {
          title: "Operations Analyst",
          description: "Analyze operational data to improve efficiency and productivity.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Operations Analyst",
          description: "Lead projects, mentor junior analysts, and develop new dashboards and reports.",
          timePeriod: "4-7 years"
        },
        {
          title: "Operations Manager / Director",
          description: "Set operations strategy, lead teams, and drive innovation in operations analysis.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "computer-information-research-scientist",
    title: "Computer & Information Research Scientist",
    shortDescription: "Research and develop new computing approaches and technologies",
    category: "AI/ML, Data Engineering",
    skills: ["Research", "Algorithms", "Data Structures", "Programming", "Mathematics"],
    tools: ["Python", "C++", "Java", "MATLAB", "TensorFlow"],
    responsibilities: [
      "Conduct research in computer and information science",
      "Develop new algorithms and data structures",
      "Publish research papers and present findings at conferences",
      "Collaborate with other researchers and engineers",
      "Stay up-to-date with the latest advancements in computer science"
    ],
    collaborators: ["Researchers", "Engineers", "Data Scientists", "Professors"],
    dayInLife: "Morning literature review & code experiments; midday simulation runs on HPC cluster; afternoon seminar or cross‑team brainstorm; evening documenting results for a paper draft.",
    monthInLife: "Quarter is split into ideation & proposal (mo 1), experimentation (mo 2), and publication / patent filing (mo 3). Teaching or mentoring often layered throughout.",
    careerPath: {
      description: "Research Scientists progress through increasingly independent research roles, culminating in leading research teams or programs.",
      progressionSteps: [
        {
          title: "Post‑doc / Junior Scientist",
          description: "Conduct research under supervision, publish papers, and develop specialized expertise.",
          timePeriod: "1-3 years"
        },
        {
          title: "Research Scientist",
          description: "Lead research projects, publish as primary author, and develop novel approaches.",
          timePeriod: "3-6 years"
        },
        {
          title: "Senior / Staff Scientist",
          description: "Define research directions, secure funding, and mentor junior researchers.",
          timePeriod: "6-10 years"
        },
        {
          title: "Principal Scientist / Distinguished Fellow / Lab Director",
          description: "Shape organizational research strategy and establish new fields of inquiry.",
          timePeriod: "10+ years"
        }
      ]
    }
  },
  {
    id: "customer-engineer-data-ai",
    title: "Customer Engineer (Data & AI)",
    shortDescription: "Help customers implement and optimize data & AI solutions",
    category: "AI/ML, Data Engineering",
    skills: ["Communication", "Problem Solving", "Cloud Computing", "Data Analysis", "AI/ML"],
    tools: ["AWS", "Azure", "GCP", "Python", "SQL"],
    responsibilities: [
      "Assist customers with the implementation of data and AI solutions",
      "Provide technical support and guidance",
      "Develop and deliver training programs",
      "Collaborate with sales and marketing teams",
      "Stay up-to-date with the latest advancements in data and AI"
    ],
    collaborators: ["Customers", "Sales Teams", "Marketing Teams", "Data Scientists"],
    dayInLife: "Kick off with a customer architecture review; build a demo in a sandbox; troubleshoot data pipeline issues; present a quick win to execs; log feedback for product.",
    monthInLife: "Month alternates between onboarding new customers, deep‑dive solutioning for existing ones, and internal enablement sessions. End‑of‑month: compile success metrics and case studies.",
    careerPath: {
      description: "Customer Engineers typically progress toward more strategic roles with larger accounts or leadership positions.",
      progressionSteps: [
        {
          title: "Support Engineer",
          description: "Resolve technical issues, implement solutions, and build technical expertise.",
          timePeriod: "1-2 years"
        },
        {
          title: "Customer Engineer",
          description: "Lead customer implementations, develop solutions, and drive adoption.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior / Lead Customer Engineer",
          description: "Handle strategic accounts, mentor team members, and influence product roadmap.",
          timePeriod: "4-7 years"
        },
        {
          title: "Solutions Architect / Field CTO / Customer Engineering Manager",
          description: "Set technology direction, lead teams, and shape customer strategy.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "decision-scientist",
    title: "Decision Scientist",
    shortDescription: "Use data science to improve business decision-making",
    category: "Analytics, AI/ML",
    skills: ["Data Science", "Statistics", "Machine Learning", "Communication", "Business Acumen"],
    tools: ["Python", "R", "SQL", "Tableau", "Excel"],
    responsibilities: [
      "Develop and implement data-driven solutions to improve business decision-making",
      "Analyze data to identify trends and insights",
      "Communicate findings to stakeholders",
      "Collaborate with business users to understand their needs",
      "Stay up-to-date with the latest advancements in data science"
    ],
    collaborators: ["Business Users", "Data Scientists", "Business Analysts", "Product Managers"],
    dayInLife: "Morning KPI check; scenario modeling in Python; strategy meeting with execs; build decision trees & Monte‑Carlo sims; deliver recommendations deck by EOD.",
    monthInLife: "Monthly cadence: week 1 metric review & hypothesis framing; weeks 2‑3 modeling & sensitivity analysis; week 4 executive read‑out and playbook updates.",
    careerPath: {
      description: "Decision Scientists progress from analytical roles to strategic leadership positions that influence company direction.",
      progressionSteps: [
        {
          title: "Decision Analyst",
          description: "Build models, analyze scenarios, and support decision-making processes.",
          timePeriod: "1-3 years"
        },
        {
          title: "Decision Scientist",
          description: "Lead analytical projects, design frameworks, and influence key decisions.",
          timePeriod: "3-5 years"
        },
        {
          title: "Senior Decision Scientist",
          description: "Drive strategic initiatives, develop methodologies, and mentor analysts.",
          timePeriod: "5-8 years"
        },
        {
          title: "Head of Decision Science / Chief Data or Strategy Officer",
          description: "Shape organizational strategy, build decision-making culture, and lead teams.",
          timePeriod: "8+ years"
        }
      ]
    }
  },
  {
    id: "ai-ethicist",
    title: "AI Ethicist",
    shortDescription: "Ensure AI systems are developed and
