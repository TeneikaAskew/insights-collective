import React, { useEffect, useRef } from 'react';
import { CoachMessage } from './useCoachChat';
import { ACTS, COACH_NAME } from './coachScript';

const CoachAvatar: React.FC<{ small?: boolean }> = ({ small }) => (
  <div
    aria-hidden
    className={`flex-none rounded-full grid place-content-center font-bold text-white bg-gradient-to-br from-ss-lav to-ss-peach ${
      small ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
    }`}
  >
    {COACH_NAME.charAt(0)}
  </div>
);

export const ActsStepper: React.FC<{ currentAct: number; allDone?: boolean }> = ({ currentAct, allDone }) => (
  <div className="flex items-center gap-1.5 flex-wrap" aria-label="Conversation progress" data-testid="acts-stepper">
    {ACTS.map((act, i) => {
      const done = allDone || i < currentAct;
      const now = !allDone && i === currentAct;
      return (
        <React.Fragment key={act.name}>
          {i > 0 && <span className="w-3 h-0.5 rounded bg-ss-track" aria-hidden />}
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
              done
                ? 'bg-ss-good-chip text-ss-good border-transparent'
                : now
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card/70 text-muted-foreground border-border'
            }`}
          >
            {act.name}
          </span>
        </React.Fragment>
      );
    })}
  </div>
);

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2">
    <CoachAvatar small />
    <div className="inline-flex gap-1 px-4 py-3 bg-background border border-border rounded-2xl rounded-bl-md">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-ss-lav animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  </div>
);

interface StudioChatProps {
  messages: CoachMessage[];
  composing: boolean;
  currentAct: number;
  actsDone: boolean;
  /** Inline action area rendered after the messages (quick replies, resume choice, upload…). */
  children?: React.ReactNode;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  inputDisabled: boolean;
  placeholder: string;
  headerAction?: React.ReactNode;
}

const StudioChat: React.FC<StudioChatProps> = ({
  messages, composing, currentAct, actsDone, children,
  inputValue, onInputChange, onSubmit, inputDisabled, placeholder, headerAction,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    // Follow new messages and typing progress — but not unrelated re-renders,
    // so the reader can still scroll up through the history.
  }, [messages.length, lastMessage?.text, composing]);

  return (
    <div className="bg-card ss-card flex flex-col overflow-hidden" data-testid="coach-panel">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-ss-track">
        <CoachAvatar />
        <div className="min-w-0">
          <p className="font-bold leading-tight">{COACH_NAME}</p>
          <p className="text-xs text-ss-good">your career coach</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:block">
            <ActsStepper currentAct={currentAct} allDone={actsDone} />
          </div>
          {headerAction}
        </div>
      </div>

      <div ref={scrollRef} className="h-[26rem] overflow-y-auto px-5 py-5 scroll-smooth">
        <div className="flex flex-col gap-2.5">
          {messages.map((msg) => {
            const isBot = msg.sender === 'bot';
            return (
              <div
                key={msg.id}
                data-testid="coach-message"
                data-sender={msg.sender}
                className={`flex items-end gap-2 ${isBot ? '' : 'justify-end'}`}
              >
                {isBot && <CoachAvatar small />}
                <div
                  className={`max-w-[84%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isBot
                      ? 'bg-background border border-border rounded-bl-md'
                      : 'bg-ss-lav-deep text-white rounded-br-md'
                  }`}
                >
                  {msg.text}
                  {msg.partial && (
                    <span className="inline-block w-0.5 h-4 ml-px align-text-bottom bg-ss-lav-deep animate-pulse" aria-hidden />
                  )}
                </div>
              </div>
            );
          })}
          {composing && <TypingIndicator />}
          {children}
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-5 py-4 border-t border-ss-track">
        <label htmlFor="coach-input" className="sr-only">Your answer</label>
        <input
          id="coach-input"
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          disabled={inputDisabled}
          placeholder={placeholder}
          autoComplete="off"
          data-testid="coach-input"
          className="flex-1 rounded-full border border-input bg-background px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ss-lav disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={inputDisabled || !inputValue.trim()}
          aria-label="Send"
          data-testid="coach-send"
          className="flex-none w-11 h-11 rounded-full bg-ss-lav-deep text-white grid place-content-center transition-colors hover:bg-ss-lav-deep/90 disabled:bg-ss-track disabled:text-muted-foreground"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default StudioChat;
