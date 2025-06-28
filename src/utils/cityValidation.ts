
export const validateCityName = (cityName: string): { isValid: boolean; error?: string } => {
  if (!cityName || cityName.trim().length === 0) {
    return { isValid: false, error: "City name is required" };
  }

  const trimmedCity = cityName.trim();

  // Length validation - changed from 2 to 3 characters minimum
  if (trimmedCity.length < 3) {
    return { isValid: false, error: "City name must be at least 3 characters" };
  }

  if (trimmedCity.length > 50) {
    return { isValid: false, error: "City name must be less than 50 characters" };
  }

  // Character validation - only letters, spaces, hyphens, apostrophes, and periods
  const validCityRegex = /^[a-zA-Z\s\-'\.]+$/;
  if (!validCityRegex.test(trimmedCity)) {
    return { isValid: false, error: "City name can only contain letters, spaces, hyphens, apostrophes, and periods" };
  }

  return { isValid: true };
};

export const formatCityName = (cityName: string): string => {
  return cityName
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
