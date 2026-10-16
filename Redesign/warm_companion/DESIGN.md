---
name: Warm Companion
colors:
  surface: '#fbf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae8e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#3d4947'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#006a61'
  on-primary: '#ffffff'
  primary-container: '#2aa89a'
  on-primary-container: '#003631'
  inverse-primary: '#66d9ca'
  secondary: '#236b40'
  on-secondary: '#ffffff'
  secondary-container: '#a6f0b9'
  on-secondary-container: '#286f44'
  tertiary: '#47645b'
  on-tertiary: '#ffffff'
  tertiary-container: '#7e9d93'
  on-tertiary-container: '#17342c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#84f6e6'
  primary-fixed-dim: '#66d9ca'
  on-primary-fixed: '#00201c'
  on-primary-fixed-variant: '#005048'
  secondary-fixed: '#a9f3bc'
  secondary-fixed-dim: '#8ed7a1'
  on-secondary-fixed: '#00210e'
  on-secondary-fixed-variant: '#00522a'
  tertiary-fixed: '#c9eade'
  tertiary-fixed-dim: '#adcdc2'
  on-tertiary-fixed: '#022019'
  on-tertiary-fixed-variant: '#2f4c44'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
  background-primary: '#FFFBF5'
  background-secondary: '#FFF5EB'
  surface-card: '#FFFFFF'
  text-secondary: '#8E8E8E'
  range-above: '#FF8A80'
  range-warning: '#FFB347'
  range-below: '#E57373'
  pastel-peach: '#FFE5D9'
  pastel-butter: '#FFF3CD'
  pastel-lavender: '#E8DEF8'
typography:
  display:
    fontFamily: Nunito
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
  display-mobile:
    fontFamily: Nunito
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 38px
  headline-lg:
    fontFamily: Nunito
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.4px
  headline-lg-mobile:
    fontFamily: Nunito
    fontSize: 26px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.3px
  headline-md:
    fontFamily: Nunito
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-sm:
    fontFamily: Nunito
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  title-md:
    fontFamily: Nunito
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Nunito
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Nunito
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Nunito
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Nunito
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 20px
  label-md:
    fontFamily: Nunito
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Nunito
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an empathetic, non-clinical digital health atmosphere. It prioritizes emotional comfort, reducing the chronic anxiety and cognitive friction often caused by sterile, hospital-grade diabetes software. The core design philosophy pairs the rounded, gentle personality of modern wellness platforms (such as Headspace and Noom) with rigorous, metabolic readability.

The target demographic consists of bilingual individuals managing metabolic wellness and diabetes, with specific cultural resonance for South Asian nutrition patterns. The interface speaks through soft, humanized language, rounded tactile surfaces, and comforting pastel warmth.

The chosen design direction combines tactile softness with clean, modern minimalism. It relies on ambient warm glows, gentle off-white background planes, pastel meal-categorization accents, and full-pill interactive triggers. Clinical metrics (such as glucose curves, mg/dL units, and Time-in-Range gauges) are presented with friendly clarity rather than cold alerts, transforming continuous glucose management into an empowering daily habit.

## Colors

The palette rejects stark monochrome clinical whites in favor of deeply warm, comforting tones. `#FFFBF5` serves as the primary canvas, backed by `#FFF5EB` for secondary grouping planes. Crisp `#FFFFFF` surfaces sit forward from these warm backgrounds to provide gentle contrast.

The primary accent `#2AA89A` (Warm Teal) anchors critical brand actions, primary curves, and active touch targets. Metabolic data visualization uses a calibrated semantic hierarchy:
- `#81C995` (Soft Sage) represents safe in-range targets (70–180 mg/dL).
- `#FF8A80` (Soft Coral) signals above-range values (>180 mg/dL).
- `#FFB347` (Warm Amber) denotes cautionary educational disclaimers and moderate carb levels.
- `#E57373` (Muted Rose) denotes urgent below-range excursions (<70 mg/dL) and destructive actions.

Pastel tints—`#FFE5D9` (Peach), `#D4F5E9` (Mint), `#FFF3CD` (Butter), and `#E8DEF8` (Lavender)—distinguish breakfast, lunch, dinner, and medication tags while keeping the tone light and welcoming. Text colors avoid pure black: `#3D3D3D` provides readable, high-contrast typography, while `#8E8E8E` softens auxiliary metadata and structural rules.

## Typography

Nunito anchors the entire typographic scale. Its curved terminal strokes complement the rounded surfaces throughout the app, reinforcing an empathetic tone.

Key typographic rules:
- **Bi-Directional Numbers & Units**: All clinical data points, numeric values, and units (`mg/dL`, `g`, `kcal`, `min`) must be set using Western Latin numerals (`0-9`) regardless of whether the interface is rendered in English (LTR) or Urdu (RTL).
- **Weight Contrast**: Heavy weights (`700` and `800`) are used for numeric totals, Time-in-Range gauge values, and section titles to make metrics easy to read at a glance. Body text defaults to regular (`400`) and medium (`500`) for natural, comfortable scanning.
- **Labels**: Secondary inputs, clinical disclaimers, and metadata timestamps use `label-md` and `label-sm` in Warm Stone Gray (`#8E8E8E`), keeping the visual hierarchy focused on vital stats.

## Layout & Spacing

Layouts follow a fluid single-column mobile rhythm expanding into a 4-column tablet or 12-column desktop grid. The screen padding standardizes at `margin: 1.5rem` (24px) across handheld layouts, providing comfortable margins that frame content cards cleanly.

