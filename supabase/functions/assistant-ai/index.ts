
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0'
import { requireUser } from '../_shared/auth.ts'

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

/**
 * Real pay figures for the roles the platform knows about, formatted for the
 * system prompt.
 *
 * KNOWLEDGE_BASE used to carry a hardcoded salary ladder — "Junior roles:
 * $60,000-$85,000" and so on — with no source and no date. The model answered
 * every pay question from it, so the numbers users saw were as old as whenever
 * that block was typed. These come from `career_role_wages`, which is BLS OEWS
 * data with a reference period attached.
 *
 * Returns an empty string on failure, and the prompt below then tells the model
 * it has no wage data and must say so. That is the one place a fallback is
 * right: the alternative is the model filling the silence from its training
 * data, which is exactly the undated-guess problem being removed.
 */
async function fetchWageContext(supabaseClient: any): Promise<string> {
  const { data, error } = await supabaseClient
    .from('career_role_wages')
    .select('title, occupation_title, soc_code, pct10, median, pct90, reference_period, source_name')
    .order('median', { ascending: false });

  if (error || !data?.length) {
    console.error('fetchWageContext: no wage data available', error?.message);
    return '';
  }

  const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
  const lines = data.map(
    (r: any) =>
      `- ${r.title}: 10th ${usd(r.pct10)}, median ${usd(r.median)}, 90th ${usd(r.pct90)} ` +
      `(BLS occupation: ${r.occupation_title}, ${r.soc_code})`,
  );

  return `
CURRENT WAGE DATA — ${data[0].source_name}, ${data[0].reference_period}:
National, cross-industry annual wage estimates. Figures describe the BLS
occupation each role maps to, not the role title itself.

${lines.join('\n')}

When asked about pay, quote only these figures and name the reference period.
Do not estimate, adjust for cost of living, or offer a range that is not above.
`;
}

interface AIRequest {
  query: string;
  careerFocus: string;
  careerPath: string;
  salaryCap: number;
  assistantType: string;
  conversationId?: string;
  quizAttemptId?: string;
  context?: string;
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

// Track conversation history in the database.
// BEHAVIOR CHANGE (silent-failure audit): supabase-js returns errors instead of
// throwing, so the old try/catch never fired and failed inserts vanished without
// even a log line — users lost chat history silently. We now check the returned
// errors and report success/failure to the caller so the response can carry an
// explicit persistence warning. The chat itself still succeeds.
async function trackConversation(conversationId: string, content: string, senderType: 'user' | 'assistant', supabaseClient: any): Promise<boolean> {
  try {
    if (!conversationId) return true;

    const { error: insertError } = await supabaseClient
      .from('assistant_messages')
      .insert({
        conversation_id: conversationId,
        content,
        sender_type: senderType
      });

    if (insertError) {
      console.error(`Failed to persist ${senderType} message for conversation ${conversationId}:`, insertError);
      return false;
    }

    // Update the conversation's updated_at timestamp (non-fatal if it fails)
    const { error: updateError } = await supabaseClient
      .from('assistant_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (updateError) {
      console.warn('Failed to bump conversation updated_at:', updateError);
    }

    return true;
  } catch (error) {
    console.error('Error tracking conversation:', error);
    return false;
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
  
  // verify_jwt=true is satisfied by the public anon key, so require a session.
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

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
    // Tracks whether chat-history persistence failed so the client can be told
    let historyPersisted = true;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase credentials not found, conversation tracking disabled");
      if (conversationId) historyPersisted = false;
    } else {
      // Carries the caller's JWT so RLS evaluates as that user. The bare anon
      // client this replaced made auth.uid() null for every request, which meant
      // conversations were read and written purely on a client-supplied id.
      const supabase = auth.asUser;

      // Fetch quiz data if available
      if (quizAttemptId) {
        quizContext = await fetchQuizData(quizAttemptId, supabase);
      }

      // Get conversation history if available
      if (conversationId) {
        conversationHistory = await getPreviousMessages(conversationId, supabase);

        // Track user message in database
        historyPersisted = await trackConversation(conversationId, query, 'user', supabase) && historyPersisted;
      }
    }
    
    // Create context based on user preferences
    let userContext = `
      The user is interested in the ${careerFocus} sector, 
      specifically in ${careerPath} career paths, 
      with a target salary range up to $${salaryCap}.
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

    // Real, dated pay figures replacing the hardcoded ladder that used to live
    // in KNOWLEDGE_BASE.
    //
    // `auth.asUser` rather than the `supabase` above: that one is scoped to the
    // else-branch of the credentials check, so referencing it here throws
    // ReferenceError on every request. `career_role_wages` is public reference
    // data, so the caller's own client can read it.
    const wageContext = await fetchWageContext(auth.asUser);

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
          // Replaces llama3-8b-8192, decommissioned 2025-08-30, which had been
          // 500ing every message since. This model is markedly more verbose than
          // the 8b: at the old max_tokens of 1024 it hit finish_reason 'length'
          // and truncated mid-answer, so the ceiling below moved with it.
          model: 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: `You are a helpful data career assistant with expertise in the data industry.
                       Use the following knowledge base to inform your responses:
                       ${KNOWLEDGE_BASE}
                       ${wageContext || `
NO WAGE DATA IS AVAILABLE for this conversation. If the user asks about salary,
pay or compensation, say you cannot look up current figures right now and point
them at the Explore Careers page. Do not answer from memory — any number you
produce would be undated and unsourced.`}

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
          max_tokens: 4096,
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
        historyPersisted = await trackConversation(conversationId, aiResponse, 'assistant', supabase) && historyPersisted;
      }

      // Return the AI response. If history persistence failed, say so explicitly
      // instead of pretending the messages were saved.
      return new Response(
        JSON.stringify({
          response: aiResponse,
          ...(conversationId && !historyPersisted
            ? { persistenceWarning: 'Failed to save this exchange to conversation history' }
            : {})
        }),
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
