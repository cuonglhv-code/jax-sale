/** Foundation 1/2 narrative. Content data — academic-team-editable. */

import type { FoundationNarrative } from "./types";

export const FOUNDATION: Record<string, FoundationNarrative> = {
  IF1: {
    family: "foundation",
    learn: {
      listeningReading: "Nghe & Đọc: làm quen dạng bài, luyện nghe/đọc thông tin cơ bản.",
      writingSpeaking: "Viết & Nói: viết câu đơn giản, nói về chủ đề quen thuộc.",
      vocabulary: "Từ vựng: 800–1000 từ nền tảng theo chủ đề.",
      grammar: "Ngữ pháp: thì cơ bản, cấu trúc câu nền tảng.",
    },
    goal: "Xây nền tảng vững, đạt ~2.5, sẵn sàng cho Foundation 2.",
  },
  IF2: {
    family: "foundation",
    learn: {
      listeningReading: "Nghe & Đọc: mở rộng dạng bài, tăng tốc độ xử lý.",
      writingSpeaking: "Viết & Nói: viết đoạn ngắn, nói có ý mở rộng.",
      vocabulary: "Từ vựng: mở rộng theo chủ đề học thuật cơ bản.",
      grammar: "Ngữ pháp: câu phức cơ bản, liên từ.",
    },
    goal: "Đạt ~3.5, sẵn sàng bước vào giai đoạn Booster.",
  },
};
