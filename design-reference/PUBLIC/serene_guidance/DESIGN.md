---
name: Serene Guidance
colors:
  surface: '#f6f9ff'
  surface-dim: '#d4dbe2'
  surface-bright: '#f6f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4fc'
  surface-container: '#e8eef6'
  surface-container-high: '#e3e9f1'
  surface-container-highest: '#dde3eb'
  on-surface: '#161c22'
  on-surface-variant: '#404940'
  inverse-surface: '#2b3137'
  inverse-on-surface: '#ebf1f9'
  outline: '#707a6f'
  outline-variant: '#bfc9bd'
  surface-tint: '#1f6c3a'
  primary: '#004c22'
  on-primary: '#ffffff'
  primary-container: '#166534'
  on-primary-container: '#93e0a2'
  inverse-primary: '#8bd79b'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#3d4143'
  on-tertiary: '#ffffff'
  tertiary-container: '#55585a'
  on-tertiary-container: '#ccced0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a6f4b5'
  primary-fixed-dim: '#8bd79b'
  on-primary-fixed: '#00210b'
  on-primary-fixed-variant: '#005226'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f6f9ff'
  on-background: '#161c22'
  surface-variant: '#dde3eb'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-margin-mobile: 16px
  container-margin-desktop: 32px
  gutter: 16px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 24px
---

## Brand & Style

The design system is centered on the concept of "Dignified Navigation." It prioritizes clarity, accessibility, and a sense of calm to support users who may be in emotionally sensitive states. The aesthetic follows a **Modern Corporate** approach with a focus on high legibility and an uncluttered interface.

The brand personality is professional yet empathetic. By utilizing a restrained color palette and generous white space, the UI recedes to let the functional tasks—locating a loved one, managing records, or viewing maps—remain the primary focus. The emotional response should be one of reliability and tranquility, ensuring that the technology feels like a supportive tool rather than a distraction.

## Colors

The palette is anchored by **Dark Forest Green**, evoking nature, growth, and the physical environment of the memorial park. The background uses a soft, off-white neutral to reduce eye strain and provide a clean canvas for information.

- **Primary (#166534):** Used for primary actions, navigation headers, and brand-identifying elements.
- **Text/Secondary (#1E293B):** A high-contrast charcoal for all body text and headings to ensure WCAG AA accessibility compliance.
- **Borders (#E2E8F0):** Subtle grays are used to define structure without adding visual noise.
- **Plot Statuses:**
  - *Occupied* uses a soft Sage Green (#DCF1E4) to indicate life and memory.
  - *Available* is kept white with a thin border to indicate potential.
  - *GPS Warning* uses a distinct Orange to ensure users are aware of location inaccuracies during navigation.

## Typography

This design system utilizes **Inter** for its exceptional legibility and systematic feel. The typography is designed to handle both data-heavy admin tables and simple, large-scale directions for mobile visitors.

- **Headlines:** Use Bold and Semi-Bold weights to create clear hierarchy.
- **Body:** Standardized at 16px for optimal readability across all age groups.
- **Labels:** Used for metadata, table headers, and status badges, often utilizing the `label-caps` style for distinct categorization.
- **Mobile Scaling:** Large headlines scale down on mobile to prevent awkward line breaks while maintaining a strong visual anchor.

## Layout & Spacing

The design system employs a **Fluid Grid** for mobile visitors and a **Fixed/Hybrid Grid** for the desktop admin portal.

- **Mobile:** A 4-column layout with 16px margins. Components like Map Controls are anchored to the bottom-right for easy thumb reach.
- **Desktop:** A 12-column layout with a 280px fixed sidebar for navigation. Content areas use a maximum width of 1440px to ensure line lengths remain readable.
- **Spacing Rhythm:** Based on an 8px scale (4, 8, 16, 24, 32, 48, 64). Use `stack-md` for standard vertical spacing between elements in a card and `stack-lg` for spacing between sections.

## Elevation & Depth

To maintain a calm and modern feel, the design system avoids heavy shadows. It uses **Tonal Layers** and **Low-Contrast Outlines** to suggest depth.

- **Level 0 (Background):** #F8FAFC.
- **Level 1 (Cards/Surface):** White (#FFFFFF) with a 1px border of #E2E8F0. No shadow.
- **Level 2 (Overlays/Dialogs):** White with a very soft, diffused ambient shadow (0px 4px 20px rgba(30, 41, 59, 0.05)).
- **Interactions:** Subtle background color shifts (e.g., from White to #F1F5F9) are used for hover states on list items rather than lift effects.

## Shapes

The shape language is "Softly Structured." A standard radius of **8px (rounded-md)** is applied to buttons, cards, and input fields. This provides a approachable, modern feel without being overly casual.

- **Buttons/Inputs:** 8px radius.
- **Status Badges:** Fully rounded (pill-shaped) to distinguish them as non-interactive status indicators.
- **Map Controls:** Circular (floating action buttons) for a distinct functional presence over the map UI.

## Components

### Buttons
- **Primary:** Dark Forest Green background, White text. Used for "Find Grave" or "Save Record."
- **Secondary:** White background, 1px Gray border, Charcoal text. Used for "Cancel" or "Print."
- **Ghost:** No background or border. Charcoal text. Used for secondary navigation or subtle actions.

### Inputs & Search
- **Search Fields:** Feature a leading magnifying glass icon. High contrast text on a white background with a clear focus ring in Primary Green.
- **Form Inputs:** Labels are always positioned above the input field. Error states use a clear red border and 12px helper text.

### Cards & Tables
- **Cards:** Used for mobile plot results. Should contain a small thumbnail, the name, plot ID, and a "Navigate" primary button.
- **Tables (Admin):** High-density layouts with #E2E8F0 horizontal dividers. Rows should include a hover state.

### Status Badges & Alerts
- **Status Badges:** Small, pill-shaped indicators using the color tokens (Verified, Unverified, etc.). Text should be high-contrast against the badge color.
- **Alert Messages:** Use a light tinted background of the status color with a 4px left-border accent.
- **GPS Warning:** A sticky banner at the top of the map view when accuracy drops below 5 meters.

### Navigation & Maps
- **Navigation Bars:** Mobile uses a bottom-tab bar for primary destinations (Map, Search, Records). Desktop uses a persistent left-hand sidebar.
- **Map Controls:** Floating UI elements (Zoom In, Zoom Out, Recenter) placed in the bottom right, using a 12px offset from the screen edge.
- **Photo-Upload:** A dashed-border drop zone or a large-tap-target camera icon for mobile field-work.
