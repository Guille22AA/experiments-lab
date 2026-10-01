import { Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { SCREENS } from '../../constants/labels.js';

export default function Header() {
  const { pathname } = useLocation();
  const title = SCREENS[pathname]?.label ?? 'Despensa y menús';

  return (
    <header className="app-header">
      <h1>{title}</h1>
      {pathname !== '/ajustes' && (
        <Link to="/ajustes" className="icon-button" aria-label="Ajustes">
          <Settings size={22} aria-hidden="true" />
        </Link>
      )}
    </header>
  );
}
