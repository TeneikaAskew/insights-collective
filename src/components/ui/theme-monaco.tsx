
import { cn } from "@/lib/utils";
import React from "react";

interface ThemeMonacoProps {
  children: React.ReactNode;
  className?: string;
}

export function ThemeMonaco({ children, className }: ThemeMonacoProps) {
  return (
    <div className={cn(
      "bg-monaco-background text-monaco-foreground",
      "selection:bg-monaco-selection selection:text-white",
      className
    )}>
      {children}
    </div>
  );
}

export function MonacoCard({ children, className }: ThemeMonacoProps) {
  return (
    <div className={cn(
      "bg-monaco-background/95 backdrop-blur-sm border border-monaco-border",
      "rounded-lg shadow-lg overflow-hidden",
      className
    )}>
      {children}
    </div>
  );
}

export function MonacoCodeBlock({ children, className }: ThemeMonacoProps) {
  return (
    <pre className={cn(
      "bg-monaco-background/80 border border-monaco-border p-4 rounded-md",
      "font-mono text-sm text-white overflow-x-auto",
      className
    )}>
      <code>{children}</code>
    </pre>
  );
}
