---
name: Flash
version: alpha
description: A minimalist dashboard design system built for precision and speed.
colors:
  primary: "#0071E3"
  primary-hover: "#005BB5"
  on-primary: "#FFFFFF"
  obsidian: "#0A0A0A"
  bone: "#F7F7F7"
  titanium: "#D1D1D1"
  text-primary: "#1D1D1F"
  text-muted: "#6E6E73"
  divider: "#D2D2D7"
  surface-glass: "rgba(255, 255, 255, 0.45)"
  midnight-bg: "#0A0A0C"
  midnight-surface: "rgba(20, 20, 24, 0.92)"
  midnight-text: "#E8E8ED"
  midnight-text-muted: "#B0B0B8"
  midnight-accent: "#2F6FCB"
  midnight-accent-2: "#255DB0"
  midnight-accent-soft: "#5E9FFF"
  globe-bg: "#FFFFFF"
  globe-sphere-edge: "#F0F0F2"
  globe-border: "#111112"
  globe-meridian: "rgba(218, 218, 222, 0.4)"
  modal-backdrop: "rgba(0, 0, 0, 0.45)"
typography:
  display:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 2.5rem
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -0.045em
  title:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: -0.022em
  body:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.52
    letterSpacing: -0.011em
  label:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.36
    letterSpacing: 0.04em
rounded:
  sm: 4px
  md: 8px
  lg: 16px
  xl: 24px
  card: 20px
  pill: 980px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
elevation:
  shadow-sm: "0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.04)"
  shadow-md: "0 2px 6px rgba(0, 0, 0, 0.05), 0 10px 24px rgba(0, 0, 0, 0.06)"
  shadow-lg: "0 4px 12px rgba(0, 0, 0, 0.06), 0 20px 44px rgba(0, 0, 0, 0.08)"
  shadow-xl: "0 8px 20px rgba(0, 0, 0, 0.08), 0 32px 64px rgba(0, 0, 0, 0.10)"
  shadow-accent: "0 4px 14px rgba(0, 113, 227, 0.28)"
  midnight-shadow-md: "0 2px 6px rgba(0, 0, 0, 0.35), 0 12px 28px rgba(0, 0, 0, 0.4)"
components:
  layout:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.text-primary}"
  glass-card:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: 0.65em 1.4em
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  input:
    backgroundColor: "{colors.globe-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  caption:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
  chip:
    backgroundColor: "{colors.titanium}"
    textColor: "{colors.obsidian}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  divider:
    backgroundColor: "{colors.divider}"
    height: 1px
  modal-backdrop:
    backgroundColor: "{colors.modal-backdrop}"
  midnight-layout:
    backgroundColor: "{colors.midnight-bg}"
    textColor: "{colors.midnight-text}"
  midnight-card:
    backgroundColor: "{colors.midnight-surface}"
    textColor: "{colors.midnight-text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  midnight-caption:
    backgroundColor: "{colors.midnight-surface}"
    textColor: "{colors.midnight-text-muted}"
    typography: "{typography.label}"
  midnight-button-primary:
    backgroundColor: "{colors.midnight-accent}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: 0.65em 1.4em
  midnight-button-primary-hover:
    backgroundColor: "{colors.midnight-accent-2}"
    textColor: "{colors.on-primary}"
  midnight-active-indicator:
    backgroundColor: "{colors.midnight-accent-soft}"
    textColor: "{colors.obsidian}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xs}"
  globe-canvas:
    backgroundColor: "{colors.globe-bg}"
    textColor: "{colors.globe-border}"
  globe-sphere:
    backgroundColor: "{colors.globe-sphere-edge}"
    textColor: "{colors.globe-border}"
  globe-meridian:
    backgroundColor: "{colors.globe-meridian}"
    textColor: "{colors.globe-border}"
  motion-curve-spring:
    backgroundColor: "{colors.bone}"
    textColor: "cubic-bezier(0.34, 1.3, 0.64, 1)"
  motion-curve-standard:
    backgroundColor: "{colors.bone}"
    textColor: "cubic-bezier(0.4, 0, 0.2, 1)"
  motion-curve-decelerate:
    backgroundColor: "{colors.bone}"
    textColor: "cubic-bezier(0, 0, 0.2, 1)"
  motion-duration-fast:
    backgroundColor: "{colors.bone}"
    textColor: "120ms"
  motion-duration-normal:
    backgroundColor: "{colors.bone}"
    textColor: "220ms"
  motion-duration-slow:
    backgroundColor: "{colors.bone}"
    textColor: "380ms"
  motion-stagger-item:
    backgroundColor: "{colors.bone}"
    textColor: "40ms"
