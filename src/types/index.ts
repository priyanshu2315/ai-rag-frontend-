export interface User {
  userId: string;
  email: string;
}

export interface Document {
  id: string;
  filename: string;
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
