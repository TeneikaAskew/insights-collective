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
 */
export function Hint({ label, children, side = "top", align = "center", className }: HintProps) {
  if (!label) return children;
  return (
    <Tooltip>
      {/*
        Wrap children in a span so Radix's ref (from asChild) lands on a DOM
        node even when the child is a plain function component without
        forwardRef. Without this, React emits "Function components cannot be
        given refs" warnings that fail our console-error assertion in E2E.
      */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className={className}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
