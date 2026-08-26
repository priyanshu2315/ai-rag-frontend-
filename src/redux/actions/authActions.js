import createAppThunk from '../createAppThunk';
import authService from '../../services/authService';

export const login = createAppThunk('auth/login', (credentials, { signal }) =>
  authService.login(credentials, signal)
);

export const register = createAppThunk('auth/register', (payload, { signal }) =>
  authService.register(payload, signal)
);
