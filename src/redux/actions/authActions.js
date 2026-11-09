import createAppThunk from '../createAppThunk';
import authService from '../../services/authService';

export const login = createAppThunk('auth/login', (credentials, { signal }) =>
  authService.login(credentials, signal)
);

export const changePassword = createAppThunk('auth/changePassword', (payload, { signal }) =>
  authService.changePassword(payload, signal)
);

export const forgotPassword = createAppThunk('auth/forgotPassword', (payload, { signal }) =>
  authService.forgotPassword(payload, signal)
);

export const resetPassword = createAppThunk('auth/resetPassword', (payload, { signal }) =>
  authService.resetPassword(payload, signal)
);
