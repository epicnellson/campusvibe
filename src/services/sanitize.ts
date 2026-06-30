export function sanitizeText(text: string): string {
  return text
    .replace(/[<>&"']/g, (char) => {
      switch (char) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case '"': return "&quot;";
        case "'": return "&#x27;";
        default: return char;
      }
    })
    .trim();
}
