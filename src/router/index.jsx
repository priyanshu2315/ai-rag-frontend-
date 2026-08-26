import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import GuestRoute from './GuestRoute';
import AppShell from '../components/layout/AppShell';
import Spinner from '../components/feedback/Spinner';
import { ROUTES } from '../constants/routes';

// Every page is lazy (§10, §13).
const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));
const ChatPage = lazy(() => import('../pages/chat/ChatPage'));

const RouteFallback = () => (
  <div className="flex h-screen items-center justify-center bg-bg">
    <Spinner className="h-6 w-6" />
  </div>
);

const withSuspense = (element) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: ROUTES.LOGIN, element: withSuspense(<Login />) },
      { path: ROUTES.REGISTER, element: withSuspense(<Register />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [{ path: ROUTES.CHAT, element: withSuspense(<ChatPage />) }],
      },
    ],
  },
  { path: '*', element: <Navigate to={ROUTES.CHAT} replace /> },
]);

const Router = () => <RouterProvider router={router} />;

export default Router;
