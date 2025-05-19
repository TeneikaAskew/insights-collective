
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const handleError = (error: any) => {
  console.error("Error details:", {
    message: error.message,
    name: error.name,
    stack: error.stack,
    cause: error.cause,
  });
  
  return error;
};
