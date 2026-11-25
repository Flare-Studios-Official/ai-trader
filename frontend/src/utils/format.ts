export function formatInr(amount: number, showSign = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (safe < 0) return `-₹${abs}`;
  if (showSign && safe > 0) return `+₹${abs}`;
  return `₹${abs}`;
}

export function formatNumber(amount: number, decimals = 2, showSign = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = Math.abs(safe).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (safe < 0) return `-${formatted}`;
  if (showSign && safe > 0) return `+${formatted}`;
  return formatted;
}

export function formatUsd(amount: number, showSign = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (safe < 0) return `-$${abs}`;
  if (showSign && safe > 0) return `+$${abs}`;
  return `$${abs}`;
}

export function formatIstTime(isoOrUnix: string | number | null | undefined): string {
  if (!isoOrUnix) return '—';
  const d = typeof isoOrUnix === 'number' ? new Date(isoOrUnix * 1000) : new Date(isoOrUnix);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatIstDateTime(isoOrUnix: string | number | null | undefined): string {
  if (!isoOrUnix) return '—';
  const d = typeof isoOrUnix === 'number' ? new Date(isoOrUnix * 1000) : new Date(isoOrUnix);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
