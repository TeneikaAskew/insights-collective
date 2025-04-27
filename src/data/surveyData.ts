
export interface FieldData {
  label: string;
  type: 'short_text' | 'long_text' | 'dropdown' | 'radio' | 'checkbox' | 'multi_select' | 'slider' | 'date_picker' | 'file_upload';
  required?: boolean;
  options?: string[];
  max_select?: number;
  min?: number;
  max?: number;
  max_words?: number;
  file_types?: string[];
  max_size_mb?: number;
  validation?: 'numeric_only' | 'url' | 'email';
  text?: string;
}

export interface SectionData {
  section: string;
  fields: FieldData[];
}

export const surveyData: SectionData[] = [
  {
    section: "Personal Information",
    fields: [
      {
        label: "What country do you live in?",
        type: "dropdown",
        required: true,
        options: [
          "United States", "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia",
          "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
          "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
          "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad",
          "Chile", "China", "Colombia", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the",
          "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica",
          "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini",
          "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada",
          "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India",
          "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya",
          "Kiribati", "Korea, North", "Korea, South", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
          "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia",
          "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
          "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (Burma)", "Namibia", "Nauru",
          "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway", "Oman",
          "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
          "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
          "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal",
          "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia",
          "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
          "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago",
          "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
          "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia",
          "Zimbabwe", "Other"
        ]
      },
      {
        label: "What state do you live in?",
        type: "dropdown",
        required: true,
        options: [
          "Non-US", "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
          "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
          "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana",
          "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
          "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee",
          "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
        ]
      },
      {
        label: "What city do you live in?",
        type: "short_text",
        required: true
      },
      {
        label: "What is your zip code (postal code)?",
        type: "short_text",
        required: true
      },
      {
        label: "I am currently",
        type: "radio",
        required: true,
        options: ["A Student", "A Working Professional", "Retired", "Unemployed"]
      },
      {
        label: "Citizenship Status",
        type: "dropdown",
        required: true,
        options: [
          "U.S. Citizen",
          "Permanent Resident",
          "Visa Holder",
          "I reside outside of the U.S. and I am not a citizen or resident",
          "Other"
        ]
      },
      {
        label: "Are you the first in your family to attend college?",
        type: "radio",
        required: true,
        options: ["Yes", "No", "I did not attend college"]
      }
    ]
  },
  {
    section: "Work And Education",
    fields: [
      {
        label: "What company/organization do you currently work for?",
        type: "short_text",
        required: false
      },
      {
        label: "What is your current job title?",
        type: "short_text",
        required: false
      },
      {
        label: "How many years of work experience do you have?",
        type: "dropdown",
        required: true,
        options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "10+"]
      },
      {
        label: "How many years of coding/programming experience do you have?",
        type: "dropdown",
        required: true,
        options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "10+"]
      },
      {
        label: "What is your highest level of education?",
        type: "dropdown",
        required: true,
        options: [
          "PhD", "Graduate Degree", "Undergraduate Degree (4-year)", "Associate's Degree / Community College",
          "High School", "GED", "Vocational School", "Other"
        ]
      },
      {
        label: "What is the name of the school where you obtained or are pursuing your highest level of education?",
        type: "short_text",
        required: true
      },
      {
        label: "What is/was your GPA? (4.0 Scale)",
        type: "short_text",
        required: false,
        validation: "numeric_only"
      },
      {
        label: "What is/was your graduation year?",
        type: "short_text",
        required: false
      },
      {
        label: "What is/was your major or area of study?",
        type: "short_text",
        required: true
      },
      {
        label: "Please enter your LinkedIn Profile URL",
        type: "short_text",
        required: false
      },
      {
        label: "Please upload your resume",
        type: "file_upload",
        required: true,
        file_types: ["pdf"],
        max_size_mb: 32
      },
      {
        label: "Have you participated in any previous workforce development programs?",
        type: "radio",
        required: false,
        options: ["Yes", "No"]
      }
    ]
  },
  {
    section: "Skills and Interests",
    fields: [
      {
        label: "I'd like to get help with...",
        type: "multi_select",
        required: true,
        max_select: 3,
        options: [
          "Improving my Data Skills", "Understanding Career Options in Data", "Switching Careers",
          "Finding a Job/Internship", "Resume Review", "Interview Preparation", "Finding a Mentor", "Other"
        ]
      },
      {
        label: "The industries I am interested in are...",
        type: "multi_select",
        required: true,
        max_select: 3,
        options: [
          "Finance", "Consulting", "Healthcare", "Public Sector / Non-profit Agencies", "Education / EdTech",
          "Technology (Software / Internet)", "Energy", "Retail / E-Commerce", "Manufacturing", "Transportation & Logistics",
          "Insurance", "Media & Entertainment", "Real Estate", "Agriculture & Food Systems", "Aerospace & Defense",
          "Telecommunications", "Biotech & Pharmaceuticals", "Sports & Recreation", "Hospitality & Tourism",
          "Environmental & Sustainability", "Government", "Other"
        ]
      },
      {
        label: "What type of roles are you interested in?",
        type: "multi_select",
        required: true,
        max_select: 3,
        options: [
          "Data Analyst", "Data Scientist", "Data Engineer", "Machine Learning Engineer", "Product Manager",
          "Sales", "Marketing", "Human Resources", "Operations", "Business Intelligence", "Mobile Developer",
          "Frontend Developer", "Backend Developer", "DevOps / Infrastructure", "Other"
        ]
      },
      {
        label: "What are your top three dream companies to work for?",
        type: "short_text",
        required: false
      },
      {
        label: "How would you rate your programming proficiency?",
        type: "slider",
        min: 1,
        max: 5,
        required: true
      },
      {
        label: "How would you rate your Python proficiency?",
        type: "slider",
        min: 1,
        max: 5,
        required: true
      },
      {
        label: "Why do you want to attend this program?",
        type: "long_text",
        required: true,
        max_words: 250
      },
      {
        label: "How did you first hear about this program?",
        type: "dropdown",
        required: true,
        options: [
          "My Employer", "Email from program organizers", "University group I'm involved with",
          "Partner organization group I'm involved with", "News article or clip", "Facebook", "Twitter", "LinkedIn",
          "Instagram", "TikTok", "Friend/Family", "Current program participant", "Program Mentor",
          "Program Teaching Assistant", "Other"
        ]
      },
      {
        label: "Are you willing to participate in an alumni mentorship program post-program?",
        type: "radio",
        required: true,
        options: ["Yes", "No"]
      }
    ]
  },
  {
    section: "Demographics",
    fields: [
      {
        label: "What is your date of birth?",
        type: "date_picker",
        required: true
      },
      {
        label: "What is your gender?",
        type: "dropdown",
        required: true,
        options: [
          "Male", "Female", "Non-binary/non-conforming", "Other", "Prefer not to say"
        ]
      },
      {
        label: "Please indicate how you identify yourself.",
        type: "multi_select",
        required: true,
        options: [
          "American Indian or Alaska Native", "Asian", "Black or African American", "Hispanic or Latino/Latinx",
          "Native Hawaiian or Other Pacific Islander", "White", "Other"
        ]
      },
      {
        label: "Please indicate if you identify as any of the following:",
        type: "multi_select",
        required: false,
        options: [
          "LGBTQ+", "Veteran", "Immigrant to the U.S.", "DACA or 'DREAMer'", "Refugee to the U.S.", "Single parent",
          "Low-income household", "Deaf or Hearing Impaired", "Blind or Visually Impaired", "Person with a disability",
          "Short Stature, Little Person", "None of the above"
        ]
      },
      {
        label: "Primary language spoken at home",
        type: "short_text",
        required: false
      },
      {
        label: "What is your annual household income amount?",
        type: "short_text",
        required: true,
        validation: "numeric_only"
      },
      {
        label: "Please select the income range that matches the amount you entered",
        type: "dropdown",
        required: true,
        options: [
          "<$25,000", "$25,001–$50,000", "$50,001–$75,000", "$75,001–$100,000", "$100,001+"
        ]
      },
      {
        label: "Do you currently support dependents (children, elderly family, etc.)?",
        type: "radio",
        required: false,
        options: ["Yes", "No"]
      }
    ]
  },
  {
    section: "Media Release and Agreements",
    fields: [
      {
        label: "I authorize the use of my pictures/videos for promotional materials.",
        type: "radio",
        required: true,
        options: ["I accept", "I do not accept"]
      },
      {
        label: "Program Commitment Agreement",
        type: "checkbox",
        required: true,
        text: "I agree to commit fully to the program requirements and understand that limited attendance may impact my eligibility for certification or further opportunities."
      }
    ]
  }
];
