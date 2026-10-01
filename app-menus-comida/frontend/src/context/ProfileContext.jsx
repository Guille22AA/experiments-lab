// Holds the user profile for the whole app, plus the light/dark theme.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const ProfileContext = createContext(null);

/** Applies a theme to <html>. 'system' removes the attribute so the CSS follows the OS. */
function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem('theme', theme); // read by index.html on the next load
  } catch {
    // Storage can be blocked (private mode): the theme still works for this visit.
  }
}

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const loaded = await api.get('/profile');
      setProfile(loaded);
      applyTheme(loaded.theme);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setTheme = useCallback(async (theme) => {
    applyTheme(theme); // instant feedback, then save
    setProfile((current) => ({ ...current, theme }));
    try {
      await api.put('/profile/theme', { theme });
    } catch {
      // Not saved on the server; it still applies on this device thanks to localStorage.
    }
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, reload, error, setTheme }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
