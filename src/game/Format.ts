import { calendar, DAY, HOUR } from './Engine';

export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
export const tokens = (k: number) => (k >= 1000 ? `${(k / 1000).toFixed(2)}M` : `${Math.round(k * 10) / 10}k`);

export function clock(minute: number) {
  const c = calendar(minute);
  const m = minute % HOUR;
  return `${String(c.hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function duration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  if (total >= DAY) {
    const d = Math.floor(total / DAY);
    const h = Math.floor((total % DAY) / HOUR);
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  const h = Math.floor(total / HOUR);
  const m = total % HOUR;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function moment(minute: number) {
  const c = calendar(minute);
  return `${c.weekdayShort} ${clock(minute)}`;
}

export function dated(minute: number) {
  const c = calendar(minute);
  return `Month ${c.month}, Week ${c.weekOfMonth}, ${c.weekday}`;
}
