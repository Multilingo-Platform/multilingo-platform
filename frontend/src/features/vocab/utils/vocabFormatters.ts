/**
 * Tiện ích định dạng số giây sang định dạng mm:ss
 * @param seconds Số giây (ví dụ: 65)
 * @returns Chuỗi định dạng (ví dụ: "01:05")
 */
export const formatSecondsToMmSs = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Tính tỷ lệ phần trăm chính xác
 * @param correct Số lượng đúng
 * @param total Tổng số câu
 * @returns Tỷ lệ làm tròn 1 chữ số thập phân (ví dụ: 85.5)
 */
export const calculateAccuracyPercent = (correct: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
};
