import type { WritingHintsFailure } from '../types/api.types';
import { WritingHintsContractError } from '../api/writingHintsContract';

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Trích xuất và kiểm tra tính hợp lệ của header Retry-After (tính theo giây).
 * Hỗ trợ header dạng plain object hoặc AxiosHeaders (có method .get()).
 * Chấp nhận số nguyên dương khi milliseconds và retryAt vẫn là số nguyên an toàn.
 */
function parseRetryAfter(headers: unknown, nowMs: number): number | null {
  if (!isRecord(headers)) {
    return null;
  }

  let rawValue: unknown;
  if (typeof (headers as any).get === 'function') {
    rawValue = (headers as any).get('retry-after');
  }
  if (rawValue === undefined || rawValue === null) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'retry-after') {
        rawValue = headers[key];
        break;
      }
    }
  }

  if (typeof rawValue === 'number') {
    if (
      Number.isSafeInteger(rawValue) && rawValue > 0 &&
      Number.isSafeInteger(rawValue * 1000) && Number.isSafeInteger(nowMs + rawValue * 1000)
    ) {
      return rawValue;
    }
    return null;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    const parsed = parseInt(trimmed, 10);
    if (
      Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === trimmed &&
      Number.isSafeInteger(parsed * 1000) && Number.isSafeInteger(nowMs + parsed * 1000)
    ) {
      return parsed;
    }
    return null;
  }

  return null;
}

/**
 * Phân loại lỗi khi gọi API Writing Hints sang cấu trúc WritingHintsFailure chuẩn.
 * Tách biệt HTTP status với business error codes từ backend,
 * chuẩn hóa Retry-After và đảm bảo mọi thông điệp UI đều là cố định và an toàn
 * (tuyệt đối không hiển thị raw backend error message hoặc stack trace).
 */
export function classifyWritingHintsError(error: unknown, nowMs: number): WritingHintsFailure {
  if (error instanceof WritingHintsContractError) {
    return {
      kind: 'contract',
      action: 'retry',
      retryAt: null,
      message: 'Dữ liệu gợi ý nhận được không đúng cấu trúc quy định. Bạn có thể thử lại.',
    };
  }

  if (isRecord(error) && isRecord(error.response)) {
    const status = typeof error.response.status === 'number' ? error.response.status : undefined;
    const data = isRecord(error.response.data) ? error.response.data : undefined;
    const businessCode = data && typeof data.code === 'number' ? data.code : undefined;
    const retryAfter = parseRetryAfter(error.response.headers, nowMs);

    if (status === 409) {
      if (businessCode === 1604) {
        const delaySeconds = retryAfter ?? 10;
        return {
          kind: 'pending',
          action: 'retry',
          retryAt: nowMs + delaySeconds * 1000,
          message: 'Yêu cầu gợi ý đang được xử lý trên máy chủ. Vui lòng chờ giây lát rồi thử lại.',
        };
      }
      if (businessCode === 1605) {
        return {
          kind: 'conflict',
          action: 'reload',
          retryAt: null,
          message: 'Có xung đột trong yêu cầu gợi ý. Vui lòng tải lại trang để tiếp tục.',
        };
      }
      return {
        kind: 'ended',
        action: 'reload',
        retryAt: null,
        message: 'Phiên làm bài đã kết thúc hoặc không còn nhận gợi ý. Vui lòng tải lại trang.',
      };
    }

    if (status === 429) {
      if (businessCode === 1606) {
        const delaySeconds = retryAfter ?? 10;
        return {
          kind: 'rate-limited',
          action: 'none',
          retryAt: nowMs + delaySeconds * 1000,
          message: 'Bạn đang thao tác quá nhanh. Vui lòng đợi hết thời gian chờ trước khi thử lại.',
        };
      }
      return {
        kind: 'quota',
        action: 'none',
        retryAt: null,
        message: 'Hạn mức sử dụng gợi ý AI của bạn đã hết hoặc chưa khả dụng.',
      };
    }

    if (status === 422) {
      if (businessCode === 1607 || businessCode === 1608) {
        return {
          kind: 'language',
          action: 'change-language',
          retryAt: null,
          message: 'Ngôn ngữ yêu cầu không hợp lệ hoặc chưa được hỗ trợ. Vui lòng chọn ngôn ngữ khác.',
        };
      }
      if (businessCode === 1609) {
        return {
          kind: 'context',
          action: 'reload',
          retryAt: null,
          message: 'Nội dung câu hỏi không khả dụng để tạo gợi ý. Vui lòng tải lại trang.',
        };
      }
      return {
        kind: 'context',
        action: 'reload',
        retryAt: null,
        message: 'Dữ liệu yêu cầu không hợp lệ. Vui lòng tải lại trang.',
      };
    }

    if (status === 404) {
      return {
        kind: 'context',
        action: 'reload',
        retryAt: null,
        message: 'Không tìm thấy nội dung câu hỏi yêu cầu gợi ý. Vui lòng tải lại trang.',
      };
    }

    if (status === 413) {
      return {
        kind: 'context',
        action: 'reload',
        retryAt: null,
        message: 'Dung lượng yêu cầu vượt quá giới hạn cho phép. Vui lòng tải lại trang.',
      };
    }

    if (status === 401 || status === 403) {
      return {
        kind: 'access',
        action: 'none',
        retryAt: null,
        message: 'Bạn không có quyền truy cập gợi ý cho bài thi này.',
      };
    }

    if (status === 502 || status === 503 || status === 504) {
      return {
        kind: 'request',
        action: 'retry',
        retryAt: null,
        message: 'Không thể kết nối đến dịch vụ gợi ý AI lúc này. Vui lòng thử lại.',
      };
    }

    return {
      kind: 'request',
      action: 'retry',
      retryAt: null,
      message: 'Không thể kết nối đến dịch vụ gợi ý AI lúc này. Vui lòng thử lại.',
    };
  }

  if (error instanceof Error) {
    if (error.message.includes('quá thời gian') || error.name === 'TimeoutError') {
      return {
        kind: 'request',
        action: 'retry',
        retryAt: null,
        message: 'Yêu cầu gợi ý đã quá thời gian chờ. Vui lòng thử lại.',
      };
    }
    if (error.message.includes('hủy') || error.name === 'CanceledError') {
      return {
        kind: 'request',
        action: 'retry',
        retryAt: null,
        message: 'Yêu cầu đã bị hủy.',
      };
    }
  }

  return {
    kind: 'request',
    action: 'retry',
    retryAt: null,
    message: 'Không thể kết nối đến dịch vụ gợi ý AI lúc này. Vui lòng thử lại.',
  };
}
