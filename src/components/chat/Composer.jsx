import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Send, Square } from 'lucide-react';
import TextareaField from '../inputs/TextareaField';
import Button from '../buttons/Button';
import { chatSchema, EMPTY_CHAT } from '../../validation/chatSchema';

/**
 * One `useForm`, one `<Controller>` — no `register` anywhere (§8).
 * Enter sends; Shift+Enter breaks the line.
 *
 * While an answer is streaming the send button becomes Stop, so there is one
 * control in one place rather than a button that disables and a second that
 * appears elsewhere.
 *
 * `disabled` covers the gap before the conversation has loaded — a question
 * sent then would have no conversation to be threaded onto.
 */
const Composer = ({ onSend, onStop, sending, disabled = false, placeholder }) => {
  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(chatSchema),
    defaultValues: EMPTY_CHAT,
    mode: 'onSubmit',
  });

  const submit = handleSubmit(({ question }) => {
    onSend(question);
    reset(EMPTY_CHAT);
  });

  const blocked = sending || disabled;

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!blocked) submit();
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!blocked) submit();
      }}
      className="shrink-0 border-t border-border bg-surface px-6 py-4"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Controller
          name="question"
          control={control}
          render={({ field, fieldState }) => (
            <TextareaField
              {...field}
              rows={1}
              className="flex-1"
              inputClassName="max-h-40 min-h-10 py-2.5 disabled:bg-surface-2 disabled:text-muted"
              disabled={disabled}
              placeholder={sending ? 'Generating the answer…' : placeholder}
              onKeyDown={handleKeyDown}
              error={fieldState.error?.message}
            />
          )}
        />

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
    </form>
  );
};

export default Composer;
