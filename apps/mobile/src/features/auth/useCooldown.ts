import { useCallback, useEffect, useState } from "react";

/**
 * Compte à rebours (en secondes) pour limiter la fréquence d'une action. Basé sur l'heure réelle
 * plutôt que sur le nombre de ticks : il reste juste si l'application passe en arrière-plan.
 */
export function useCooldown(seconds: number, startImmediately = false) {
  const [until, setUntil] = useState(() => (startImmediately ? Date.now() + seconds * 1000 : 0));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  const start = useCallback(() => {
    const current = Date.now();
    setNow(current);
    setUntil(current + seconds * 1000);
  }, [seconds]);

  return { remaining: Math.max(0, Math.ceil((until - now) / 1000)), start };
}
