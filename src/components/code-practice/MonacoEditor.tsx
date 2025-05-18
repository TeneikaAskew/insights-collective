import React from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';

interface MonacoEditorProps {
  code: string;
  language: string;
  onChange: (value: string) => void;
  height?: string;
  width?: string;
  readOnly?: boolean;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  code,
  language,
  onChange,
  height = '500px',
  width = '100%',
  readOnly = false,
}) => {
  const { theme } = useTheme();

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  return (
    <div
      style={{
        height,
        width,
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <Editor
        height={height}
        language={language}
        value={code}
        theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          readOnly,
          wordWrap: 'on',
          renderWhitespace: 'selection',
          contextmenu: true,
          lineHeight: 21,
          padding: { top: 10, bottom: 10 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          folding: true,
          renderControlCharacters: true,
          guides: { indentation: true },
          renderLineHighlight: 'all',
        }}
      />
    </div>
  );
}; 