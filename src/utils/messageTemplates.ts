
export const preWrittenMessages = [
  "Hi! Would you like to collaborate on a project?",
  "Thanks for connecting! I noticed we're in the same course.",
  "Looking forward to working with you!",
  "Could we schedule a time to discuss the course material?",
  "I'd love to get your feedback on my latest project.",
];

export const getMessageSuggestion = (conversationType: 'initial' | 'followup'): string => {
  if (conversationType === 'initial') {
    return preWrittenMessages[Math.floor(Math.random() * preWrittenMessages.length)];
  }
  return "Thanks for your message! I'll get back to you soon.";
};
