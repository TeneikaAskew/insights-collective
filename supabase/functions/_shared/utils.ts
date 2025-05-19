
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
  
  // Serialize error for better debugging
  let serializedError;
  try {
    serializedError = JSON.stringify(error, Object.getOwnPropertyNames(error));
    console.error("Serialized error:", serializedError);
  } catch (e) {
    console.error("Could not serialize error:", e);
  }
  
  return error;
};

// Parse JSON safely with detailed error handling
export const safeParseJSON = (content: string) => {
  try {
    // Try to parse the content directly
    console.log(`Attempting direct JSON parsing`);
    return { 
      data: JSON.parse(content),
      success: true,
      error: null
    };
  } catch (e) {
    console.error(`Failed to parse JSON directly:`, e);
    
    // Try to extract JSON using regex as a fallback
    console.log(`Attempting fallback JSON extraction via regex`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return {
          data: JSON.parse(jsonMatch[0]),
          success: true,
          error: null
        };
      } catch (e2) {
        console.error(`Failed to parse extracted JSON:`, e2);
        return {
          data: null,
          success: false,
          error: new Error("Failed to parse JSON even after extraction")
        };
      }
    } else {
      console.error(`Could not find JSON in content`);
      console.error(`Content snippet:`, content.substring(0, 100) + '...');
      return {
        data: null,
        success: false,
        error: new Error("Could not extract JSON from content")
      };
    }
  }
};
