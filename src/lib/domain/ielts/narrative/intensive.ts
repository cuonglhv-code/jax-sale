/** Luyện đề Intensive narrative (3-column shape). Content data — academic-team-editable. */

import type { IntensiveNarrative } from "./types";

export const INTENSIVE: Record<string, IntensiveNarrative> = {
  INT: {
    family: "intensive",
    audience: "Học viên đã đạt nền ~5.5+ cần bứt tốc điểm số trước kỳ thi.",
    goal: "Tối ưu chiến lược làm bài, nâng ~0.5 overall qua luyện đề chuyên sâu.",
    columns: {
      speaking: "NÓI: luyện phản xạ, phát âm và triển khai ý theo tiêu chí band mục tiêu.",
      writing: "VIẾT: luyện Task 1 & Task 2 theo tiêu chí chấm, sửa bài chi tiết.",
      examStrategy: "CHIẾN LƯỢC THI: phân bổ thời gian, xử lý dạng bẫy, tối ưu điểm từng phần.",
    },
  },
};
