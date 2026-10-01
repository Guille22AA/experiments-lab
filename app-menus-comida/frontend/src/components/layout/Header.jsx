import { ArrowLeft, Settings } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SCREENS } from '../../constants/labels.js';

const TAB_PATHS = ['/menu', '/despensa', '/lista', '/recetas'];

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = SCREENS[pathname]?.label ?? 'Despensa y menús';
  const isTab = TAB_PATHS.includes(pathname);

  return (
    <header className="app-header">
      <div className="header-title">
        {/* Screens outside the bottom tabs get a back button. */}
        {!isTab && (
          <button className="icon-button" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
        )}
        <h1>{title}</h1>
      </div>
      {pathname !== '/ajustes' && (
        <Link to="/ajustes" className="icon-button" aria-label="Ajustes">
          <Settings size={22} aria-hidden="true" />
        </Link>
      )}
    </header>
  );
}
