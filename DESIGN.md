---
version: 1.0.0
name: Scanora-design-system
description: "Calm Clinical Editorial design system for Scanora. Engineered specifically for reading, interpreting, and clarifying medical report findings with dignity, restraint, and absolute clarity. The system pairs a warm, anti-glare sage-neutral canvas (#F5F8F7) with deep slate ink (#17324D), restorative clinical teal actions (#087F8C), hairline borders (#D6E3E0), and gentle, non-alarmist amber attention states (#A96324). Designed for high scannability, accessibility (WCAG AA), zero medical sensationalism, and seamless single-session privacy."

tokens:
  colors:
    canvas: "#F5F8F7"
    surface: "#FFFFFF"
    surface-muted: "#EEF4F2"
    surface-subtle: "#F9FBFA"
    ink: "#17324D"
    ink-muted: "#557080"
    ink-faint: "#7E96A6"
    border: "#D6E3E0"
    border-subtle: "#E4EDE9"
    border-strong: "#B8CBC6"
    brand: "#087F8C"
    brand-hover: "#06636E"
    brand-soft: "#E6F3F5"
    attention: "#A96324"
    attention-soft: "#FFF4E7"
    attention-border: "#F3D5B5"
    success: "#2F725B"
    success-soft: "#ECF7F1"
    success-border: "#C4E6D6"
    error: "#A63D3D"
    error-soft: "#FFF0EF"
    error-border: "#FAD1CE"
    focus-ring: "#087F8C"

  typography:
    heading-font: "'Figtree', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    body-font: "'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    mono-font: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"

  spacing:
    1: "4px"
    2: "8px"
    3: "12px"
    4: "16px"
    5: "20px"
    6: "24px"
    8: "32px"
    10: "40px"
    12: "48px"
    16: "64px"

  radii:
    sm: "6px"
    md: "8px"
    lg: "12px"
    full: "9999px"

  shadows:
    none: "none"
    card: "0 1px 2px rgba(23, 50, 77, 0.04)"
    elevated: "0 4px 16px rgba(23, 50, 77, 0.06)"
---

# Scanora Design System (Calm Clinical Editorial)

## 1. Purpose & Core Philosophy

Scanora is a private, session-only assistant that helps people understand information visible on medical report images. Reviewing diagnostic laboratory results or health records is often accompanied by apprehension and cognitive stress. 

The **Calm Clinical Editorial** system is built to:
* **De-escalate tension**: Offer a soothing, paper-quiet surface that rejects clinical sterility without turning into an informal consumer toy.
* **Elevate evidence over speculation**: Maintain clear visual boundaries between what is printed on the physical report and what the AI assistant is clarifying.
* **Provide immediate scannability**: Structure complex medical metrics into logical, legible micro-surfaces with razor-sharp hairline precision.
* **Ensure uncompromised safety**: Never communicate critical conditions with color alone, never use alarmist emergency red for standard out-of-range lab markers, and keep non-diagnostic positioning transparent across every viewport.

---

## 2. Design Influences (Adapted Principles)

Scanora synthesizes specific foundational principles from premier developer and editorial design systems while preserving its own unique clinical identity:

* **From Claude (Warmth & Editorial Pacing)**:
  * Soft, non-pure-white canvas (`#F5F8F7`) that reduces eye strain and provides an editorial reading tone.
  * Humanist typography with generous body line-height (`1.55`–`1.6`) and constrained line length (55–70 characters) to optimize comprehension of dense medical text.
  * Measured, scarce application of high-voltage accent colors; color acts as punctuation, not decoration.
* **From Linear (Hairline Precision & Data Hierarchy)**:
  * 1px hairline borders (`#D6E3E0`) and surface-tone depth over heavy drop shadows.
  * Crisp, tabular alignment of laboratory metrics (Test Name, Observed Value, Reference Range, Clinical Context).
  * Prominent, high-visibility keyboard focus rings (`3px` solid with `2px` offset).
  * Consistent, restrained corner radius (`8px` container standard, `6px` for inline tags).
