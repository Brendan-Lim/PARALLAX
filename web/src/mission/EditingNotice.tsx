import { createContext, useContext } from 'react';
export const EditingContext = createContext('');
export function EditingNotice({ editable }: { editable: boolean }) {
  const reason = useContext(EditingContext);
  if (editable) return null;
  return (
    <aside className="m-editing-notice" aria-label="Editing unavailable">
      <strong>Review controls are read-only</strong>
      <p>
        {reason ||
          'Checking editing ownership. Editing becomes available only after this tab acquires the mission lock.'}
      </p>
      <p>For another editing tab, close that tab first. The companion may stay open.</p>
      <button className="s-button s-secondary" onClick={() => location.reload()}>
        Retry editing
      </button>
    </aside>
  );
}
