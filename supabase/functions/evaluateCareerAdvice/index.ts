
// Edge function to evaluate career advice using OpenAI based on prompt, quiz questions, quiz answers, and optional resume text.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const GROQ_API_KEY  = Deno.env.get('GROQ');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log(body)
    const { prompt, Quizquestions, quizAnswers, resumeText } = body;

    if (!prompt || !Quizquestions || !quizAnswers) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build combined prompt with all inputs for better context to OpenAI
    let combinedPrompt = `${prompt}\n\nUser's quiz answers:\n`;

    for (const question of Quizquestions) {
      const answer = quizAnswers[question.id] || '';
      combinedPrompt += `${question.label || question.id}: ${answer}\n`;
    }

    if (resumeText) {
      combinedPrompt += `\nUser Resume Text:\n${resumeText}\n`;
    }

    // Compose the message array for gpt chat completion
    const messages = [
      { role: "system", content: "You are a helpful career coach assistant that synthesizes data to give clear career advice." },
      { role: "user", content: combinedPrompt },
    ];

    // Call OpenAI API chat completion
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'compound-beta-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('OpenAI API error:', errorDetails);
      return new Response(JSON.stringify({ error: 'OpenAI API error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in evaluateCareerAdvice function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// import "https://deno.land/x/xhr@0.1.0/mod.ts";
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// const GROQ_API_KEY = Deno.env.get("GROQ");

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// };

// serve(async (req) => {
//   if (req.method === "OPTIONS") {
//     return new Response(null, { headers: corsHeaders });
//   }

//   try {
//     const { prompt, pathwayQuestions, pathwayAnswers, resumeText } = await req.json();

//     console.log("Prompt: ", prompt);
//     console.log("pathwayQuestions: ", pathwayQuestions);
//     console.log("pathwayAnswers: ", pathwayAnswers);
//     console.log("resumeText: ", resumeText);

//     // Validate required fields
//     if (!prompt || !pathwayQuestions || !pathwayAnswers) {
//       return new Response(
//         JSON.stringify({ error: "Missing required fields: prompt, pathwayQuestions, or pathwayAnswers" }),
//         {
//           status: 400,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         }
//       );
//     }

//     // Format the career analysis prompt
//     const formattedPrompt = formatCareerPrompt(prompt, pathwayQuestions, pathwayAnswers, resumeText);

//     console.log("Formatted prompt:", formattedPrompt);

//     const messages = [
//       {
//         role: "system",
//         content: "You are a helpful career coach assistant that synthesizes data to give clear career advice.",
//       },
//       {
//         role: "user",
//         content: formattedPrompt,
//       },
//     ];

//     const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${GROQ_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: "compound-beta-mini",
//         messages,
//         temperature: 0.7,
//         max_tokens: 1200,
//       }),
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error("GROQ API Error:", errorText);
//       return new Response(
//         JSON.stringify({ error: "GROQ API error", details: errorText }),
//         {
//           status: 502,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         }
//       );
//     }

//     const data = await response.json();
//     const generatedText = data.choices?.[0]?.message?.content || "";

//     return new Response(JSON.stringify({ generatedText }), {
//       headers: { ...corsHeaders, "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     console.error("Error in evaluateCareerAdvice function:", error);
//     return new Response(
//       JSON.stringify({ error: error.message || "Unexpected error occurred" }),
//       {
//         status: 500,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       }
//     );
//   }
// });

// function formatCareerPrompt(
//   prompt: string, 
//   pathwayQuestions: any[], 
//   pathwayAnswers: Record<string, string>, 
//   resumeText?: string
// ): string {
//   let formattedPrompt = prompt + '\n\n';
  
//   // Add user's responses
//   formattedPrompt += 'User Responses:\n';
//   if (Array.isArray(pathwayQuestions)) {
//     pathwayQuestions.forEach((question) => {
//       const answer = pathwayAnswers[question.id];
//       if (answer) {
//         formattedPrompt += `${question.label}: ${answer}\n`;
//       }
//     });
//   }
  
//   // Add resume information if available
//   if (resumeText) {
//     formattedPrompt += '\nResume Content:\n' + resumeText + '\n';
//   }
  
//   // Add instructions for formatting
//   formattedPrompt += '\nPlease provide a detailed career pathway report with the following sections:\n';
//   formattedPrompt += '1. Summary\n';
//   formattedPrompt += '2. Recommended Roles\n';
//   formattedPrompt += '3. Skills and Matching Courses\n';
//   formattedPrompt += '4. Next-Step Career Recommendations\n';
//   formattedPrompt += '5. Roles that Might be Right for You\n';
//   formattedPrompt += '6. Path to Your Aspirational Role\n';
//   formattedPrompt += '7. Remote Work Considerations (if applicable)\n';
  
//   return formattedPrompt;
// }
// // import "https://deno.land/x/xhr@0.1.0/mod.ts";
// // import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// // const GROQ_API_KEY = Deno.env.get("GROQ");

// // const corsHeaders = {
// //   "Access-Control-Allow-Origin": "*",
// //   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// // };

// // serve(async (req) => {
// //   if (req.method === "OPTIONS") {
// //     return new Response(null, { headers: corsHeaders });
// //   }

// //   console.log(req)

// // let body;
// // try {
// // //   body = await req.text();//json();
// // // } catch (err) {
// // //   console.error("Invalid JSON body:", err);
// // //   return new Response(
// // //     JSON.stringify({ error: "Invalid JSON body" }),
// // //     {
// // //       status: 400,
// // //       headers: { ...corsHeaders, "Content-Type": "application/json" },
// // //     }
// // //   );
// // // }

// //     const { prompt, pathwayQuestions, pathwayAnswers, resumeText } = await req.json()

// //     console.log("Prompt: ", prompt)
// //     console.log("pathwayQuestions: ", PathwayQuestions)
// //     console.log("pathwayAnswers: ", pathwayAnswers)
// //     console.log("resumeText: ", resumeText)

// //     // Validate required fields
// //     if (!prompt || !pathwayQuestions || !pathwayAnswers) {
// //       throw new Error('Missing required fields: prompt, pathwayQuestions, or pathwayAnswers')
// //     }
  
// //     // Format the career analysis prompt
// //     const formattedPrompt = formatCareerPrompt(prompt, pathwayQuestions, pathwayAnswers, resumeText)

// //     // console.log("Body:", body)

// //     // // const prompt = body.prompt;
// //     // console.log("Prompt: ", prompt)
    
// //     // // const pathwayQuestions = body.pathwayQuestions || body.quizQuestions;
// //     // console.log("PathwayQuestions: ", PathwayQuestions)
    
// //     // // const pathwayAnswers = body.pathwayAnswers || body.quizAnswers;
// //     // console.log("pathwayAnswers: ", pathwayAnswers)
    
// //     // // const resumeText = body.resumeText;    
// //     // console.log("resumeText: ", resumeText)

// //     if (!prompt || !pathwayQuestions || !pathwayAnswers) {
// //       return new Response(
// //         JSON.stringify({ error: "Missing required fields." }),
// //         {
// //           status: 400,
// //           headers: { ...corsHeaders, "Content-Type": "application/json" },
// //         }
// //       );
// //     }

// //     // // Construct prompt
// //     // let combinedPrompt = `${prompt}\n\nUser's pathway answers:\n`;
// //     // for (const question of pathwayQuestions) {
// //     //   const answer = pathwayAnswers[question.id] || "";
// //     //   combinedPrompt += `${question.label || question.id}: ${answer}\n`;
// //     // }
// //     // if (resumeText) {
// //     //   combinedPrompt += `\nUser Resume Text:\n${resumeText}\n`;
// //     // }

// //     const messages = [
// //       {
// //         role: "system",
// //         content: "You are a helpful career coach assistant that synthesizes data to give clear career advice.",
// //       },
// //       {
// //         role: "user",
// //         content: combinedPrompt,
// //       },
// //     ];

// //     const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
// //       method: "POST",
// //       headers: {
// //         Authorization: `Bearer ${GROQ_API_KEY}`,
// //         "Content-Type": "application/json",
// //       },
// //       body: JSON.stringify({
// //         model: "compound-beta-mini",
// //         messages,
// //         temperature: 0.7,
// //         max_tokens: 1200,
// //       }),
// //     });

// //     if (!response.ok) {
// //       const errorText = await response.text();
// //       console.error("GROQ API Error:", errorText);
// //       return new Response(
// //         JSON.stringify({ error: "GROQ API error", details: errorText }),
// //         {
// //           status: 502,
// //           headers: { ...corsHeaders, "Content-Type": "application/json" },
// //         }
// //       );
// //     }

// //     let data;
// //     try {
// //       data = await response.json();
// //     } catch (jsonErr) {
// //       console.error("Failed to parse JSON from GROQ:", jsonErr);
// //       return new Response(
// //         JSON.stringify({
// //           error: "Failed to parse GROQ JSON response",
// //           details: jsonErr.message,
// //         }),
// //         {
// //           status: 500,
// //           headers: { ...corsHeaders, "Content-Type": "application/json" },
// //         }
// //       );
// //     }

// //     const generatedText = data.choices?.[0]?.message?.content || "";

// //     return new Response(JSON.stringify({ generatedText }), {
// //       headers: { ...corsHeaders, "Content-Type": "application/json" },
// //     });
// //   } catch (error) {
// //     console.error("Error in evaluateCareerAdvice function:", error);
// //     return new Response(
// //       JSON.stringify({ error: error.message || "Unexpected error occurred" }),
// //       {
// //         status: 500,
// //         headers: { ...corsHeaders, "Content-Type": "application/json" },
// //       }
// //     );
// //   }
// // });

// // function formatCareerPrompt(
// //   prompt: string, 
// //   pathwayQuestions: any[], 
// //   pathwayAnswers: Record<string, string>, 
// //   resumeText?: string
// // ): string {
// //   let formattedPrompt = prompt + '\n\n'
  
// //   // Add user's responses
// //   formattedPrompt += 'User Responses:\n'
// //   pathwayQuestions.forEach((question) => {
// //     const answer = pathwayAnswers[question.id]
// //     if (answer) {
// //       formattedPrompt += `${question.label}: ${answer}\n`
// //     }
// //   })
  
// //   // Add resume information if available
// //   if (resumeText) {
// //     formattedPrompt += '\nResume Content:\n' + resumeText + '\n'
// //   }
  
// //   // Add instructions for formatting
// //   formattedPrompt += '\nPlease provide a detailed career pathway report with the following sections:\n'
// //   formattedPrompt += '1. Summary\n'
// //   formattedPrompt += '2. Recommended Roles\n'
// //   formattedPrompt += '3. Skills and Matching Courses\n'
// //   formattedPrompt += '4. Next-Step Career Recommendations\n'
// //   formattedPrompt += '5. Roles that Might be Right for You\n'
// //   formattedPrompt += '6. Path to Your Aspirational Role\n'
// //   formattedPrompt += '7. Remote Work Considerations (if applicable)\n'
  
// //   return formattedPrompt
// // }