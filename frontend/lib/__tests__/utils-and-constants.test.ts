import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cn } from '@/lib/utils';

describe('lib/utils - cn', () => {
  it('merges plain class strings', () => {
    expect(cn('px-2', 'py-1', 'text-sm')).toBe('px-2 py-1 text-sm');
  });

  it('handles conditional values, objects, arrays, and falsy inputs', () => {
    expect(
      cn(
        'base',
        false && 'hidden',
        null,
        undefined,
        '',
        { 'text-red-500': true, 'text-blue-500': false },
        ['mt-2', ['mb-3']],
      ),
    ).toBe('base text-red-500 mt-2 mb-3');
  });

  it('resolves conflicting Tailwind utility classes via tailwind-merge', () => {
    expect(cn('px-2 py-1 text-sm', 'px-4 text-lg')).toBe('py-1 px-4 text-lg');
  });

  it('returns an empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });
});

describe('lib/constants/r2 - R2_PUBLIC_URL', () => {
  const originalEnv = process.env.NEXT_PUBLIC_R2_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_R2_URL;
    } else {
      process.env.NEXT_PUBLIC_R2_URL = originalEnv;
    }
  });

  it('uses default fallback URL when NEXT_PUBLIC_R2_URL is undefined', async () => {
    delete process.env.NEXT_PUBLIC_R2_URL;
    const { R2_PUBLIC_URL } = await import('@/lib/constants/r2');
    expect(R2_PUBLIC_URL).toBe(
      'https://pub-164d4a22a3b640eea0cda4f57ba0c1f9.r2.dev',
    );
  });

  it('uses default fallback URL when NEXT_PUBLIC_R2_URL is empty string', async () => {
    process.env.NEXT_PUBLIC_R2_URL = '';
    const { R2_PUBLIC_URL } = await import('@/lib/constants/r2');
    expect(R2_PUBLIC_URL).toBe(
      'https://pub-164d4a22a3b640eea0cda4f57ba0c1f9.r2.dev',
    );
  });

  it('uses process.env.NEXT_PUBLIC_R2_URL when configured', async () => {
    process.env.NEXT_PUBLIC_R2_URL = 'https://cdn.lattecinema.vn';
    const { R2_PUBLIC_URL } = await import('@/lib/constants/r2');
    expect(R2_PUBLIC_URL).toBe('https://cdn.lattecinema.vn');
  });
});
