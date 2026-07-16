/**
 * The TWO commitment thresholds (spec §Domain data; FR-PDF-02, SC-007). They are DIFFERENT
 * guarantees and MUST render distinctly and verbatim — never merged or approximated. Content data.
 *
 * This module deliberately exposes them as two separate objects so no code path can accidentally
 * conflate them.
 */

export interface CommitmentThreshold {
  key: "completion-certificate" | "written-output-guarantee";
  title: string;
  conditions: string[];
}

/** Chứng nhận hoàn thành khóa học. */
export const COMPLETION_CERTIFICATE: CommitmentThreshold = {
  key: "completion-certificate",
  title: "Chứng nhận hoàn thành khóa học",
  conditions: [
    "Overall đạt ≥ band đầu ra của khóa",
    "Tỉ lệ chuyên cần ≥ 90%",
    "Hoàn thành bài tập về nhà ≥ 90%",
  ],
};

/** Cam kết đầu ra bằng văn bản — STRICTER, and separate from the completion certificate. */
export const WRITTEN_OUTPUT_GUARANTEE: CommitmentThreshold = {
  key: "written-output-guarantee",
  title: "Cam kết đầu ra bằng văn bản",
  conditions: [
    "Hoàn thành bài tập về nhà ≥ 95%",
    "Vắng mặt không quá 1 buổi mỗi khóa",
  ],
};

/** Both, as an ordered pair for rendering. Order is fixed; they are never combined into one block. */
export const COMMITMENT_THRESHOLDS: readonly CommitmentThreshold[] = [
  COMPLETION_CERTIFICATE,
  WRITTEN_OUTPUT_GUARANTEE,
];
