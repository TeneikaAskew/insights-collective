
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Knowledge base content as context
const KNOWLEDGE_BASE = `
DATA BLUEPRINT SERIES KNOWLEDGE:

1. DATA ROLES AND RESPONSIBILITIES:
- Data Analysts focus on descriptive analytics, creating reports, and visualizing data trends
- Data Scientists build predictive models and use statistical analysis for deeper insights
- Data Engineers design and maintain data pipelines and infrastructure
- Machine Learning Engineers develop and deploy ML models to production
- Business Intelligence Analysts translate data findings into business recommendations
- Analytics Managers lead teams and align data strategy with business goals

2. TECHNICAL SKILLS BY ROLE:
- Data Analysts: SQL, Excel, Power BI/Tableau, basic statistics
- Data Scientists: Python/R, statistics, machine learning algorithms
- Data Engineers: SQL, Python/Java, ETL tools, cloud platforms
- ML Engineers: Python, deep learning frameworks, MLOps tools
- BI Analysts: SQL, business intelligence tools, data visualization
- Analytics Managers: Project management, team leadership, stakeholder communication

3. CAREER PROGRESSION PATHS:
- Entry-level: Junior Analyst/Associate Data Scientist (0-2 years)
- Mid-level: Data Analyst/Scientist/Engineer (2-5 years)
- Senior: Senior Analyst/Scientist/Engineer (5-8 years)
- Lead: Lead Data Scientist/Analytics Manager (8+ years)
- Executive: Director of Analytics/Chief Data Officer (10+ years)

4. SALARY RANGES (USD):
- Junior roles: $60,000-$85,000
- Mid-level roles: $85,000-$120,000
- Senior roles: $120,000-$165,000
- Lead/Management: $150,000-$200,000
- Executive: $200,000-$350,000+

5. EDUCATION AND CERTIFICATION:
- Bachelor's degree: Minimum requirement for most entry-level positions
- Master's/PhD: Often preferred for Data Scientist and research roles
- Certifications: AWS/Azure/GCP cloud certifications, Tableau, Microsoft Power BI
- Boot camps: Accelerated learning for career changers (3-6 months)

6. INDUSTRY DEMAND:
- Healthcare: Growing need for data professionals in medical research, patient care optimization
- Finance: High demand for risk modeling, fraud detection, algorithmic trading
- Retail: Customer analytics, supply chain optimization, recommendation systems
- Technology: Product analytics, user behavior analysis, platform optimization
- Manufacturing: Process optimization, predictive maintenance, quality control

7. EMERGING TRENDS:
- MLOps: Growing importance of operationalizing machine learning models
- AutoML: Automation of model selection and hyperparameter tuning
- Responsible AI: Focus on ethical AI, fairness, and removing bias
- Data Mesh: Decentralized data ownership and governance
- Real-time Analytics: Increasing demand for streaming data processing

8. PORTFOLIO DEVELOPMENT:
- Projects should demonstrate problem-solving abilities and technical skills
- Include 3-5 substantial projects showing different aspects of data work
- Document methodology, challenges faced, and business impact
- Share code through GitHub with clear documentation
- Consider contributing to open-source projects

9. JOB SEARCH STRATEGIES:
- Tailor resume to highlight relevant skills and projects for each application
- Network through data conferences, meetups, and online communities
- Prepare for technical interviews with coding practice and case studies
- Follow companies of interest on LinkedIn and engage with their content
- Consider contract roles as entry points to desirable companies

10. CONTINUOUS LEARNING RESOURCES:
- Academic courses: Coursera, edX, Udacity
- Technical skills: DataCamp, Pluralsight, LeetCode
- Books: "Python for Data Analysis", "The Data Warehouse Toolkit"
- Blogs: Towards Data Science, KDnuggets, Analytics Vidhya
- Podcasts: Data Skeptic, DataFramed, The O'Reilly Data Show
`

interface AIRequest {
  query: string;
  careerFocus: string;
  careerPath: string;
  salaryCap: number;
  assistantType: string;
}


/**
 * formatResponse
 * Cleans up the raw LLM output into your bullet‑only, balanced‑bold Markdown.
 */
function formatResponse(raw: string): string {
  let text = raw;

  // 1) Balanced bold: **…**
  text = text.replace(/\*\*(.+?)\*/g, '**$1**');
  text = text.replace(/\*(.+?)\*\*/g, '**$1**');

  // 2) Numbers → bullets
  text = text.replace(/^\s*\d+\.\s+/gm, '- ');

  // 3) Headings: standalone bold lines → ## or ### 
  text = text.replace(/^\*\*(.+?)\*\*\s*$/gm, (m, title) => {
    const level = title.match(/^(Data Jobs|Data Engineering|Salary Range|Career Progression|Education|Industry Demand|Emerging Trends|Portfolio Development|Job Search Strategies)/)
      ? '##' : '###';
    return `\n${level} ${title}\n`;
  });

  // 4) Ensure bullets stay on one line (no mid‑sentence splits)
  text = text.replace(/(^|\n)(- .+)/g, '\n$1$2');

  // 5) Collapse 3+ blank lines into 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}


serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get API key from environment variable
    const apiKey = Deno.env.get('GROQ');
    if (!apiKey) {
      throw new Error('GROQ API key not found');
    }
    
    // Parse the request body
    const requestData: AIRequest = await req.json();
    const { query, careerFocus, careerPath, salaryCap, assistantType } = requestData;
    
    console.log(`Received query: ${query}`);
    console.log(`Career focus: ${careerFocus}, Career path: ${careerPath}, Salary cap: ${salaryCap}`);
    console.log(`Assistant type: ${assistantType}`);
    
    // Create context based on user preferences
    const userContext = `
      The user is interested in the ${careerFocus} sector, 
      specifically in ${careerPath} career paths, 
      with a target salary range up to $${salaryCap}.
      You are acting as a ${assistantType} assistant.
    `;
    
    // Prepare the API call to GROQ
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', // Using Llama3 8B model
        messages: [
          {
            role: 'system',
            content: `You are a helpful data career assistant with expertise in the data industry. 
                     Use the following knowledge base to inform your responses: 
                     ${KNOWLEDGE_BASE}
                     
                     ${FORMAT_INSTRUCTIONS}
                     
                     ${userContext}
                     
                     Focus on providing accurate, actionable advice based on the knowledge base above.
                     If you're unsure about something or if the information isn't in the knowledge base,
                     acknowledge the limitations of your knowledge rather than making up information.`
          },
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 1024,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('GROQ API error:', errorData);
      throw new Error(`GROQ API returned ${response.status}: ${errorData}`);
    }
    
    const data = await response.json();
    let aiResponse = data.choices[0].message.content;
    
    // Replace "* " with "\n- " for better formatted bullet points
    // Applying formatting function here:
    aiResponse = formatResponse(aiResponse); //.replace(/\* /g, "\n- ");
    
    console.log('AI response generated successfully.');
    
    // Return the AI response
    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
    
  } catch (error) {
    console.error('Error processing request:', error.message);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
})
