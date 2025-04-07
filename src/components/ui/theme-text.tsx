
import { cn } from "@/lib/utils";

interface ThemeTextProps {
  children: React.ReactNode;
  className?: string;
  darkBg?: boolean;
}

export function ThemeText({ children, className, darkBg = false }: ThemeTextProps) {
  return (
    <span className={cn(
      "transition-colors",
      darkBg ? "text-white" : "text-slateGray",
      className
    )}>
      {children}
    </span>
  );
}
