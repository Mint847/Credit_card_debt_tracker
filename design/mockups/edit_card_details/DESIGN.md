---
name: Serendib Neo-Fintech
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#3c4a46'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#6c7a76'
  outline-variant: '#bbcac4'
  surface-tint: '#006b5c'
  primary: '#006b5c'
  on-primary: '#ffffff'
  primary-container: '#00bfa5'
  on-primary-container: '#00473c'
  inverse-primary: '#44ddc1'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006a63'
  on-tertiary: '#ffffff'
  tertiary-container: '#00beb1'
  on-tertiary-container: '#004741'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#68fadd'
  primary-fixed-dim: '#44ddc1'
  on-primary-fixed: '#00201a'
  on-primary-fixed-variant: '#005145'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#56faeb'
  tertiary-fixed-dim: '#28ddcf'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#00504a'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-trust, modern retail banking experience tailored for the digital-first Sri Lankan consumer. Inspired by top-tier European neo-banks like Starling, the aesthetic balances institutional precision with approachable clarity. The interface relies on pure white layered surfaces resting over an ultra-light neutral background, punctuated by high-energy cyan/teal accents that signal action, balance health, and technological modernity.

The visual tone is confident, crystalline, and unburdened by legacy banking clutter. Typography utilizes deep slate and navy tones rather than harsh absolute blacks to retain warmth and legibility under direct sunlight. Micro-interactions and data visualization prioritize financial clarity: soft-tinted pastel tiles categorize everyday expenditures, clear linear indicators depict budgeting velocity, and crisp structural borders offer precise visual containment.

## Colors

The palette is engineered for financial legibility and focused interaction:

- **Primary (`#00BFA5` / `#00D2C4`)**: A vibrant digital teal/cyan spectrum. Used strictly for core interactive touchpoints, financial progression meters, current balance states, and primary actions.
- **Secondary (`#0F172A`)**: A deep, commanding midnight slate. Governs primary hierarchy text, large numerical balances, and prominent state indicators.
- **Neutral Surface & Background (`#F8F9FA`)**: An ultra-clean, desaturated cool-gray base canvas. Surface elements sit on pure `#FFFFFF` cards to create subtle, clean contrast against this backdrop.
- **Structural Outlines (`#E2E8F0`)**: A calm, low-contrast slate gray used for cards, dividers, and component boundaries.
- **Supporting Category Pastels**:
  - Groceries & Essentials: `#E6F7F5` base with `#00A896` icon tint.
  - Dining & Leisure: `#FFF4E5` base with `#F59E0B` icon tint.
  - Transport & Commute: `#EFF6FF` base with `#3B82F6` icon tint.
  - Utilities & Bills: `#F5F3FF` base with `#8B5CF6` icon tint.
  - Wealth & Savings: `#ECFDF5` base with `#10B981` icon tint.
- **Semantic & Alerts**:
  - Warning/Negative: `#EF4444` on `#FEF2F2`.
  - Attention/Action: `#F59E0B` on `#FFFBEB`.

## Typography

The design system uses **Plus Jakarta Sans** across all text layers to deliver crisp geometric proportion, high screen legibility, and a balanced, friendly fintech profile. 

- **Numerical Figures & Currencies**: All monetary figures (LKR, USD) utilize `font-feature-settings: "tnum" 1` (tabular figures) to ensure vertical alignment across transaction ledgers and financial summaries.
- **Hierarchical Contrast**: Primary figures and section headlines use `font-weight: 700` paired with deep slate (`#0F172A`). Secondary supporting captions, merchant timestamps, and reference IDs utilize `body-sm` or `label-sm` set in muted slate (`#64748B`).

## Layout & Spacing

The layout is built for fluid mobile-first presentation, transitioning gracefully onto larger tablet canvases:

- **Mobile (< 768px)**: A 4-column fluid system with `margin: 1rem` (16px) and `gutter: 1rem` (16px). All transaction feeds, summary cards, and dynamic budget monitors fill available horizontal width within the margin shell.
- **Tablet / Large Mobile (>= 768px)**: An 8-column layout with `margin-md: 1.5rem` and `gutter: 1rem`, allowing horizontal juxtaposition of the primary account ring/card module alongside recent activity feeds.
- **Vertical Rhythm**: Fixed 4px/8px modular base increment. Stacked ledger items preserve `space-md` separation, while compact metadata within cards uses `space-xs` and `space-sm`.

