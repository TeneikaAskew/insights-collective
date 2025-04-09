// Analyze word balance
export function analyzeWordBalance(bullet: string): {
  industry_pct: number;
  common_pct: number;
  action_pct: number;
  metric_pct: number;
  word_balance_score: number;
} {
  // Simple word classification - in production would use NLP or a more sophisticated approach
  const words = bullet.split(/\s+/);
  
  // Action words list (simplified version)
  // const actionWords = [
  //   "achieved", "delivered", "improved", "increased", "reduced", "developed", "created", 
  //   "managed", "led", "built", "designed", "implemented", "transformed", "spearheaded", 
  //   "drove", "executed", "launched", "initiated", "generated", "optimized", "streamlined"
  // ];
  const actionWords = [
    "Achieved", "Accelerated", "Accomplished", "Activated", "Adapted", "Addressed",
    "Administered", "Advanced", "Advised", "Advocated", "Aligned", "Analyzed",
    "Appraised", "Applied", "Assembled", "Assessed", "Assigned", "Assisted",
    "Attained", "Automated", "Boosted", "Budgeted", "Built", "Calculated",
    "Centralized", "Championed", "Clarified", "Coached", "Collaborated", "Collected",
    "Communicated", "Compiled", "Completed", "Conceived", "Conceptualized",
    "Conducted", "Consolidated", "Constructed", "Consulted", "Contributed",
    "Controlled", "Converted", "Coordinated", "Corrected", "Created", "Cultivated",
    "Customized", "Decreased", "Defined", "Delivered", "Demonstrated", "Designed",
    "Developed", "Devised", "Diagnosed", "Directed", "Discovered", "Dispatched",
    "Documented", "Doubled", "Drove", "Enabled", "Encouraged", "Engineered",
    "Enhanced", "Enforced", "Engaged", "Enlarged", "Ensured", "Established",
    "Evaluated", "Executed", "Expanded", "Expedited", "Explained", "Explored",
    "Facilitated", "Forecasted", "Formed", "Formulated", "Fostered", "Founded",
    "Generated", "Guided", "Headed", "Identified", "Implemented", "Improved",
    "Increased", "Influenced", "Informed", "Initiated", "Innovated", "Inspected",
    "Inspired", "Installed", "Instituted", "Instructed", "Integrated", "Intensified",
    "Introduced", "Invented", "Investigated", "Launched", "Led", "Leveraged",
    "Maintained", "Managed", "Maximized", "Merged", "Minimized", "Modernized",
    "Monitored", "Motivated", "Negotiated", "Optimized", "Orchestrated", "Organized",
    "Outperformed", "Overhauled", "Oversaw", "Partnered", "Performed", "Piloted",
    "Pioneered", "Planned", "Prepared", "Presented", "Prioritized", "Produced",
    "Programmed", "Projected", "Promoted", "Proposed", "Protected", "Provided",
    "Quantified", "Realigned", "Realized", "Rebuilt", "Received", "Reconciled",
    "Recruited", "Reduced", "Redesigned", "Refined", "Reformed", "Reinforced",
    "Reorganized", "Replaced", "Reported", "Resolved", "Restructured", "Revamped",
    "Reviewed", "Revised", "Saved", "Scheduled", "Secured", "Selected", "Simplified",
    "Solved", "Spearheaded", "Standardized", "Started", "Streamlined", "Strengthened",
    "Structured", "Supervised", "Supported", "Surpassed", "Surveyed", "Synthesized",
    "Targeted", "Tested", "Trained", "Transformed", "Translated", "Updated",
    "Upgraded", "Validated", "Won", "Yielded"
  ];
  
  // Industry words (simplified - would be more comprehensive in production)
  // const industryWords = [
  //   "data", "analysis", "analytics", "python", "sql", "tableau", "powerbi", "excel",
  //   "database", "algorithms", "machine", "learning", "ai", "visualization", "dashboard",
  //   "kpi", "metrics", "statistics", "engineering", "etl", "cloud", "aws", "azure", 
  //   "pipeline", "hadoop", "spark", "agile", "scrum", "software", "development", "api"
  // ];
  // Extensive industry‑word list for data, analytics, strategy, consulting & product domains
  const industryWords = [
    /* Core data & analytics */
    "data","analytics","analysis","bi","intelligence","insights","sql","nosql","python","r","scala","java","julia","sas","matlab","stata",
    "tableau","powerbi","looker","qlik","superset","mode","redash","excel","sheets",
    "bigquery","snowflake","redshift","athena","presto","trino","hive","hadoop","spark","pyspark","flink","beam","storm",
    "kafka","kinesis","pubsub","rabbitmq","databricks","airflow","dbt","glue","datafactory","informatica","talend","pentaho","ssis","nifi","luigi",
    "etl","elt","ingestion","pipeline","pipelines","orchestration","lake","lakehouse","warehouse","parquet","avro","orc","delta",
    "ml","mlops","ai","model","models","training","inference","deployment","monitoring","drift","featurestore","feast",
    "tensorflow","keras","pytorch","scikit","sklearn","xgboost","lightgbm","catboost","sagemaker","vertex","azureml","mlflow",
    "classification","regression","clustering","forecasting","timeseries","optimization","statistics","statistical",
    "dashboard","dashboards","visualization","dataviz","kpi","kpis","okr","metric","metrics",
    "cloud","aws","azure","gcp","googlecloud","s3","gcs","adls","ec2","lambda","iam","vpc",
    "api","rest","graphql","json","yaml","xml",
  
    /* Strategy & consulting jargon */
    "strategy","strategic","roadmap","roadmaps","gtm","market","competitive","benchmark","benchmarks","swot","roi","npv","irr",
    "tom","operating","governance","compliance","regulatory","stakeholder","alignment","transformation","maturity","assessment","capability",
    "value","realization","businesscase","costbenefit","risk","mitigation","dependency","deliverable","deliverables","milestone","milestones",
    "program","portfolio","pmo","pm","agile","scrum","kanban","safe","waterfall","lean","sixsigma","kaizen","reengineering",
    "process","processes","improvement","change","adkar","prosci","communication","workshop","workshops","facilitation","training","adoption","readiness",
    "consulting","consultant","client","clients","engagement","engagements","workstream","proposal","rfp","sow","deck","presentation","presentations",
    "storytelling","findings","recommendations","operatingmodel","digital","transformation",
  
    /* Product & growth */
    "product","productmanagement","productmanager","productowner","backlog","user","story","stories","epic","feature","features","mvp",
    "prototype","wireframe","mockup","figma","ux","ui","design","designthinking","ideation","persona","personas","journey","segmentation",
    "pricing","monetization","growth","acquisition","retention","churn","ltv","nps","csat","activation","engagement",
    "launch","release","releases","beta","alpha","ga","telemetry","instrumentation","tracking","mixpanel","amplitude","segment","snowplow","heap",
    "ga4","adobe","experimentation","abtest","multivariate","hypothesis",
  
    /* General tech & engineering */
    "software","development","engineering","devops","ci","cd","jenkins","github","gitlab","bitbucket","terraform","ansible","docker","kubernetes","helm","serverless",
    "security","encryption","gdpr","hipaa","pci","sox","access","lineage","catalog","datacatalog","collibra","alation",
    "jira","confluence","api","microservice","microservices","serverless","event","events","logging","observability"
  ];

  let industryCount = 0;
  let commonCount = 0;
  let actionCount = 0;
  let metricCount = 0;
  
  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    // Check if word contains numbers (metrics)
    if (/\d/.test(cleanWord) || /%|\$/.test(cleanWord)) {
      metricCount++;
    }
    // Check if word is an action word
    else if (actionWords.includes(cleanWord)) {
      actionCount++;
    }
    // Check if word is an industry word
    else if (industryWords.includes(cleanWord)) {
      industryCount++;
    }
    // Otherwise it's a common word
    else {
      commonCount++;
    }
  }
  
  const totalWords = words.length;
  const industry_pct = Math.round((industryCount / totalWords) * 100);
  const common_pct = Math.round((commonCount / totalWords) * 100);
  const action_pct = Math.round((actionCount / totalWords) * 100);
  const metric_pct = Math.round((metricCount / totalWords) * 100);
  
  // Calculate word balance score
  // Ideal: Industry 45%, Common 25%, Action 15%, Metric 15%
  const idealIndustry = 45;
  const idealCommon = 25;
  const idealAction = 15;
  const idealMetric = 15;
  
  const industryDev = Math.abs(industry_pct - idealIndustry);
  const commonDev = Math.abs(common_pct - idealCommon);
  const actionDev = Math.abs(action_pct - idealAction);
  const metricDev = Math.abs(metric_pct - idealMetric);
  
  const totalDeviation = industryDev + commonDev + actionDev + metricDev;
  const word_balance_score = Math.max(0, 25 - totalDeviation);
  
  return {
    industry_pct,
    common_pct,
    action_pct,
    metric_pct,
    word_balance_score
  };
}

