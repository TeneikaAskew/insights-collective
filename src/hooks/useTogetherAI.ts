// src/hooks/useTogetherAI.ts
import { useState } from 'react';

interface UseTogetherAIOptions {
  model?: string;
  maxTokens?: number;
}

export function useTogetherAI(options: UseTogetherAIOptions = {}) {
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [streamedResult, setStreamedResult] = useState<string>('');  // accumulate here

  async function generateText(prompt: string) {
    setIsLoading(true);
    setError(null);
    setStreamedResult('');

    try {
      const res = await fetch('/api/together-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: options.model || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
          max_tokens: options.maxTokens || 1024
        })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Error ${res.status}: ${txt}`);
      }
      if (!res.body) {
        throw new Error('No response body');
      }

      // read & decode the SSE‐style stream:
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          // append each chunk
          setStreamedResult((prev) => prev + chunk);
        }
      }

      return streamedResult;
    } catch (err: any) {
      console.error('Streaming error:', err);
      setError(err.message ?? 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  return {
    generateText,
    isLoading,
    error,
    streamedResult
  };
}

// import { useState } from 'react';
// import { supabase } from '@/integrations/supabase/client';

// interface UseTogetherAIOptions {
//   model?: string;
//   maxTokens?: number;
// }

// interface TogetherAIResponse {
//   data: {
//     choices: Array<{
//       text: string;
//       index: number;
//       finish_reason: string;
//     }>;
//     id: string;
//     object: string;
//     created: number;
//     model: string;
//   };
// }

// export function useTogetherAI(options: UseTogetherAIOptions = {}) {
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [result, setResult] = useState<string | null>(null);

//   const generateText = async (prompt: string) => {
//     setIsLoading(true);
//     setError(null);
    
//     try {
//       const { data, error } = await supabase.functions.invoke<TogetherAIResponse>('together-ai', {
//         body: {
//           prompt,
//           model: options.model || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
//           max_tokens: options.maxTokens || 1024
//         }
//       });

//       if (error) {
//         throw new Error(error.message);
//       }

//       if (!data?.data?.choices?.[0]?.text) {
//         throw new Error('No response received from AI');
//       }

//       setResult(data.data.choices[0].text);
//       return data.data.choices[0].text;
//     } catch (err: any) {
//       const errorMessage = err.message || 'Failed to generate text';
//       setError(errorMessage);
//       console.error('Error generating text with Together.ai:', errorMessage);
//       return null;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return {
//     generateText,
//     isLoading,
//     error,
//     result
//   };
// }
