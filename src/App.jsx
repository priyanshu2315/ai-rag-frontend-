import { Toaster } from 'react-hot-toast';
import Router from './router';

/**
 * `<Toaster/>` is mounted exactly once, here (§0.6). Nothing else in the app
 * renders one.
 */
const App = () => (
  <>
    <Router />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--color-surface)',
          color: 'var(--color-ink)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--sh)',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: 'var(--color-green)', secondary: '#fff' } },
        error: { iconTheme: { primary: 'var(--color-red)', secondary: '#fff' } },
      }}
    />
  </>
);

export default App;
