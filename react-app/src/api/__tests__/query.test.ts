import { describe, expect, it } from 'vitest';
import { toQueryString } from '../query';

describe('toQueryString', () => {
  it('returns an empty string when no parameter is set', () => {
    expect(toQueryString({})).toBe('');
    expect(toQueryString({ search: '', page: undefined, category_id: null })).toBe('');
  });

  it('keeps set values and drops empty ones', () => {
    expect(toQueryString({ search: 'chair', category_id: 3, stock_status: '' })).toBe(
      '?search=chair&category_id=3',
    );
  });

  it('encodes values so a free-text search survives the round trip', () => {
    expect(toQueryString({ search: 'blue chair & table' })).toBe(
      '?search=blue+chair+%26+table',
    );
  });

  it('coerces booleans and zero, which are meaningful filter values', () => {
    expect(toQueryString({ page: 0, verified: false })).toBe('?page=0&verified=false');
  });
});