* **From Replicate (Input/Output Separation & Structured States)**:
  * Distinct task surfaces ("wells") separating the active workspace (drag-and-drop dropzone) from results and supporting context.
  * Transparent surfacing of model limits, unreadable document sections, and ambiguity as structured callout cards rather than suppressed errors.

---

## 3. Typography System

The typographic voice pairs **Figtree** (a geometric yet warm and approachable display typeface) with **Noto Sans** (a universally legible, humanist workhorse).

### Type Hierarchy Specification

| Level | Font Family | Size | Weight | Line Height | Tracking | Purpose & Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | Figtree | 32px (Desktop)<br>28px (Mobile) | 600 (SemiBold) | 1.15 | -0.02em | Main page headline on upload & result view |
| **Section Heading** | Figtree | 20px | 600 (SemiBold) | 1.25 | -0.01em | Major section headers ("Needs Attention", "Report Chat") |
| **Card / Item Title** | Figtree | 16px | 600 (SemiBold) | 1.35 | 0 | Test / metric names, card subheadings |
| **Body (Default)** | Noto Sans | 16px | 400 (Regular) | 1.60 | 0 | Plain-language explanations, assistant messages |
| **Body Emphasized** | Noto Sans | 16px | 600 (SemiBold) | 1.60 | 0 | Highlighted phrases, user chat bubbles |
| **Supporting / UI** | Noto Sans | 14px | 400 (Regular) | 1.50 | 0 | Guidance text, dropzone notes, disclaimers |
| **Metadata / Badges** | Noto Sans | 13px | 500 (Medium) | 1.40 | 0.01em | Reference ranges, timestamps, file sizes |
| **Kicker / Eyebrow** | Figtree | 12px | 700 (Bold) | 1.40 | 0.08em | Small uppercase category tags (e.g., "STEP 1 OF 1") |
| **Metric Numerals** | Noto Sans | 15px | 600 (SemiBold) | 1.20 | 0 | Lab result values (tabular figures enabled) |

### Typographic Rules
* Always keep paragraph measure between **45 and 72 characters**.
* Heading weights are capped at **600 (SemiBold)** to prevent an overbearing or authoritarian posture.
* Never use full uppercase for body sentences, medical findings, or disclaimers. Uppercase is reserved exclusively for small kickers/eyebrows.

---

## 4. Color System & Semantic Roles

Colors are layered systematically to direct focus, establish certainty boundaries, and signify status without anxiety.

### Token Specification

```css
/* Core Canvas & Surfaces */
--color-scanora-canvas:          #F5F8F7; /* Soft sage-tinted floor */
--color-scanora-surface:         #FFFFFF; /* Pure white content panels */
--color-scanora-surface-muted:   #EEF4F2; /* Recessed wells, assistant messages */
--color-scanora-surface-subtle:  #F9FBFA; /* Alternate table rows / quiet borders */

/* Typography & Ink */
--color-scanora-ink:             #17324D; /* Deep oceanic slate (Primary text) */
--color-scanora-ink-muted:       #557080; /* Neutral supporting text */
--color-scanora-ink-faint:       #7E96A6; /* Placeholders, disabled icons */

/* Boundaries & Hairlines */
--color-scanora-border:          #D6E3E0; /* 1px hairline standard */
--color-scanora-border-subtle:   #E4EDE9; /* Inner dividers */
--color-scanora-border-strong:   #B8CBC6; /* Hover / active boundaries */

/* Primary Action / Brand Voltage */
--color-scanora-brand:           #087F8C; /* Restrained teal */
--color-scanora-brand-hover:     #06636E; /* Darkened action hover/press */
--color-scanora-brand-soft:      #E6F3F5; /* Light teal tint for user chat bubble */

/* Status & Clinical Semantics */
--color-scanora-attention:       #A96324; /* Non-alarmist amber for out-of-range markers */
--color-scanora-attention-soft:  #FFF4E7; /* Amber background fill */
--color-scanora-attention-border:#F3D5B5; /* Amber hairline */

--color-scanora-success:         #2F725B; /* Sage green for verified normal / evaluated states */
--color-scanora-success-soft:    #ECF7F1; /* Success background fill */
--color-scanora-success-border:  #C4E6D6; /* Success hairline */

--color-scanora-error:           #A63D3D; /* Muted crimson for client/server errors */
--color-scanora-error-soft:      #FFF0EF; /* Error background fill */
--color-scanora-error-border:    #FAD1CE; /* Error hairline */
```

