/**
 * Tiện ích chuẩn hóa thông báo lỗi người dùng.
 * Loại bỏ hoàn toàn HTTP status code (409, 400, 404, 500, etc.) và các raw error string khỏi UI.
 */

const VIETNAMESE_PATTERN =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/**
 * Thông báo có dấu tiếng Việt là thông báo nghiệp vụ do backend chủ động gửi,
 * không phải chuỗi lỗi thô của HTTP client -> an toàn để hiển thị cho người dùng.
 */
function hasVietnameseText(message: string): boolean {
  return (
    !!message &&
    !/\b(400|401|403|404|409|bad request|unauthorized|forbidden|conflict|status code)\b/i.test(
      message,
    ) &&
    VIETNAMESE_PATTERN.test(message)
  );
}

/**
 * Chuẩn hóa thông báo lỗi để hiển thị.
 *
 * Phân loại dựa trên `status` thật của response khi có. Chỉ khi không có
 * `status` (vd. lỗi mạng, `Error` được throw lại) mới đoán qua nội dung text,
 * vì đoán theo text dễ khớp sai: một message 400 có chứa chữ "conflict" từng bị
 * xếp vào nhánh 409 và nhận thông báo của nghiệp vụ khác.
 *
 * @param error - Lỗi gốc: `{ status, message }` từ response, `Error`, hoặc string.
 * @param fallbackMessage - Thông báo dùng khi không suy luận được gì cụ thể.
 *   Hãy truyền thông báo đúng ngữ cảnh màn hình đang gọi.
 */
export function getFriendlyErrorMessage(
  error: unknown,
  fallbackMessage = "Hệ thống đang bận, vui lòng thử lại sau.",
): string {
  if (!error) return fallbackMessage;

  const rawStatus =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status: unknown }).status)
      : undefined;
  const status =
    rawStatus !== undefined && Number.isFinite(rawStatus)
      ? rawStatus
      : undefined;

  let message = "";
  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const rawMsg = (error as { message: unknown }).message;
    message = Array.isArray(rawMsg) ? rawMsg.join(", ") : String(rawMsg);
  }

  // Thông báo nghiệp vụ tiếng Việt của backend luôn là thông tin cụ thể và
  // đúng ngữ cảnh nhất (vd. "Email này đã được đăng ký.", "Mã xác thực không
  // đúng hoặc đã hết hạn."), nên được ưu tiên trước mọi nhánh theo status.
  if (hasVietnameseText(message) && !isRawHttpError(message)) {
    const cleaned = sanitizeErrorText(message);
    if (cleaned) return cleaned;
  }

  // Chỉ suy luận theo nội dung text khi response không cho biết status.
  const matches = (pattern: RegExp) =>
    status === undefined && pattern.test(message);

  // 409 Conflict: dữ liệu bị trùng hoặc đã bị người khác chiếm trước.
  // Thông báo ở đây phải trung tính, vì hàm này dùng chung cho mọi màn hình.
  // Màn hình cần câu cụ thể (vd. giữ ghế) tự xử lý `status === 409` của mình.
  if (status === 409 || matches(/\b409\b|\bconflict\b/i)) {
    return "Thông tin này đã tồn tại hoặc vừa được người khác sử dụng, vui lòng kiểm tra lại.";
  }

  // 401 / 403: Hết phiên hoặc không có quyền.
  if (
    status === 401 ||
    status === 403 ||
    matches(/\b(401|403|unauthorized|forbidden)\b/i)
  ) {
    return "Phiên đăng nhập đã hết hạn hoặc bạn không có quyền thực hiện thao tác này.";
  }

  // 404: Không tìm thấy
  if (status === 404 || matches(/\b(404|not found)\b/i)) {
    return "Không tìm thấy dữ liệu yêu cầu.";
  }

  // 429: Gửi yêu cầu quá nhanh (cooldown gửi lại mã xác thực...).
  if (status === 429 || matches(/\b(429|too many requests)\b/i)) {
    return "Bạn đang thao tác quá nhanh, vui lòng đợi một lát rồi thử lại.";
  }

  // 400 / 422: Dữ liệu không hợp lệ
  if (
    status === 400 ||
    status === 422 ||
    matches(/\b(400|422|bad request|unprocessable)\b/i)
  ) {
    return "Thông tin không hợp lệ, vui lòng kiểm tra lại.";
  }

  // 500+ / Lỗi máy chủ
  if (
    (status !== undefined && status >= 500) ||
    matches(/\b(500|502|503|504|internal server error)\b/i)
  ) {
    return "Hệ thống đang bận, vui lòng thử lại sau.";
  }

  // Còn lại là chuỗi lỗi thô của trình duyệt / HTTP client ("Failed to fetch",
  // "NetworkError..."): không có giá trị với người dùng, dùng thông báo của
  // màn hình gọi. Chỉ giữ nguyên text nếu đó là thông báo tiếng Việt.
  if (message && hasVietnameseText(message)) {
    const cleaned = sanitizeErrorText(message);
    if (cleaned && !isRawHttpError(cleaned)) {
      return cleaned;
    }
  }

  return fallbackMessage;
}

function sanitizeErrorText(text: string): string {
  return text
    .replace(/Request failed with status code \d+/gi, "")
    .replace(
      /Error\s*\d+\s*(Conflict|Bad Request|Not Found|Internal Server Error)?/gi,
      "",
    )
    .replace(
      /\b(HTTP|status|code)?\s*[:#]?\s*(400|401|403|404|409|500|502|503)\b/gi,
      "",
    )
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isRawHttpError(text: string): boolean {
  return (
    /^(failed|error|request failed|internal server error|bad request|conflict|not found)$/i.test(
      text.trim(),
    ) || /^\d{3}$/.test(text.trim())
  );
}
