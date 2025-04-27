
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { SurveyField } from '@/components/survey/SurveyField';
import { SectionData } from '@/data/surveyData';

interface SurveySectionProps {
  section: SectionData;
  formData: Record<string, any>;
}

const SurveySection: React.FC<SurveySectionProps> = ({ section, formData }) => {
  const { formState: { errors } } = useFormContext();

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">{section.section}</h2>
      
      <div className="space-y-6">
        {section.fields.map((field, index) => (
          <SurveyField
            key={`${section.section}-${index}`}
            field={field}
            fieldName={`${section.section.toLowerCase().replace(/\s+/g, '_')}_${index}`}
            defaultValue={formData[`${section.section.toLowerCase().replace(/\s+/g, '_')}_${index}`]}
          />
        ))}
      </div>
    </div>
  );
};

export default SurveySection;
