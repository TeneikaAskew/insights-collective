import { useCallback, useRef, useState } from 'react';

export interface CoachMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  /** true while this bot message is still being typed out */
  partial?: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let msgCounter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now()}_${msgCounter++}`;

/**
 * The coach cadence engine: read → think → type.
 *
 * - `say` shows a typing indicator whose duration scales with the upcoming
 *   reply, then reveals the text a few characters at a time with pauses after
 *   punctuation.
 * - `readPause` waits proportionally to how much the user just wrote.
 * - `prefers-reduced-motion` skips the typewriter but keeps the pacing.
 *
 * A generation counter cancels any in-flight cadence on `reset`/`cancel`, so a
 * "Start over" mid-sentence never leaves orphaned timers writing into state.
 */
export function useCoachChat() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [composing, setComposing] = useState(false);
  const genRef = useRef(0);
  const reducedRef = useRef(
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  const cancel = useCallback(() => {
    genRef.current += 1;
    setComposing(false);
  }, []);

  const reset = useCallback(() => {
    genRef.current += 1;
    setComposing(false);
    setMessages([]);
  }, []);

  const addUser = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: uid('user'), sender: 'user', text }]);
  }, []);

  const addBotInstant = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: uid('bot'), sender: 'bot', text }]);
  }, []);

  /** Replace the whole transcript at once (restoring a saved conversation). */
  const restore = useCallback((history: Array<Pick<CoachMessage, 'sender' | 'text'>>) => {
    genRef.current += 1;
    setComposing(false);
    setMessages(history.map((m) => ({ ...m, id: uid(m.sender) })));
  }, []);

  const say = useCallback(async (text: string) => {
    const g = genRef.current;
    setComposing(true);
    // Think: indicator duration scales with the length of what's coming.
    await sleep(reducedRef.current ? 350 : Math.min(600 + text.length * 8, 1900));
    if (g !== genRef.current) return;
    setComposing(false);

    if (reducedRef.current) {
      setMessages((prev) => [...prev, { id: uid('bot'), sender: 'bot', text }]);
      return;
    }

    const id = uid('bot');
    setMessages((prev) => [...prev, { id, sender: 'bot', text: '', partial: true }]);
    let i = 0;
    while (i < text.length) {
      if (g !== genRef.current) return;
      i = Math.min(text.length, i + 2 + Math.floor(Math.random() * 2));
      const slice = text.slice(0, i);
      const done = i >= text.length;
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: slice, partial: !done } : m)));
      const ch = text[i - 1];
      let delay = 14 + Math.random() * 12;
      if ('.!?'.includes(ch)) delay += 220;
      else if (',;—:'.includes(ch)) delay += 90;
      await sleep(delay);
    }
  }, []);

  /** The coach reads before responding — pause proportional to the user's words. */
  const readPause = useCallback(async (userText: string) => {
    const words = userText.trim().split(/\s+/).filter(Boolean).length;
    await sleep(Math.min(300 + words * 30, 1600));
  }, []);

  return { messages, composing, say, addUser, addBotInstant, restore, readPause, reset, cancel, genRef };
}
