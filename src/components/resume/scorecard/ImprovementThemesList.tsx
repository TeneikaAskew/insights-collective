
import React from 'react';

interface ImprovementThemesListProps {
  themes: string[];
}

export const ImprovementThemesList: React.FC<ImprovementThemesListProps> = ({ themes }) => {
  return (
    <div className="space-y-3">
      <h3 className="font-medium mb-2">Key Improvement Themes</h3>
      {themes && themes.length > 0 ? (
        <ul className="list-disc list-inside space-y-1 text-sm pl-4">
          {themes.map((theme, index) => (
            <li key={index}>{theme}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No key improvement themes available.
        </p>
      )}
    </div>
  );
};
