// "Sin conexión" strip: shown when the phone has no network or the server
// (the PC at home) does not answer. It explains what can still be done.
import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

const RETRY_MS = 15_000;

export default function ConnectionBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const onConnection = (event) => setOnline(event.detail);
    const onBrowserOffline = () => setOnline(false);
    window.addEventListener('app-connection', onConnection);
    window.addEventListener('offline', onBrowserOffline);
    return () => {
      window.removeEventListener('app-connection', onConnection);
      window.removeEventListener('offline', onBrowserOffline);
    };
  }, []);

  // While offline, check now and then whether the server is back.
  useEffect(() => {
    if (online) return undefined;
    const check = () =>
      fetch('/api/health')
        .then((response) => response.ok && setOnline(true))
        .catch(() => {});
    window.addEventListener('online', check);
    const timer = setInterval(check, RETRY_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', check);
    };
  }, [online]);

  if (online) return null;
  return (
    <div className="connection-banner" role="status">
      <WifiOff size={18} aria-hidden="true" />
      <span>
        Sin conexión con la app de casa (¿estás fuera de tu wifi o el PC está apagado?). Lo que ves puede no estar al día. Consejo:
        antes de ir al súper, exporta la lista desde «Llevar la lista».
      </span>
    </div>
  );
}
