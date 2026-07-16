import { Field } from "./Field";

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}

/** A labeled `<select>` bound to a value+options list — collapses the repeated select boilerplate. */
export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border px-2 py-1">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
