
import { v4 as uuidv4 } from 'uuid';
import { FormField, FormSection, FormStructure } from '@/types/forms';

/**
 * Creates personal information section for fellowship application
 */
const createPersonalInfoSection = (): FormSection => {
  return {
    id: uuidv4(),
    title: "Personal Information",
    description: "Please provide your contact details",
    fields: [
      createField({
        label: "Full Name",
        type: "short_text",
        required: true,
        placeholder: "Enter your full name"
      }),
      createField({
        label: "Email Address",
        type: "short_text",
        required: true,
        validation: {
          type: "email",
          message: "Please enter a valid email address"
        },
        placeholder: "your.email@example.com"
      }),
      createField({
        label: "Phone Number",
        type: "short_text",
        required: true,
        placeholder: "(555) 555-5555"
      }),
      createField({
        label: "LinkedIn URL",
        type: "url",
        required: true,
        validation: {
          type: "linkedin_url",
          message: "Please enter a valid LinkedIn profile URL"
        },
        placeholder: "https://linkedin.com/in/yourprofile"
      })
    ]
  };
};

/**
 * Creates education section for fellowship application
 */
const createEducationSection = (): FormSection => {
  return {
    id: uuidv4(),
    title: "Education",
    description: "Tell us about your educational background",
    fields: [
      createField({
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
      }),
      createField({
        label: "Field of Study",
        type: "short_text",
        required: true,
        placeholder: "E.g., Computer Science, Business Analytics"
      }),
      createField({
        label: "University/Institution",
        type: "short_text",
        required: true,
        placeholder: "Name of your educational institution"
      }),
      createField({
        label: "Graduation Year",
        type: "short_text",
        required: true,
        placeholder: "YYYY"
      })
    ]
  };
};

/**
 * Creates professional experience section for fellowship application
 */
const createExperienceSection = (): FormSection => {
  return {
    id: uuidv4(),
    title: "Professional Experience",
    description: "Share your work experience relevant to this fellowship",
    fields: [
      createField({
        label: "Current Role",
        type: "short_text",
        required: true,
        placeholder: "Your current job title"
      }),
      createField({
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
      }),
      createField({
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
      }),
      createField({
        label: "Tell us about your experience with data or AI projects",
        type: "long_text",
        required: true,
        placeholder: "Describe your relevant experience...",
        max_words: 250
      })
    ]
  };
};

/**
 * Creates interest section for fellowship application
 */
const createInterestSection = (): FormSection => {
  return {
    id: uuidv4(),
    title: "Interest in the Fellowship",
    description: "Help us understand why you're interested in this fellowship",
    fields: [
      createField({
        label: "Why are you interested in this fellowship?",
        type: "long_text",
        required: true,
        placeholder: "Explain your motivation...",
        max_words: 200
      }),
      createField({
        label: "What do you hope to achieve through this fellowship?",
        type: "long_text",
        required: true,
        placeholder: "Describe your goals...",
        max_words: 200
      }),
      createField({
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
      }),
      createField({
        label: "Availability to start",
        type: "date_picker",
        required: true
      })
    ]
  };
};

/**
 * Helper function to create a form field with an auto-generated ID
 */
const createField = (fieldData: Partial<FormField>): FormField => {
  return {
    id: uuidv4(),
    ...fieldData
  } as FormField;
};

/**
 * Creates a fellowship application form with predefined sections and fields
 */
const createFellowshipForm = () => {
  return {
    title: "AI & Automation Skills Fellowship Application",
    description: "Apply for our AI & Automation Skills Fellowship program. This fellowship is designed to help professionals transition into AI and data automation careers.",
    status: true,
    slug: "ai-fellowship",
    form_structure: {
      sections: [
        createPersonalInfoSection(),
        createEducationSection(),
        createExperienceSection(),
        createInterestSection()
      ]
    },
    form_link: "/survey/ai-fellowship"
  };
};

export default createFellowshipForm;
