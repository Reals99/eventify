import { useState, useEffect } from 'react';
import api from '../utils/api';

/**
 * Returns true if this is the first time the app is being used
 * (no admins exist yet in the database).
 *
 * Used by App.jsx to auto-redirect to /admin/setup on first boot.
 */
export default function useFirstRun() {
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [checked,    setChecked]    = useState(false);

  useEffect(() => {
    api.get('/auth/first-run')
      .then(({ data }) => setIsFirstRun(data.isFirstRun))
      .catch(() => setIsFirstRun(false)) // fail safe — don't block the app
      .finally(() => setChecked(true));
  }, []);

  return { isFirstRun, checked };
}
