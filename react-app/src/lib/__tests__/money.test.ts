import { describe, expect, it } from 'vitest';
import { formatMMK } from '../money';

describe('formatMMK', () => {
  it('groups thousands for a typical display price', () => {
    expect(formatMMK(5000)).toBe('5,000');
    expect(formatMMK(1234567)).toBe('1,234,567');
  });

  it('renders zero without any decoration', () => {
    expect(formatMMK(0)).toBe('0');
  });

  it('never emits decimal places because MMK amounts are integers', () => {
    expect(formatMMK(5000.7)).toBe('5,000');
    expect(formatMMK(0.9)).toBe('0');
  });

  it('formats a live cart line total', () => {
    expect(formatMMK(4500 * 3)).toBe('13,500');
  });
});
