// Common frame of the main screens: header, content, bottom tabs and assistant.
import { useCallback, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AssistantContext } from '../../context/AssistantContext.jsx';
import AssistantButton from '../assistant/AssistantButton.jsx';
import ChatPanel from '../assistant/ChatPanel.jsx';
import ErrorBoundary from '../ui/ErrorBoundary.jsx';
import BottomNav from './BottomNav.jsx';
import ConnectionBanner from './ConnectionBanner.jsx';
import Header from './Header.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  // null = closed; { context: undefined } = open with the current screen; { context: {...} } = about something specific
  const [chat, setChat] = useState(null);

  const openAssistant = useCallback((context) => setChat({ context }), []);
  const assistant = useMemo(() => ({ openAssistant }), [openAssistant]);

  return (
    <AssistantContext.Provider value={assistant}>
      <Header />
      <ConnectionBanner />
      <main className="app-main">
        {/* key: a crashed screen recovers when you go to another one */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <BottomNav />
      {/* Always mounted, so focus can return to it when the chat closes. */}
      <AssistantButton onClick={() => openAssistant(undefined)} />
      {chat && <ChatPanel context={chat.context} onClose={() => setChat(null)} />}
    </AssistantContext.Provider>
  );
}
