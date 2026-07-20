/**
 * Objection-keyed FAQ (spec 005 Story 5, contracts/content-data.md §faq.ts). Content data —
 * order/priority is editorial and lives here; the component renders chips in file order so a
 * consultant reaches the right answer in one action, never by scanning a list (research D-FAQ).
 */

export interface FaqEntry {
  objectionKey: string;
  chipLabelVi: string;
  questionVi: string;
  answerVi: string;
  priority: number;
}

export const FAQ: readonly FaqEntry[] = [
  {
    objectionKey: "price-too-high",
    chipLabelVi: "Học phí cao?",
    questionVi: "Học phí có cao so với trung tâm khác không?",
    answerVi:
      "Học phí phản ánh lộ trình cá nhân hoá theo từng band, không phải một khóa chung chung. " +
      "Mỗi khóa có mục tiêu đầu ra rõ ràng và cam kết bằng văn bản đi kèm.",
    priority: 1,
  },
  {
    objectionKey: "duration-too-long",
    chipLabelVi: "Thời gian có lâu không?",
    questionVi: "Lộ trình này có mất quá nhiều thời gian không?",
    answerVi:
      "Thời gian hiển thị là khoảng ước tính dựa trên nhịp học thực tế (bao gồm nghỉ lễ, học bù). " +
      "Học chắc từng bước giúp tránh việc học lại — nhanh hơn về lâu dài so với việc nhảy cóc rồi hổng kiến thức.",
    priority: 2,
  },
  {
    objectionKey: "why-not-skip-level",
    chipLabelVi: "Có thể bỏ qua cấp độ?",
    questionVi: "Con tôi có thể học thẳng lên trình độ cao hơn không?",
    answerVi:
      "Thang khóa học của Jaxtina được thiết kế để không bỏ qua cấp độ — mỗi khóa giải quyết đúng " +
      "nút thắt của giai đoạn đó. Bỏ qua một bước thường khiến học viên hổng nền tảng ở band cao hơn.",
    priority: 3,
  },
  {
    objectionKey: "guarantee-conditions",
    chipLabelVi: "Điều kiện cam kết là gì?",
    questionVi: "Cam kết đầu ra có điều kiện gì không?",
    answerVi:
      "Có hai mức cam kết riêng biệt: chứng nhận hoàn thành khóa học và cam kết đầu ra bằng văn bản — " +
      "mỗi mức có điều kiện chuyên cần và bài tập riêng (xem mục Cam kết đầu ra & điều kiện).",
    priority: 4,
  },
  {
    objectionKey: "no-placement-test-yet",
    chipLabelVi: "Chưa test đầu vào thì sao?",
    questionVi: "Chưa làm bài test đầu vào thì lộ trình này có chính xác không?",
    answerVi:
      "Lộ trình hiện tại là dự kiến dựa trên band ước tính — chúng tôi luôn khuyến khích đặt lịch " +
      "test đầu vào miễn phí để có lộ trình chính xác trước khi cam kết học phí.",
    priority: 5,
  },
  {
    objectionKey: "support-outside-class",
    chipLabelVi: "Ngoài giờ học có hỗ trợ gì?",
    questionVi: "Ngoài giờ học trên lớp, học viên được hỗ trợ thêm gì?",
    answerVi:
      "Học viên có LMS theo dõi tiến độ, AI Speaking Coach luyện nói, thư viện số/E-book, kiểm tra " +
      "định kì và CLB Speaking miễn phí — xem chi tiết ở mục Hệ sinh thái hỗ trợ.",
    priority: 6,
  },
];
