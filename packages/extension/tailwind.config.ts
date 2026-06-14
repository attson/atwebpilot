import type { Config } from "tailwindcss";

/**
 * Override Tailwind's built-in `zinc` palette so every `bg-zinc-XXX /
 * text-zinc-XXX / border-zinc-XXX` resolves to a CSS variable. The variables
 * themselves swap between light and dark themes in `theme.css` based on
 * `[data-theme]` on `<html>`.
 *
 * The `<alpha-value>` placeholder keeps `/40`-style modifiers working in
 * both themes.
 */
const zinc = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [
    String(n),
    `rgb(var(--c-zinc-${n}) / <alpha-value>)`
  ])
);

export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: { zinc }
    }
  },
  plugins: []
} satisfies Config;
