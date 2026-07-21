interface FieldProps {
  label: string;
  children: React.ReactNode;
}

/** Shared label+control wrapper — the single source for form field layout across the app. */
export function Field({ label, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-text">{label}</span>
      {children}
    </label>
  );
}
