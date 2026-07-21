import next from "eslint-config-next";

// Next.js 16 ships eslint-config-next as a native flat-config array (Linter.Config[]),
// so we spread it directly — no FlatCompat needed. It already ignores .next/out/build/next-env.
const eslintConfig = [
  ...next,
  {
    ignores: ["coverage/**", "supabase/.branches/**", "supabase/.temp/**", "dist/**"],
  },
  {
    files: ["src/lib/ielts/pdf/*.tsx"],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },
];

export default eslintConfig;
