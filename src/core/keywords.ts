export const KEYWORDS = ["funding", "growth hacking", "artificial intelligence startups"];
export function matchKeywords(text: string) {
  const t = (text || "").toLowerCase();
  return KEYWORDS.filter((k) => t.includes(k.toLowerCase()));
}
