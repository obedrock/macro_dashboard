export function isMarketOpen(now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = Object.fromEntries(
    fmt.formatToParts(now).map(p => [p.type, p.value])
  );

  const day = parts['weekday'];
  const hour = parseInt(parts['hour']);
  const minute = parseInt(parts['minute']);

  if (day === 'Sat' || day === 'Sun') return false;

  const openMinutes = 9 * 60 + 30;
  const closeMinutes = 16 * 60;
  const nowMinutes = hour * 60 + minute;

  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}
