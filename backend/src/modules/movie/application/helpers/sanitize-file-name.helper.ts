import { FILE_NAME_MAX_LENGTH } from '../../domain/constants/movie-asset.constants';

/**
 * Chuẩn hoá tên file người dùng gửi lên thành tên an toàn dùng trong S3 key:
 * chỉ lấy phần basename, loại ký tự ngoài [\w.-], chặn `..`, giới hạn độ dài và giữ phần mở rộng.
 */
export function sanitizeFileName(originalName: string | undefined): string {
  const base = (originalName ?? '').replace(/\\/g, '/').split('/').pop() ?? '';
  const cleaned = base
    .replace(/[^\w.-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '');
  if (!cleaned) {
    return 'file';
  }

  const dotIndex = cleaned.lastIndexOf('.');
  const ext = dotIndex > 0 ? cleaned.slice(dotIndex) : '';
  const name = dotIndex > 0 ? cleaned.slice(0, dotIndex) : cleaned;
  const maxName = Math.max(1, FILE_NAME_MAX_LENGTH - ext.length);
  return `${name.slice(0, maxName)}${ext}`;
}
