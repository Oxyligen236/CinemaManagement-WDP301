import { FILE_NAME_MAX_LENGTH } from '../../domain/constants/movie-asset.constants';
import { sanitizeFileName } from './sanitize-file-name.helper';

describe('sanitizeFileName', () => {
  it('returns "file" when input is undefined, empty, or only dots', () => {
    expect(sanitizeFileName(undefined)).toBe('file');
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName('...')).toBe('file');
  });

  it('extracts basename across forward and back slashes and strips unsafe chars', () => {
    expect(sanitizeFileName('C:\\folder\\sub/../my poster (1).png')).toBe(
      'my_poster__1_.png',
    );
    expect(sanitizeFileName('../../..secret..jpg')).toBe('secret.jpg');
  });

  it('handles filenames without an extension', () => {
    expect(sanitizeFileName('poster_image')).toBe('poster_image');
  });

  it('truncates long names while keeping extension within FILE_NAME_MAX_LENGTH', () => {
    const longName = `${'a'.repeat(FILE_NAME_MAX_LENGTH + 20)}.webp`;
    const result = sanitizeFileName(longName);

    expect(result.endsWith('.webp')).toBe(true);
    expect(result.length).toBe(FILE_NAME_MAX_LENGTH);
  });
});
