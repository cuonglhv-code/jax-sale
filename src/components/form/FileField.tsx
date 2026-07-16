import { Field } from "./Field";

interface FileFieldProps {
  label: string;
  onChange: (file: File | null) => void;
  accept?: string;
  required?: boolean;
}

/** A labeled `<input type="file">` that surfaces the chosen File to the parent (uncontrolled value). */
export function FileField({ label, onChange, accept, required }: FileFieldProps) {
  return (
    <Field label={label}>
      <input
        type="file"
        accept={accept}
        required={required}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="rounded border px-2 py-1"
      />
    </Field>
  );
}