### Contrast & Accessibility Requirements
* All body and heading text against their respective background surfaces **exceed 5:1 contrast** (WCAG AAA for headings, AA for body).
* `--color-scanora-ink-muted` against `--color-scanora-canvas` and `--color-scanora-surface` maintains **at least 4.6:1 contrast**.
* Focus rings use solid `--color-scanora-brand` at `3px` width with `2px` white offset, ensuring minimum **3:1 graphical contrast** against any adjacent element.

---

## 5. Spacing, Elevation & Geometry

### Spacing Scale (4px Base)
* `4px` (`--spacing-1`): Inline micro-spacing, icon-to-label gaps.
* `8px` (`--spacing-2`): Related text pairs, badge padding, button internal gaps.
* `12px` (`--spacing-3`): Input vertical padding, compact card internal padding.
* `16px` (`--spacing-4`): Standard component gap, standard card padding, mobile page margins.
* `24px` (`--spacing-6`): Inter-card margins, panel separation.
* `32px` (`--spacing-8`): Major section separation, desktop card padding.
* `48px` (`--spacing-12`): Page hero top/bottom breathing room.
* `64px` (`--spacing-16`): Maximum container separation.

### Geometry & Radii
* **Panels, Cards, Inputs, Primary Buttons**: `8px` (`rounded-md`). Provides clean structural framing without feeling boxy or aggressive.
* **Tags, Badges, Micro-buttons**: `6px` (`rounded-sm`). Preserves internal visual density.
* **Pill Badges**: `9999px` (`rounded-full`). Used exclusively for compact status tags (e.g., "Needs Attention", "Step 1 of 1"). Never use pill shapes for standard text inputs or wide buttons.

### Elevation
* **Flat Surfaces + Hairlines**: The default elevation model. Panels sit flat on the `#F5F8F7` canvas with a `1px solid #D6E3E0` border.
* **Depth via Color-Step**: Distinct hierarchy is created by placing `#FFFFFF` cards or `#EEF4F2` wells on the `#F5F8F7` canvas.
* **Shadows**: Reserved exclusively for floating elements (e.g., active dropdowns or sticky status indicators) using `0 4px 16px rgba(23, 50, 77, 0.06)`. Never use heavy, blurry, dark drop shadows.

---

## 6. Layout Principles

### Single Focused Column Architecture
* **Container Max-Width**: Locked to `720px` (centered horizontally via `margin: 0 auto`).
* **Reading Discipline**: Single vertical action path. Prevents distraction, wandering attention, and layout shifting during emotional medical reviews.
* **Rhythm**:
  1. **Brand Bar**: Minimalist logo lockup + session privacy pill.
  2. **Editorial Header**: Page title and context lead paragraph.
  3. **Primary Surface**:
     - *Phase 1 (Upload)*: Dropzone + Preview List + Action Button + Privacy Note.
     - *Phase 2 (Results)*: Overview Summary + "Needs Attention" Findings List + "No Issues" / Evaluated State + Supporting Findings + Interactive Chat + Reset Action.
  4. **Trust Anchors**: Persistent Medical Disclaimer + Footnote.

---

## 7. Component Patterns & Specifications

