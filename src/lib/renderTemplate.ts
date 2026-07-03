/**
 * Simple `{{variable}}` substitution used across e-commerce landing pages.
 * Missing vars become an empty string so admin-editable templates never crash.
 */
export function renderTemplate(input: string | null | undefined, vars: Record<string, string | number | undefined | null>): string {
  if (!input) return "";
  return String(input).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}