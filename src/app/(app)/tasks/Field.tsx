interface FieldProps {
  label: string;
  children: React.ReactNode;
}

/** Shared label+control wrapper — extracted to remove duplication across the create-task form. */
export function Field({ label, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
    </label>
  );
}
