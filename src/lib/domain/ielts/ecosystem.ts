/**
 * Hệ sinh thái hỗ trợ — the support-ecosystem list for the PDF (spec §5 PDF section 5; AC-6.5).
 * Content data.
 */

export interface EcosystemItem {
  name: string;
  description: string;
}

export const ECOSYSTEM: readonly EcosystemItem[] = [
  { name: "LMS Tracking", description: "Theo dõi tiến độ học tập trên hệ thống LMS." },
  { name: "AI Speaking Coach PRE(F)C", description: "Luyện nói với trợ lý AI theo khung PRE(F)C." },
  { name: "Thư viện số & E-book", description: "Kho tài liệu số và e-book luyện thi." },
  { name: "Hệ thống bài kiểm tra định kì", description: "Đánh giá năng lực định kì theo lộ trình." },
  { name: "CLB Speaking", description: "Câu lạc bộ luyện nói với cộng đồng học viên." },
];
