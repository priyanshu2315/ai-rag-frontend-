import { useEffect, useRef } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Lock, LockOpen, Send, Square } from 'lucide-react';
import TextareaField from '../inputs/TextareaField';
import Button from '../buttons/Button';
import useEnterLock from '../../hooks/useEnterLock';
import cn from '../../utils/cn';
import { chatSchema, EMPTY_CHAT } from '../../validation/chatSchema';

/**
 * One `useForm`, one `<Controller>` — no `register` anywhere (§8).
 * Enter sends and Shift+Enter breaks the line — unless the lock is on, in
 * which case Enter breaks the line too and only the send button sends.
 *
 * While an answer is streaming the send button becomes Stop, so there is one
 * control in one place rather than a button that disables and a second that
 * appears elsewhere.
 *
 * `disabled` covers the gap before the conversation has loaded — a question
 * sent then would have no conversation to be threaded onto.
 */
const Composer = ({ onSend, onStop, sending, disabled = false, placeholder, documentAction }) => {
  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(chatSchema),
    defaultValues: EMPTY_CHAT,
    mode: 'onSubmit',
  });

  const [enterLocked, toggleEnterLock] = useEnterLock();

  const formRef = useRef(null);
  const question = useWatch({ control, name: 'question' });

  // Grow with the text so a line break is visible the moment it is typed, up
  // to the field's own max-height. Keyed on the value, so clearing it after a
  // send shrinks it back too.
  useEffect(() => {
    const textarea = formRef.current?.querySelector('textarea');
    if (!textarea) return;

    textarea.style.height = 'auto';
    const borders = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + borders}px`;
  }, [question]);

  const submit = handleSubmit(({ question: text }) => {
    onSend(text);
    reset(EMPTY_CHAT);
  });

  const blocked = sending || disabled;

  const handleKeyDown = (event) => {
    // Locked: leave Enter alone so the textarea inserts the newline itself.
    if (enterLocked) return;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!blocked) submit();
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        if (!blocked) submit();
      }}
      className={cn(
        'relative shrink-0 border-t border-border bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4',
        documentAction && 'sm:px-14'
      )}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Controller
          name="question"
          control={control}
          render={({ field, fieldState }) => (
            <TextareaField
              {...field}
              rows={1}
              className="min-w-0 flex-1"
              inputClassName="max-h-40 min-h-10 py-2.5 text-base sm:text-sm disabled:bg-surface-2 disabled:text-muted"
              disabled={disabled}
              placeholder={sending ? 'Generating the answer…' : placeholder}
              onKeyDown={handleKeyDown}
              error={fieldState.error?.message}
            />
          )}
        />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={toggleEnterLock}
          aria-pressed={enterLocked}
          aria-label={enterLocked ? 'Enter adds a new line' : 'Enter sends the message'}
          title={
            enterLocked
              ? 'Locked: Enter adds a new line — use the send button to send. Click to let Enter send again.'
              : 'Click to lock: Enter will add a new line instead of sending.'
          }
          className={cn('mb-0.5', enterLocked && 'bg-blue-lt text-blue hover:text-blue-dk')}
        >
          {enterLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
        </Button>

        {sending ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className="mb-0.5"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            aria-label="Send question"
            disabled={disabled}
            className="mb-0.5"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      {documentAction && (
        <div className="mt-1 flex justify-end sm:absolute sm:right-2 sm:bottom-4 sm:mt-0">{documentAction}</div>
      )}
    </form>
  );
};

export default Composer;
