import { Moon, Sun } from 'lucide-react';
import Button from './Button';
import useTheme from '../../hooks/useTheme';

/** Sun in dark mode, moon in light — the icon shows where a click takes you. */
const ThemeToggle = ({ className }) => {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={className}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
};

export default ThemeToggle;
