import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import Modal from '../modals/Modal';
import TextField from '../inputs/TextField';
import Button from '../buttons/Button';
import { renameChatSchema } from '../../validation/chatSchema';

/** Rename one global chat. Closes itself only once the rename succeeded. */
const RenameChatDialog = ({ chat, saving, onRename, onClose }) => {
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(renameChatSchema),
    defaultValues: { title: chat.title ?? '' },
  });

  const onSubmit = handleSubmit(async ({ title }) => {
    if (await onRename(chat.id, title)) onClose();
  });

  return (
    <Modal title="Rename chat" onClose={onClose} closeDisabled={saving}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Controller
          name="title"
          control={control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Title" maxLength={120} error={fieldState.error?.message} />
          )}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
};

export default RenameChatDialog;
