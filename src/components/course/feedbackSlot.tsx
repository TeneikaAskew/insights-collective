// ABOUTME: An in-flow mount point for the course Feedback button. Layouts that render a top bar place <FeedbackSlot/>
// ABOUTME: there; CourseFeedbackButton portals into it when present and falls back to its floating pill otherwise.
import React, { useSyncExternalStore } from 'react';

let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();
const setSlot = (el: HTMLElement | null) => {
  if (slot === el) return;
  slot = el;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The slot element currently mounted in a top bar, or null when the page has none. */
export const useFeedbackSlot = () => useSyncExternalStore(subscribe, () => slot, () => null);

/** Renders no box of its own (`display: contents`); the button portalled into it lays out with its siblings. */
export const FeedbackSlot: React.FC = () => <span className="contents" data-testid="course-feedback-slot" ref={setSlot} />;

/** The one rule for where the course Feedback trigger exists, shared by the button and the top bar that hosts it. */
export const showsCourseFeedback = (pathname: string, isAuthenticated: boolean) => isAuthenticated && pathname.startsWith('/courses');
