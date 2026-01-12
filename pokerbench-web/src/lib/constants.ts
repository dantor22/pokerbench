

export const MODEL_NAME_MAPPING: Record<string, string> = {
  "Pro": "Gemini 3 Pro",
  "Minni": "GPT-5 Mini",
  "Claude": "Opus 4.5",
  "FiveTwo": "GPT-5.2",
  "Elon": "Grok 4.1 Fast Reasoning",
  "Flash": "Gemini 3 Flash",
  "Haiku": "Haiku 4.5",
  // Fallbacks for lowercase just in case
  "pro": "Gemini 3 Pro",
  "minni": "GPT-5 Mini",
  "claude": "Opus 4.5",
  "fivetwo": "GPT-5.2",
  "elon": "Grok 4.1 Fast Reasoning",
  "flash": "Gemini 3 Flash",
  "haiku": "Haiku 4.5"
};

export const MODEL_CONFIG: Record<string, { color: string; logo: string; logoInvert?: boolean; logoScale?: number; voice?: string; nativeVoice?: string }> = {
  "Pro": { color: '#3b82f6', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'alloy', nativeVoice: 'Samantha' },      // Blue
  "Minni": { color: '#4ade80', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'nova', nativeVoice: 'Victoria' },   // Green
  "Claude": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'shimmer', nativeVoice: 'Tessa' },  // Orange
  "FiveTwo": { color: '#ef4444', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'echo', nativeVoice: 'Alex' }, // Red
  "Elon": { color: '#22d3ee', logo: '/logos/grok.svg', logoInvert: true, logoScale: 1.3, voice: 'onyx', nativeVoice: 'Daniel' },   // Cyan
  "Flash": { color: '#a855f7', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'fable', nativeVoice: 'Fred' },     // Purple
  "Haiku": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'nova', nativeVoice: 'Victoria' },
  // Fallbacks
  "pro": { color: '#3b82f6', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'alloy', nativeVoice: 'Samantha' },
  "minni": { color: '#4ade80', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'nova', nativeVoice: 'Victoria' },
  "claude": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'shimmer', nativeVoice: 'Tessa' },
  "fivetwo": { color: '#ef4444', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'echo', nativeVoice: 'Alex' },
  "elon": { color: '#22d3ee', logo: '/logos/grok.svg', logoInvert: true, logoScale: 1.3, voice: 'onyx', nativeVoice: 'Daniel' },
  "flash": { color: '#a855f7', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'fable', nativeVoice: 'Fred' },
  "haiku": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'nova', nativeVoice: 'Victoria' },
};

export function formatModelName(name: string, runId?: string): string {
  if (runId === 'Small_Models' && name === 'Claude') {
    return 'Haiku 4.5';
  }
  return MODEL_NAME_MAPPING[name] || name;
}

export function getModelColor(name: string): string {
  return MODEL_CONFIG[name]?.color || '#94a3b8';
}

// Bit of a hack as we're not currently encoding the reasoning effort config into the JSON.
export function getEffortSuffix(modelKey: string, runId?: string): string {
  const key = modelKey.toLowerCase();
  if (key === 'claude') {
    if (runId === 'Small_Models') return '';
    return ' (medium)';
  }
  if (key === 'elon') return '';
  return ' (high)';
}
