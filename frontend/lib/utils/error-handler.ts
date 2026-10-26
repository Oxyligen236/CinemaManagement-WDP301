/**
 * Tiện ích chuẩn hóa thông báo lỗi người dùng.
 * Loại bỏ hoàn toàn HTTP status code (409, 400, 404, 500, etc.) và các raw error string khỏi UI.
 */

export function getFriendlyErrorMessage(
  error: unknown,
  fallbackMessage = 'Hệ thống đang bận, vui lòng thử lại sau.',
): string {
  if (!error) return fallbackMessage;

  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined;

  let message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    const rawMsg = (error as { message: unknown }).message;
    message = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg);
  }

  // 409 Conflict: Ghế đã được giữ hoặc đặt
  if (status === 409 || /\b409\b|conflict/i.test(message)) {
    if (
      message &&
      !/\b(409|conflict|status code|error)\b/i.test(message) &&
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(message)
    ) {
      return sanitizeErrorText(message);
    }
    return 'Ghế này vừa có người giữ hoặc đã được đặt, vui lòng chọn ghế khác.';
  }

  // 403 Forbidden: Không có quyền hoặc thao tác sai chi nhánh
  if (status === 403 || /\b403\b|forbidden/i.test(message)) {
    if (
      message &&
      !/\b(403|forbidden|status code|error)\b/i.test(message) &&
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(message)
    ) {
      return sanitizeErrorText(message);
    }
    return 'Bạn không có quyền thực hiện thao tác này hoặc thao tác ngoài chi nhánh phân công.';
  }

  // 401 Unauthorized: Hết phiên đăng nhập
  if (status === 401 || /\b(401|unauthorized)\b/i.test(message)) {
    return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
  }

  // 404: Không tìm thấy
  if (status === 404 || /\b(404|not found)\b/i.test(message)) {
    return 'Không tìm thấy dữ liệu yêu cầu.';
  }

  // 400: Dữ liệu không hợp lệ
  if (status === 400 || /\b(400|bad request)\b/i.test(message)) {
    if (
      message &&
      !/\b(400|bad request|status code|error)\b/i.test(message) &&
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(message)
    ) {
      return sanitizeErrorText(message);
    }
    return 'Thông tin không hợp lệ, vui lòng kiểm tra lại.';
  }

  // 500+ / Lỗi máy chủ
  if (
    (status && status >= 500) ||
    /\b(500|502|503|504|internal server error)\b/i.test(message)
  ) {
    return 'Hệ thống đang bận, vui lòng thử lại sau.';
  }

  // Lọc sạch mọi status code còn sót trong text
  if (message) {
    const cleaned = sanitizeErrorText(message);
    if (cleaned && !isRawHttpError(cleaned)) {
      return cleaned;
    }
  }

  return fallbackMessage;
}

function sanitizeErrorText(text: string): string {
  return text
    .replace(/Request failed with status code \d+/gi, '')
    .replace(/Error\s*\d+\s*(Conflict|Bad Request|Not Found|Internal Server Error)?/gi, '')
    .replace(/\b(HTTP|status|code)?\s*[:#]?\s*(400|401|403|404|409|500|502|503)\b/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isRawHttpError(text: string): boolean {
  return (
    /^(failed|error|request failed|internal server error|bad request|conflict|not found)$/i.test(
      text.trim(),
    ) ||
    /^\d{3}$/.test(text.trim())
  );
}
