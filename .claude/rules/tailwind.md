---
description: Tailwind CSS styling rules — applies when writing or modifying className in any component
globs: ["src/**/*.tsx", "src/**/*.jsx", "src/**/*.astro"]
---

# Tailwind CSS Rules

## Use `cn()` for conditional classes
Import from `@/lib/cn`. Use `cn()` whenever a className involves any conditional logic, ternaries, or dynamic values.

```tsx
// Good
className={cn("flex items-center gap-2", isActive && "bg-blue-500")}
className={cn("rounded-lg p-4", variant === "large" ? "text-xl" : "text-base")}

// Bad — never use template literals for conditional classes
className={`flex items-center gap-2 ${isActive ? "bg-blue-500" : ""}`}
```

Static classNames that never change do not need `cn()`:
```tsx
// Fine as-is
className="flex items-center gap-2"
```

## No arbitrary one-off values
Do not use Tailwind arbitrary values like `pt-[23px]`, `w-[347px]`, `text-[13px]`, `gap-[7px]`.

Use the default Tailwind spacing/sizing scale (`p-4`, `w-80`, `text-sm`, `gap-2`) or the fluid tokens defined in `src/styles/global.css` under `@theme`.

If a design truly requires a non-standard value, add a semantic token to `@theme` in `global.css` rather than inlining it.

The only exception is arbitrary color values like `bg-[#f5f5f5]` or `text-[#333f46]` when a semantic token doesn't exist yet — but prefer creating one if the color appears more than once.
