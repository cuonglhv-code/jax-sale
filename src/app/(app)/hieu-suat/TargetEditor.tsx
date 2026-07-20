"use client";

import { useEffect, useState } from "react";
import { useSetPersonalTarget } from "@/hooks/mutations/useSetPersonalTarget";
import { listAssignableEmployees, type AssignableEmployee } from "@/app/actions/tasks/list-assignable-employees";
import { METRIC_KEYS } from "@/lib/data/types";
import { METRIC_LABEL } from "@/lib/domain/vocabulary";
import { Field, SelectField } from "@/components/form";

const inputClass = "rounded border px-2 py-1";

/** US2 (AC-2.1/2.5): a centre manager/admin sets or clears a per-consultant target in their centre. */
export function TargetEditor({ period }: { period: string }) {
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [consultantId, setConsultantId] = useState("");
  const [metricKey, setMetricKey] = useState<(typeof METRIC_KEYS)[number]>(METRIC_KEYS[0]);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setPersonalTarget = useSetPersonalTarget();

  useEffect(() => {
    listAssignableEmployees().then((result) => {
      if ("data" in result) {
        setEmployees(result.data);
        if (result.data[0]) setConsultantId(result.data[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await setPersonalTarget.mutateAsync({
        consultantId,
        period,
        metricKey,
        target: target === "" ? null : Number(target),
      });
      setTarget("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded border p-4">
      <SelectField
        label="Tư vấn viên"
        value={consultantId}
        onChange={setConsultantId}
        options={employees.map((e) => ({ value: e.id, label: e.fullName }))}
      />
      <SelectField
        label="Chỉ số"
        value={metricKey}
        onChange={(v) => setMetricKey(v as (typeof METRIC_KEYS)[number])}
        options={METRIC_KEYS.map((k) => ({ value: k, label: METRIC_LABEL[k] }))}
      />
      <Field label="Mục tiêu (để trống để bỏ mục tiêu)">
        <input
          type="number"
          min={1}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={inputClass}
        />
      </Field>
      <button
        type="submit"
        disabled={setPersonalTarget.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {setPersonalTarget.isPending ? "Đang lưu..." : "Đặt mục tiêu"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
