import { describe, it, expect } from 'vitest';
import { Paginator } from '../src/core/paginator';

describe('Paginator Logic', () => {
  const mockDefaults = {
    page: 1,
    limit: 10,
    maxLimit: 100,
  };

  it('should calculate correct skip values', async () => {
    const paginator = new Paginator(mockDefaults as any);
    
    // @ts-expect-error: Accessing private normalize method for unit testing calculations
    const result = paginator.normalize({ page: 2, limit: 20 });
    
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.skip).toBe(20); // (2-1) * 20
  });

  it('should enforce maxLimit', async () => {
    const paginator = new Paginator(mockDefaults as any);
    
    // @ts-expect-error - accessing private method for testing
    const result = paginator.normalize({ limit: 500 });
    
    expect(result.limit).toBe(100); // capped at mockDefaults.maxLimit
  });
});