Vertical rhythm adheres strictly to an 8px base grid, using 4px micro-steps:
- Standard list gaps and card separation: `1rem` (16px).
- Internal card padding: `1.25rem` (20px).
- Edge-to-edge component clearances: `1.5rem` (24px).

Responsive reflow collapses complex horizontal dashboards into vertically stacked card flows on mobile screens. Multi-column food analysis tables shift into vertical, left-accented card stacks. Bottom navigation bars and floating buttons remain pinned to mobile safe areas, ensuring primary metabolic logging actions sit comfortably within thumb reach.

## Elevation & Depth

Visual hierarchy uses soft, diffused depth instead of high-contrast drop shadows. Elevation sits close to the surface, creating a calm, welcoming feel.

- **Surface Level 0 (Canvas)**: Flat `#FFFBF5` canvas, accented on top screens with ambient radial gradients blending softly from `#FFE5D9` into `#FFFBF5`.
- **Surface Level 1 (Cards & Tab Bars)**: Crisp white (`#FFFFFF`) or tinted pastel surfaces with an ambient shadow of `0 4px 14px rgba(61, 61, 61, 0.06)` and a subtle `1px solid rgba(61, 61, 61, 0.06)` outline. This border treatment maintains separation without sharp dividers.
- **Surface Level 2 (Floating Action Triggers & Overlays)**: The center camera Floating Action Button (FAB) and primary action triggers use an expanded diffused shadow (`0 8px 20px rgba(42, 168, 154, 0.25)`) tinted with primary teal, giving interactives a friendly, inviting lift.
- **Modals & Camera Viewfinders**: Bottom sheets use the standard Level 1 diffused shadow across an elevated 24px top radius. Live viewfinders use soft dark edge gradients rather than hard geometric cutouts.

## Shapes

The interface embraces a pill-shaped rounded design (`roundedness: 3`). Fully rounded curves throughout the design eliminate visual tension and create an approachable feel.

- **Full Pill (`9999px` / `28px radius`)**: Reserved for interactive controls, including primary buttons, filter chips, follow-up prompt bubbles, tab switches, and status pills.
- **Large Structural Containers (`24px radius`)**: Used for hero metric cards, the Time-in-Range circular donut display, and bottom action modals.
- **Standard Card Surfaces & Inputs (`20px radius`)**: Used for food log rows, selectable meal option cards, and text input fields.
- **Circular Elements (`50%`)**: Reserved for user profile avatars (56px), the central camera FAB (62px), the camera shutter (80px), and secondary back buttons (40px).

## Components

### Buttons & Interactive Controls
- **Primary Buttons**: 56px height, full pill radius (`9999px`), solid `#2AA89A` fill, `#FFFFFF` text (`label-lg`), and an ambient teal drop shadow. Active states scale subtly to 0.98.
- **Secondary Buttons**: 56px height, full pill radius, `#FFF5EB` fill or 1.5px dashed border (`#2AA89A`), with `#2AA89A` text.
- **Icon Actions**: 40px circular `#FFFFFF` pills with a 1px border (`rgba(61, 61, 61, 0.06)`) and a centered `#3D3D3D` icon.

### Chips & Filter Pills
- **Selectable Chips**: Full pill radius, 36px height, padding of 12px 16px. Inactive states feature `#FFF5EB` fill with `#3D3D3D` text. Active states transition to `#2AA89A` fill with `#FFFFFF` text.
- **Prompt Pills**: Pastel mint (`#D4F5E9`) or pastel peach (`#FFE5D9`) surfaces featuring contextual prefix emojis (such as ✨, 🚶, ⏰).

### Cards & Data Containers
- **Content Cards**: 20px radius, `#FFFFFF` surface fill, 1px border (`rgba(61, 61, 61, 0.06)`), 20px internal padding.
- **Meal Breakdown Cards**: Feature a distinct 6px left border accent corresponding to the meal window: Peach for Breakfast, Mint for Lunch, Butter for Dinner.
- **Metric Badges**: Soft rounded containers colored semantically: Soft Sage (`#81C995`) for in-range deltas, Soft Coral (`#FF8A80`) for spikes, and Warm Amber (`#FFB347`) for non-diagnostic educational notices.

### Input Fields
- **Text Inputs**: 52px height, 20px border radius, `#FFFFFF` or `#FFF5EB` fill, 1.5px border (`rgba(61, 61, 61, 0.10)`).
- **Focused State**: Shifts border to 2px solid `#2AA89A` without harsh outer glow rings. Placeholder text is set in `#8E8E8E`.

### Selection Controls
- **Checkboxes**: 24px soft rounded squares (8px radius) with `#FFF5EB` background. Selected states transition to `#D4F5E9` fill with a `#2AA89A` checkmark.
- **Radio Items**: Custom container cards with a 20px radius that highlight with a 2px solid `#2AA89A` border upon selection.

### Specialized Health Components
- **Simulated Glucose Curve**: Dual visual hierarchy featuring an `#8E8E8E` dashed curve for past baseline trends, overlaid with a `#2AA89A` 3px smoothed curve for predictive projections. The safe target zone (70–180 mg/dL) is highlighted with an `#81C995` translucent horizontal band.
- **TIR Donut Gauge**: 220px circular chart using three clean, rounded arcs: `#81C995` (In-Range), `#FF8A80` (Above-Range), and `#E57373` (Below-Range).