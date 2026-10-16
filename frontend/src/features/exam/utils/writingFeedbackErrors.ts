import { WritingFeedbackContractError } from '../api/writingFeedbackContract';

export type WritingFeedbackErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'contract'
  | 'timeout'
  | 'network'
  | 'server'
  | 'unknown';

export interface WritingFeedbackLoadError {
  kind: WritingFeedbackErrorKind;
  status?: number;
  message: string;
  isTransient: boolean;
}

export const ALLOWED_REASON_CODES = new Set([
  'TOO_SHORT',
  'ESSAY_TOO_LONG',
  'LEGACY_NO_JOB',
  'MALFORMED_FEEDBACK',
  'UNSUPPORTED_LANGUAGE',
  'VISUAL_CONTEXT_UNSUPPORTED',
  'UNSUPPORTED_MEDIA',
  'INVALID_IMAGE_URL',
  'IMAGE_TOO_LARGE',
  'IMAGE_INVALID',
  'IMAGE_UNAVAILABLE',
  'IMAGE_SOURCE_NOT_ALLOWED',
  'QUOTA_UNAVAILABLE',
  'PROVIDER_DISABLED',
  'FEATURE_DISABLED',
]);

export const REASON_CODE_MESSAGES: Record<string, string> = {
  TOO_SHORT: 'Bài viết quá ngắn để hệ thống có thể chấm và nhận xét chi tiết.',
  ESSAY_TOO_LONG: 'Bài viết vượt quá độ dài tối đa cho phép.',
  LEGACY_NO_JOB: 'Bài thi cũ chưa có dữ liệu chấm chi tiết từ AI.',
  MALFORMED_FEEDBACK: 'Không thể phân tích phản hồi từ mô hình chấm điểm.',
  UNSUPPORTED_LANGUAGE: 'Ngôn ngữ bài viết chưa được hỗ trợ chấm điểm.',
  VISUAL_CONTEXT_UNSUPPORTED: 'Định dạng hình ảnh hoặc ngữ cảnh không được hỗ trợ.',
  UNSUPPORTED_MEDIA: 'Phương tiện truyền thông trong đề bài không được hỗ trợ.',
  INVALID_IMAGE_URL: 'Đường dẫn hình ảnh không hợp lệ.',
  IMAGE_TOO_LARGE: 'Kích thước hình ảnh vượt quá giới hạn cho phép.',
  IMAGE_INVALID: 'Tệp hình ảnh không hợp lệ hoặc bị lỗi.',
  IMAGE_UNAVAILABLE: 'Không thể tải được hình ảnh của đề bài.',
  IMAGE_SOURCE_NOT_ALLOWED: 'Nguồn hình ảnh không được phép truy cập.',
  QUOTA_UNAVAILABLE: 'Hạn ngạch chấm điểm AI tạm thời chưa khả dụng. Vui lòng thử lại sau.',
  PROVIDER_DISABLED: 'Dịch vụ chấm điểm AI hiện đang tạm tắt.',
  FEATURE_DISABLED: 'Tính năng nhận xét bài viết đang tạm dừng phục vụ.',
};

export const DEFAULT_SAFE_FEEDBACK_MESSAGE = 'Không có nhận xét chi tiết cho bài viết này.';

export const REFRESH_WARNING_MESSAGE =
  'Chưa thể cập nhật nhận xét mới nhất. Đang hiển thị kết quả trước đó.';

export function mapReasonCodeToMessage(reasonCode: string | null | undefined): string {
  if (typeof reasonCode === 'string' && ALLOWED_REASON_CODES.has(reasonCode)) {
    return REASON_CODE_MESSAGES[reasonCode];
  }
  return DEFAULT_SAFE_FEEDBACK_MESSAGE;
}

export function classifyWritingFeedbackError(error: unknown): WritingFeedbackLoadError {
  if (error instanceof WritingFeedbackContractError) {
    return {
      kind: 'contract',
      message: 'Dữ liệu nhận xét nhận được không đúng cấu trúc quy định. Bạn có thể thử lại.',
      isTransient: false,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    // Axios response error
    if (typeof err.response === 'object' && err.response !== null) {
      const response = err.response as Record<string, unknown>;
      const status = typeof response.status === 'number' ? response.status : undefined;

      if (status === 401) {
        return {
          kind: 'unauthorized',
          status: 401,
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          isTransient: false,
        };
      }
      if (status === 403) {
        return {
          kind: 'forbidden',
          status: 403,
          message: 'Bạn không có quyền xem nhận xét của bài thi này.',
          isTransient: false,
        };
      }
      if (status === 404) {
        return {
          kind: 'not_found',
          status: 404,
          message: 'Không tìm thấy bài thi hoặc phần thi yêu cầu.',
          isTransient: false,
        };
      }
      if (status === 400) {
        return {
          kind: 'invalid_request',
          status: 400,
          message: 'Yêu cầu xem nhận xét không hợp lệ.',
          isTransient: false,
        };
      }
      if (status !== undefined && status >= 500 && status <= 599) {
        return {
          kind: 'server',
          status,
          message: 'Hệ thống chấm điểm đang gặp sự cố. Vui lòng thử lại sau.',
          isTransient: true,
        };
      }
      if (status !== undefined && status >= 400 && status <= 499) {
        return {
          kind: 'invalid_request',
          status,
          message: 'Yêu cầu không hợp lệ. Vui lòng thử lại.',
          isTransient: false,
        };
      }
    }

    // Timeout / abort / network error
    const code = typeof err.code === 'string' ? err.code : '';

    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      return {
        kind: 'timeout',
        message: 'Yêu cầu tải nhận xét quá thời gian. Vui lòng thử lại.',
        isTransient: true,
      };
    }
    if (code === 'ERR_CANCELED') {
      return {
        kind: 'unknown',
        message: 'Yêu cầu đã bị hủy.',
        isTransient: true,
      };
    }
    if (code === 'ERR_NETWORK' || (err.isAxiosError === true && !err.response)) {
      return {
        kind: 'network',
        message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
        isTransient: true,
      };
    }
  }

  return {
    kind: 'unknown',
    message: 'Không thể tải nhận xét viết. Vui lòng thử lại sau.',
    isTransient: true,
  };
}
