import { Field } from "./Field";

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  min?: string;
  max?: string;
}

/** A labeled `<input type="date">` bound to an ISO-date string value. */
export function DateField({ label, value, onChange, required, min, max }: DateFieldProps) {
  return (
    <Field label={label}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        max={max}
        className="rounded border px-2 py-1"
      />
    </Field>
  );
}
