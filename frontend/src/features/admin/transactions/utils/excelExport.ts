import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { AdminTransaction } from '../../types/adminTypes';

export const exportTransactionsToExcel = async (
  transactions: AdminTransaction[],
  fileNamePrefix = 'Bao_cao_giao_dich_VNPAY'
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Multilingo Admin Portal';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Giao Dịch VNPAY', {
    views: [{ showGridLines: true }],
  });

  // Title Row
  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BÁO CÁO ĐỐI SOÁT GIAO DỊCH VNPAY - MULTILINGO PLATFORM';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFD97706' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 32;

  // Metadata Row
  worksheet.mergeCells('A2:I2');
  const metaCell = worksheet.getCell('A2');
  metaCell.value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Tổng số bản ghi: ${transactions.length}`;
  metaCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  // Header Row
  const headers = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Mã Đơn Hàng (vnp_TxnRef)', key: 'vnpTxnRef', width: 26 },
    { header: 'Mã GD VNPAY', key: 'vnpTransactionNo', width: 20 },
    { header: 'Học Viên (Email)', key: 'userEmail', width: 28 },
    { header: 'Gói Cước', key: 'planName', width: 18 },
    { header: 'Số Tiền (VND)', key: 'amount', width: 18 },
    { header: 'Phương Thức', key: 'paymentMethod', width: 15 },
    { header: 'Trạng Thái', key: 'status', width: 16 },
    { header: 'Thời Gian Giao Dịch', key: 'createdAt', width: 22 },
  ];

  const headerRow = worksheet.getRow(4);
  headerRow.height = 26;

  headers.forEach((h, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = h.header;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD97706' }, // Amber #d97706
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    worksheet.getColumn(index + 1).width = h.width;
  });

  // Data Rows
  transactions.forEach((tx, idx) => {
    const row = worksheet.getRow(5 + idx);
    row.height = 22;

    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(2).value = tx.vnpTxnRef;
    row.getCell(2).alignment = { vertical: 'middle' };

    row.getCell(3).value = tx.vnpTransactionNo || '-';
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(4).value = tx.userEmail || `User #${tx.userId}`;
    row.getCell(4).alignment = { vertical: 'middle' };

    row.getCell(5).value = tx.planName || 'VIP';
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(6).value = Number(tx.amount);
    row.getCell(6).numFmt = '#,##0 "₫"';
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(7).value = tx.paymentMethod || 'VNPAY';
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(8).value = tx.status;
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    if (tx.status === 'SUCCESS') {
      row.getCell(8).font = { color: { argb: 'FF16A34A' }, bold: true };
    } else if (tx.status === 'FAILED') {
      row.getCell(8).font = { color: { argb: 'FFDC2626' }, bold: true };
    }

    row.getCell(9).value = new Date(tx.createdAt).toLocaleString('vi-VN');
    row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };

    // Apply borders
    for (let c = 1; c <= 9; c++) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
  });

  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${fileNamePrefix}_${timestamp}.xlsx`);
};
