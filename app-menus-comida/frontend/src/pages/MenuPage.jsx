import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import CycleCard from '../components/pantry/CycleCard.jsx';
import ComingSoon from '../components/ui/ComingSoon.jsx';

export default function MenuPage() {
  const [cycleStatus, setCycleStatus] = useState(null);

  useEffect(() => {
    api.get('/purchases/cycle').then(setCycleStatus).catch(() => {});
  }, []);

  return (
    <>
      <CycleCard status={cycleStatus} />
      <ComingSoon Icon={CalendarDays} title="Tu menú">
        Aquí verás el menú de cada día hasta tu próxima compra. Muy pronto.
      </ComingSoon>
    </>
  );
}
