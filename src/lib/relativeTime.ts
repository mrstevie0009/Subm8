// Kleine Helferfunktion für "2h", "3m", etc.
export function relativeTime(date: Date, locale = 'en'): string {
  const diff = Date.now() - date.getTime(); // ms
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return `${sec}s`;
  if (min < 60) return `${min}m`;
  if (hr  < 24) return `${hr}h`;
  if (day < 7)  return `${day}d`;
  // Fallback: Datum kurz formatiert
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
}
