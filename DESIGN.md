# Jovo / JobOS Design System: Editorial Intelligence Canvas

> **Source Project:** `Jovo Application Operating System UI` (`projects/13912991242556663313`)  
> **Origin:** Google Stitch MCP  
> **Theme Name:** `Editorial Intelligence Canvas`  
> **Aesthetic Philosophy:** Editorial Engineering — precision instrument consoles, architectural blueprints, and high-end broadsheet publishing. Forensic clarity, structured whitespace, quiet typographic weight, crisp hairline dividers, and deliberate telemetry signals.

---

## 1. Brand & Design Philosophy

The design system establishes an **"editorial engineering"** aesthetic tailored for high-agency candidates navigating complex recruitment pipelines. Rather than imitating ubiquitous AI tools characterized by electric purple gradients, floating glassy cards, and hyper-saturated dark themes, this system draws inspiration from precision instrument consoles, architectural blueprints, and high-end broadsheet publishing.

The emotional atmosphere is composed, authoritative, calm, and grounded in forensic clarity. Seeking employment is fraught with volatility; the interface counterbalances this friction with structured white space, quiet typographic weight, crisp hairline dividers, and deliberate status signals. Visual noise is aggressively eliminated in favor of information density with air. Ground-truth evidence badges and quantitative match ratings behave as analytical telemetry, signaling verifiable rigor rather than vague algorithmic optimism.

---

## 2. Color System

### 2.1 Editorial Substrate & Core Palette

| Role                   | Token / Name               | Hex Code              | Purpose & Usage                                                                              |
| :--------------------- | :------------------------- | :-------------------- | :------------------------------------------------------------------------------------------- |
| **Canvas Background**  | `surface` / `porcelain`    | `#F8F9FF` / `#FBFBFA` | Warm, grounded off-white base preventing glare during extended document review.              |
| **Foreground Panels**  | `surface-container-lowest` | `#FFFFFF`             | Document sheets, input fields, and foreground master panels.                                 |
| **Primary Ink**        | `primary` / `deep-ink`     | `#0F172A` (`#000000`) | High-contrast editorial text, headers, and core brand anchoring.                             |
| **Secondary Accent**   | `secondary`                | `#006A61`             | Teal calibration indicator, secondary brand accent.                                          |
| **Interactive Action** | `accent`                   | `#0284C7` / `#2563EB` | Dedicated exclusively to primary workflow triggers (Generate Dossier, Dispatch Application). |
| **Muted Metadata**     | `on-surface-variant`       | `#64748B` / `#45464D` | Timestamps, secondary criteria, contextual hints, and field labels.                          |
| **Hairline Dividers**  | `outline-variant`          | `#E2E8F0` / `#C6C6CD` | Subtle dividing rules; never harsh, never decorative.                                        |
| **Container Frame**    | `surface-container`        | `#E5EEFF` / `#F1F5F9` | Inactive controls, code blocks, container frames.                                            |

### 2.2 Match & Evidence Calibration Tokens

Color functions strictly to indicate status, proof, or actionable intent:

| Fit Level         | Score Range  | Text / Icon Color | Background Color | Semantic Meaning                                           |
| :---------------- | :----------- | :---------------- | :--------------- | :--------------------------------------------------------- |
| **High Fit**      | `88% – 100%` | `#059669`         | `#ECFDF5`        | Comprehensive qualification overlap.                       |
| **Strong Fit**    | `75% – 87%`  | `#0D9488`         | `#F0FDFA`        | Clear capability alignment with minor variance.            |
| **Moderate Fit**  | `60% – 74%`  | `#D97706`         | `#FFFBEB`        | Bridgeable skill or timeline adjacencies.                  |
| **Gap Indicator** | `< 60%`      | `#EF4444`         | `#FEF2F2`        | Missing hard criteria or critical experience requirements. |

### 2.3 Comprehensive Material Theme Tokens

