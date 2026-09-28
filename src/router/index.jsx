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
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
const ChatPage = lazy(() => import('../pages/chat/ChatPage'));
const ChunkExplorer = lazy(() => import('../pages/chunks/ChunkExplorer'));
const About = lazy(() => import('../pages/about/About'));
const Architecture = lazy(() => import('../pages/architecture/Architecture'));

const RouteFallback = () => (
  <div className="flex h-screen items-center justify-center bg-bg">
    <Spinner className="h-6 w-6" />
  </div>
);

const withSuspense = (element) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

const router = createBrowserRouter([
  { path: ROUTES.ARCHITECTURE, element: withSuspense(<Architecture />) },
  {
    element: <GuestRoute />,
    children: [
      { path: ROUTES.LOGIN, element: withSuspense(<Login />) },
      { path: ROUTES.REGISTER, element: withSuspense(<Register />) },
      { path: ROUTES.FORGOT_PASSWORD, element: withSuspense(<ForgotPassword />) },
      { path: ROUTES.RESET_PASSWORD, element: withSuspense(<ResetPassword />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      // Outside AppShell on purpose: the document sidebar is a chat context
      // picker, and there is no document context to pick on this page.
      { path: ROUTES.ABOUT, element: withSuspense(<About />) },
      {
        element: <AppShell />,
        // Same page either way — only the context differs, and that context
        // is the URL, so a refresh reopens the document the user was on.
        children: [
          { path: ROUTES.CHAT, element: withSuspense(<ChatPage />) },
          { path: ROUTES.DOCUMENT, element: withSuspense(<ChatPage />) },
          // Inside the shell so the sidebar keeps the same document selected.
          { path: ROUTES.CHUNKS, element: withSuspense(<ChunkExplorer />) },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to={ROUTES.CHAT} replace /> },
]);

const Router = () => <RouterProvider router={router} />;

export default Router;
