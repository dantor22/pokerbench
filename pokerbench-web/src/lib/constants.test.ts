import { describe, it, expect } from 'vitest';
import { formatModelName, getModelColor, getEffortSuffix, MODEL_NAME_MAPPING } from './constants';

describe('constants', () => {
  describe('formatModelName', () => {
    it('should format known model names correctly', () => {
      expect(formatModelName('Pro')).toBe('Gemini 3 Pro');
      expect(formatModelName('Pro', 'Gemini_Models')).toBe('Gemini 3.1 Pro');
      expect(formatModelName('Flashlight', 'Gemini_Models')).toBe('Gemini 3.1 Flash Lite');
      expect(formatModelName('Claude')).toBe('Opus 4.5');
      expect(formatModelName('Claude', 'Small_Models')).toBe('Haiku 4.5');
    });

    it('should return the original name if not in mapping', () => {
      expect(formatModelName('Unknown')).toBe('Unknown');
    });

    it('should handle lowercase fallbacks', () => {
      expect(formatModelName('pro')).toBe('Gemini 3 Pro');
      expect(formatModelName('pro', 'Gemini_Models')).toBe('Gemini 3.1 Pro');
    });
  });

  describe('getModelColor', () => {
    it('should return the correct color for known models', () => {
      expect(getModelColor('Pro')).toBe('#3b82f6');
      expect(getModelColor('Flashlight')).toBe('#60a5fa');
      expect(getModelColor('Elon')).toBe('#22d3ee');
    });

    it('should return default color for unknown models', () => {
      expect(getModelColor('Unknown')).toBe('#94a3b8');
    });
  });

  describe('getEffortSuffix', () => {
    it('should return (medium) for Claude normally', () => {
      expect(getEffortSuffix('Claude')).toBe(' (medium)');
      expect(getEffortSuffix('claude')).toBe(' (medium)');
    });

    it('should return empty string for Claude in Small_Models run', () => {
      expect(getEffortSuffix('Claude', 'Small_Models')).toBe('');
      expect(getEffortSuffix('claude', 'Small_Models')).toBe('');
    });

    it('should return empty string for Elon', () => {
      expect(getEffortSuffix('Elon')).toBe('');
      expect(getEffortSuffix('elon')).toBe('');
    });

    it('should return (high) for other models', () => {
      expect(getEffortSuffix('Pro')).toBe(' (high)');
      expect(getEffortSuffix('Unknown')).toBe(' (high)');
    });
  });

  describe('MODEL_NAME_MAPPING', () => {
    it('should have all expected models', () => {
      const expectedKeys = ['Pro', 'Minni', 'Claude', 'FiveTwo', 'Elon', 'Flash', 'Flashlight'];
      expectedKeys.forEach(key => {
        expect(MODEL_NAME_MAPPING).toHaveProperty(key);
      });
    });
  });
});
