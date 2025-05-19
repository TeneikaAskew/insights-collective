
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseTogetherAIOptions {
  model?: string;
  maxTokens?: number;
  stream?: boolean;
  chatHistory?: Array<{ role: string; content: string }>;
}

interface ChatMessage {
  role: string;
  content: string;
}

interface TogetherAIResponse {
  data: {
    choices: Array<{
      text?: string;
      message?: {
        content: string;
      };
      delta?: {
        content: string;
      };
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

  const generateText = async (prompt: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke<TogetherAIResponse>('together-ai', {
        body: {
          prompt,
          model: options.model || 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',//'mistralai/Mixtral-8x7B-Instruct-v0.1',
          max_tokens: options.maxTokens || 1024,
          stream: options.stream || false
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.data?.choices?.[0]) {
        throw new Error('No response received from AI');
      }

      // Handle both streaming and non-streaming responses
      const choice = data.data.choices[0];
      let text: string;
      
      if (choice.text) {
        text = choice.text;
      } else if (choice.message?.content) {
        text = choice.message.content;
      } else if (choice.delta?.content) {
        text = choice.delta.content;
      } else {
        text = '';
      }

      setResult(text);
      return text;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to generate text';
      setError(errorMessage);
      console.error('Error generating text with Together.ai:', errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const generateChatCompletion = async (messages: ChatMessage[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke<TogetherAIResponse>('together-ai', {
        body: {
          chatHistory: messages,
          model: options.model || 'meta-llama/Llama-3-8b-chat-hf',
          max_tokens: options.maxTokens || 1024,
          stream: options.stream || false
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.data?.choices?.[0]) {
        throw new Error('No response received from AI');
      }
      
      // Handle both streaming and non-streaming responses
      const choice = data.data.choices[0];
      let text: string;
      
      if (choice.text) {
        text = choice.text;
      } else if (choice.message?.content) {
        text = choice.message.content;
      } else if (choice.delta?.content) {
        text = choice.delta.content;
      } else {
        text = '';
      }

      setResult(text);
      return text;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to generate chat completion';
      setError(errorMessage);
      console.error('Error generating chat completion with Together.ai:', errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generateText,
    generateChatCompletion,
    isLoading,
    error,
    result
  };
}
