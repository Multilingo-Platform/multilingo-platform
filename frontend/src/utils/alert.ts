import Swal, { type SweetAlertIcon } from 'sweetalert2';

export const alertUtil = {
  /**
   * Hiển thị Toast (thông báo nhỏ góc màn hình)
   */
  toast: (message: string, icon: SweetAlertIcon = 'success') => {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      }
    });
    
    Toast.fire({
      icon,
      title: message
    });
  },

  /**
   * Hiển thị Popup (thông báo lớn giữa màn hình)
   */
  popup: (message: string, icon: SweetAlertIcon = 'success', title?: string) => {
    Swal.fire({
      title: title || (icon === 'success' ? 'Thành công' : icon === 'error' ? 'Lỗi' : 'Thông báo'),
      text: message,
      icon,
      confirmButtonColor: 'var(--accent, #3b82f6)',
      confirmButtonText: 'Đóng'
    });
  },

  /**
   * Hiển thị hộp thoại xác nhận (Confirm)
   * Trả về true nếu người dùng chọn Đồng ý
   */
  confirm: async (message: string, confirmText: string = 'Đồng ý', cancelText: string = 'Hủy'): Promise<boolean> => {
    const result = await Swal.fire({
      title: 'Xác nhận',
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--accent, #3b82f6)',
      cancelButtonColor: 'var(--danger, #ef4444)',
      confirmButtonText: confirmText,
      cancelButtonText: cancelText
    });
    
    return result.isConfirmed;
  }
};
