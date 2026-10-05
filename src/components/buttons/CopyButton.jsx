import { useState } from 'react';

const CopyButton = ({ text, label = 'Copy' }) => {
  const [status, setStatus] = useState(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied');
    } catch {
      setStatus('Copy failed');
    }
  };
  return (
    <button type="button" onClick={copy} className="text-[11px] font-medium text-blue hover:underline" aria-label={label}>
      {status ?? label}
    </button>
  );
};

export default CopyButton;