### 7.1. Brand Wordmark & Header
* Minimalist wordmark: Scanora name in Figtree SemiBold with an integrated teal optical lens icon.
* Right-aligned subtle session indicator: *"Private, session-only analysis"*.
* Never show corporate banners, multi-tab navigation, or user login avatars.

### 7.2. Buttons
* **Primary Button ("Analyze Reports", "Send")**:
  * Height: `48px` minimum (touch target compliant).
  * Background: `--color-scanora-brand` (`#087F8C`), hover: `--color-scanora-brand-hover` (`#06636E`).
  * Text: White, Figtree 15px, weight 600.
  * Transition: `180ms ease` for background and opacity.
  * Loading state: Retains 48px height, label changes to *"Analyzing your reports..."* with non-jumping CSS dot indicator, button is disabled with `aria-busy="true"`.
* **Secondary Button ("Analyze more reports", "Browse files")**:
  * Height: `48px`.
  * Background: `--color-scanora-surface`, border: `1px solid --color-scanora-border`.
  * Text: `--color-scanora-ink`, Figtree 15px, weight 600.
  * Hover: `--color-scanora-surface-muted`, border: `--color-scanora-brand`.
* **Icon Controls (File remove, close)**:
  * Minimum touch target: `44px × 44px`.
  * Always provide explicit descriptive `aria-label` (e.g., `aria-label="Remove CBC_Report_Page1.png"`).

### 7.3. Upload Area & Dropzone
* **Resting State**:
  * Border: `1.5px dashed --color-scanora-border-strong`.
  * Background: `--color-scanora-surface`.
  * Icon: Gentle document upload icon in `--color-scanora-brand`.
  * Clear instructions: "Drag & drop report images here, or browse files".
  * Format & size support clearly articulated: "JPG, JPEG, PNG, or PDF up to 10 MB each. Multiple files supported."
* **Active Drag-Over State**:
  * Border: `1.5px solid --color-scanora-brand`.
  * Background: `--color-scanora-surface-muted`.
* **Selected File Previews**:
  * Surface card for each selected file displaying thumbnail, truncated filename, formatted size (`1.4 MB`), and an accessible 44px remove button.

### 7.4. Finding Cards ("Needs Attention")
* Framed in `1px solid --color-scanora-border` on `--color-scanora-surface`.
* Top bar features an amber badge:
  * Badge fill: `--color-scanora-attention-soft`, text: `--color-scanora-attention`, border: `--color-scanora-attention-border`.
  * Explicit text label: *"Needs Attention"*.
* **Data Grid Layout**:
  * **Test / Metric Name**: Figtree 16px SemiBold.
  * **Observed Value**: Figtree/Noto 16px SemiBold in `--color-scanora-ink` (or `--color-scanora-attention` when out of range).
  * **Reference Range**: 13px Noto Sans Medium in `--color-scanora-ink-muted` (e.g., *"Normal reference: 4.0 - 11.0 ×10^3/µL"*).
  * **Plain-Language Explanation**: 15px Noto Sans Regular in `--color-scanora-ink` explaining *why* it is flagged (e.g., "The report notes this value is slightly above the laboratory reference interval.").

### 7.5. "No Issues Identified" State
* Renders when no values meet the attention criteria.
* Surface fill: `--color-scanora-success-soft`, border: `1px solid --color-scanora-success-border`.
* Text: `--color-scanora-success` heading: *"No issues identified in the evaluated data"*.
* Scoped context paragraph: Clearly explains that the evaluated test values were within their respective visible reference ranges, without claiming overall medical clearance.

### 7.6. Interactive Report Chat
* Framed container at the bottom of results phase.
* **Message Bubbles**:
  * *User message*: Right-aligned or distinct fill using `--color-scanora-brand-soft` with deep slate text.
  * *Assistant message*: Left-aligned on `--color-scanora-surface-muted` with `1px solid --color-scanora-border`.
