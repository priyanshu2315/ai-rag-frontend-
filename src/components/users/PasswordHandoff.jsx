import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import Modal from '../modals/Modal';
import Button from '../buttons/Button';
import Alert from '../feedback/Alert';
import { signInUrl } from '../../utils/users';

const Row = ({ label, children }) => (
  <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 py-1.5">
    <dt className="text-[12px] text-muted">{label}</dt>
    <dd className="min-w-0 break-all text-ink">{children}</dd>
  </div>
);

/**
 * Shown when the backend could NOT email the login details (`emailSent` is
 * false, or not reported): the admin has to pass them on, and this is the
 * only time the temporary password is visible — it can't be read back later.
 * When the email did go out, the caller shows a toast instead of this.
 */
const PasswordHandoff = ({ title, user, password, onDone }) => {
  const [copied, setCopied] = useState(false);
  const details = `Sign in: ${signInUrl()}\nEmail: ${user.email}\nTemporary password: ${password}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal title={title} description={user.name || user.email} onClose={onDone}>
      <div className="space-y-4">
        <Alert variant="warning">
          The email could not be sent; share these details with the user yourself.
        </Alert>

        <dl className="rounded-(--radius) border border-border bg-surface-2 px-3 py-1.5 text-[13px]">
          <Row label="Sign-in link">{signInUrl()}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Password"><code className="mono text-[14px] font-medium tracking-wide">{password}</code></Row>
        </dl>

        <p className="text-[12.5px] text-muted">
          They'll be asked to choose their own password the first time they sign in. This is the only time the
          temporary password is shown — it can't be looked up later, only reset.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy details'}
          </Button>
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    </Modal>
  );
};

export default PasswordHandoff;
