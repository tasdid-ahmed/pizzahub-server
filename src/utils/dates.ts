const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Today's calendar date in Dhaka (YYYY-MM-DD), regardless of the server's timezone. */
export const todayInDhaka = () => new Date(Date.now() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);

/** Parses YYYY-MM-DD into a UTC-midnight Date, or null if it isn't a real calendar date. */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}