// XYZ ATS Quality Check
export function xyzCheck(bullet: string): {
  hard_soft: number;
  action_words: number;
  measurable_results: number;
  clarity_focus: number;
  xyz_total: number;
} {
  // 1. Hard & Soft Skills check
  const skillsKeywords = ["managed", "led", "developed", "created", "analyzed", "designed", "implemented"];
  const hasSkills = skillsKeywords.some(keyword => bullet.toLowerCase().includes(keyword));
  const hard_soft = hasSkills ? 5 : 0;
  
  // 2. Action Words check
  const startsWithAction = /^(Achieved|Improved|Increased|Reduced|Developed|Created|Managed|Led|Built|Designed|Implemented)/i.test(bullet);
  const noWeakPhrasing = !/(responsible for|duties include|helped with)/i.test(bullet);
  const action_words = (startsWithAction && noWeakPhrasing) ? 5 : (startsWithAction || noWeakPhrasing ? 3 : 0);
  
  // 3. Measurable Results check
  const hasNumbers = /\d+%|\d+x|\$\d+|\d+ percent|\d+k|\d+M|\d+B/i.test(bullet);
  const measurable_results = hasNumbers ? 5 : 0;
  
  // 4. Clarity & Focus check
  const wordCount = bullet.split(/\s+/).length;
  const isConcise = wordCount <= 25;
  const clarity_focus = isConcise ? 5 : (wordCount <= 30 ? 3 : 0);
  
  // Calculate total XYZ score
  const xyz_total = hard_soft + action_words + measurable_results + clarity_focus;
  
  return {
    hard_soft,
    action_words,
    measurable_results,
    clarity_focus,
    xyz_total
  };
}
