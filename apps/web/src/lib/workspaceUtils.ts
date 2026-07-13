import { useEffect, useState } from "react";

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

/**
 * timeAgo depende de Date.now(), que diverge entre a renderização no
 * servidor e a hidratação no cliente (o processo SSR pode ter calculado o
 * "agora" bem antes do cliente montar) — causando mismatch de hidratação.
 * Por isso só calculamos o valor real depois de montado; o servidor e o
 * primeiro paint do cliente sempre renderizam "" igualmente.
 */
export function useTimeAgo(iso: string): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(timeAgo(iso));
  }, [iso]);
  return label;
}
