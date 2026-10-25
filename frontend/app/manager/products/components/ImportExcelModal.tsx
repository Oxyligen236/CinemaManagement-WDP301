'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  ExcelStockMode,
  ImportItemsExcelRes,
  concessionApi,
} from '@/lib/api/manager/concession';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportExcelModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [stockMode, setStockMode] = useState<ExcelStockMode>('OVERWRITE');
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ImportItemsExcelRes | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setErrorMsg(null);
  };

  const handleFileSelect = (selectedFile?: File | null) => {
    if (!selectedFile) return;

    const validExtensions = ['.xlsx', '.xls'];
    const fileName = selectedFile.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setErrorMsg('Vui lòng chỉ tải lên file Excel định dạng .xlsx hoặc .xls');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMsg('Dung lượng file tối đa là 5MB');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const blob = await concessionApi.downloadExcelTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Kiem_Ke_SanPham_FB.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể tải file mẫu Excel. Vui lòng thử lại sau.',
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Vui lòng chọn một file Excel kiểm kê để tiếp tục');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await concessionApi.importExcel(file, stockMode);
      setResult(res);
      onSuccess();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Có lỗi xảy ra trong quá trình xử lý file Excel',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-[#dad2b4] shadow-2xl my-8">
        {/* Header */}
        <div className="bg-[#231f20] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#a3e635]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-[#a3e635]" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a3e635]">
                NHẬP DỮ LIỆU HÀNG LOẠT
              </p>
              <h2 className="text-[17px] font-bold text-white mt-0.5">
                Import Excel Danh sách Món & Kiểm kê
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#dad2b4] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-[#fef2f2] border border-[#fca5a5] p-3 text-[13px] text-[#b91c1c]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#da291c]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleUpload} className="space-y-5">
              {/* Download Template Bar */}
              <div className="flex items-center justify-between bg-[#efebdb] border border-[#dad2b4] p-3.5">
                <div>
                  <p className="text-[13px] font-bold text-[#231f20]">
                    Chưa có mẫu file nhập dữ liệu?
                  </p>
                  <p className="text-[11px] text-[#6f6247]">
                    Tải về file Excel mẫu chuẩn (.xlsx) với các cột dữ liệu mẫu minh họa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#dad2b4] bg-white text-[12px] font-bold text-[#231f20] hover:bg-[#efebdb] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {downloadingTemplate ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-[#da291c]" />
                  )}
                  <span>Tải file mẫu Excel</span>
                </button>
              </div>

              {/* Drag & Drop Zone */}
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247] mb-2">
                  Chọn file Excel kiểm kê (.xlsx, .xls)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-[#a3e635] bg-[#f7fee7]'
                      : file
                      ? 'border-[#a3e635] bg-[#fcfbfa]'
                      : 'border-[#dad2b4] bg-[#fcfbfa] hover:bg-[#efebdb]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) =>
                      handleFileSelect(e.target.files?.[0] || null)
                    }
                  />

                  {file ? (
                    <div className="flex flex-col items-center">
                      <FileSpreadsheet className="h-10 w-10 text-[#15803d] mb-2" />
                      <p className="text-[14px] font-bold text-[#231f20]">
                        {file.name}
                      </p>
                      <p className="text-[12px] text-[#666] mt-0.5">
                        Kích thước: {(file.size / 1024).toFixed(1)} KB — Bấm để chọn lại file khác
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-10 w-10 text-[#9d9580] mb-2" />
                      <p className="text-[14px] font-bold text-[#231f20]">
                        Kéo thả file Excel vào đây, hoặc click để duyệt file
                      </p>
                      <p className="text-[12px] text-[#888] mt-1">
                        Hỗ trợ .xlsx, .xls tối đa 5MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247] mb-2">
                  Chế độ cập nhật tồn kho
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3.5 border cursor-pointer transition-all ${
                      stockMode === 'OVERWRITE'
                        ? 'border-[#a3e635] bg-[#f7fee7]'
                        : 'border-[#dad2b4] bg-white hover:bg-[#fcfbfa]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stockMode"
                      value="OVERWRITE"
                      checked={stockMode === 'OVERWRITE'}
                      onChange={() => setStockMode('OVERWRITE')}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-[13px] font-bold text-[#231f20]">
                        Chốt tồn kho theo kiểm kê (Ghi đè)
                      </p>
                      <p className="text-[11px] text-[#666] mt-0.5">
                        Khuyến nghị cho kiểm kê định kỳ: Số lượng trong Excel sẽ thay thế tồn kho cũ trong hệ thống.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 border cursor-pointer transition-all ${
                      stockMode === 'ACCUMULATE'
                        ? 'border-[#a3e635] bg-[#f7fee7]'
                        : 'border-[#dad2b4] bg-white hover:bg-[#fcfbfa]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stockMode"
                      value="ACCUMULATE"
                      checked={stockMode === 'ACCUMULATE'}
                      onChange={() => setStockMode('ACCUMULATE')}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-[13px] font-bold text-[#231f20]">
                        Cộng dồn vào tồn kho hiện tại
                      </p>
                      <p className="text-[11px] text-[#666] mt-0.5">
                        Khuyến nghị khi nhập hàng mới: Số lượng trong Excel sẽ được cộng thêm vào tồn kho hiện tại.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-[#efebdb] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border border-[#dad2b4] bg-[#efebdb] text-[13px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading || !file}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-[#a3e635] text-[13px] font-bold text-[#18181b] hover:bg-[#84cc16] shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{loading ? 'Đang đọc và xử lý...' : 'Bắt đầu Import'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Result Summary View */
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 bg-[#f0fdf4] border border-[#bbf7d0]">
                <CheckCircle2 className="h-6 w-6 text-[#15803d] shrink-0" />
                <div>
                  <h3 className="text-[14px] font-bold text-[#15803d]">
                    Hoàn tất xử lý file Excel
                  </h3>
                  <p className="text-[12px] text-[#666]">
                    {result.message || 'Hệ thống đã cập nhật danh sách mặt hàng F&B thành công.'}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#fcfbfa] border border-[#dad2b4] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-[#888]">
                    Tổng số dòng
                  </p>
                  <p className="text-[20px] font-black text-[#231f20]">
                    {result.totalRows}
                  </p>
                </div>
                <div className="bg-[#f0fdf4] border border-[#bbf7d0] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-[#15803d]">
                    Thành công
                  </p>
                  <p className="text-[20px] font-black text-[#15803d]">
                    {result.successCount}
                  </p>
                </div>
                <div className="bg-[#fef2f2] border border-[#fca5a5] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-[#b91c1c]">
                    Dòng lỗi
                  </p>
                  <p className="text-[20px] font-black text-[#b91c1c]">
                    {result.errorCount}
                  </p>
                </div>
                <div className="bg-[#efebdb] border border-[#dad2b4] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-[#6f6247]">
                    Tạo mới / Cập nhật
                  </p>
                  <p className="text-[16px] font-bold text-[#231f20] mt-1">
                    +{result.createdCount} / ~{result.updatedCount}
                  </p>
                </div>
              </div>

              {/* Error Rows Table */}
              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[#b91c1c]">
                    Chi tiết các dòng bị lỗi ({result.errors.length}):
                  </p>
                  <div className="max-h-48 overflow-y-auto border border-[#fca5a5] bg-[#fff5f5]">
                    <table className="w-full text-left text-[12px]">
                      <thead className="bg-[#fee2e2] text-[#991b1b] uppercase text-[10px] sticky top-0 font-bold">
                        <tr>
                          <th className="py-2 px-3">Dòng</th>
                          <th className="py-2 px-3">Tên sản phẩm</th>
                          <th className="py-2 px-3">Nguyên nhân lỗi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#fed7d7]">
                        {result.errors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-white/60">
                            <td className="py-2 px-3 font-bold text-[#b91c1c]">
                              #{err.rowNumber}
                            </td>
                            <td className="py-2 px-3 text-[#231f20]">
                              {err.name || '(Trống)'}
                            </td>
                            <td className="py-2 px-3 text-[#da291c]">
                              {err.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-4 border-t border-[#efebdb] flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#dad2b4] bg-[#efebdb] text-[12px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Import file khác</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-[#231f20] text-[13px] font-bold text-white hover:bg-black transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
