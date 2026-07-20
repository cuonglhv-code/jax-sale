/**
 * US7 (T057, contracts/notifications.md): Vietnamese transactional email content for the four HR
 * notification triggers. Plain-text-content modules (matching `SUMMIT_COPY`'s style, R10) rather
 * than `@react-email/components` JSX — simpler to keep the prop types narrow and auditable, and
 * this slice's emails are a few lines of text + a link, so no component layer is needed.
 *
 * CRITICAL (FR-037): every prop type below is deliberately narrow. None may ever gain a
 * `content`/`buffer`/`attachment`/`file` field — that is the structural guarantee that no code path
 * can place a medical document (or any attachment) in an email body. The us7-notify test asserts
 * this structurally (checks the actual call-argument keys), not just "we didn't add one".
 */

/** Trigger: request submitted → email the centre's approver(s) (contracts/notifications.md). */
export interface SubmissionNotifyProps {
  approverName: string;
  submitterName: string;
  formTypeLabel: string;
  startDate: string | null;
  viewUrl: string;
}

export function submissionNotifySubject(props: SubmissionNotifyProps): string {
  return `[Jaxtina] Yêu cầu ${props.formTypeLabel} mới cần duyệt`;
}

export function submissionNotifyBody(props: SubmissionNotifyProps): string {
  const dateLine = props.startDate ? `\nNgày bắt đầu: ${props.startDate}` : "";
  return (
    `Chào ${props.approverName},\n\n` +
    `${props.submitterName} vừa gửi một yêu cầu "${props.formTypeLabel}" cần bạn duyệt.` +
    `${dateLine}\n\n` +
    `Xem chi tiết và duyệt tại: ${props.viewUrl}\n\n` +
    `Jaxtina English`
  );
}

/** Trigger: decision made (approve/reject) → email the submitter. */
export interface DecisionNotifyProps {
  submitterName: string;
  formTypeLabel: string;
  decision: "approve" | "reject";
  reason: string | null;
  viewUrl: string;
}

export function decisionNotifySubject(props: DecisionNotifyProps): string {
  const verb = props.decision === "approve" ? "được duyệt" : "bị từ chối";
  return `[Jaxtina] Yêu cầu ${props.formTypeLabel} của bạn đã ${verb}`;
}

export function decisionNotifyBody(props: DecisionNotifyProps): string {
  const verb = props.decision === "approve" ? "ĐÃ ĐƯỢC DUYỆT" : "BỊ TỪ CHỐI";
  const reasonLine = props.reason ? `\nLý do: ${props.reason}` : "";
  return (
    `Chào ${props.submitterName},\n\n` +
    `Yêu cầu "${props.formTypeLabel}" của bạn ${verb}.${reasonLine}\n\n` +
    `Xem chi tiết tại: ${props.viewUrl}\n\n` +
    `Jaxtina English`
  );
}

/** Trigger: cover nominated → email the nominee. */
export interface CoverNominationNotifyProps {
  nomineeName: string;
  submitterName: string;
  sessionSummary: string;
  respondUrl: string;
}

export function coverNominationNotifySubject(): string {
  return "[Jaxtina] Bạn được đề cử dạy thay";
}

export function coverNominationNotifyBody(props: CoverNominationNotifyProps): string {
  return (
    `Chào ${props.nomineeName},\n\n` +
    `${props.submitterName} đã đề cử bạn dạy thay cho buổi học: ${props.sessionSummary}.\n\n` +
    `Vui lòng phản hồi (nhận/từ chối) tại: ${props.respondUrl}\n\n` +
    `Jaxtina English`
  );
}

/** Trigger: a money form is approved → email accounting (super_admin, v1). */
export interface MoneyFormApprovedNotifyProps {
  formTypeLabel: string;
  submitterName: string;
  amount: number | null;
  viewUrl: string;
}

export function moneyFormApprovedNotifySubject(props: MoneyFormApprovedNotifyProps): string {
  return `[Jaxtina] Yêu cầu ${props.formTypeLabel} đã duyệt — cần xử lý kế toán`;
}

export function moneyFormApprovedNotifyBody(props: MoneyFormApprovedNotifyProps): string {
  const amountLine = props.amount !== null ? `\nSố tiền: ${props.amount.toLocaleString("vi-VN")} VNĐ` : "";
  return (
    `Chào bộ phận kế toán,\n\n` +
    `Yêu cầu "${props.formTypeLabel}" của ${props.submitterName} đã được duyệt.${amountLine}\n\n` +
    `Xem chi tiết tại: ${props.viewUrl}\n\n` +
    `Jaxtina English`
  );
}

/** Trigger: pending-reminder cron digest → email a centre's approver(s). */
export interface PendingReminderNotifyProps {
  approverName: string;
  pendingCount: number;
  queueUrl: string;
}

export function pendingReminderNotifySubject(): string {
  return "[Jaxtina] Nhắc nhở: có yêu cầu đang chờ duyệt";
}

export function pendingReminderNotifyBody(props: PendingReminderNotifyProps): string {
  return (
    `Chào ${props.approverName},\n\n` +
    `Hiện có ${props.pendingCount} yêu cầu đang chờ bạn duyệt.\n\n` +
    `Xem hàng chờ duyệt tại: ${props.queueUrl}\n\n` +
    `Jaxtina English`
  );
}
