
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a fellowship application form with predefined sections and fields
 */
const createFellowshipForm = () => {
  // Generate unique IDs for the form structure
  const personalInfoSectionId = uuidv4();
  const educationSectionId = uuidv4();
  const experienceSectionId = uuidv4();
  const interestSectionId = uuidv4();

  return {
    title: "AI & Automation Skills Fellowship Application",
    description: "Apply for our AI & Automation Skills Fellowship program. This fellowship is designed to help professionals transition into AI and data automation careers.",
    status: true,
    slug: "ai-fellowship",
    form_structure: {
      sections: [
        {
          id: personalInfoSectionId,
          title: "Personal Information",
          description: "Please provide your contact details",
          fields: [
            {
              id: uuidv4(),
              label: "Full Name",
              type: "short_text",
              required: true,
              placeholder: "Enter your full name"
            },
            {
              id: uuidv4(),
              label: "Email Address",
              type: "short_text",
              required: true,
              validation: {
                type: "email",
                message: "Please enter a valid email address"
              },
              placeholder: "your.email@example.com"
            },
            {
              id: uuidv4(),
              label: "Phone Number",
              type: "short_text",
              required: true,
              placeholder: "(555) 555-5555"
            },
            {
              id: uuidv4(),
              label: "LinkedIn URL",
              type: "url",
              required: true,
              validation: {
                type: "linkedin_url",
                message: "Please enter a valid LinkedIn profile URL"
              },
              placeholder: "https://linkedin.com/in/yourprofile"
            }
          ]
        },
        {
          id: educationSectionId,
          title: "Education",
          description: "Tell us about your educational background",
          fields: [
            {
              id: uuidv4(),
              label: "Highest Degree Earned",
              type: "dropdown",
              required: true,
              options: [
                "High School Diploma",
                "Associate's Degree",
                "Bachelor's Degree",
                "Master's Degree",
                "Ph.D. or Doctorate",
                "Other"
              ]
            },
            {
              id: uuidv4(),
              label: "Field of Study",
              type: "short_text",
              required: true,
              placeholder: "E.g., Computer Science, Business Analytics"
            },
            {
              id: uuidv4(),
              label: "University/Institution",
              type: "short_text",
              required: true,
              placeholder: "Name of your educational institution"
            },
            {
              id: uuidv4(),
              label: "Graduation Year",
              type: "short_text",
              required: true,
              placeholder: "YYYY"
            }
          ]
        },
        {
          id: experienceSectionId,
          title: "Professional Experience",
          description: "Share your work experience relevant to this fellowship",
          fields: [
            {
              id: uuidv4(),
              label: "Current Role",
              type: "short_text",
              required: true,
              placeholder: "Your current job title"
            },
            {
              id: uuidv4(),
              label: "Years of Experience",
              type: "dropdown",
              required: true,
              options: [
                "Less than 1 year",
                "1-2 years",
                "3-5 years",
                "6-10 years",
                "More than 10 years"
              ]
            },
            {
              id: uuidv4(),
              label: "Relevant Skills",
              type: "multi_select",
              required: true,
              options: [
                "Python",
                "R",
                "SQL",
                "Machine Learning",
                "Data Analysis",
                "AI/ML Frameworks",
                "Cloud Platforms",
                "Business Intelligence",
                "Statistics",
                "Data Visualization"
              ],
              max_select: 5
            },
            {
              id: uuidv4(),
              label: "Tell us about your experience with data or AI projects",
              type: "long_text",
              required: true,
              placeholder: "Describe your relevant experience...",
              max_words: 250
            }
          ]
        },
        {
          id: interestSectionId,
          title: "Interest in the Fellowship",
          description: "Help us understand why you're interested in this fellowship",
          fields: [
            {
              id: uuidv4(),
              label: "Why are you interested in this fellowship?",
              type: "long_text",
              required: true,
              placeholder: "Explain your motivation...",
              max_words: 200
            },
            {
              id: uuidv4(),
              label: "What do you hope to achieve through this fellowship?",
              type: "long_text",
              required: true,
              placeholder: "Describe your goals...",
              max_words: 200
            },
            {
              id: uuidv4(),
              label: "How did you hear about this fellowship?",
              type: "dropdown",
              required: true,
              options: [
                "Social Media",
                "Email Newsletter",
                "Friend/Colleague",
                "Company Website",
                "Online Search",
                "Other"
              ]
            },
            {
              id: uuidv4(),
              label: "Availability to start",
              type: "date_picker",
              required: true
            }
          ]
        }
      ]
    },
    form_link: "/survey/ai-fellowship"
  };
};

export default createFellowshipForm;
