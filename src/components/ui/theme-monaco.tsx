
import { cn } from "@/lib/utils";

interface ThemeMonacoProps {
  children: React.ReactNode;
  className?: string;
}

export function MonacoThemeProvider({ children, className }: ThemeMonacoProps) {
  return (
    <div className={cn(
      "bg-[#1e1e1e] text-gray-200 rounded-lg min-h-screen",
      className
    )}>
      {children}
    </div>
  );
}

export function MonacoCard({ children, className }: ThemeMonacoProps) {
  return (
    <div className={cn(
      "bg-[#252526] border border-[#323232] rounded-lg shadow-md",
      className
    )}>
      {children}
    </div>
  );
}
