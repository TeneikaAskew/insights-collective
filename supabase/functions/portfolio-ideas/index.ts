
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/utils.ts';

const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Portfolio ideas function called");
    const requestBody = await req.json();
    console.log("Request body:", JSON.stringify(requestBody));
    
    const { resumeText, actionPlan, questionnaireAnswers } = requestBody;

    if (!togetherApiKey) {
      console.error("No Together API key configured");
      throw new Error('Together.ai API key not configured');
    }

    // Construct the prompt
    const systemPrompt = `You are a career portfolio advisor helping someone identify project ideas and career paths based on their background. 
    Analyze the following information and provide a detailed analysis:
    1. Key strengths & interests (extracted from their information)
    2. A skill inventory (list all skills you identify)
    3. Top 2-3 target roles that match their profile
    4. For each role, suggest 3-5 portfolio project ideas with:
       - Project name and description
       - Required skills & tools
       - Estimated effort level (Low: <10 hrs, Medium: 10-30 hrs, High: >30 hrs)
       - Impact statement (why hiring managers would value this)
       - Suggested milestones/roadmap
    5. Identify skill gaps and recommend learning resources
    
    Format your response as structured JSON without explanatory text. The structure should be:
    {
      "strengths": ["strength1", "strength2", ...],
      "skills": ["skill1", "skill2", ...],
      "targetRoles": [
        {
          "title": "Role Title",
          "coreSkills": ["skill1", "skill2", ...],
          "commonDeliverables": ["deliverable1", "deliverable2", ...],
          "projectIdeas": [
            {
              "title": "Project Title",
              "description": "Project Description",
              "requiredSkills": ["skill1", "skill2", ...],
              "effortLevel": "Low/Medium/High",
              "impact": "Impact statement",
              "roadmap": ["milestone1", "milestone2", ...]
            },
            ...
          ]
        },
        ...
      ],
      "skillGaps": {
        "missingSkills": ["skill1", "skill2", ...],
        "learningResources": [
          {
            "skill": "skill name",
            "resources": ["resource1", "resource2", ...]
          },
          ...
        ]
      }
    }`;

    // Combine all user data into a user profile for the AI
    const userProfileText = `
    RESUME INFORMATION:
    ${resumeText || "No resume provided"}
    
    CAREER ACTION PLAN:
    ${actionPlan ? JSON.stringify(actionPlan) : "No action plan provided"}
    
    QUESTIONNAIRE ANSWERS:
    Interests: ${questionnaireAnswers?.interests || "Not provided"}
    Current role: ${questionnaireAnswers?.currentRole || "Not provided"}
    Hobbies/free time activities: ${questionnaireAnswers?.hobbies || "Not provided"}
    `;

    console.log("Calling Together API with model: meta-llama/Llama-3.1-8B-Instruct-Turbo-Free");
    
    // Call the Together AI API
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${togetherApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.1-8B-Instruct-Turbo-Free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userProfileText }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Together API error:', errorText);
      throw new Error(`Together API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("Together API response received");
    const aiResponse = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from the AI response
    let portfolioData = {};
    try {
      // Try to parse directly first
      portfolioData = JSON.parse(aiResponse);
      console.log("Successfully parsed JSON response");
    } catch (e) {
      console.log("Direct JSON parsing failed, trying to extract JSON from text");
      // If direct parsing fails, try to extract JSON from text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          portfolioData = JSON.parse(jsonMatch[0]);
          console.log("Successfully extracted and parsed JSON from text");
        } catch (innerError) {
          console.error('Failed to parse JSON from AI response:', innerError);
          throw new Error('Failed to parse portfolio data from AI response');
        }
      } else {
        console.error('No valid JSON found in AI response');
        throw new Error('No valid JSON found in AI response');
      }
    }

    console.log("Returning successful response");
    return new Response(
      JSON.stringify({ success: true, data: portfolioData }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error in portfolio-ideas function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
