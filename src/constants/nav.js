import { BookOpen, MessagesSquare, Shield, Upload, Users } from 'lucide-react';
import { ROUTES } from './routes';
import { PERMISSIONS } from './permissions';

/**
 * Sidebar modules, in display order. "New chat" is not listed — it is the
 * sidebar's primary button, not a section link.
 *
 * `match` lists the extra route patterns under which a module stays
 * highlighted: a document's chat and chunk pages belong to Knowledge base.
 * `requires` hides the module from accounts without that permission.
 */
export const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { label: 'Chats', to: ROUTES.CHATS, icon: MessagesSquare, match: [ROUTES.CHAT_CONVERSATION] },
      {
        label: 'Knowledge base',
        to: ROUTES.KNOWLEDGE_BASE,
        icon: BookOpen,
        match: [ROUTES.DOCUMENT, ROUTES.CHUNKS],
      },
    ],
  },
  {
    label: 'Admin',
    admin: true,
    items: [
      { label: 'Upload document', to: ROUTES.UPLOAD, icon: Upload, requires: PERMISSIONS.UPLOAD_DOCUMENT },
      { label: 'Roles', to: ROUTES.ROLES, icon: Shield, requires: PERMISSIONS.MANAGE_ROLES, match: [ROUTES.ROLE_DETAIL, ROUTES.ROLE_EDIT] },
      { label: 'Users', to: ROUTES.USERS, icon: Users, requires: PERMISSIONS.MANAGE_USERS, match: [ROUTES.USER_DETAIL, ROUTES.USER_EDIT] },
    ],
  },
];
