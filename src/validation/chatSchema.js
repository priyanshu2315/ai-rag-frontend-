import * as yup from 'yup';

export const chatSchema = yup.object({
  question: yup.string().trim().required('Ask a question first').max(2000, 'Question is too long'),
});

export const EMPTY_CHAT = { question: '' };

/** Same limits the backend enforces on PATCH /chat/conversations/:id. */
export const renameChatSchema = yup.object({
  title: yup.string().trim().required('Title is required').max(120, 'Title is too long (120 characters max)'),
});
