import { describe, it, expect } from 'vitest';
import { YOUTUBE_LINKS } from './youtube-links';

describe('youtube-links', () => {
  it('should have the correct YouTube link for Gemini Models game 7d2df2a6', () => {
    expect(YOUTUBE_LINKS['Gemini_Models/game/7d2df2a6']).toBe('https://youtu.be/t5NqKOXLvEA');
  });

  it('should have other known links preserved', () => {
    expect(YOUTUBE_LINKS['Gemini_3_Flash_and_Pro_Heads_Up/game/4deb9405']).toBe('https://www.youtube.com/watch?v=4-mZvLVUzSQ');
    expect(YOUTUBE_LINKS['Large_Models/game/feba63c1']).toBe('https://www.youtube.com/watch?v=CfZTa2XeVG0');
  });
});
