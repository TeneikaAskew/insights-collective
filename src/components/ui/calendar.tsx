import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      // `relative` is load-bearing — see the nav comment below.
      className={cn("relative p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        // THE MONTH ARROWS WERE POSITIONED AGAINST THE VIEWPORT.
        //
        // react-day-picker v9 renders `nav` at the DayPicker ROOT, as a sibling
        // of `months` — in v8 it lived inside the caption. These classNames
        // still carried v8's arrangement: `absolute left-1` / `absolute
        // right-1` on the BUTTONS, relying on `month_caption`'s `relative`,
        // which is no longer an ancestor of them. With no positioned ancestor
        // left, both buttons resolved against the initial containing block.
        //
        // Measured on /courses/:id/calendar at 1280x720 before this change:
        //
        //     "Go to the Previous Month"   x = 4 .. 32     (left-1 from the viewport)
        //     "Go to the Next Month"       x = 1248 .. 1276 (right-1 from the viewport)
        //     collapsed course sidebar     x = 0 .. 48
        //     elementFromPoint(18, ...)    -> the sidebar's content div
        //
        // so Previous was rendered UNDERNEATH the sidebar rail and could not be
        // clicked at all, and Next only worked because nothing happens to sit
        // at the right edge. Every Calendar in the app had it; the course
        // calendar is just where a test finally looked.
        //
        // Fixed the v9 way: `nav` is the absolutely positioned element, pinned
        // across the calendar's own top edge (the root now provides the
        // positioning context), and the buttons are ordinary flex children.
        nav: "absolute inset-x-3 top-3 z-10 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
        weeks: "w-full border-collapse",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" {...props} />;
          }
          return <ChevronRight className="h-4 w-4" {...props} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
