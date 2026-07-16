/**
 * Vietnamese display labels for IELTS-domain enums (content data — FR-CONTENT-02). Co-located with
 * the IELTS content store (the single source for THIS domain's vocabulary), editable without touching
 * engine/UI logic. Enum string values are the contract; only display text lives here.
 */

import type { Band } from "./bands";

export const AUDIENCES = ["THCS", "THPT", "SINH_VIEN", "NGUOI_DI_LAM", "MAT_GOC"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  THCS: "Học sinh THCS",
  THPT: "Học sinh THPT",
  SINH_VIEN: "Sinh viên",
  NGUOI_DI_LAM: "Người đi làm",
  MAT_GOC: "Mất gốc tiếng Anh",
};

export const INTENSITIES = ["TIEU_CHUAN", "TANG_CUONG"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const INTENSITY_LABEL: Record<Intensity, string> = {
  TIEU_CHUAN: "Tiêu chuẩn",
  TANG_CUONG: "Tăng cường",
};

export const EXAM_PURPOSES = ["XET_TUYEN_DH", "TOT_NGHIEP", "DU_HOC_HB", "CHUAN_B2", "KHAC"] as const;
export type ExamPurpose = (typeof EXAM_PURPOSES)[number];

export const EXAM_PURPOSE_LABEL: Record<ExamPurpose, string> = {
  XET_TUYEN_DH: "Xét tuyển ĐH",
  TOT_NGHIEP: "Tốt nghiệp",
  DU_HOC_HB: "Du học – học bổng",
  CHUAN_B2: "Chuẩn B2",
  KHAC: "Khác",
};

/** Band display label (the lowest option reads "Chưa có nền"). */
export function bandLabel(band: Band): string {
  if (band === "~A1") return "Chưa có nền (~A1)";
  if (band === "below A1") return "Dưới A1";
  return band;
}