* **Composer**:
  * Textarea with comfortable vertical padding, clear placeholder ("Ask a question about your report findings...").
  * Focus: `3px solid --color-scanora-brand` ring.
  * Key actions: `Enter` sends (when non-empty), `Shift+Enter` inserts newline.
  * Send button: Teal icon/button disabled when input is empty or request is pending.
* **Polite Accessibility**: Uses `aria-live="polite"` for new assistant responses.

---

## 8. Medical-Safety Visual Guidelines

Scanora is an informational aid, not a diagnostic medical device or clinical authority. Visual styling must enforce this distinction:

1. **No Emergency Sensationalism**:
   * Out-of-range lab values are styled in calm amber (`#A96324`), **never in flashing or alarming red**. Red is strictly restricted to system-level errors (e.g., failed network uploads or oversized files).
2. **Textual Pairing (No Color-Only Signaling)**:
   * Every color-coded finding must be accompanied by explicit text (e.g., *"Above reference range"* or *"Flagged in report"*). Never communicate medical status through an amber dot or colored pill alone.
3. **Attribute Evidence Directly to the Document**:
   * Copy must frame facts around the visible artifact: *"The report indicates..."*, *"Visible reference range is..."*, *"The printed text notes..."*.
4. **Display Limitations & Uncertainty**:
   * If a report image is partially blurry, truncated, or missing reference ranges, the UI must display this limitation openly in a neutral callout card rather than hiding uncertainty.
5. **Persistent Medical Disclaimer**:
   * The disclaimer stating that Scanora is for educational purposes and cannot replace professional clinical consultation must be visibly anchored on both the upload and results screens.

---

## 9. Accessibility & Motion Standards

* **Keyboard Navigation**:
  * Full tab stop cycle across dropzone file trigger, remove buttons, analyze actions, chat input, send button, and reset action.
  * All interactive controls feature an unmissable focus ring: `outline: 3px solid var(--color-scanora-primary); outline-offset: 2px;`.
* **Screen Readers**:
  * Semantic heading tree (`h1` for main title, `h2` for primary phase sections, `h3` for individual metrics/findings).
  * Error banners utilize `role="alert"`.
  * Loading and chat responses utilize `role="status"` and `aria-live="polite"`.
* **Touch Targets**:
  * Minimum `44px × 44px` on all mobile clickable areas; `48px` preferred for primary controls.
* **Reduced Motion Compliance**:
  * Strictly honors `@media (prefers-reduced-motion: reduce)`.
  * All transitions and keyframe animations (such as the loading dots) drop to `0.01ms` or are replaced with static text indicators.

---

## 10. Responsive Behavior & Breakpoints

* **Mobile (< 640px)**:
  * Page padding: `24px 16px 32px`.
  * Single-column full-width layouts (`width: 100%`).
  * Primary and secondary buttons expand to `w-full` for easy thumb access.
  * Title scales gracefully from `32px` to `28px`.
* **Tablet / Desktop (≥ 640px)**:
  * Page padding: `48px 24px 48px`.
  * Max container width locked to `720px`.
  * Spacing expands to 32px/48px section separators.
  * Tabular metrics layout displays value and reference range side-by-side.

---

## 11. Do's and Don'ts

### Do
* Keep the background warm and neutral (`#F5F8F7`) to maintain an anti-glare reading environment.
* Pair every out-of-range finding with its source reference interval printed on the report.
* Use `8px` corner radius consistently across cards, panels, and buttons.
* Maintain a single centered column (`720px`) for focused reading.
* Use hairline borders (`1px solid #D6E3E0`) for crisp visual grouping.

### Don't
* Do not use alarmist emergency-red badges for standard abnormal lab values.
* Do not use pure white (`#FFFFFF`) as the full-screen canvas background.
* Do not create multi-column dashboards or sidebars.
* Do not add heavy drop shadows, neon glow rings, or gradient backgrounds.
* Do not invent health scores, wellness meters, or diagnostic likelihood percentages.
* Do not add celebratory confetti or cheerful animations when a report has "no issues identified".