---

## Overview

Flash sits at the intersection of absolute simplicity and raw power. Eliminate the unnecessary so the essential can speak. Brand presence should feel zero-friction: precise, fast, and quiet.

**Product intent:** dashboard and home-economics UI — dense data, calm chrome, high-contrast actions.

**Motion budget:** target 60 fps on mid-range mobile. Prefer `transform` and `opacity` in the hot path; keep color/shadow transitions on the compositor.

**Accessibility baseline:** WCAG AA (4.5:1 primary text, 3:1 secondary/UI). Honor `prefers-reduced-motion` by disabling springs and non-essential transforms.

## Colors

Palette is high-contrast neutrals plus a single functional accent.

| Role | Token | Value | Use |
|------|-------|-------|-----|
| Core dark | `obsidian` | `#0A0A0A` | Identity ink, strong contrast |
| Core light | `bone` | `#F7F7F7` | Page foundation (softer than pure white) |
| Material | `titanium` | `#D1D1D1` | Structure, secondary chrome |
| Action | `primary` | `#0071E3` | Primary CTAs and critical system states only |
| Action hover | `primary-hover` | `#005BB5` | Hover/pressed primary |
| Body text | `text-primary` | `#1D1D1F` | Headings and body |
| Muted text | `text-muted` | `#6E6E73` | Captions, metadata (WCAG AA on bone) |
| Divider | `divider` | `#D2D2D7` | Hairlines and separators |

**Midnight (eye-strain dark):** use `midnight-*` tokens. Soft whites instead of pure `#fff`. Interactive accents (`midnight-accent`) are deepened for AA contrast on white label text; soft glow/indicators may use `midnight-accent-soft` (`#5E9FFF`). Prefer a static backdrop (no animated canvas) so GPU budget stays on content.

**Semantic mapping for themes:** components should consume roles (surface, text, accent, border, shadow) rather than raw brand hex in JSX. Light default maps bone → surface, obsidian/text-primary → text, primary → accent. Midnight maps the `midnight-*` set.

## Typography

Invisible grid: clarity and breathability through strict hierarchy.

- **Family:** Inter / system-ui (SF Pro on Apple platforms is acceptable as the system fallback).
- **Alignment:** left-aligned; generous body line-height (`1.52`).
- **Scale:** `display` → hero; `title` → section; `body` → content; `label` → caps/metadata (slight positive tracking).
- Do not introduce a second display face without updating tokens.

## Layout

- **Baseline grid:** 4px / 8px (`spacing.xs` … `spacing.xl`).
- **Density:** dashboards may pack modules, but keep card padding at least `{spacing.lg}`.
- **Modals:** fullscreen/focused overlays use dimmed blurred backdrop (`modal-backdrop`), content enters with scale ~0.92→1 and slight Y settle; close via backdrop click or a fixed top-right control.
- **Globe / map modules:** white-on-white minimalist style — pure white ground, soft radial sphere volume, thin dark country borders, soft meridian strokes, primary-tinted active zone. Canvas animation loop should avoid React state thrash (draw in rAF, not setState per frame).

## Elevation & Depth

- **Light theme (default)** uses layered, moderately volumetric shadows: a tight ambient layer plus a wide diffuse key layer (`elevation.shadow-sm` … `shadow-xl`). Cards rest at `shadow-md` and lift to `shadow-lg` on hover — the lift reads as physical, never jumpy.
- Glass cards remain the primary container: translucent surface, subtle border, soft resting shadow.
- Prefer blur + border over heavy drop shadows; keep shadow transitions on `box-shadow`/`opacity` with short durations only (never animate `top/left`).
- Modal backdrop: `rgba(0,0,0,0.45)` + ~12px backdrop blur; dim and blur share a short ease-out (~0.2s).
- Midnight surfaces use translucent dark glass (`midnight-surface`) on near-black ground with `midnight-shadow-md`.

