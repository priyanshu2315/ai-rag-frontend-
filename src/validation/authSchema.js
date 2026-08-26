import * as yup from 'yup';

const email = yup
  .string()
  .trim()
  .required('Email is required')
  .email('Enter a valid email address');

export const loginSchema = yup.object({
  email,
  password: yup.string().required('Password is required'),
});

export const registerSchema = yup.object({
  email,
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters'),
  confirmPassword: yup
    .string()
    .required('Confirm your password')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
});

export const EMPTY_LOGIN = { email: '', password: '' };
export const EMPTY_REGISTER = { email: '', password: '', confirmPassword: '' };
