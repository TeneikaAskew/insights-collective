
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
    id: "generative-ai-scientist",
    title: "Generative AI Scientist",
    shortDescription: "Develop AI systems that can create new content",
    category: "AI/ML",
    skills: ["Deep Learning", "NLP", "Computer Vision", "Research", "Python"],
    tools: ["PyTorch", "TensorFlow", "HuggingFace", "CUDA", "JAX"],
    responsibilities: [
      "Design and implement generative AI models",
      "Conduct research to improve model performance",
      "Evaluate model outputs for quality and bias",
      "Collaborate with product teams to integrate models",
      "Stay current with the latest research in generative AI"
    ],
    collaborators: ["ML Engineers", "Product Managers", "UX Researchers", "Ethics Teams"],
    dayInLife: "Spin up GPU jobs at 8 AM; tune transformer hyper‑params; midday peer review of new diffusion‑model paper; afternoon bias evaluation & prompt testing; wrap with model checkpoint push.",
    monthInLife: "Months revolve around research sprint (mo 1), large‑scale training & evaluation (mo 2), and deployment / conference submission (mo 3).",
    careerPath: {
      description: "Generative AI Scientists typically progress from implementing models to leading research programs and shaping AI strategy.",
      progressionSteps: [
        {
          title: "Research Engineer",
          description: "Implement and train models, conduct experiments, and support research projects.",
          timePeriod: "1-3 years"
        },
        {
          title: "Generative AI Scientist",
          description: "Lead research projects, develop novel approaches, and publish findings.",
          timePeriod: "3-5 years"
        },
        {
          title: "Senior Scientist",
          description: "Drive research direction, mentor junior scientists, and collaborate across disciplines.",
          timePeriod: "5-8 years"
        },
        {
          title: "Staff / Principal Scientist / Director of Generative AI Research",
          description: "Shape research strategy, lead teams, and represent organization in academic and industry forums.",
          timePeriod: "8+ years"
        }
      ]
    }
  },
  {
    id: "insights-analyst",
    title: "Insights Analyst",
    shortDescription: "Transform data into actionable business insights",
    category: "Analytics",
    skills: ["Data Analysis", "SQL", "Data Visualization", "Communication", "Business Acumen"],
    tools: ["Tableau", "Power BI", "Excel", "SQL", "Python"],
    responsibilities: [
      "Analyze data to identify trends and insights",
      "Create dashboards and reports",
      "Present findings to stakeholders",
      "Collaborate with business teams to understand their needs",
      "Make recommendations based on data analysis"
    ],
    collaborators: ["Business Teams", "Data Engineers", "Product Managers", "Executives"],
    dayInLife: "Pull fresh data, run SQL, create ad‑hoc visual in BI tool; meet marketing to interpret campaign KPIs; craft insight memo; close with dashboard tweak requests.",
    monthInLife: "Week 1: standard KPI refresh; week 2: deep‑dive analysis; week 3: stakeholder workshops; week 4: iterate dashboards & document learnings.",
    careerPath: {
      description: "Insights Analysts typically progress from analyzing data to leading insights teams and shaping business strategy.",
      progressionSteps: [
        {
          title: "Data / Reporting Analyst",
          description: "Create reports, monitor metrics, and support basic analysis needs.",
          timePeriod: "1-2 years"
        },
        {
          title: "Insights Analyst",
          description: "Conduct complex analyses, develop insights, and make recommendations.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Insights Analyst",
          description: "Lead projects, mentor junior analysts, and drive strategic initiatives.",
          timePeriod: "4-6 years"
        },
        {
          title: "Insights Manager / Director of Business Insights",
          description: "Set analytics strategy, lead teams, and partner with executives on key decisions.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "mlops-engineer",
    title: "MLOps Engineer",
    shortDescription: "Build and maintain ML model production infrastructure",
    category: "AI/ML, Data Engineering",
    skills: ["DevOps", "Cloud Computing", "Python", "Container Orchestration", "CI/CD"],
    tools: ["Kubernetes", "Docker", "GitHub Actions", "TensorFlow Serving", "Prometheus"],
    responsibilities: [
      "Deploy ML models to production",
      "Build and maintain CI/CD pipelines for ML",
      "Monitor model performance and infrastructure",
      "Automate ML workflows",
      "Ensure reliability and scalability of ML systems"
    ],
    collaborators: ["Data Scientists", "ML Engineers", "DevOps Teams", "Software Engineers"],
    dayInLife: "Daily stand‑up; update CI/CD YAML; containerize new model; deploy via Kubernetes; add Prometheus alert; afternoon root‑cause a latency spike.",
    monthInLife: "Sprint 1 sets up infra; Sprint 2 automates training pipeline; Sprint 3 adds monitoring & rollback; Sprint 4 does cost‑optimization and knowledge‑sharing.",
    careerPath: {
      description: "MLOps Engineers typically progress from building infrastructure to leading platform teams and shaping ML strategy.",
      progressionSteps: [
        {
          title: "DevOps / Data Engineer",
          description: "Support deployment, build pipelines, and maintain infrastructure.",
          timePeriod: "1-2 years"
        },
        {
          title: "MLOps Engineer",
          description: "Design and implement ML deployment, monitoring, and automation solutions.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior MLOps",
          description: "Lead projects, mentor junior engineers, and establish best practices.",
          timePeriod: "4-6 years"
        },
        {
          title: "MLOps Lead / Platform Engineering Manager",
          description: "Set platform strategy, lead teams, and drive innovation in ML infrastructure.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "private-equity-analyst",
    title: "Private Equity Analyst",
    shortDescription: "Evaluate investment opportunities and support portfolio management",
    category: "Analytics, Business Intelligence",
    skills: ["Financial Modeling", "Due Diligence", "Valuation", "Excel", "Financial Analysis"],
    tools: ["Excel", "FactSet", "Capital IQ", "PowerPoint", "Bloomberg Terminal"],
    responsibilities: [
      "Build financial models to evaluate investment opportunities",
      "Conduct due diligence on potential investments",
      "Monitor portfolio company performance",
      "Prepare investment committee materials",
      "Support deal execution and portfolio management"
    ],
    collaborators: ["Investment Professionals", "Portfolio Companies", "Investment Banking", "Consultants"],
    dayInLife: "Early news scan; Excel/LBO model tweaks; management call with target company; prepare IC memo; attend investment committee review.",
    monthInLife: "Deal cycle: sourcing & screening (wks 1‑2), deep diligence & modeling (wks 3‑4), committee presentation & term‑sheet (wk 5), closing logistics (wk 6+).",
    careerPath: {
      description: "Private Equity Analysts typically progress from analytical roles to investment professionals leading deals and managing portfolios.",
      progressionSteps: [
        {
          title: "Analyst",
          description: "Support deal evaluation, build models, and conduct research.",
          timePeriod: "1-2 years"
        },
        {
          title: "Senior Analyst",
          description: "Lead analytical work, manage due diligence, and support deal execution.",
          timePeriod: "2-3 years"
        },
        {
          title: "Associate",
          description: "Source deals, lead financial analysis, and manage relationships with portfolio companies.",
          timePeriod: "3-5 years"
        },
        {
          title: "VP / Deal Lead / Principal / Partner",
          description: "Lead investment decisions, manage portfolios, and drive firm strategy.",
          timePeriod: "5+ years"
        }
      ]
    }
  },
  {
    id: "product-insights-analyst",
    title: "Product Insights Analyst",
    shortDescription: "Analyze product data to inform product development decisions",
    category: "Analytics",
    skills: ["Product Analytics", "A/B Testing", "SQL", "Data Visualization", "User Behavior Analysis"],
    tools: ["Amplitude", "Mixpanel", "SQL", "Tableau", "Python"],
    responsibilities: [
      "Analyze product usage data",
      "Design and analyze A/B tests",
      "Create dashboards to track product metrics",
      "Collaborate with product managers to define success metrics",
      "Make recommendations to improve product performance"
    ],
    collaborators: ["Product Managers", "Engineers", "UX Designers", "Marketing Teams"],
    dayInLife: "Check product dashboards; design A/B test; sync with PM; analyze experiment results; share insight Slack post; iterate tracking plan.",
    monthInLife: "Month: roadmap metrics review, test design & launch, mid‑month readouts, end‑month retrospective and instrumentation grooming.",
    careerPath: {
      description: "Product Insights Analysts typically progress from analyzing data to leading product analytics and influencing product strategy.",
      progressionSteps: [
        {
          title: "Data Analyst",
          description: "Support basic reporting, implement tracking, and analyze user behavior.",
          timePeriod: "1-2 years"
        },
        {
          title: "Product Insights Analyst",
          description: "Lead analysis projects, develop metrics, and design experiments.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior / Lead Insights Analyst",
          description: "Define measurement strategy, mentor junior analysts, and drive data-informed decisions.",
          timePeriod: "4-6 years"
        },
        {
          title: "Analytics PM or Product Analytics Manager",
          description: "Set product analytics strategy, lead teams, and influence product roadmap.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "qa-engineer-ai",
    title: "QA Engineer (AI)",
    shortDescription: "Test and validate AI systems for quality and reliability",
    category: "AI/ML",
    skills: ["Software Testing", "Automation", "Python", "Evaluation Metrics", "Bug Reporting"],
    tools: ["pytest", "TensorFlow", "Selenium", "Jira", "Jenkins"],
    responsibilities: [
      "Design test plans for AI systems",
      "Implement automated tests for model validation",
      "Identify and report issues in AI systems",
      "Test for bias and fairness in AI outputs",
      "Ensure models meet quality standards"
    ],
    collaborators: ["Data Scientists", "ML Engineers", "Product Managers", "DevOps Teams"],
    dayInLife: "Review nightly model‑test report; write new edge‑case scripts; pair with DS to reproduce a drift bug; update quality gates; document findings.",
    monthInLife: "Monthly: author test plan (wk 1), automate & run tests (wk 2‑3), finalize QA sign‑off and post‑mortem (wk 4).",
    careerPath: {
      description: "QA Engineers focused on AI typically progress from testing to leading quality assurance strategies for AI systems.",
      progressionSteps: [
        {
          title: "QA Analyst",
          description: "Execute tests, report bugs, and assist with test automation.",
          timePeriod: "1-2 years"
        },
        {
          title: "AI QA Engineer",
          description: "Design test plans, implement automated testing, and ensure model quality.",
          timePeriod: "2-4 years"
        },
        {
          title: "QA Lead",
          description: "Lead testing teams, establish quality standards, and drive test strategy.",
          timePeriod: "4-6 years"
        },
        {
          title: "AI Quality Manager / Director of AI QA & Compliance",
          description: "Set quality strategy, lead teams, and ensure compliance with AI standards.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "research-scientist",
    title: "Research Scientist",
    shortDescription: "Conduct original research to advance knowledge and technology",
    category: "AI/ML",
    skills: ["Research", "Machine Learning", "Deep Learning", "Mathematics", "Scientific Writing"],
    tools: ["PyTorch", "TensorFlow", "Python", "LaTeX", "Cloud Computing"],
    responsibilities: [
      "Design and conduct experiments",
      "Develop new algorithms and models",
      "Publish research papers",
      "Present at conferences",
      "Collaborate with other researchers and engineers"
    ],
    collaborators: ["Academic Researchers", "Engineers", "Product Teams", "PhD Students"],
    dayInLife: "Morning experiment results review; refine algorithm; meet engineers to productize research; draft paper section; mentor intern.",
    monthInLife: "Quarterly: literature survey, hypothesis & experiment design, execution & analysis, publication & tech‑transfer to product.",
    careerPath: {
      description: "Research Scientists typically progress from conducting research to leading research teams and shaping research strategy.",
      progressionSteps: [
        {
          title: "Junior Researcher",
          description: "Assist with experiments, implement models, and support research projects.",
          timePeriod: "1-3 years"
        },
        {
          title: "Research Scientist",
          description: "Lead research projects, publish papers, and develop novel approaches.",
          timePeriod: "3-5 years"
        },
        {
          title: "Senior / Staff Researcher",
          description: "Define research directions, secure funding, and mentor junior researchers.",
          timePeriod: "5-8 years"
        },
        {
          title: "Principal Researcher / Head of Research",
          description: "Set research strategy, lead teams, and drive innovation.",
          timePeriod: "8+ years"
        }
      ]
    }
  },
  {
    id: "solution-engineer-data-ai",
    title: "Solution Engineer (Data & AI)",
    shortDescription: "Design and implement data and AI solutions for clients",
    category: "AI/ML, Data Engineering",
    skills: ["Solution Architecture", "Pre-sales", "Cloud Computing", "Data Engineering", "Communication"],
    tools: ["AWS", "Azure", "GCP", "PowerPoint", "Python"],
    responsibilities: [
      "Design data and AI solutions for clients",
      "Build prototypes and proof-of-concepts",
      "Present technical solutions to clients",
      "Support sales teams in technical discussions",
      "Stay up-to-date with the latest technologies"
    ],
    collaborators: ["Sales Teams", "Customers", "Product Teams", "Implementation Teams"],
    dayInLife: "Demo analytics solution; scope requirements; design reference architecture; build POC; present ROI; hand off to delivery team.",
    monthInLife: "Sales cycle: discovery & scoping (wk 1), POC build (wk 2‑3), technical validation (wk 4), hand‑over & lessons learned (wk 5).",
    careerPath: {
      description: "Solution Engineers typically progress from technical roles to strategic and leadership positions.",
      progressionSteps: [
        {
          title: "Pre‑sales Engineer",
          description: "Support demos, answer technical questions, and assist with POCs.",
          timePeriod: "1-3 years"
        },
        {
          title: "Solution Engineer",
          description: "Design solutions, build POCs, and lead technical discussions.",
          timePeriod: "3-5 years"
        },
        {
          title: "Senior Solution Engineer",
          description: "Handle complex opportunities, mentor junior SEs, and influence product roadmap.",
          timePeriod: "5-7 years"
        },
        {
          title: "Solutions Architect / Director of Solutions Engineering",
          description: "Set technical strategy, lead teams, and drive business growth.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "cloud-data-engineer",
    title: "Cloud Data Engineer",
    shortDescription: "Build and maintain cloud-based data infrastructure",
    category: "Data Engineering",
    skills: ["Cloud Computing", "ETL", "SQL", "IaC", "Data Modeling"],
    tools: ["AWS", "Azure", "GCP", "Terraform", "Spark"],
    responsibilities: [
      "Design and implement cloud-based data solutions",
      "Build and maintain ETL pipelines",
      "Optimize data storage and processing",
      "Implement data security and governance",
      "Automate data workflows"
    ],
    collaborators: ["Data Scientists", "Business Analysts", "DevOps Teams", "Security Teams"],
    dayInLife: "Stand‑up; write Terraform; build Spark ETL; optimize BigQuery costs; add IAM policies; evening code review.",
    monthInLife: "Month: design architecture (wk 1), pipeline build (wk 2‑3), performance tuning & documentation (wk 4).",
    careerPath: {
      description: "Cloud Data Engineers typically progress from building infrastructure to leading data platform teams and shaping data strategy.",
      progressionSteps: [
        {
          title: "Data Engineer",
          description: "Build pipelines, implement data storage, and support basic analytics.",
          timePeriod: "1-2 years"
        },
        {
          title: "Cloud Data Engineer",
          description: "Design and implement cloud-based data solutions with security and scalability.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior / Lead Cloud DE",
          description: "Lead projects, mentor junior engineers, and establish best practices.",
          timePeriod: "4-6 years"
        },
        {
          title: "Cloud Data Architect / Principal Engineer",
          description: "Set data architecture strategy, lead teams, and drive innovation in data platforms.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "data-governance-analyst",
    title: "Data Governance Analyst",
    shortDescription: "Ensure data quality, security, and compliance",
    category: "Data Engineering",
    skills: ["Data Governance", "Compliance", "Data Quality", "Policy Development", "Documentation"],
    tools: ["Collibra", "Alation", "SQL", "Excel", "Informatica"],
    responsibilities: [
      "Develop and implement data governance policies",
      "Monitor and improve data quality",
      "Ensure compliance with regulations",
      "Maintain data catalogs and metadata",
      "Train and support data stewards"
    ],
    collaborators: ["Data Stewards", "IT Teams", "Legal & Compliance", "Business Users"],
    dayInLife: "Morning data‑quality dashboard check; draft policy; meet compliance; update data catalog; run stewardship workshop.",
    monthInLife: "Quarter: policy rollout (mo 1), metric tracking & remediation (mo 2), audit prep & training (mo 3).",
    careerPath: {
      description: "Data Governance Analysts typically progress from policy implementation to leadership roles shaping governance strategy.",
      progressionSteps: [
        {
          title: "Data Steward",
          description: "Support data quality, assist with metadata management, and enforce policies.",
          timePeriod: "1-2 years"
        },
        {
          title: "Data Governance Analyst",
          description: "Develop policies, implement governance tools, and drive quality initiatives.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior DG Analyst",
          description: "Lead governance projects, mentor junior analysts, and establish best practices.",
          timePeriod: "4-6 years"
        },
        {
          title: "DG Manager / Director of Data Governance",
          description: "Set governance strategy, lead teams, and ensure enterprise data compliance.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "data-visualization-specialist",
    title: "Data Visualization Specialist",
    shortDescription: "Create effective visual representations of data",
    category: "Analytics, Business Intelligence",
    skills: ["Data Visualization", "UX Design", "Storytelling", "SQL", "Design Thinking"],
    tools: ["Tableau", "Power BI", "D3.js", "Adobe Illustrator", "Figma"],
    responsibilities: [
      "Design and create data visualizations",
      "Develop interactive dashboards",
      "Transform complex data into understandable visuals",
      "Collaborate with stakeholders to understand requirements",
      "Train users on visualization tools"
    ],
    collaborators: ["Analysts", "Business Users", "UX Designers", "Data Engineers"],
    dayInLife: "Sketch viz mockups; develop Tableau dashboards; color‑test with UX; stakeholder feedback session; iterate.",
    monthInLife: "Month: requirement gathering, prototyping, production build, training & style‑guide update.",
    careerPath: {
      description: "Data Visualization Specialists typically progress from creating visualizations to leading data experience teams.",
      progressionSteps: [
        {
          title: "BI Developer",
          description: "Create reports, build basic dashboards, and support data needs.",
          timePeriod: "1-2 years"
        },
        {
          title: "Data Viz Specialist",
          description: "Design advanced visualizations, develop interactive dashboards, and establish best practices.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Viz / Storytelling Lead",
          description: "Lead visualization strategy, mentor junior specialists, and drive innovation in data presentation.",
          timePeriod: "4-6 years"
        },
        {
          title: "Visualization Manager / Director of Data Storytelling",
          description: "Set visualization strategy, lead teams, and shape how organizations communicate with data.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "data-metrics-analyst",
    title: "Data Metrics Analyst",
    shortDescription: "Define, track, and analyze key business metrics",
    category: "Analytics, Business Intelligence",
    skills: ["Metrics Definition", "Data Analysis", "SQL", "Data Visualization", "Business Acumen"],
    tools: ["SQL", "Looker", "Tableau", "Excel", "Jira"],
    responsibilities: [
      "Define and document key metrics",
      "Build dashboards to track performance",
      "Ensure consistency in metric definitions",
      "Collaborate with stakeholders to understand business needs",
      "Identify opportunities for improvement based on metrics"
    ],
    collaborators: ["Business Leaders", "Product Teams", "Data Engineers", "Analysts"],
    dayInLife: "Define KPI; update metric definitions; build Looker dashboard; meet finance on OKRs; write insights brief.",
    monthInLife: "Month cycles: metric discovery (wk 1), dashboard dev (wk 2), validation & rollout (wk 3), impact review (wk 4).",
    careerPath: {
      description: "Data Metrics Analysts typically progress from defining and tracking metrics to shaping measurement strategy.",
      progressionSteps: [
        {
          title: "Reporting Analyst",
          description: "Support reporting needs, build basic dashboards, and track existing metrics.",
          timePeriod: "1-2 years"
        },
        {
          title: "Metrics Analyst",
          description: "Define key metrics, develop tracking systems, and ensure data quality.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Metrics Analyst",
          description: "Lead metrics frameworks, mentor junior analysts, and drive measurement strategy.",
          timePeriod: "4-6 years"
        },
        {
          title: "Metrics Lead / Analytics Strategy Manager",
          description: "Set measurement strategy, lead teams, and align metrics with business goals.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "information-architect",
    title: "Information Architect",
    shortDescription: "Design information structures and taxonomies",
    category: "Data Engineering",
    skills: ["Information Design", "Taxonomy", "Data Modeling", "Content Strategy", "UX Design"],
    tools: ["Enterprise Architect", "Visio", "Draw.io", "SQL", "Axure"],
    responsibilities: [
      "Design information structures and taxonomies",
      "Develop data models and schemas",
      "Create metadata frameworks",
      "Collaborate with stakeholders to understand information needs",
      "Ensure information is organized logically and accessibly"
    ],
    collaborators: ["UX Designers", "Data Engineers", "Content Strategists", "Business Analysts"],
    dayInLife: "Create data model; map taxonomy; workshop with UX; document metadata; review with enterprise architects.",
    monthInLife: "Month: discovery & audit, modeling & taxonomy design, implementation guidance, governance hand‑off.",
    careerPath: {
      description: "Information Architects typically progress from designing structures to leading information strategy.",
      progressionSteps: [
        {
          title: "Data Modeler",
          description: "Create data models, support taxonomy efforts, and document structures.",
          timePeriod: "1-3 years"
        },
        {
          title: "Information Architect",
          description: "Design comprehensive information structures, develop taxonomies, and implement metadata frameworks.",
          timePeriod: "3-5 years"
        },
        {
          title: "Senior IA",
          description: "Lead information initiatives, mentor junior architects, and establish best practices.",
          timePeriod: "5-7 years"
        },
        {
          title: "Enterprise Information Architect / Chief Data Architect",
          description: "Set information strategy, lead teams, and shape how organizations structure data.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "intelligence-analyst",
    title: "Intelligence Analyst",
    shortDescription: "Collect and analyze data to produce intelligence insights",
    category: "Analytics",
    skills: ["Intelligence Analysis", "Research", "Critical Thinking", "Report Writing", "Risk Assessment"],
    tools: ["OSINT Tools", "Excel", "Python", "GIS", "Visualization Software"],
    responsibilities: [
      "Collect and analyze data from various sources",
      "Identify patterns, trends, and insights",
      "Produce intelligence reports and briefings",
      "Assess risks and threats",
      "Present findings to stakeholders"
    ],
    collaborators: ["Security Teams", "Executives", "External Agencies", "Operations Teams"],
    dayInLife: "Gather OSINT feeds; run pattern analysis; produce threat brief; present to stakeholders; archive findings.",
    monthInLife: "Monthly: collection plan setup, deep‑dive analysis, intelligence report cycle, post‑action review.",
    careerPath: {
      description: "Intelligence Analysts typically progress from analytical roles to leadership positions in intelligence and security.",
      progressionSteps: [
        {
          title: "Junior Intel Analyst",
          description: "Support data collection, conduct basic analysis, and assist with reports.",
          timePeriod: "1-2 years"
        },
        {
          title: "Intelligence Analyst",
          description: "Lead analysis projects, produce comprehensive reports, and make actionable recommendations.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Intel Analyst",
          description: "Oversee complex analyses, mentor junior analysts, and shape intelligence strategy.",
          timePeriod: "4-7 years"
        },
        {
          title: "Intelligence Manager / Director of Intelligence",
          description: "Lead intelligence functions, set strategy, and advise executive leadership.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "mdm-analyst",
    title: "MDM Analyst",
    shortDescription: "Manage and maintain master data",
    category: "Data Engineering",
    skills: ["Master Data Management", "Data Governance", "Data Quality", "ETL", "Business Process"],
    tools: ["Informatica MDM", "SAP MDG", "SQL", "Excel", "Talend"],
    responsibilities: [
      "Implement and maintain master data management systems",
      "Ensure data quality and consistency",
      "Develop and enforce data standards",
      "Resolve data issues and conflicts",
      "Train users on MDM processes"
    ],
    collaborators: ["Data Stewards", "IT Teams", "Business Users", "Data Governance Teams"],
    dayInLife: "Morning duplicate‑record report; resolve data conflicts; update MDM rules; sync with ETL team; document quality metrics.",
    monthInLife: "Quarter: data profiling, golden‑record design, rule implementation, monitoring & stewardship training.",
    careerPath: {
      description: "MDM Analysts typically progress from data management roles to leadership positions in master data strategy.",
      progressionSteps: [
        {
          title: "Data Steward",
          description: "Support data quality efforts, resolve basic issues, and enforce standards.",
          timePeriod: "1-2 years"
        },
        {
          title: "MDM Analyst",
          description: "Implement MDM solutions, ensure data quality, and develop processes.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior MDM Analyst",
          description: "Lead MDM projects, mentor junior analysts, and establish best practices.",
          timePeriod: "4-6 years"
        },
        {
          title: "MDM Lead / Master Data Manager",
          description: "Set MDM strategy, lead teams, and align master data with business goals.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "sql-developer",
    title: "SQL Developer",
    shortDescription: "Design and optimize database queries and structures",
    category: "Data Engineering",
    skills: ["SQL", "Database Design", "Query Optimization", "Stored Procedures", "Performance Tuning"],
    tools: ["SQL Server", "Oracle", "PostgreSQL", "MySQL", "PL/SQL"],
    responsibilities: [
      "Design and implement database schemas",
      "Write and optimize SQL queries",
      "Develop stored procedures and functions",
      "Troubleshoot database performance issues",
      "Collaborate with applications teams on data access"
    ],
    collaborators: ["Database Administrators", "Applications Developers", "BI Teams", "Data Engineers"],
    dayInLife: "Write new stored proc; tune slow query; collaborate with BI; deploy schema migration; backup verification.",
    monthInLife: "Sprint cycle: requirement intake, query/dev, QA & performance testing, release & monitoring.",
    careerPath: {
      description: "SQL Developers typically progress from writing queries to architecting database solutions.",
      progressionSteps: [
        {
          title: "SQL Dev",
          description: "Write basic queries, develop reports, and support applications.",
          timePeriod: "1-2 years"
        },
        {
          title: "Senior SQL Dev",
          description: "Design schemas, optimize complex queries, and implement best practices.",
          timePeriod: "2-5 years"
        },
        {
          title: "Database Engineer",
          description: "Lead database projects, performance tune, and develop database architecture.",
          timePeriod: "5-8 years"
        },
        {
          title: "Data Platform Lead / Database Architect",
          description: "Set database strategy, lead teams, and drive innovation in data platforms.",
          timePeriod: "8+ years"
        }
      ]
    }
  },
  {
    id: "ai-governance-officer",
    title: "AI Governance Officer",
    shortDescription: "Ensure responsible AI development and compliance",
    category: "AI/ML",
    skills: ["Policy Development", "Risk Assessment", "Compliance", "Ethics", "Communication"],
    tools: ["Documentation Tools", "Monitoring Platforms", "Compliance Frameworks", "Jira", "PowerPoint"],
    responsibilities: [
      "Develop and implement AI governance policies",
      "Assess AI systems for risks and compliance issues",
      "Monitor AI performance and impacts",
      "Train teams on responsible AI practices",
      "Stay current with AI regulations and standards"
    ],
    collaborators: ["AI Teams", "Legal & Compliance", "Executives", "Ethics Committee"],
    dayInLife: "Review new AI project; risk assessment; update governance policy; brief execs; conduct compliance training.",
    monthInLife: "Quarter: policy development, tool rollout, audit & reporting, stakeholder training.",
    careerPath: {
      description: "AI Governance Officers typically progress from policy roles to leadership positions in AI ethics and governance.",
      progressionSteps: [
        {
          title: "Policy Analyst",
          description: "Support policy development, assist with assessments, and monitor compliance.",
          timePeriod: "1-3 years"
        },
        {
          title: "AI Governance Officer",
          description: "Develop governance frameworks, conduct risk assessments, and implement compliance processes.",
          timePeriod: "3-5 years"
        },
        {
          title: "Senior Governance Lead",
          description: "Lead governance initiatives, shape policy, and advise on ethical considerations.",
          timePeriod: "5-7 years"
        },
        {
          title: "Head of Responsible AI / VP, AI Risk & Compliance",
          description: "Set AI governance strategy, lead teams, and ensure responsible AI practices.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "cloud-engineer",
    title: "Cloud Engineer",
    shortDescription: "Design and manage cloud infrastructure",
    category: "Data Engineering",
    skills: ["Cloud Computing", "IaC", "DevOps", "Security", "Networking"],
    tools: ["AWS", "Azure", "GCP", "Terraform", "Kubernetes"],
    responsibilities: [
      "Design and implement cloud infrastructure",
      "Automate deployment and management",
      "Monitor and optimize cloud resources",
      "Implement security best practices",
      "Collaborate with development teams"
    ],
    collaborators: ["DevOps Teams", "Developers", "Security Teams", "Data Teams"],
    dayInLife: "Deploy infra via IaC; optimize autoscaling; patch security groups; cost review; incident post‑mortem.",
    monthInLife: "Month: architecture design, deployment, monitoring/tuning, DR testing.",
    careerPath: {
      description: "Cloud Engineers typically progress from implementation roles to architecture and leadership positions.",
      progressionSteps: [
        {
          title: "Cloud Engineer",
          description: "Implement cloud services, automate deployments, and support infrastructure.",
          timePeriod: "1-3 years"
        },
        {
          title: "Senior Cloud Engineer",
          description: "Design complex solutions, optimize performance/cost, and establish best practices.",
          timePeriod: "3-5 years"
        },
        {
          title: "Cloud Architect",
          description: "Lead cloud strategy, design enterprise architecture, and drive innovation.",
          timePeriod: "5-7 years"
        },
        {
          title: "Cloud Practice Lead / Principal Cloud Engineer",
          description: "Set cloud direction, lead teams, and define organizational cloud strategy.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "cloud-security-engineer",
    title: "Cloud Security Engineer",
    shortDescription: "Secure cloud environments and data",
    category: "Data Engineering",
    skills: ["Cloud Security", "Security Architecture", "Compliance", "DevSecOps", "Incident Response"],
    tools: ["AWS Security", "Azure Security Center", "GCP Security", "HashiCorp Vault", "SIEM Tools"],
    responsibilities: [
      "Design and implement cloud security controls",
      "Conduct security assessments",
      "Monitor for security threats",
      "Implement compliance controls",
      "Respond to security incidents"
    ],
    collaborators: ["Cloud Engineers", "Security Teams", "Compliance Officers", "DevOps Teams"],
    dayInLife: "Run vulnerability scan; triage alerts; implement IAM hardening; pen‑test review; write incident report.",
    monthInLife: "Quarter: security assessment, remediation sprint, compliance audit, tabletop exercise.",
    careerPath: {
      description: "Cloud Security Engineers typically progress from implementation roles to leadership positions in security.",
      progressionSteps: [
        {
          title: "Security Analyst",
          description: "Monitor alerts, implement controls, and support security operations.",
          timePeriod: "1-3 years"
        },
        {
          title: "Cloud Security Engineer",
          description: "Design security solutions, conduct assessments, and implement best practices.",
          timePeriod: "3-5 years"
        },
        {
          title: "Senior CSE",
          description: "Lead security initiatives, architect solutions, and mentor junior engineers.",
          timePeriod: "5-7 years"
        },
        {
          title: "Security Architect / Director of Cloud Security",
          description: "Set security strategy, lead teams, and ensure enterprise cloud security.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "full-stack-developer",
    title: "Full Stack Developer",
    shortDescription: "Build and maintain web applications end-to-end",
    category: "Data Engineering",
    skills: ["Frontend Development", "Backend Development", "Databases", "API Design", "DevOps"],
    tools: ["JavaScript", "React", "Node.js", "Python", "SQL"],
    responsibilities: [
      "Develop frontend and backend components",
      "Design and implement databases",
      "Build and consume APIs",
      "Deploy and maintain applications",
      "Collaborate with product and design teams"
    ],
    collaborators: ["Product Managers", "Designers", "QA Teams", "DevOps Engineers"],
    dayInLife: "Daily stand‑up; build React feature; connect to Flask API; write unit tests; deploy via CI; code review.",
    monthInLife: "Two‑week sprints: feature dev, integration, testing, release, retro.",
    careerPath: {
      description: "Full Stack Developers typically progress from implementation to architecture and leadership roles.",
      progressionSteps: [
        {
          title: "Software Dev",
          description: "Implement features, fix bugs, and support applications.",
          timePeriod: "1-2 years"
        },
        {
          title: "Full‑Stack Dev",
          description: "Design and implement end-to-end solutions with performance and scalability in mind.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Full‑Stack",
          description: "Lead development efforts, architect solutions, and mentor junior developers.",
          timePeriod: "4-7 years"
        },
        {
          title: "Tech Lead / Engineering Manager",
          description: "Set technical direction, lead teams, and drive innovation in software development.",
          timePeriod: "7+ years"
        }
      ]
    }
  },
  {
    id: "metadata-specialist",
    title: "Metadata Specialist",
    shortDescription: "Manage and organize data about data",
    category: "Data Engineering",
    skills: ["Metadata Management", "Data Cataloging", "Taxonomy", "Data Governance", "Documentation"],
    tools: ["Alation", "Collibra", "Apache Atlas", "SQL", "Excel"],
    responsibilities: [
      "Develop and maintain metadata repositories",
      "Create and apply metadata standards",
      "Document data lineage and relationships",
      "Support data discovery and understanding",
      "Collaborate with data governance teams"
    ],
    collaborators: ["Data Stewards", "Data Engineers", "Business Analysts", "Data Scientists"],
    dayInLife: "Update data catalog; curate metadata tags; meet DG team; audit lineage; create glossary entry.",
    monthInLife: "Month: catalog rollout, metadata enrichment, stewardship training, governance alignment.",
    careerPath: {
      description: "Metadata Specialists typically progress from documentation roles to leadership positions in data management.",
      progressionSteps: [
        {
          title: "Data Librarian",
          description: "Document metadata, maintain basic catalogs, and support data organization.",
          timePeriod: "1-2 years"
        },
        {
          title: "Metadata Specialist",
          description: "Implement metadata systems, establish standards, and support data governance.",
          timePeriod: "2-4 years"
        },
        {
          title: "Senior Metadata Specialist",
          description: "Lead metadata initiatives, architect solutions, and establish best practices.",
          timePeriod: "4-6 years"
        },
        {
          title: "Metadata Lead / Director of Data Cataloging",
          description: "Set metadata strategy, lead teams, and drive data understanding across the organization.",
          timePeriod: "6+ years"
        }
      ]
    }
  },
  {
    id: "software-engineer-ai-ml",
    title: "Software Engineer (AI/ML)",
    shortDescription: "Develop software that integrates AI/ML capabilities",
    category: "AI/ML, Data Engineering",
    skills: ["Software Engineering", "ML Integration", "API Development", "Performance Optimization", "DevOps"],
    tools: ["Python", "TensorFlow", "Docker", "Kubernetes", "Git"],
    responsibilities: [
      "Develop software that incorporates AI/ML models",
      "Build APIs for model serving",
      "Optimize model performance in production",
      "Implement testing frameworks for AI applications",
      "Collaborate with data scientists and product teams"
    ],
    collaborators: ["Data Scientists", "Product Managers", "DevOps Engineers", "UX Designers"],
    dayInLife: "Implement feature flag; integrate TensorFlow model; write API; benchmark latency; deploy via Docker.",
    monthInLife: "Sprint: model integration, API build, performance tuning, release & monitoring.",
    careerPath: {
      description: "Software Engineers specializing in AI/ML typically progress from implementation to architecture and leadership roles.",
      progressionSteps: [
        {
          title: "Software Engineer",
          description: "Implement integrations, develop features, and support AI applications.",
          timePeriod: "1-3 years"
        },
        {
          title: "ML Software Engineer",
          description: "Design AI systems, optimize performance, and develop production-ready solutions.",
          timePeriod: "3-5 years"
        },
        {
          title: "Senior ML Engineer",
          description: "Lead development efforts, architect complex systems, and mentor junior engineers.",
          timePeriod: "5-7 years"
        },
        {
          title: "Tech Lead (ML Apps) / Principal Engineer, AI Platforms",
          description: "Set technical direction, lead teams, and drive innovation in AI applications.",
          timePeriod: "7+ years"
        }
      ]
    }
  }
];
