import * as yup from 'yup';

/** Mirrors POST/PATCH /api/roles validation. */
export const roleSchema = yup.object({
  name: yup.string().trim().required('Role name is required').max(100, 'Role name is too long (100 characters max)'),
  description: yup.string().trim(),
  documentIds: yup.array().of(yup.string()),
});

export const EMPTY_ROLE = { name: '', description: '', documentIds: [] };
