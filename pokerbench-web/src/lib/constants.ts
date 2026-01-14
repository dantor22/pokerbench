
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

/**
 * ElevenLabs Voice IDs (Standard):
 * Brian: nPczCjzI2devNBz1zQrb
 * George: JBFqnCBsd6RMkjVDRZzb
 * Alice: Xb7hH8MSUJpSbSDYk0k2
 * Bill: pqHfZKP75CvOlQylNhV4
 * Callim (Callum): N2lVS1w4EtoT3dr4eOWO
 * Charlie: IKne3meq5aSn9XLyUdCD
 * Charlotte: XB0fDUnXU5powFXDhCwa
 * Chris: iP95p4xoKVk53GoZ742B
 */

export const MODEL_CONFIG: Record<string, { color: string; logo: string; logoInvert?: boolean; logoScale?: number; voice?: string; nativeVoice?: string }> = {
  "Pro": { color: '#3b82f6', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'nPczCjzI2devNBz1zQrb', nativeVoice: 'Samantha' },      // Brian
  "Minni": { color: '#4ade80', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'Xb7hH8MSUJpSbSDYk0k2', nativeVoice: 'Victoria' },   // Alice
  "Claude": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'pqHfZKP75CvOlQylNhV4', nativeVoice: 'Tessa' },  // Bill
  "FiveTwo": { color: '#ef4444', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'JBFqnCBsd6RMkjVDRZzb', nativeVoice: 'Alex' }, // George
  "Elon": { color: '#22d3ee', logo: '/logos/grok.svg', logoInvert: true, logoScale: 1.3, voice: 'iP95p4xoKVk53GoZ742B', nativeVoice: 'Daniel' },   // Chris
  "Flash": { color: '#a855f7', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'N2lVS1w4EtoT3dr4eOWO', nativeVoice: 'Fred' },     // Callim (Callum)
  "Haiku": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'XB0fDUnXU5powFXDhCwa', nativeVoice: 'Victoria' }, // Charlotte
  // Fallbacks
  "pro": { color: '#3b82f6', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'nPczCjzI2devNBz1zQrb', nativeVoice: 'Samantha' },
  "minni": { color: '#4ade80', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'Xb7hH8MSUJpSbSDYk0k2', nativeVoice: 'Victoria' },
  "claude": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'pqHfZKP75CvOlQylNhV4', nativeVoice: 'Tessa' },
  "fivetwo": { color: '#ef4444', logo: '/logos/openai.svg', logoInvert: true, logoScale: 1.3, voice: 'JBFqnCBsd6RMkjVDRZzb', nativeVoice: 'Alex' },
  "elon": { color: '#22d3ee', logo: '/logos/grok.svg', logoInvert: true, logoScale: 1.3, voice: 'iP95p4xoKVk53GoZ742B', nativeVoice: 'Daniel' },
  "flash": { color: '#a855f7', logo: '/logos/gemini_2025.svg', logoScale: 1.0, voice: 'N2lVS1w4EtoT3dr4eOWO', nativeVoice: 'Fred' },
  "haiku": { color: '#fb923c', logo: '/logos/anthropic.svg', voice: 'XB0fDUnXU5powFXDhCwa', nativeVoice: 'Victoria' },
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
