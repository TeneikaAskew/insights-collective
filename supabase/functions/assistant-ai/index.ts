
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0'

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

4. EDUCATION AND CERTIFICATION:
- Bachelor's degree: Minimum requirement for most entry-level positions
- Master's/PhD: Often preferred for Data Scientist and research roles
- Certifications: AWS/Azure/GCP cloud certifications, Tableau, Microsoft Power BI
- Boot camps: Accelerated learning for career changers (3-6 months)

5. INDUSTRY DEMAND:
- Healthcare: Growing need for data professionals in medical research, patient care optimization
- Finance: High demand for risk modeling, fraud detection, algorithmic trading
- Retail: Customer analytics, supply chain optimization, recommendation systems
- Technology: Product analytics, user behavior analysis, platform optimization
- Manufacturing: Process optimization, predictive maintenance, quality control

6. EMERGING TRENDS:
- MLOps: Growing importance of operationalizing machine learning models
- AutoML: Automation of model selection and hyperparameter tuning
- Responsible AI: Focus on ethical AI, fairness, and removing bias
- Data Mesh: Decentralized data ownership and governance
- Real-time Analytics: Increasing demand for streaming data processing

7. PORTFOLIO DEVELOPMENT:
- Projects should demonstrate problem-solving abilities and technical skills
- Include 3-5 substantial projects showing different aspects of data work
- Document methodology, challenges faced, and business impact
- Share code through GitHub with clear documentation
- Consider contributing to open-source projects

8. JOB SEARCH STRATEGIES:
- Tailor resume to highlight relevant skills and projects for each application
- Network through data conferences, meetups, and online communities
- Prepare for technical interviews with coding practice and case studies
- Follow companies of interest on LinkedIn and engage with their content
- Consider contract roles as entry points to desirable companies

9. CONTINUOUS LEARNING RESOURCES:
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
  salaryCap?: number;
  assistantType: string;
  conversationId?: string;
  quizAttemptId?: string;
  context?: string;
}

/**
 * Real wage figures for the curated roles, injected per request.
 *
 * The knowledge base used to carry a hardcoded, undated salary ladder
 * ("Junior roles: $60,000-$85,000" …) that the model answered pay questions
 * from. It had no source, no reference period, and was organised by seniority
 * rather than by occupation, so nothing about it could be checked. These come
 * from `bls_occupations`, and the model is told to cite the period.
 */
async function fetchWageContext(supabaseClient: any): Promise<string> {
  const { data, error } = await supabaseClient
    .from('career_role_wages')
    .select('title, occupation_title, soc_code, pct25, median, pct75, reference_period')
    .eq('source', 'curated')
    .order('median', { ascending: false });

  if (error || !data?.length) {
    console.error('Could not load BLS wage context:', error);
    // Say nothing about pay rather than falling back to remembered numbers.
    return `
SALARY DATA:
No wage data is available for this request. Do not state or estimate any salary
figures. Tell the user pay data is temporarily unavailable.
`;
  }

  const period = data[0].reference_period;
  const lines = data
    .map(
      (r: Record<string, string | number>) =>
        `- ${r.title} (BLS: ${r.occupation_title}, ${r.soc_code}): 25th–75th percentile $${r.pct25}–$${r.pct75}, median $${r.median}`,
    )
    .join('\n');

  return `
SALARY DATA — U.S. Bureau of Labor Statistics, Occupational Employment and Wage
Statistics, ${period}. National, cross-industry. These are the ONLY salary
figures you may state. Do not estimate, extrapolate, adjust for seniority or
location, or quote any number that is not below. Always name the reference
period (${period}) when you give a figure, and note that the figure is for the
BLS occupation the role maps to.

${lines}
`;
}


/**
 * formatResponse
 * Cleans up the raw LLM output into properly formatted Markdown.
 */
