// Common frame of the main screens: header, content, bottom tabs and assistant.
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AssistantButton from '../assistant/AssistantButton.jsx';
import ChatPanel from '../assistant/ChatPanel.jsx';
import BottomNav from './BottomNav.jsx';
import Header from './Header.jsx';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
      {!chatOpen && <AssistantButton onClick={() => setChatOpen(true)} />}
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </>
  );
}
