export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);

export const formatDateTime = (date: Date | string): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
};

export const formatDiscount = (type: 'PERCENTAGE' | 'FIXED_AMOUNT', value: number): string => {
  if (type === 'PERCENTAGE') {
    return `${value}%`;
  }
  return formatCurrency(value);
};

export const toInputDateTimeLocal = (dateString?: string): string => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
  return localISOTime;
};
