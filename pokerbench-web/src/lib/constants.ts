
export const MODEL_NAME_MAPPING: Record<string, string> = {
  "Pro": "Gemini 3 Pro",
  "Minni": "GPT-5 Mini",
  "Claude": "Opus 4.5",
  "FiveTwo": "GPT-5.2",
  "Elon": "Grok 4.1 Fast Reasoning",
  "Flash": "Gemini 3 Flash",
  "Flashlight": "Gemini 3.1 Flash Lite",
  "Haiku": "Haiku 4.5",
  // Fallbacks for lowercase just in case
  "pro": "Gemini 3 Pro",
  "minni": "GPT-5 Mini",
  "claude": "Opus 4.5",
  "fivetwo": "GPT-5.2",
  "elon": "Grok 4.1 Fast Reasoning",
  "flash": "Gemini 3 Flash",
  "flashlight": "Gemini 3.1 Flash Lite",
  "haiku": "Haiku 4.5"
};

export const RUN_MODEL_NAME_MAPPINGS: Record<string, Record<string, string>> = {
  "Latest_Gemini_Models": {
    "Pro": "Gemini 3.1 Pro",
    "Flashlight": "Gemini 3.1 Flash Lite",
    "pro": "Gemini 3.1 Pro",
    "flashlight": "Gemini 3.1 Flash Lite"
  },
  "Small_Models": {
    "Claude": "Haiku 4.5",
    "claude": "Haiku 4.5"
  }
};

/**
 * ElevenLabs Voice IDs (Standard):
 * Brian: nPczCjzI2devNBz1zQrb
 * George: JBFqnCBsd6RMkjVDRZzb
 * Alice: Xb7hH8MSUJpSbSDYk0k2
 * Bill: pqHfZKP75CvOlQylNhV4
 * Callum: N2lVS1w4EtoT3dr4eOWO
 * Charlie: IKne3meq5aSn9XLyUdCD
 * Charlotte: XB0fDUnXU5powFXDhCwa
 * Chris: iP95p4xoKVk53GoZ742B
 */

export const MODEL_CONFIG: Record<string, { color: string; logo: string; logoInvert?: boolean; logoScale?: number; voice?: string; elevenLabsVoice?: string; nativeVoice?: string }> = {
  "Pro": { color: '#3b82f6', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'alloy', elevenLabsVoice: 'nPczCjzI2devNBz1zQrb', nativeVoice: 'Samantha' },      // Blue
  "Minni": { color: '#4ade80', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'nova', elevenLabsVoice: 'Xb7hH8MSUJpSbSDYk0k2', nativeVoice: 'Victoria' },   // Green
  "Claude": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'shimmer', elevenLabsVoice: 'pqHfZKP75CvOlQylNhV4', nativeVoice: 'Tessa' },  // Orange
  "FiveTwo": { color: '#ef4444', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'echo', elevenLabsVoice: 'JBFqnCBsd6RMkjVDRZzb', nativeVoice: 'Alex' }, // Red
  "Elon": { color: '#22d3ee', logo: '/logos/grok.svg', logoInvert: true, logoScale: 1.3, voice: 'onyx', elevenLabsVoice: 'iP95p4xoKVk53GoZ742B', nativeVoice: 'Daniel' },   // Cyan
  "Flash": { color: '#a855f7', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'fable', elevenLabsVoice: 'N2lVS1w4EtoT3dr4eOWO', nativeVoice: 'Fred' },     // Purple
  "Flashlight": { color: '#60a5fa', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'charlie', elevenLabsVoice: 'IKne3meq5aSn9XLyUdCD', nativeVoice: 'Samantha' },
  "Haiku": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'nova', elevenLabsVoice: 'XB0fDUnXU5powFXDhCwa', nativeVoice: 'Victoria' },
  // Fallbacks
  "pro": { color: '#3b82f6', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'alloy', elevenLabsVoice: 'nPczCjzI2devNBz1zQrb', nativeVoice: 'Samantha' },
  "minni": { color: '#4ade80', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'nova', elevenLabsVoice: 'Xb7hH8MSUJpSbSDYk0k2', nativeVoice: 'Victoria' },
  "claude": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'shimmer', elevenLabsVoice: 'pqHfZKP75CvOlQylNhV4', nativeVoice: 'Tessa' },
  "fivetwo": { color: '#ef4444', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'echo', elevenLabsVoice: 'JBFqnCBsd6RMkjVDRZzb', nativeVoice: 'Alex' },
  "elon": { color: '#22d3ee', logo: '/logos/grok.svg', logoInvert: true, logoScale: 1.3, voice: 'onyx', elevenLabsVoice: 'iP95p4xoKVk53GoZ742B', nativeVoice: 'Daniel' },
  "flash": { color: '#a855f7', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'fable', elevenLabsVoice: 'N2lVS1w4EtoT3dr4eOWO', nativeVoice: 'Fred' },
  "flashlight": { color: '#60a5fa', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'charlie', elevenLabsVoice: 'IKne3meq5aSn9XLyUdCD', nativeVoice: 'Samantha' },
  "haiku": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'nova', elevenLabsVoice: 'XB0fDUnXU5powFXDhCwa', nativeVoice: 'Victoria' },
};

export function formatModelName(name: string, runId?: string): string {
  if (runId && RUN_MODEL_NAME_MAPPINGS[runId]?.[name]) {
    return RUN_MODEL_NAME_MAPPINGS[runId][name];
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
