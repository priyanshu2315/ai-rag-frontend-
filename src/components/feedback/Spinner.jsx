import { Loader2 } from 'lucide-react';
import cn from '../../utils/cn';

const Spinner = ({ className }) => (
  <Loader2 className={cn('h-4 w-4 animate-spin text-blue', className)} />
);

export default Spinner;