## Motion

- **Curves:** spring-like ease-out `motion-curve-spring` (cubic-bezier(0.34, 1.3, 0.64, 1)) for entrances and hover lifts; `motion-curve-standard` for color/state fades; `motion-curve-decelerate` for view transitions.
- **Durations:** micro `motion-duration-fast` (120ms), standard `motion-duration-normal` (220ms), view/large `motion-duration-slow` (380ms). Stagger list items at `motion-stagger-item` (40ms) intervals, capped so long lists never delay more than ~300ms total.
- **Hot path:** animate only `transform` and `opacity`. Color, border and shadow changes use short standard-ease transitions.
- **Reduced motion:** honor `prefers-reduced-motion` — disable springs, stagger, ripple and view transitions; keep instant state changes.
- **Micro-interactions:** buttons compress slightly on press (`scale(0.97)`), cards lift `translateY(-2px)` on hover, ripple on primary buttons is allowed when implemented with a single composited pseudo-element.

## Shapes

| Token | Value | Typical use |
|-------|-------|-------------|
| `sm` | 4px | Dense controls, chips |
| `md` | 8px | Inputs, small panels |
| `lg` | 16px | Small panels |
| `xl` | 24px | Large panels |
| `card` | 20px | Content cards (default card radius) |
| `pill` | 980px | Primary buttons only |

Cards stay geometric (`lg`/`xl`). Primary actions use **pill** rounding so they read as interactive, not structural.

## Components

### Layout shell

- Background `{colors.bone}`, text `{colors.text-primary}`.
- Midnight variant: `{colors.midnight-bg}` / `{colors.midnight-text}`.

### Glass card

- Primary content container.
- Background `{colors.surface-glass}`, radius `{rounded.card}` (20px), padding `{spacing.lg}`.
- Resting shadow `{elevation.shadow-md}`; hover lifts to `{elevation.shadow-lg}` with `translateY(-2px)` on the spring curve.

### Button (primary)

- Background `{colors.primary}`, text `{colors.on-primary}`, radius `{rounded.pill}`.
- Hover: `{colors.primary-hover}`.
- Reserve Apple Blue for primary actions and critical states — not decorative chrome.

### Input

- White field, body text color, radius `{rounded.md}`, padding `{spacing.md}`.
- Focus via ring/offset, not color inversion, so themes stay consistent.

### Modal

- Backdrop component uses `{colors.modal-backdrop}`.
- Content spring: mass ~0.8, stiffness ~400, damping ~30 (or CSS equivalent); disable when reduced motion is requested.

### Caption, chip, divider

- **Caption:** muted metadata text on bone (`text-muted` + `label` typography).
- **Chip:** titanium fill, obsidian text, `sm` radius — secondary structure, not a CTA.
- **Divider:** 1px hairline using `divider`.

### Midnight variants

- **midnight-layout / midnight-card / midnight-caption** for dark eye-strain mode.
- **midnight-button-primary** uses AA-safe accent (`midnight-accent` / hover `midnight-accent-2`). Non-text indicators may use `midnight-accent-soft`.

### Globe module

- **globe-canvas:** pure white ground.
- **globe-sphere / globe-meridian:** soft volume edge and meridian strokes; country borders use `globe-border`. Active timezone highlight may tint with `primary` opacity ramps (prose-only; keep stroke work on canvas).

## Do's and Don'ts

**Do**

- Read tokens from this file (or generated CSS/Tailwind export) before hard-coding colors.
- Keep primary blue scarce so it stays meaningful.
- Honor `prefers-reduced-motion`.
- Lint after token edits: `npx @google/design.md lint DESIGN.md`.

**Don't**

- Mix pure `#FFFFFF` page backgrounds in light mode when `{colors.bone}` is the foundation (globe module is an intentional exception).
- Animate layout properties (`top`/`left`/`width`/`height`) in the hot path.
- Invent a second accent color for routine UI.
- Bypass glass-card/button tokens with one-off styles for standard dashboard modules.