function formatResponse(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // 1) Fix unbalanced bold markers: **…* or *…** → **…**
  text = text.replace(/\*\*(.+?)\*/g, '**$1**');
  text = text.replace(/\*(.+?)\*\*/g, '**$1**');

  // 2) Convert any leading "* " or "+ " into "- " bullets
  text = text.replace(/^[\s]*[\*\+]\s+/gm, '- ');

  // 3) Convert any numbered lists into bullets
  text = text.replace(/^[\s]*\d+\.\s+/gm, '- ');

  // 4) Ensure headings (bold-only lines) get a blank line before & after
  text = text.replace(/^\s*\*\*(.+?)\*\*\s*$/gm, '\n## $1\n');

  // 5) Collapse multiple blank lines into exactly two
  text = text.replace(/\n{3,}/g, '\n\n');

  // 6) Trim leading/trailing whitespace on each line
  text = text
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();

  return text;
}

// New function to fetch quiz data for career coach
async function fetchQuizData(quizAttemptId: string, supabaseClient: any): Promise<string> {
  try {
    const { data: quizData, error } = await supabaseClient
      .from('career_quiz_attempts')
      .select('*')
      .eq('id', quizAttemptId)
      .single();
    
    if (error || !quizData) {
      console.error('Error fetching quiz data:', error);
      return '';
    }
    
    // Format quiz data as context
    const topPath = quizData.top_recommended_path;
    let pathScore = 0;
    
    switch(topPath) {
      case 'AI/ML':
        pathScore = quizData.result_ai_ml_score;
        break;
      case 'Analytics':
        pathScore = quizData.result_analytics_score;
        break;
      case 'Data Engineering':
        pathScore = quizData.result_data_engineering_score;
        break;
      case 'Business Intelligence':
        pathScore = quizData.result_business_intelligence_score;
        break;
    }
    
    const quizContext = `
QUIZ RESULTS CONTEXT:
Top recommended career path: ${topPath} (Score: ${pathScore})

Other paths considered:
- AI/ML: ${quizData.result_ai_ml_score}
- Analytics: ${quizData.result_analytics_score}
- Data Engineering: ${quizData.result_data_engineering_score}
- Business Intelligence: ${quizData.result_business_intelligence_score}

Question Responses:
- Analytical Thinking: ${quizData.q_analytical_thinking || 'N/A'}/5
- Creative Problem Solving: ${quizData.q_creative_problem_solving || 'N/A'}/5
- Technical Complexity: ${quizData.q_technical_complexity || 'N/A'}/5
- Business Value: ${quizData.q_business_value || 'N/A'}/5
- Communication: ${quizData.q_communication || 'N/A'}/5
- Teamwork: ${quizData.q_teamwork || 'N/A'}/5
- Data Orientation: ${quizData.q_data_orientation || 'N/A'}/5
- Math/Stats Comfort: ${quizData.q_math_stats_comfort || 'N/A'}/5
- Coding Preference: ${quizData.q_coding_preference || 'N/A'}/5
- Visualization Interest: ${quizData.q_visualization_interest || 'N/A'}/5
`;

    return quizContext;
  } catch (error) {
    console.error('Error in fetchQuizData:', error);
    return '';
  }
}

