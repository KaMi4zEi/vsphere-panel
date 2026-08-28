export const FAVICON_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/svg+xml",
] as const;

const MAX_FAVICON_BYTES = 512 * 1024;

export type ValidFavicon = { mimeType: string; buffer: Buffer };

export function validateFaviconDataUrl(dataUrl: unknown, declaredType: unknown): ValidFavicon | null {
  if (typeof dataUrl !== "string" || typeof declaredType !== "string") return null;
  if (!FAVICON_TYPES.includes(declaredType as (typeof FAVICON_TYPES)[number])) return null;

  const prefix = `data:${declaredType};base64,`;
  if (!dataUrl.startsWith(prefix)) return null;

  const encoded = dataUrl.slice(prefix.length);
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;

  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > MAX_FAVICON_BYTES) return null;

  if (declaredType === "image/svg+xml") {
    const svg = buffer.toString("utf8");
    if (svg.includes("\uFFFD") || !/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return null;

    // Un favicon n'a besoin d'aucun contenu actif ni d'aucune ressource distante.
    const unsafe = [
      /<!DOCTYPE/i,
      /<!ENTITY/i,
      /<\s*(?:script|foreignObject|iframe|object|embed|audio|video|style)\b/i,
      /\son[a-z]+\s*=/i,
      /(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i,
      /\b(?:href|xlink:href)\s*=\s*["'](?!#)[^"']/i,
      /@import/i,
      /url\s*\(\s*["']?(?!#)/i,
    ];
    if (unsafe.some(pattern => pattern.test(svg))) return null;
  }

  return { mimeType: declaredType, buffer };
}
