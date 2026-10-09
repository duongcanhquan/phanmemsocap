# Design System Master File

**Project:** phanmemsocap  
**Applied:** 2026-10-09  
**Category:** Education admin, light, mobile-first

The skill search mixed a dark analytics palette, claymorphism, and Fira fonts. Those conflict with the product: a light training console in Vietnamese, Myanmar, and Bengali. This file is the system actually used.

## Style

Minimal Swiss admin. Canvas `#F8FAFC`, white cards, one navy primary, one blue accent. No clay shadows, no dark theme, no emoji icons.

## Color

| Role | Hex | Token |
|------|-----|-------|
| Canvas | `#F8FAFC` | `--color-canvas` |
| Surface | `#FFFFFF` | `--color-surface` |
| Ink | `#0F172A` | `--color-ink` |
| Muted | `#64748B` | `--color-muted` |
| Line | `#E2E8F0` | `--color-line` |
| Accent | `#0369A1` | `--color-accent` |
| Danger | `#B91C1C` | `--color-danger` |
| Warning text | `#92400E` | `--color-warning` |
| Warning surface | `#FFFBEB` | `--color-warning-bg` |

Primary buttons use ink on white (contrast above 7:1). Accent marks links, the active navigation bar, and example terms. Do not encode status with color alone.

## Type

Noto Sans, Noto Sans Myanmar, and Noto Sans Bengali. Body 16px, line-height 1.5–1.7. Headings 600. Fira is not used because it does not cover Myanmar or Bengali.

## Shape and motion

Cards `rounded-2xl`, controls `rounded-xl`, shadow `shadow-sm`. Touch targets at least 44px. Transitions 200ms. Press uses a slight scale. `prefers-reduced-motion` removes motion.

## Navigation

Desktop: sidebar. Phone: bottom navigation, at most 5 items, icon plus label. Active item uses weight and an accent bar, not color alone.
