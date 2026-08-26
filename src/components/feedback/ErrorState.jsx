import { AlertTriangle } from 'lucide-react';
import Button from '../buttons/Button';
import cn from '../../utils/cn';

/** API error + retry (§12). */
const ErrorState = ({ message, onRetry, className }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-8 text-center', className)}>
    <AlertTriangle className="mb-3 h-6 w-6 text-red" />
    <p className="text-sm text-ink-2">{message || 'Could not load this right now.'}</p>
    {onRetry && (
      <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

export default ErrorState;
