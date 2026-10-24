export const POSTER_PREFIX = 'movies/posters';
export const POSTER_KEY_PATTERN = /^movies\/posters\/[\w.-]+$/;
export const POSTER_MAX_SIZE = 5 * 1024 * 1024;
export const POSTER_ALLOWED_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const FILE_NAME_MAX_LENGTH = 100;

export const MSG_FILE_REQUIRED = 'The file field is required.';
export const MSG08 =
  'File format is not supported. Please upload JPG, PNG, or WEBP.';
export const MSG09 = 'File size exceeds maximum allowed limit (5MB).';
export const MSG10 = 'Failed to upload asset to storage service.';
export const MSG11 = 'Invalid trailer link.';
export const MSG_INVALID_POSTER_KEY = 'Invalid poster key.';
