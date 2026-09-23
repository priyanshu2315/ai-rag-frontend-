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

export const forgotPasswordSchema = yup.object({ email });

export const resetPasswordSchema = yup.object({
  otp: yup
    .string()
    .required('OTP is required')
    .matches(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters'),
  confirmNewPassword: yup
    .string()
    .required('Confirm your new password')
    .oneOf([yup.ref('newPassword')], 'Passwords do not match'),
});

export const EMPTY_LOGIN = { email: '', password: '' };
export const EMPTY_REGISTER = { email: '', password: '', confirmPassword: '' };
export const EMPTY_FORGOT_PASSWORD = { email: '' };
export const EMPTY_RESET_PASSWORD = { otp: '', newPassword: '', confirmNewPassword: '' };
