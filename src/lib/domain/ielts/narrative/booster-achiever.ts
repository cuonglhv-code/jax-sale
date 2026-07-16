/**
 * Booster 1 → Achiever 3 narrative (4-block shape). Content data — academic-team-editable. The copy
 * below is representative and sourced from the programme deck; edit here without touching logic.
 */

import type { BoosterAchieverNarrative } from "./types";

export const BOOSTER_ACHIEVER: Record<string, BoosterAchieverNarrative> = {
  B1: {
    family: "booster-achiever",
    startPoint: "Học viên đã có nền tảng cơ bản (~3.5) nhưng còn lúng túng khi vận dụng.",
    bottleneck: "Vốn từ và ngữ pháp chưa đủ để diễn đạt trọn ý trong 4 kỹ năng.",
    howItSolves: "Củng cố nền tảng và mở rộng vốn từ theo chủ đề, luyện phản xạ 4 kỹ năng.",
    skillTable: [
      { skill: "Listening/Reading", progression: "Nghe/đọc ý chính và chi tiết cơ bản", simple: "Bắt được thông tin chính khi tốc độ vừa phải" },
      { skill: "Writing", progression: "Viết câu và đoạn mạch lạc", simple: "Diễn đạt được ý trọn vẹn, ít lỗi cơ bản" },
      { skill: "Speaking", progression: "Trả lời Part 1 tự tin hơn", simple: "Nói trôi chảy các chủ đề quen thuộc" },
    ],
    afterCourse: "Học viên đạt ~4.5, sẵn sàng cho Booster 2.",
  },
  B2: {
    family: "booster-achiever",
    startPoint: "Học viên ở mức ~4.5, cần nâng độ chính xác và độ dài diễn đạt.",
    bottleneck: "Thiếu chiến lược làm bài và độ chính xác ngữ pháp ở câu phức.",
    howItSolves: "Rèn chiến lược từng dạng bài và nâng cấp cấu trúc câu.",
    skillTable: [
      { skill: "Listening/Reading", progression: "Xử lý dạng bài đa dạng hơn", simple: "Ít bị 'bẫy' hơn trong bài thi" },
      { skill: "Writing", progression: "Viết đoạn có lập luận", simple: "Bài viết có bố cục rõ ràng" },
      { skill: "Speaking", progression: "Mở rộng Part 2/3", simple: "Nói dài hơn, có ví dụ" },
    ],
    afterCourse: "Học viên đạt ~5.5, đủ nền cho giai đoạn Achiever.",
  },
  A1: {
    family: "booster-achiever",
    startPoint: "Học viên ~5.5, bắt đầu luyện theo chuẩn thi thật.",
    bottleneck: "Chưa ổn định band ở kỹ năng Writing/Speaking.",
    howItSolves: "Luyện theo tiêu chí chấm thật, có Mock và bài kiểm tra thực tế.",
    skillTable: [
      { skill: "Listening/Reading", progression: "Đạt độ chính xác cao", simple: "Ổn định điểm ở 2 kỹ năng đầu" },
      { skill: "Writing", progression: "Đáp ứng tiêu chí Task Response", simple: "Bài viết đúng trọng tâm đề" },
      { skill: "Speaking", progression: "Phát âm & fluency tốt hơn", simple: "Nói tự nhiên, ít ngập ngừng" },
    ],
    afterCourse: "Học viên đạt ~6.0.",
  },
  A2: {
    family: "booster-achiever",
    startPoint: "Học viên ~6.0, hướng tới 6.5.",
    bottleneck: "Cần nâng độ phức tạp ngôn ngữ và độ chính xác.",
    howItSolves: "Tinh chỉnh theo tiêu chí band 6.5, luyện đề sát thực tế.",
    skillTable: [
      { skill: "Listening/Reading", progression: "Xử lý câu hỏi khó", simple: "Giữ điểm cao ổn định" },
      { skill: "Writing", progression: "Nâng Lexical & Grammar range", simple: "Dùng từ/cấu trúc đa dạng, chính xác" },
      { skill: "Speaking", progression: "Idea development tốt", simple: "Trả lời có chiều sâu" },
    ],
    afterCourse: "Học viên đạt ~6.5.",
  },
  A3: {
    family: "booster-achiever",
    startPoint: "Học viên ~6.5, hướng tới 7.0.",
    bottleneck: "Cần độ tinh tế ngôn ngữ và chiến lược tối ưu điểm.",
    howItSolves: "Luyện chuyên sâu theo band 7.0, tối ưu từng kỹ năng.",
    skillTable: [
      { skill: "Listening/Reading", progression: "Đạt gần tuyệt đối", simple: "Hầu như không mất điểm" },
      { skill: "Writing", progression: "Đạt tiêu chí band 7.0", simple: "Lập luận sắc, ngôn ngữ chuẩn" },
      { skill: "Speaking", progression: "Tự nhiên như người bản xứ ở chủ đề quen", simple: "Nói linh hoạt, tự tin" },
    ],
    afterCourse: "Học viên đạt ~7.0.",
  },
};
