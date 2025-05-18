import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
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
  const editorRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      editor.current = monaco.editor.create(editorRef.current, {
        value: code,
        language,
        theme: theme === 'dark' ? 'vs-dark' : 'vs-light',
        automaticLayout: true,
        minimap: {
          enabled: false,
        },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: 'on',
        readOnly,
        wordWrap: 'on',
        renderWhitespace: 'selection',
        contextmenu: true,
        lineHeight: 21,
        padding: {
          top: 10,
          bottom: 10,
        },
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        folding: true,
        renderControlCharacters: true,
        renderIndentGuides: true,
        renderLineHighlight: 'all',
      });

      editor.current.onDidChangeModelContent(() => {
        onChange(editor.current?.getValue() || '');
      });

      return () => {
        editor.current?.dispose();
      };
    }
  }, []);

  useEffect(() => {
    if (editor.current) {
      const currentValue = editor.current.getValue();
      if (currentValue !== code) {
        editor.current.setValue(code);
      }
    }
  }, [code]);

  useEffect(() => {
    if (editor.current) {
      monaco.editor.setModelLanguage(editor.current.getModel()!, language);
    }
  }, [language]);

  useEffect(() => {
    if (editor.current) {
      monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs-light');
    }
  }, [theme]);

  return (
    <div
      ref={editorRef}
      style={{
        height,
        width,
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
}; 