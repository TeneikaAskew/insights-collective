// Major cities by country/state for autocomplete suggestions
export const CITIES_DATA: Record<string, Record<string, string[]>> = {
  "United States": {
    "California": ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "Oakland", "Fresno", "Long Beach", "Santa Ana", "Riverside", "Stockton"],
    "New York": ["New York City", "Buffalo", "Rochester", "Syracuse", "Albany", "Yonkers", "New Rochelle", "Mount Vernon", "Schenectady", "Utica"],
    "Texas": ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano", "Lubbock"],
    "Florida": ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah", "Tallahassee", "Fort Lauderdale", "Port St. Lucie", "Cape Coral"],
    "Illinois": ["Chicago", "Aurora", "Peoria", "Rockford", "Joliet", "Naperville", "Springfield", "Elgin", "Waukegan", "Cicero"],
    "Pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem", "Lancaster", "Harrisburg", "Altoona"],
    "Ohio": ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Parma", "Canton", "Youngstown", "Lorain"],
    "Georgia": ["Atlanta", "Augusta", "Columbus", "Savannah", "Athens", "Sandy Springs", "Roswell", "Macon", "Johns Creek", "Albany"],
    "North Carolina": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary", "Wilmington", "High Point", "Asheville"],
    "Michigan": ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Lansing", "Ann Arbor", "Flint", "Dearborn", "Livonia", "Westland"]
  },
  "Canada": {
    "Ontario": ["Toronto", "Ottawa", "Hamilton", "London", "Kitchener", "Windsor", "Oshawa", "Barrie", "Guelph", "Kingston"],
    "Quebec": ["Montreal", "Quebec City", "Laval", "Gatineau", "Longueuil", "Sherbrooke", "Saguenay", "Trois-Rivières", "Terrebonne", "Saint-Jean-sur-Richelieu"],
    "British Columbia": ["Vancouver", "Surrey", "Burnaby", "Richmond", "Abbotsford", "Coquitlam", "Kelowna", "Saanich", "Delta", "Langley"],
    "Alberta": ["Calgary", "Edmonton", "Red Deer", "Lethbridge", "St. Albert", "Medicine Hat", "Grande Prairie", "Airdrie", "Spruce Grove", "Okotoks"]
  },
  "United Kingdom": {
    "England": ["London", "Birmingham", "Manchester", "Liverpool", "Sheffield", "Leeds", "Bristol", "Newcastle", "Nottingham", "Leicester"],
    "Scotland": ["Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Stirling", "Perth", "Inverness", "Paisley", "East Kilbride", "Livingston"],
    "Wales": ["Cardiff", "Swansea", "Newport", "Wrexham", "Barry", "Caerphilly", "Bridgend", "Neath", "Port Talbot", "Cwmbran"],
    "Northern Ireland": ["Belfast", "Derry", "Lisburn", "Newtownabbey", "Bangor", "Craigavon", "Castlereagh", "Ballymena", "Newtownards", "Carrickfergus"]
  },
  "Australia": {
    "New South Wales": ["Sydney", "Newcastle", "Wollongong", "Maitland", "Wagga Wagga", "Albury", "Port Macquarie", "Tamworth", "Orange", "Dubbo"],
    "Victoria": ["Melbourne", "Geelong", "Ballarat", "Bendigo", "Shepparton", "Warrnambool", "Horsham", "Wodonga", "Traralgon", "Mildura"],
    "Queensland": ["Brisbane", "Gold Coast", "Townsville", "Cairns", "Toowoomba", "Rockhampton", "Mackay", "Bundaberg", "Hervey Bay", "Gladstone"],
    "Western Australia": ["Perth", "Fremantle", "Rockingham", "Mandurah", "Bunbury", "Kalgoorlie", "Geraldton", "Albany", "Kwinana", "Broome"]
  }
};

export const getCitiesByCountryAndState = (country: string, state?: string): string[] => {
  if (!country) return [];
  
  const countryData = CITIES_DATA[country];
  if (!countryData) return [];
  
  if (state && countryData[state]) {
    return countryData[state];
  }
  
  // If no state specified or state not found, return all cities for the country
  return Object.values(countryData).flat();
};

export const searchCities = (query: string, country: string, state?: string): string[] => {
  const cities = getCitiesByCountryAndState(country, state);
  // Changed minimum query length from 2 to 3 characters
  if (!query || query.length < 3) return cities.slice(0, 10);
  
  const lowerQuery = query.toLowerCase();
  return cities
    .filter(city => city.toLowerCase().includes(lowerQuery))
    .slice(0, 10);
};
