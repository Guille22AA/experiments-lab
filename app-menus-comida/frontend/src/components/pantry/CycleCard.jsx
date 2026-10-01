// Summary of the current shopping cycle ("día 3 de 7").
import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

const formatDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

export default function CycleCard({ status, showButton = true }) {
  if (!status) return null;
  const { cycle, dayNumber, plannedDays = cycle?.plannedDays, isOverdue, averageDays } = status;

  return (
    <section className="card cycle-card">
      {cycle ? (
        <>
          <p className="cycle-title">
            {isOverdue ? `Han pasado ${dayNumber - 1} días desde la última compra` : `Día ${dayNumber} de ${plannedDays}`}
          </p>
          <p className="muted">
            Última compra: {formatDate(cycle.startedAt)}.
            {averageDays ? ` Sueles comprar cada ${averageDays} días.` : ''}
          </p>
        </>
      ) : (
        <>
          <p className="cycle-title">Aún no has registrado ninguna compra</p>
          <p className="muted">Registra tu próxima compra normal y empezará tu primer ciclo.</p>
        </>
      )}
      {showButton && (
        <Link to="/despensa/compra" className="button full">
          <ShoppingBag size={20} aria-hidden="true" />
          Registrar compra
        </Link>
      )}
    </section>
  );
}
