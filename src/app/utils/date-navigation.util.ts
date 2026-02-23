export type ViewMode = 'day' | 'week' | 'month' | 'year';

export const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
];

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseParts(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getDateRange(ref: Date, mode: ViewMode): { start: string; end: string } {
  switch (mode) {
    case 'day': {
      const d = toISODate(ref);
      return { start: d, end: d };
    }
    case 'week': {
      const day = ref.getDay();
      const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      return { start: toISODate(monday), end: toISODate(sunday) };
    }
    case 'month': {
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      return { start: toISODate(start), end: toISODate(end) };
    }
    case 'year':
      return { start: `${ref.getFullYear()}-01-01`, end: `${ref.getFullYear()}-12-31` };
  }
}

export function getNavigationLabel(ref: Date, mode: ViewMode): string {
  switch (mode) {
    case 'day':
      return `${ref.getDate()} ${MONTHS[ref.getMonth()]} ${ref.getFullYear()}`;
    case 'week': {
      const range = getDateRange(ref, 'week');
      const s = parseParts(range.start);
      const e = parseParts(range.end);
      if (s.getMonth() === e.getMonth()) {
        return `${s.getDate()} – ${e.getDate()} ${MONTHS[s.getMonth()].substring(0, 3)} ${s.getFullYear()}`;
      }
      return `${s.getDate()} ${MONTHS[s.getMonth()].substring(0, 3)} – ${e.getDate()} ${MONTHS[e.getMonth()].substring(0, 3)} ${e.getFullYear()}`;
    }
    case 'month':
      return `${MONTHS[ref.getMonth()]} ${ref.getFullYear()}`;
    case 'year':
      return `${ref.getFullYear()}`;
  }
}

export function navigateDate(ref: Date, mode: ViewMode, direction: 1 | -1): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  switch (mode) {
    case 'day': d.setDate(d.getDate() + direction); break;
    case 'week': d.setDate(d.getDate() + 7 * direction); break;
    case 'month': d.setMonth(d.getMonth() + direction); break;
    case 'year': d.setFullYear(d.getFullYear() + direction); break;
  }
  return d;
}
