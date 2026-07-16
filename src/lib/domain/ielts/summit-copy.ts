/**
 * Summit UI copy (spec 005 FR-027, contracts/content-data.md). EVERY user-facing Vietnamese
 * string of the Summit surface lives here — components import, never inline (Constitution VII).
 * Content data: marketing/academic staff edit this file only.
 */

export const SUMMIT_COPY = {
  /** Mode B — the literal, named caveat (Constitution III; FR-013). */
  provisionalCaveat: "Lộ trình dự kiến — cần xác nhận bằng kết quả test đầu vào",
  provisionalMarker: "Điểm xuất phát ước tính",
  provisionalEstimatePrefix: "Ước tính:",
  bookPlacementCta: "Đặt lịch test đầu vào miễn phí",
  measuredMarker: "Kết quả test đầu vào",

  /** Opening. */
  studentNameLabel: "Tên học viên",
  currentBandLabel: "Band hiện tại",
  targetBandLabel: "Band mục tiêu",
  modeLabel: "Trạng thái test đầu vào",
  modeMeasured: "Đã có kết quả test",
  modeEstimated: "Chưa test — ước tính",
  testDateLabel: "Ngày test (không bắt buộc)",
  invalidTargetPrompt: "Band mục tiêu phải cao hơn band hiện tại. Vui lòng điều chỉnh.",

  /** Engine advisories (consultant-facing, never in the document). */
  advisoryBeyondLadder:
    "Band mục tiêu vượt mức đảm bảo của thang chuẩn (Achiever 3 + Luyện đề). Đề xuất tư vấn trực tiếp về lộ trình nâng cao.",

  /** Summary surface. */
  summaryTitle: "Tổng quan lộ trình",
  totalSessionsLabel: "Tổng số buổi",
  durationLabel: "Thời gian dự kiến",
  projectedFinishLabel: "Dự kiến hoàn thành",
  totalPriceLabel: "Tổng học phí",
  preSFlexibleNote: "Pre-S học linh hoạt theo trình độ — thời lượng không tính vào tổng trên.",
  excludesUnpricedNote: "Chưa gồm học phí khóa cần tư vấn thêm.",
  weeksUnit: "tuần",
  monthsUnit: "tháng",
  sessionsUnit: "buổi",
  flexibleDuration: "linh hoạt",

  /** Stage panel. */
  compositionTitle: "Cấu trúc khóa học",
  priceLabel: "Học phí",
  progressionCoreLabel: "Progression cốt lõi",
  progressionSimpleLabel: "Cách hiểu đơn giản",

  /** Review & send. */
  reviewTitle: "Xem lại & gửi lộ trình",
  reviewSubtitle: "Bản xem trước dưới đây chính là tài liệu học viên sẽ nhận.",
  consultantNoteLabel: "Ghi chú từ tư vấn viên",
  departsLadderWarning:
    "Lộ trình đã chỉnh tay — không còn theo thang chuẩn Jaxtina. Vui lòng kiểm tra kỹ trước khi gửi.",
  removeCourse: "Bỏ khóa",
  moveUp: "Chuyển lên",
  moveDown: "Chuyển xuống",
  captureTitle: "Thông tin gửi",
  studentEmailLabel: "Email học viên",
  studentPhoneLabel: "SĐT học viên (không bắt buộc)",
  consultantNameLabel: "Tên tư vấn viên",
  consultantPhoneLabel: "SĐT tư vấn viên (không bắt buộc)",
  consultantEmailLabel: "Email tư vấn viên (không bắt buộc)",
  sendButton: "Gửi lộ trình qua email",
  sending: "Đang gửi…",
  sendSuccess: "Đã gửi lộ trình cho học viên và lưu bản lưu trữ.",
  sendFailureTitle: "Gửi không thành công",
  sendFailureBody:
    "Lộ trình và toàn bộ thông tin đã được giữ nguyên. Kiểm tra kết nối mạng rồi gửi lại — không cần nhập lại gì.",
  retrySend: "Gửi lại",
  downloadFallback: "Tải PDF & mở email nháp",

  /** Reset. */
  resetButton: "Buổi tư vấn mới",
  resetUnsentWarning:
    "Lộ trình đã chuẩn bị nhưng CHƯA gửi. Bắt đầu buổi mới sẽ xoá toàn bộ. Tiếp tục?",
  resetConfirm: "Xoá và bắt đầu mới",
  resetCancel: "Quay lại",

  /** Email templates. */
  emailSubject: "Lộ trình IELTS cá nhân hoá từ Jaxtina",
  emailBody: (studentName: string) =>
    `Chào ${studentName},\n\nJaxtina English gửi bạn lộ trình học IELTS cá nhân hoá (file PDF đính kèm).\n\nHẹn gặp bạn trên hành trình chinh phục IELTS!\nJaxtina – IELTS Made SIMPLE`,

  /** Secondary content rail. */
  railEcosystem: "Hệ sinh thái hỗ trợ",
  railCommitments: "Cam kết đầu ra & điều kiện",
  railFaq: "Câu hỏi thường gặp",
  railBack: "Quay lại lộ trình",

  /** Proof at the summit. */
  proofTitle: "Học viên Jaxtina đã chinh phục",
  proofExactMatch: "Hành trình giống hệt lộ trình này",
  proofNearestMatch: "Hành trình tương tự",

  /** PDF-only strings. */
  pdfCoverTitle: "Lộ trình học IELTS cá nhân hoá",
  pdfStudentLabel: "Học viên",
  pdfDurationLabel: "Tổng thời gian dự kiến",
  pdfTimelineTitle: "Lộ trình khóa học (đọc từ dưới lên)",
  pdfCourseDetailTitle: "Chi tiết từng khóa",
  pdfPriceLabel: "Học phí",
} as const;
