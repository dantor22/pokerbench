
export const MODEL_NAME_MAPPING: Record<string, string> = {
  "Pro": "Gemini 3 Pro",
  "Minni": "GPT-5 Mini",
  "Claude": "Opus 4.5",
  "FiveTwo": "GPT-5.2",
  "Elon": "Grok 4.1 Fast Reasoning",
  "Flash": "Gemini 3 Flash",
  // Fallbacks for lowercase just in case
  "pro": "Gemini 3 Pro",
  "minni": "GPT-5 Mini", 
  "claude": "Opus 4.5",
  "fivetwo": "GPT-5.2",
  "elon": "Grok 4.1 Fast Reasoning",
  "flash": "Gemini 3 Flash"
};

export function formatModelName(name: string): string {
  return MODEL_NAME_MAPPING[name] || name;
}