```yaml
colors:
  surface: "#f8f9ff"
  surface-dim: "#cbdbf5"
  surface-bright: "#f8f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#eff4ff"
  surface-container: "#e5eeff"
  surface-container-high: "#dce9ff"
  surface-container-highest: "#d3e4fe"
  on-surface: "#0b1c30"
  on-surface-variant: "#45464d"
  inverse-surface: "#213145"
  inverse-on-surface: "#eaf1ff"
  outline: "#76777d"
  outline-variant: "#c6c6cd"
  surface-tint: "#565e74"
  primary: "#000000"
  on-primary: "#ffffff"
  primary-container: "#131b2e"
  on-primary-container: "#7c839b"
  inverse-primary: "#bec6e0"
  secondary: "#006a61"
  on-secondary: "#ffffff"
  secondary-container: "#86f2e4"
  on-secondary-container: "#006f66"
  tertiary: "#000000"
  on-tertiary: "#ffffff"
  tertiary-container: "#001d31"
  on-tertiary-container: "#188ace"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#dae2fd"
  primary-fixed-dim: "#bec6e0"
  on-primary-fixed: "#131b2e"
  on-primary-fixed-variant: "#3f465c"
  secondary-fixed: "#89f5e7"
  secondary-fixed-dim: "#6bd8cb"
  on-secondary-fixed: "#00201d"
  on-secondary-fixed-variant: "#005049"
  tertiary-fixed: "#cce5ff"
  tertiary-fixed-dim: "#93ccff"
  on-tertiary-fixed: "#001d31"
  on-tertiary-fixed-variant: "#004b73"
  background: "#f8f9ff"
  on-background: "#0b1c30"
  surface-variant: "#d3e4fe"
```

---

## 3. Typography Hierarchy

The typographic hierarchy harmonizes humanistic editorial posture with strict mechanical precision.

- **Headlines / Display:** `Plus Jakarta Sans` — Geometric, open architecture projecting clarity without feeling playful.
- **Narrative / Body / Excerpts:** `Inter` — High legibility across extensive case files, job descriptions, and resume dossiers.
- **Telemetry / Badges / Code:** `JetBrains Mono` — Tabular alignment for telemetry metrics, match percentages, algorithmic confidence intervals, and chronological metadata badges.

### 3.1 Type Scale Specification

| Token               | Font Family       | Size               | Weight | Line Height       | Letter Spacing |
| :------------------ | :---------------- | :----------------- | :----- | :---------------- | :------------- |
| `display-lg`        | Plus Jakarta Sans | `2.25rem` (36px)   | 700    | `2.75rem` (44px)  | `-0.025em`     |
| `display-lg-mobile` | Plus Jakarta Sans | `1.75rem` (28px)   | 700    | `2.25rem` (36px)  | `-0.02em`      |
| `headline-lg`       | Plus Jakarta Sans | `1.75rem` (28px)   | 600    | `2.25rem` (36px)  | `-0.02em`      |
| `headline-md`       | Plus Jakarta Sans | `1.25rem` (20px)   | 600    | `1.75rem` (28px)  | `-0.015em`     |
| `headline-sm`       | Plus Jakarta Sans | `1.125rem` (18px)  | 600    | `1.5rem` (24px)   | `-0.01em`      |
| `body-lg`           | Inter             | `1.0rem` (16px)    | 400    | `1.625rem` (26px) | `normal`       |
| `body-md`           | Inter             | `0.875rem` (14px)  | 400    | `1.5rem` (24px)   | `normal`       |
| `body-sm`           | Inter             | `0.75rem` (12px)   | 400    | `1.25rem` (20px)  | `normal`       |
| `label-md`          | Inter             | `0.875rem` (14px)  | 500    | `1.25rem` (20px)  | `normal`       |
| `label-sm`          | Inter             | `0.75rem` (12px)   | 600    | `1.0rem` (16px)   | `0.01em`       |
| `telemetry-sm`      | JetBrains Mono    | `0.75rem` (12px)   | 500    | `1.0rem` (16px)   | `-0.01em`      |
| `telemetry-xs`      | JetBrains Mono    | `0.6875rem` (11px) | 500    | `0.875rem` (14px) | `0`            |

---

## 4. Spacing, Shapes & Elevation

### 4.1 Spacing Scale

```yaml
spacing:
  space-xs: 0.25rem # 4px
  space-sm: 0.5rem # 8px
  space-md: 1.0rem # 16px
  space-lg: 1.5rem # 24px
  space-xl: 2.5rem # 40px
  gutter: 1.5rem # 24px desktop gutter
  gutter-mobile: 1.0rem
  margin: 2.0rem # 32px canvas margin
  margin-mobile: 1.0rem
```

### 4.2 Shapes & Border Radii

```yaml
rounded:
  sm: 0.125rem # 2px - Micro elements, checkboxes
  DEFAULT: 0.25rem # 4px - Buttons & input fields (sharp, confident edges)
  md: 0.375rem # 6px - Dropdowns, small panels
  lg: 0.5rem # 8px - Cards, document panels & case files
  xl: 0.75rem # 12px - Overlays / Drawers
  full: 9999px # Badges, pills & match dials
```

### 4.3 Elevation & Depth

Spatial order is articulated through **tonal tiering and precision hairline borders**, avoiding high-blur dropshadows and neon glows:

