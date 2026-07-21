import { useId, useState } from "react";
import { Field } from "./Field";

interface FileFieldProps {
  label: string;
  onChange: (file: File | null) => void;
  accept?: string;
  required?: boolean;
}

/** A labeled file picker styled as a dashed dropzone (design_handoff_jax_sales_phase2) — still a
 *  plain `<input type="file">` under the hood (click-to-choose only, no real drag-and-drop handling
 *  added), surfaces the chosen File to the parent (uncontrolled value). */
export function FileField({ label, onChange, accept, required }: FileFieldProps) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <Field label={label}>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-border-strong px-4 py-4 text-[12.5px] text-text-muted transition-[border-color,background] hover:border-navy hover:bg-navy-tint"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        {fileName ?? "Kéo thả tệp hoặc bấm để chọn"}
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        required={required}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          setFileName(file?.name ?? null);
          onChange(file);
        }}
        className="sr-only"
      />
    </Field>
  );
}
