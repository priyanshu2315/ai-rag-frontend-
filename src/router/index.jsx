import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import GuestRoute from './GuestRoute';
import RoleRoute from './RoleRoute';
import AppShell from '../components/layout/AppShell';
import Spinner from '../components/feedback/Spinner';
import { PageSkeleton } from '../components/feedback/Skeletons';
import { ROUTES } from '../constants/routes';
import { PERMISSIONS } from '../constants/permissions';

// Every page is lazy (§10, §13).
const Login = lazy(() => import('../pages/auth/Login'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
const SetPassword = lazy(() => import('../pages/auth/SetPassword'));
const NewChat = lazy(() => import('../pages/chat/NewChat'));
const ChatPage = lazy(() => import('../pages/chat/ChatPage'));
const Chats = lazy(() => import('../pages/chats/Chats'));
const KnowledgeBase = lazy(() => import('../pages/knowledgeBase/KnowledgeBase'));
const ChunkExplorer = lazy(() => import('../pages/chunks/ChunkExplorer'));
const UploadDocument = lazy(() => import('../pages/upload/UploadDocument'));
const Roles = lazy(() => import('../pages/roles/Roles'));
const RoleEditor = lazy(() => import('../pages/roles/RoleEditor'));
const Users = lazy(() => import('../pages/users/Users'));
const UserEditor = lazy(() => import('../pages/users/UserEditor'));
const About = lazy(() => import('../pages/about/About'));
const Architecture = lazy(() => import('../pages/architecture/Architecture'));

const RouteFallback = () => (
  <div className="flex h-full min-h-40 flex-1 items-center justify-center bg-bg">
    <Spinner className="h-6 w-6" />
  </div>
);

const withSuspense = (element) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

/** Modules inside the shell: the page's own shape shimmers while its code loads. */
const inShell = (element) => <Suspense fallback={<PageSkeleton />}>{element}</Suspense>;

const router = createBrowserRouter([
  { path: ROUTES.ARCHITECTURE, element: withSuspense(<Architecture />) },
  {
    element: <GuestRoute />,
    children: [
      { path: ROUTES.LOGIN, element: withSuspense(<Login />) },
      { path: ROUTES.FORGOT_PASSWORD, element: withSuspense(<ForgotPassword />) },
      { path: ROUTES.RESET_PASSWORD, element: withSuspense(<ResetPassword />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      // Bare, like login: nothing else is reachable until it is done.
      { path: ROUTES.SET_PASSWORD, element: withSuspense(<SetPassword />) },
      {
        // Sidebar modules + header; every module renders into the content area.
        element: <AppShell />,
        children: [
          // No chat exists on `/` until the first question creates one.
          { path: ROUTES.CHAT, element: inShell(<NewChat />) },
          // Same page for a global chat and a document's chat — the context is
          // the URL, so a refresh reopens the chat the user was on.
          { path: ROUTES.CHAT_CONVERSATION, element: inShell(<ChatPage />) },
          { path: ROUTES.DOCUMENT, element: inShell(<ChatPage />) },
          { path: ROUTES.CHUNKS, element: inShell(<ChunkExplorer />) },
          { path: ROUTES.CHATS, element: inShell(<Chats />) },
          { path: ROUTES.KNOWLEDGE_BASE, element: inShell(<KnowledgeBase />) },
          { path: ROUTES.ABOUT, element: inShell(<About />) },
          {
            element: <RoleRoute requires={PERMISSIONS.UPLOAD_DOCUMENT} />,
            children: [{ path: ROUTES.UPLOAD, element: inShell(<UploadDocument />) }],
          },
          {
            element: <RoleRoute requires={PERMISSIONS.MANAGE_ROLES} />,
            children: [
              { path: ROUTES.ROLES, element: inShell(<Roles />) },
              { path: ROUTES.ROLE_NEW, element: inShell(<RoleEditor />) },
              { path: ROUTES.ROLE_EDIT, element: inShell(<RoleEditor />) },
            ],
          },
          {
            element: <RoleRoute requires={PERMISSIONS.MANAGE_USERS} />,
            children: [
              { path: ROUTES.USERS, element: inShell(<Users />) },
              { path: ROUTES.USER_NEW, element: inShell(<UserEditor />) },
              { path: ROUTES.USER_EDIT, element: inShell(<UserEditor />) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to={ROUTES.CHAT} replace /> },
]);

const Router = () => <RouterProvider router={router} />;

export default Router;
