
import { cn } from "@/lib/utils";

interface ThemeMonacoProps {
  children: React.ReactNode;
  className?: string;
}

export function MonacoThemeProvider({ children, className }: ThemeMonacoProps) {
  return (
    <div className={cn(
      // Deliberately single-theme: a code-editor surface stays dark in both
      // themes, using Ink Studio's ground/text values rather than VS Code's.
      "bg-[#17151C] text-[#F0EDE8] rounded-lg min-h-screen",
      className
    )}>
      {children}
    </div>
  );
}

export function MonacoCard({ children, className }: ThemeMonacoProps) {
  return (
    <div className={cn(
      "bg-[#211E28] border border-[#332F3D] rounded-lg shadow-md",
      className
    )}>
      {children}
    </div>
  );
}
