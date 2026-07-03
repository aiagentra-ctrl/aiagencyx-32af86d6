/** Convert #rgb/#rrggbb to { r, g, b }. Returns null on parse failure. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(37,99,235,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))); }

export function darken(hex: string, amount = 0.15): string {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  const r = clamp(rgb.r * (1 - amount));
  const g = clamp(rgb.g * (1 - amount));
  const b = clamp(rgb.b * (1 - amount));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function lighten(hex: string, amount = 0.15): string {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  const r = clamp(rgb.r + (255 - rgb.r) * amount);
  const g = clamp(rgb.g + (255 - rgb.g) * amount);
  const b = clamp(rgb.b + (255 - rgb.b) * amount);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Pick black or white text based on brand luminance. */
export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex); if (!rgb) return "#ffffff";
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.5 ? "#0f172a" : "#ffffff";
}

/** Compute all --brand-* CSS variables from a single hex color. */
export function brandCssVars(hex: string): Record<string, string> {
  const brand = hex || "#2563EB";
  return {
    "--brand": brand,
    "--brand-dark": darken(brand, 0.18),
    "--brand-mid": lighten(brand, 0.35),
    "--brand-light": hexToRgba(brand, 0.08),
    "--brand-text": getContrastColor(brand),
  };
}