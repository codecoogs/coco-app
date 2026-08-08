# Semantic Color System Guide

This guide explains how to use the semantic color system in your application. The system provides consistent, accessible colors for different message types and interactive states across all themes.

## Overview

The semantic color system adds four core semantic colors to your design tokens:
- **Success** - For positive actions, confirmations, and successful states
- **Warning** - For cautionary messages and warning states
- **Error** - For errors, destructive actions, and critical states
- **Info** - For informational messages and neutral states

Each semantic color has 8 variations:
- Base color
- Foreground color (text)
- Soft background (for badges, alerts)
- Border color (for outlines)
- Hover state
- Active state
- Disabled state
- Disabled foreground

## Tailwind CSS Classes

All semantic colors are available as Tailwind classes. Use them with the standard color utilities:

### Background Colors
```html
<!-- Success backgrounds -->
<div class="bg-success">Success message</div>
<div class="bg-success-soft">Soft success background</div>
<div class="bg-success-hover">Hover state background</div>
<div class="bg-success-active">Active state background</div>
<div class="bg-success-disabled">Disabled state background</div>
```

### Text Colors
```html
<!-- Success text -->
<span class="text-success">Success text</span>
<span class="text-success-foreground">Text on success background</span>
<span class="text-success-hover">Hover state text</span>
```

### Border Colors
```html
<!-- Success borders -->
<div class="border-success">With success border</div>
<div class="border-success-border">Soft success border</div>
```

## Component Examples

### Success Alert
```tsx
export function SuccessAlert({ message }: { message: string }) {
  return (
    <div className="flex gap-3 rounded-lg bg-success-soft border border-success-border px-4 py-3">
      <span className="text-success">✓</span>
      <span className="text-success">{message}</span>
    </div>
  );
}
```

### Warning Badge
```tsx
export function WarningBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-warning-soft px-3 py-1 text-sm font-medium text-warning border border-warning-border">
      {text}
    </span>
  );
}
```

### Error Button
```tsx
export function ErrorButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg bg-error text-error-foreground font-medium hover:bg-error-hover active:bg-error-active disabled:bg-error-disabled disabled:text-error-disabled-foreground"
    >
      Delete
    </button>
  );
}
```

### Info Toast/Message
```tsx
export function InfoMessage({ message }: { message: string }) {
  return (
    <div className="flex gap-3 rounded-lg bg-info-soft border border-info-border px-4 py-3">
      <span className="text-info">ℹ</span>
      <span className="text-info">{message}</span>
    </div>
  );
}
```

## CSS Variable Access

For custom styling outside of Tailwind, use CSS custom properties:

```css
.custom-success-badge {
  background-color: var(--success-soft);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.custom-success-badge:hover {
  background-color: var(--success);
  color: var(--success-foreground);
}

.custom-success-badge:disabled {
  background-color: var(--success-disabled);
  color: var(--success-disabled-foreground);
}
```

## Theme Variants

Semantic colors are defined for all themes:
- Default (Light/Dark)
- Catppuccin Latte
- Catppuccin Frappe
- Catppuccin Macchiato
- Catppuccin Mocha
- Pink Sorbet

Each theme has its own semantic color palette that maintains WCAG AA contrast ratios. Colors automatically switch when the theme changes.

## Accessibility

### Contrast Ratios

All semantic color combinations meet WCAG AA standards:
- **Success**: 4.5:1 contrast ratio (text on background)
- **Warning**: 4.5:1 contrast ratio (text on background)
- **Error**: 4.5:1 contrast ratio (text on background)
- **Info**: 4.5:1 contrast ratio (text on background)

### Usage Guidelines

1. **Don't rely on color alone** - Always include icons or text labels to convey meaning
2. **Use foreground colors** - Always pair background colors with the corresponding foreground variant for text
3. **Maintain contrast** - When using soft backgrounds, ensure text still meets contrast requirements
4. **Respect reduced motion** - Semantic colors don't include animations by default; add transitions carefully

## Examples in Context

### Form Validation

```tsx
export function FormInput({ value, error, success }: Props) {
  return (
    <div>
      <input
        value={value}
        className={`
          px-3 py-2 rounded-lg border-2 transition-colors
          ${error ? 'border-error focus:ring-error' : ''}
          ${success ? 'border-success focus:ring-success' : ''}
        `}
      />
      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
      )}
      {success && (
        <p className="mt-1 text-sm text-success">✓ Looks good!</p>
      )}
    </div>
  );
}
```

### Status Indicators

```tsx
export function StatusBadge({ status }: { status: 'success' | 'warning' | 'error' | 'info' }) {
  const colorClass = {
    success: 'bg-success-soft text-success border-success-border',
    warning: 'bg-warning-soft text-warning border-warning-border',
    error: 'bg-error-soft text-error border-error-border',
    info: 'bg-info-soft text-info border-info-border',
  }[status];

  return (
    <span className={`inline-block px-3 py-1 rounded-full border ${colorClass}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
```

## Best Practices

1. **Use semantic colors for their intended purpose**
   - Success: confirmations, valid states, positive feedback
   - Warning: cautions, pending states, attention-needed
   - Error: errors, failures, destructive actions
   - Info: general information, hints, neutral states

2. **Combine with icons** for maximum clarity
3. **Test with theme switcher** to ensure colors work across all themes
4. **Use the soft variants** for background containers and badges
5. **Use base colors** for important interactive elements
6. **Use hover/active variants** for buttons and interactive states
7. **Use disabled variants** for inactive/disabled states

## Migration Guide

If you're updating existing components:

### Before
```tsx
<div className="bg-green-500 text-white">Success!</div>
```

### After
```tsx
<div className="bg-success text-success-foreground">Success!</div>
```

This ensures consistency across all themes and maintains proper contrast.

## Error Pages

The application includes styled error pages that use semantic colors and Coco mascot assets:

### 404 Not Found Page
- Located at `app/not-found.tsx`
- Uses the cheerful "coco-nice" asset
- Provides links to dashboard and home
- Displayed when a user navigates to a non-existent page

### 403 Forbidden Page
- Located at `app/forbidden.tsx`
- Uses the stern "coco-mean" asset
- Provides links to dashboard and home
- Displayed when a user lacks permissions to access a resource

### Triggering Error Pages

Use the error utilities from `lib/errors.ts`:

```tsx
import { requirePermission, requireResource, forbidden, notFound } from "@/lib/errors";

// Check if user has permission
requirePermission(user.canEditForm, "User lacks form edit permissions");

// Check if resource exists
const form = await getForm(formId);
const validForm = requireResource(form, "Form not found");

// Manual redirect to error pages
if (!hasAccess) {
  forbidden();
}

if (!exists) {
  notFound();
}
```
