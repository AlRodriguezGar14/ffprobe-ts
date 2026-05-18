// Consumer-side helpers for working with ffprobe output.

// ffprobe prints time fields as fixed-6 decimal strings ("12.345000").
// Use this when you need byte-exact text parity with the ffprobe CLI.
export const ffTime = (n: number | null): string | null =>
  n == null || Number.isNaN(n) ? null : n.toFixed(6);