1. **Substrate (Level 0):** Canvas `#FBFBFA` / `#F8F9FF`. Flat, never elevated.
2. **Structural Panels (Level 1):** Surfaces `#FFFFFF` bound by hairline border `1px solid #E2E8F0`. Flat elevation, zero drop shadow.
3. **Floating Drawers & Popovers (Level 2):** `#FFFFFF`, `1px solid #CBD5E1`, low-spread shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -1px rgba(15, 23, 42, 0.03)`.
4. **Modal Dialogues (Level 3):** Centered `#FFFFFF` planes layered over a matte backdrop (`rgba(15, 23, 42, 0.40)` with `backdrop-filter: blur(2px)`). Border `0 20px 25px -5px rgba(15, 23, 42, 0.10)`.

---

## 5. Core Components

### 5.1 Buttons

- **Primary:** Background `#0F172A`, text `#FFFFFF`, border `1px solid transparent`, subtle hover to `#1E293B`. For definitive operations (_Export Application Package_).
- **Secondary / Action Accent:** Background `#0284C7`, text `#FFFFFF`. Used for targeted optimization actions (_Re-Score Resume_).
- **Subtle / Outline:** Background `#FFFFFF`, text `#0F172A`, border `1px solid #E2E8F0`, hover `#F8F9FA`. Default for secondary exploration.
- **Padding:** `8px 14px` for default controls; typography set to `label-md`.

### 5.2 Cards & Case-File Panels

- Background `#FFFFFF`, border `1px solid #E2E8F0`, corner radius `8px`.
- Padding conforms strictly to `1.25rem` or `1.5rem`.
- Interactive cards (e.g. job leads) do not jump in elevation on hover; border transitions to `#94A3B8` accompanied by a 1px left-accent bar.

### 5.3 Inputs & Text Areas

- Background `#FFFFFF`, border `1px solid #CBD5E1`, typography `body-md`.
- Focus state: Border transitions to `#0F172A` with a crisp `0 0 0 1px #0F172A` box-shadow ring.
- Error state: Border `#EF4444` with clear mono-caption feedback below.

### 5.4 Verified Evidence Badge

- Compact pill container (`rounded-full`), padding `2px 8px`.
- Background `#ECFDF5`, border `1px solid #A7F3D0`, text `#065F46`, font `telemetry-xs`.
- Prepended by a sharp 12px checkmark icon. Applied solely to claims, qualifications, and metrics cross-referenced with verified Master Profile records.

### 5.5 Match Percentage Dial / Tag

- Monospaced indicator (`JetBrains Mono`).
- Visualized as a 32px pill or compact metric tag featuring color-coded state:
  - `88–100%`: Green (`#059669` / `#ECFDF5`)
  - `75–87%`: Teal (`#0D9488` / `#F0FDFA`)
  - `60–74%`: Amber (`#D97706` / `#FFFBEB`)
  - `< 60%`: Red (`#EF4444` / `#FEF2F2`)

---

## 6. Layout Architecture

### 6.1 Desktop Architecture (1280px+)

- **Global Navigation Bar:** 64px fixed-height header containing primary tabs (_Jobs_, _Applications_, _Master Profile_) with razor-thin lower border rules.
- **Split-Pane Dossier Layout:**
  - **Left Pane (380px fixed):** Navigation directory, application pipelines, queue management.
  - **Center Stage (Flexible, 640px–880px max):** Resume editor, match decomposition, deep dossier examination.
  - **Right Inspector (340px fixed):** Match diagnostics, gaps, verifiable Master Profile citations, and action controls.
- Canvas margins sit at `2rem` with `1.5rem` internal pane gutters.

### 6.2 Tablet & Mobile Adaptations

- **Tablet (768px – 1024px):** Inspector converts to a sliding off-canvas drawer. Stage occupies primary viewport width.
- **Mobile (< 768px):** Single-column linear layout. Pane systems stack beneath clean segmental filters. Margins scale down to `1rem`.

---

## 7. Stitch Project Screens Reference

This design system is realized in the following Stitch MCP screens in project `13912991242556663313`:

1. **Jovo - Job Discovery** (`202b1b03661447958baf45e8f47eec6c`)
2. **Jovo - Job Intelligence & Fit Analysis** (`e5cbbeeda0534b43a45ff51e465ba6bf`)
3. **Jovo - Truthful Tailoring Engine** (`a37303c7da634924ab90ea55ee50edb1`)
4. **Jovo - Career Profile & Ground Truth Dossier** (`0515882dbeba47a597b8f56e7d4997c4`)
5. **Jovo - Application Capsule** (`9992b2d611c8417fb0b5739e131c4eb5`)
