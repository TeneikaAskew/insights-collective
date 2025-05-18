import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CodeExecutionRequest {
  code: string;
  language: string;
  input: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, language, input } = await req.json() as CodeExecutionRequest;

    // Initialize WebAssembly environment based on language
    let result: string;
    let error: string | null = null;

    switch (language) {
      case 'javascript':
        try {
          // Create a secure sandbox for JavaScript execution
          const sandbox = new Worker(
            `data:text/javascript,${encodeURIComponent(`
              self.onmessage = async (e) => {
                try {
                  const input = e.data.input;
                  const code = e.data.code;
                  // Add timeout to prevent infinite loops
                  const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Execution timeout')), 5000)
                  );
                  const executionPromise = new Promise(resolve => {
                    const result = eval(\`
                      try {
                        \${code}
                        solution(\${input});
                      } catch (error) {
                        error.message;
                      }
                    \`);
                    resolve(result);
                  });
                  const result = await Promise.race([executionPromise, timeoutPromise]);
                  self.postMessage({ result });
                } catch (error) {
                  self.postMessage({ error: error.message });
                }
              };
            `)}`
          );

          const response = await new Promise((resolve, reject) => {
            sandbox.onmessage = (e) => resolve(e.data);
            sandbox.onerror = (e) => reject(e);
            sandbox.postMessage({ code, input });
          });

          result = response.result;
          error = response.error;
        } catch (e) {
          error = e.message;
        }
        break;

      case 'python':
        // Use Pyodide for Python execution
        // This is a placeholder - we'll need to implement proper Python execution
        result = 'Python execution not implemented yet';
        break;

      case 'typescript':
        // For TypeScript, we'll need to transpile to JavaScript first
        // This is a placeholder - we'll need to implement proper TypeScript execution
        result = 'TypeScript execution not implemented yet';
        break;

      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    if (error) {
      return new Response(
        JSON.stringify({ error }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ result }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}); 