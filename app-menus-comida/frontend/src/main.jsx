import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import AuthGate from './components/auth/AuthGate.jsx';
import { ProfileProvider } from './context/ProfileContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {/* Nothing loads (not even the profile) until this device is logged in. */}
      <AuthGate>
        <ProfileProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ProfileProvider>
      </AuthGate>
    </BrowserRouter>
  </StrictMode>,
);
