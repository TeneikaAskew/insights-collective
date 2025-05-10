
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseTogetherAIOptions {
  model?: string;
  maxTokens?: number;
}

interface TogetherAIResponse {
  data: {
    choices: Array<{
      text: string;
      index: number;
      finish_reason: string;
    }>;
    id: string;
    object: string;
    created: number;
    model: string;
  };
}

export function useTogetherAI(options: UseTogetherAIOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const generateText = async (
    prompt: string, 
    onTokenReceived?: (token: string) => void
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (onTokenReceived) {
        // Streaming mode
        const { data, error } = await supabase.functions.invoke('together-ai', {
          body: {
            prompt,
            model: options.model || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
            max_tokens: options.maxTokens || 1024,
            stream: true
          }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data?.stream_url) {
          throw new Error('No stream URL received');
        }

        // Connect to the stream URL
        const eventSource = new EventSource(data.stream_url);
        let fullText = '';

        eventSource.onmessage = (event) => {
          try {
            const parsedData = JSON.parse(event.data);
            
            if (parsedData.choices && parsedData.choices[0]) {
              const token = parsedData.choices[0].text || '';
              fullText += token;
              onTokenReceived(token);
            }
          } catch (err) {
            console.error('Error parsing stream data:', err, event.data);
          }
        };

        eventSource.onerror = (err) => {
          console.error('EventSource error:', err);
          eventSource.close();
          setIsLoading(false);
        };

        eventSource.addEventListener('done', () => {
          eventSource.close();
          setResult(fullText);
          setIsLoading(false);
        });

        return fullText;
      } else {
        // Non-streaming mode
        const { data, error } = await supabase.functions.invoke<TogetherAIResponse>('together-ai', {
          body: {
            prompt,
            model: options.model || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
            max_tokens: options.maxTokens || 1024,
            stream: false
          }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data?.data?.choices?.[0]?.text) {
          throw new Error('No response received from AI');
        }

        setResult(data.data.choices[0].text);
        return data.data.choices[0].text;
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to generate text';
      setError(errorMessage);
      console.error('Error generating text with Together.ai:', errorMessage);
      return null;
    } finally {
      if (!onTokenReceived) {
        setIsLoading(false);
      }
    }
  };

  return {
    generateText,
    isLoading,
    error,
    result
  };
}
