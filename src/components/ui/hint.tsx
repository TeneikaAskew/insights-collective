// ABOUTME: Lightweight wrapper around Radix Tooltip for icon-only buttons and jargon badges.
// ABOUTME: Requires a TooltipProvider ancestor (mounted globally in App.tsx).

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HintProps {
  label: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * Wrap any focusable/hoverable element to attach a contextual tooltip.
 * Use for icon-only buttons, ambiguous badges, and jargon labels.
 *
 * Uses forwardRef + a span wrapper so consumers can compose Hint inside
 * Radix `asChild` slots (AlertDialogTrigger, DropdownMenuTrigger, ...)
 * without emitting "Function components cannot be given refs" warnings.
 */
export const Hint = React.forwardRef<HTMLSpanElement, HintProps>(function Hint(
  { label, children, side = "top", align = "center", className },
  ref,
) {
  if (!label) {
    return (
      <span ref={ref} className="inline-flex">
        {children}
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span ref={ref} className="inline-flex">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className={className}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
});
