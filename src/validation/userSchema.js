import * as yup from 'yup';
import { USER_TYPE } from '../constants/permissions';

const base = {
  name: yup.string().trim().required('Name is required'),
  type: yup.string().oneOf(Object.values(USER_TYPE), 'type must be ADMIN or USER').required(),
  roleIds: yup.array().of(yup.string()),
};

/**
 * Mirrors POST/PATCH /api/users validation. Email and the temporary password
 * are only set on create — the backend has no endpoint that changes an email,
 * and a password is reset with its own action.
 */
export const userSchema = (mode) => yup.object(mode === 'create'
  ? {
      ...base,
      email: yup.string().trim().required('Email is required').email('A valid email is required'),
      temporaryPassword: yup.string().required('Temporary password is required')
        .min(8, 'Temporary password must be at least 8 characters'),
    }
  : base);

export const resetPasswordSchema = yup.object({
  temporaryPassword: yup.string().required('Temporary password is required')
    .min(8, 'Temporary password must be at least 8 characters'),
});

export const EMPTY_USER = { name: '', email: '', temporaryPassword: '', type: USER_TYPE.USER, roleIds: [] };