// New function to track conversation history in the database
async function trackConversation(conversationId: string, content: string, senderType: 'user' | 'assistant', supabaseClient: any): Promise<void> {
  try {
    if (!conversationId) return;
    
    await supabaseClient
      .from('assistant_messages')
      .insert({
        conversation_id: conversationId,
        content,
        sender_type: senderType
      });
      
    // Update the conversation's updated_at timestamp
    await supabaseClient
      .from('assistant_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
      
  } catch (error) {
    console.error('Error tracking conversation:', error);
  }
}

// Get previous conversation history for better context
async function getPreviousMessages(conversationId: string, supabaseClient: any, limit = 5): Promise<string> {
  try {
    if (!conversationId) return '';
    
    const { data, error } = await supabaseClient
      .from('assistant_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error || !data || data.length === 0) {
      return '';
    }
    
    // Format conversation history
    const history = data
      .reverse()
      .map(msg => `${msg.sender_type.toUpperCase()}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`)
      .join('\n\n');
      
    return `PREVIOUS CONVERSATION CONTEXT:\n${history}`;
    
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return '';
  }
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
      throw new Error('GROQ API key not found. Please configure the GROQ secret in Supabase.');
    }
    
    // Parse the request body
    const requestData: AIRequest = await req.json();
    const { 
      query, 
      careerFocus, 
      careerPath, 
      salaryCap, 
      assistantType,
      conversationId,
      quizAttemptId,
      context = ''
    } = requestData;
    
    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Missing query parameter",
          response: "I need a question or topic to respond to. Please provide a query."
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    console.log(`Received query: ${query}`);
    console.log(`Career focus: ${careerFocus}, Career path: ${careerPath}, Salary cap: ${salaryCap}`);
    console.log(`Assistant type: ${assistantType}`);
    
    if (conversationId) {
      console.log(`Conversation ID: ${conversationId}`);
    }
    
    if (quizAttemptId) {
      console.log(`Quiz Attempt ID: ${quizAttemptId}`);
    }
    
    // Create Supabase client for database operations
    let quizContext = '';
    let conversationHistory = '';
    let wageContext = '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase credentials not found, conversation tracking disabled");
    } else {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Real pay figures, replacing the ladder that used to live in the prompt.
      wageContext = await fetchWageContext(supabase);

      // Fetch quiz data if available
      if (quizAttemptId) {
        quizContext = await fetchQuizData(quizAttemptId, supabase);
      }
      
      // Get conversation history if available
      if (conversationId) {
        conversationHistory = await getPreviousMessages(conversationId, supabase);
        
        // Track user message in database
        await trackConversation(conversationId, query, 'user', supabase);
      }
    }
    
    // Create context based on user preferences
    // `salaryCap` is a slider the user sets, so it is only stated when they
    // actually set one. Callers that had no slider used to send a hardcoded
    // 120000, which read to the model as a stated preference.
    let userContext = `
      The user is interested in the ${careerFocus} sector,
      specifically in ${careerPath} career paths.${
        typeof salaryCap === 'number' && salaryCap > 0
          ? `\n      They are targeting roles paying up to $${salaryCap}.`
          : ''
      }
      You are acting as a ${assistantType} assistant.
    `;
    
    // Add quiz context if available
    if (quizContext) {
      userContext += `\n\n${quizContext}`;
    }
    
    // Add conversation history if available
    if (conversationHistory) {
      userContext += `\n\n${conversationHistory}`;
    }
    
    // Add additional context if provided
    if (context) {
      userContext += `\n\nADDITIONAL CONTEXT:\n${context}`;
    }
    
    // Prepare the API call to GROQ
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      console.log("Calling GROQ API...");
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
                       ${wageContext}
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
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('GROQ API error:', errorText);
        throw new Error(`GROQ API returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      let aiResponse = data.choices[0].message.content;
      
      // Apply formatting function
      aiResponse = formatResponse(aiResponse);
      
      console.log('AI response generated successfully.');
      
      // Track assistant response in database
      if (conversationId && supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await trackConversation(conversationId, aiResponse, 'assistant', supabase);
      }
      
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
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('GROQ API request timed out');
        throw new Error('Request timed out. The AI service is taking too long to respond.');
      } else {
        throw fetchError;
      }
    }
  } catch (error) {
    console.error('Error processing request:', error.message);
    
    // Create a user-friendly error response
    const errorMessage = error.message || 'An unexpected error occurred';
    const userFriendlyMessage = errorMessage.includes('API') || errorMessage.includes('GROQ')
      ? 'The AI service is currently unavailable. Please try again in a few moments.'
      : errorMessage;
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        response: `I apologize, but I encountered an error: ${userFriendlyMessage} Please try again or contact support if the issue persists.`
      }),
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
