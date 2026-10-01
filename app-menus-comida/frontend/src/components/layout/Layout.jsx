// Common frame of the main screens: header, content, bottom tabs and assistant.
import { useCallback, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AssistantContext } from '../../context/AssistantContext.jsx';
import AssistantButton from '../assistant/AssistantButton.jsx';
import ChatPanel from '../assistant/ChatPanel.jsx';
import BottomNav from './BottomNav.jsx';
import Header from './Header.jsx';

export default function Layout() {
  // null = closed; {} = open with the current screen; { name, label, ... } = open about something specific
  const [chat, setChat] = useState(null);

  const openAssistant = useCallback((context) => setChat({ context }), []);
  const assistant = useMemo(() => ({ openAssistant }), [openAssistant]);

  return (
    <AssistantContext.Provider value={assistant}>
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
      {!chat && <AssistantButton onClick={() => openAssistant(undefined)} />}
      {chat && <ChatPanel context={chat.context} onClose={() => setChat(null)} />}
    </AssistantContext.Provider>
  );
}
