import * as yup from 'yup';

export const chatSchema = yup.object({
  question: yup.string().trim().required('Ask a question first').max(2000, 'Question is too long'),
});

export const EMPTY_CHAT = { question: '' };