## Elevation & Depth

Visual separation relies on clean surface layering paired with ultra-diffused, ambient micro-shadows and crisp hairline borders:

- **Base Layer (Level 0)**: The viewport background canvas sits at `#F8F9FA`.
- **Card Surface (Level 1)**: Interactive cards, feed items, and category sheets sit on pure `#FFFFFF` with a 1px continuous border of `#E2E8F0` and an ambient shadow of `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Elevated Interactive Layer (Level 2)**: Sticky action trays, floating action buttons, and modal bottom-sheets use `#FFFFFF` backed by an elevated shadow of `0 10px 15px -3px rgba(15, 23, 42, 0.06), 0 4px 6px -4px rgba(15, 23, 42, 0.03)` with no border, retaining an airy feel.
- **Overlays**: Dark scrim at `rgba(15, 23, 42, 0.35)` with an 8px backdrop blur filter for transaction confirmation screens.

## Shapes

The shape scale creates a soft, approachable, modern appearance without looking cartoonish:

- Standard input fields, cards, and modal sheets use **Rounded Level 2** (`border-radius: 0.5rem` / 8px).
- Large analytical surfaces, transaction groupings, and account modules use `rounded-lg` (`1rem` / 16px).
- Quick-filter chips, circular progress avatars, category icons, and high-impact action pills use `rounded-full` / pill formatting for maximum tactile ergonomics.

## Components

### Buttons & Action Bars
- **Primary Button**: Solid `#00BFA5` background, `#FFFFFF` bold text, pill-shaped (`rounded-full`), height of 48px, horizontal padding of 24px. Active state scales to `0.98` with `#00A896`.
- **Secondary Button**: `#FFFFFF` background, `#0F172A` text, 1px solid `#E2E8F0`, pill-shaped, height of 48px.
- **Ghost / Tertiary**: Transparent background, `#00BFA5` text with `label-lg` styling.

### Cards & Surfaces
- Surfaces use pure white `#FFFFFF` against `#F8F9FA` canvas with `rounded-lg` (16px) corners and a 1px border of `#E2E8F0`. Padding defaults strictly to `space-md` (16px) or `space-lg` (24px) for dashboard summary cards.

### Category Icon Tiles
- Soft 40x40px rounded squares (`border-radius: 12px`) filled with pastel category backgrounds (e.g., `#E6F7F5`). Category icons inside are centered, vector stroke-based, and rendered in the saturated category tone (`#00A896`).

### Starling-Style Category Trackers
- Horizontal multi-segmented progress bars: 8px tall track with a `#E2E8F0` background and `rounded-full` track bounds.
- Foreground fills use dynamic brand and category colors (`#00D2C4`, `#F59E0B`, `#8B5CF6`).
- Directly accompanied by category title (`label-md`), current spend vs. limit, and percentage remaining formatted in `body-sm` slate text (`#64748B`).

### Transaction List Items
- Clean list rows with 56px minimum height. Left side features the category pastel tile; center column features recipient/merchant name in `headline-sm` (`#0F172A`) over date/category in `body-sm` (`#64748B`); right column features monetary change in tabular `headline-sm` (negative in `#0F172A`, inbound credit in `#00BFA5`). Rows are divided by hairline `#F1F5F9` borders.

### Financial Alert Chips
- High-contrast, pill-shaped tags (`border-radius: 9999px`) with padding of 4px 10px. 
- Overdraft/Fraud warnings: `#FEF2F2` background, 1px border of `#FCA5A5`, text `#B91C1C` with `label-sm`.
- Instant Spend Notification: `#F0FDF4` background, 1px border of `#86EFAC`, text `#15803D`.

### Inputs & Form Elements
- 48px input height with 12px rounded corners, `#FFFFFF` background, 1px outline in `#CBD5E1`.
- Focused state: 2px ring in vibrant cyan/teal (`#00D2C4`) with immediate label float and input text in `#0F172A`.