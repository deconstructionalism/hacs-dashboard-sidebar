import { describe, expect, it } from 'vitest';

import { blockTypeLabel, titleCase, validateJsonField, validateWidth } from './block-form';

describe('validateJsonField', () => {
  it('allows empty (optional field)', () => {
    expect(validateJsonField('')).toBe(null);
    expect(validateJsonField('   ')).toBe(null);
  });

  it('accepts valid JSON', () => {
    expect(validateJsonField('{"type":"markdown"}')).toBe(null);
    expect(validateJsonField('[1, 2, 3]')).toBe(null);
  });

  it('rejects malformed JSON', () => {
    expect(validateJsonField('{type: markdown}')).toBe('Invalid JSON');
    expect(validateJsonField('{')).toBe('Invalid JSON');
  });
});

describe('validateWidth', () => {
  it('allows empty (use default)', () => {
    expect(validateWidth('')).toBe(null);
  });

  it('accepts a positive integer', () => {
    expect(validateWidth('240')).toBe(null);
  });

  it('rejects zero, negatives, and non-integers', () => {
    expect(validateWidth('0')).toBe('Must be a positive number');
    expect(validateWidth('-5')).toBe('Must be a positive number');
    expect(validateWidth('12.5')).toBe('Must be a positive number');
    expect(validateWidth('wide')).toBe('Must be a positive number');
  });
});

describe('titleCase', () => {
  it('capitalizes the first letter only', () => {
    expect(titleCase('item')).toBe('Item');
    expect(titleCase('markdown')).toBe('Markdown');
  });
});

describe('blockTypeLabel', () => {
  it('labels every block type as the title-cased type (matching the YAML)', () => {
    expect(blockTypeLabel('title')).toBe('Title');
    expect(blockTypeLabel('clock')).toBe('Clock');
    expect(blockTypeLabel('date')).toBe('Date');
    expect(blockTypeLabel('divider')).toBe('Divider');
    expect(blockTypeLabel('item')).toBe('Item');
    expect(blockTypeLabel('category')).toBe('Category');
    // The two that used to be "Text" and "Manual Card" now match the YAML type.
    expect(blockTypeLabel('markdown')).toBe('Markdown');
    expect(blockTypeLabel('card')).toBe('Card');
  });
});
