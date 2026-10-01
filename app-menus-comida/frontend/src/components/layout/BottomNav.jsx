// Bottom tab bar: the 4 main sections, within thumb reach.
import { BookOpen, CalendarDays, Package, ShoppingCart } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/menu', label: 'Menú', Icon: CalendarDays },
  { to: '/despensa', label: 'Despensa', Icon: Package },
  { to: '/lista', label: 'Lista', Icon: ShoppingCart },
  { to: '/recetas', label: 'Recetas', Icon: BookOpen },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Secciones">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to}>
          <Icon size={24} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
