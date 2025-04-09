
export type Message = {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp: Date;
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  assistantId: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface PersonalizationSettings {
  careerFocus: string;
  careerPath: string;
  salaryCap: number;
}
