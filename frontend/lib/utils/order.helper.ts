export const ORDER_HOLD_TIMEOUT_MS = 10 * 60 * 1000; // 10 phút

/**
 * Trích xuất message lỗi chính xác từ response hoặc error object.
 *
 * @param err - Đối tượng lỗi bắt được
 * @param fallback - Thông báo mặc định khi không tìm thấy message
 * @returns Chuỗi thông báo lỗi
 */
export function extractErrorMessage(err: unknown, fallback = 'Hủy đơn hàng thất bại'): string {
  if (!err) return fallback;

  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>;
    const response = errorObj.response as Record<string, unknown> | undefined;
    const responseData = response?.data as Record<string, unknown> | undefined;
    if (typeof responseData?.message === 'string') {
      return responseData.message;
    }

    const data = errorObj.data as Record<string, unknown> | undefined;
    if (typeof data?.message === 'string') {
      return data.message;
    }

    if (typeof errorObj.message === 'string') {
      return errorObj.message;
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  return fallback;
}

/**
 * Kiểm tra xem đơn hàng PENDING đã hết hạn giữ chỗ (10 phút) hay chưa.
 *
 * @param createdAt - Thời gian tạo đơn hàng (ISO string hoặc Date object)
 * @param status - Trạng thái hiện tại của đơn hàng
 * @returns true nếu đơn PENDING đã quá 10 phút, ngược lại false
 */
export function isOrderHoldExpired(
  createdAt: string | Date | undefined,
  status: string | undefined
): boolean {
  if (status !== 'PENDING' || !createdAt) {
    return false;
  }

  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) {
    return false;
  }

  return Date.now() - createdTime > ORDER_HOLD_TIMEOUT_MS;
}
