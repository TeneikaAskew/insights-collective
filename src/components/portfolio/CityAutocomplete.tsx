
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, MapPin, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchCities } from '@/data/cities';
import { validateCityName, formatCityName } from '@/utils/cityValidation';

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  country?: string;
  state?: string;
  placeholder?: string;
}

export function CityAutocomplete({ value, onChange, country, state, placeholder = "Enter city name" }: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (country && searchQuery.length >= 2) {
      const cities = searchCities(searchQuery, country, state);
      setSuggestions(cities);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, country, state]);

  const handleInputChange = (inputValue: string) => {
    setSearchQuery(inputValue);
    
    // Validate the input - now requires 3 characters minimum
    const validation = validateCityName(inputValue);
    if (!validation.isValid && inputValue.trim().length > 0) {
      setValidationError(validation.error || null);
    } else {
      setValidationError(null);
    }
  };

  const handleSelectCity = (cityName: string) => {
    const formattedCity = formatCityName(cityName);
    onChange(formattedCity);
    setSearchQuery('');
    setOpen(false);
    setValidationError(null);
  };

  const handleBlur = () => {
    // Format the city name on blur if valid
    if (value && !validationError) {
      const formattedCity = formatCityName(value);
      if (formattedCity !== value) {
        onChange(formattedCity);
      }
    }
  };

  // Allow user to add custom city if not found in suggestions
  const handleAddCustomCity = () => {
    if (searchQuery.trim().length >= 3) {
      const validation = validateCityName(searchQuery);
      if (validation.isValid) {
        const formattedCity = formatCityName(searchQuery);
        onChange(formattedCity);
        setSearchQuery('');
        setOpen(false);
        setValidationError(null);
      }
    }
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    handleInputChange(inputValue);
    onChange(inputValue);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="city" className="text-sm flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        City
      </Label>
      
      {country ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between text-left font-normal",
                !value && "text-muted-foreground",
                validationError && "border-red-500"
              )}
            >
              {value || placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 bg-white border shadow-lg z-[9999]" align="start">
            <div className="bg-white rounded-md border">
              {/* Search Input */}
              <div className="flex items-center border-b px-3 py-2">
                <input
                  type="text"
                  placeholder="Search cities..."
                  value={searchQuery}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
              
              {/* Results */}
              <div className="max-h-[200px] overflow-y-auto bg-white">
                {searchQuery.length < 3 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Type at least 3 characters to search
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="p-1">
                    {suggestions.map((city) => (
                      <div
                        key={city}
                        onClick={() => handleSelectCity(city)}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100 transition-colors"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === city ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {city}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <span>No cities found.</span>
                      {validateCityName(searchQuery).isValid && (
                        <button
                          onClick={handleAddCustomCity}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Add "{formatCityName(searchQuery)}"
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <Input
          ref={inputRef}
          id="city"
          value={value}
          onChange={handleManualInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(validationError && "border-red-500")}
        />
      )}
      
      {validationError && (
        <p className="text-sm text-red-500">{validationError}</p>
      )}
      
      {!country && (
        <p className="text-xs text-muted-foreground">
          Select a country first to see city suggestions
        </p>
      )}
    </div>
  );
}
