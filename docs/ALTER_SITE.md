# Alter — marketing + product UI

## Authenticated app shell (`nightshift.*` Tailwind tokens)

The signed-in product uses the **`nightshift` color namespace** in Tailwind (historical name) with **Alter** semantics:

| Token | Hex / value | Role |
|--------|----------------|------|
| `bg` | `#0A0F1C` | App background |
| `bg-light` | `#0F172A` | Sidebar / secondary surfaces |
| `bg-card` | `#10172A` | Elevated panels / cards |
| `surface` | `#0F172A` | Inputs |
| `accent` | `#2563EB` | Primary actions |
| `navy` | `#7C3AED` | Secondary accent (e.g. secondary buttons) |
| `highlight` | `#06B6D4` | Highlights / active nav |
| `text-primary` | `#F3F4F6` | Headings |
| `text-secondary` | `#94A3B8` | Body secondary |
| `text-muted` | `#64748B` | Meta |
| `border` | `rgba(148,163,184,0.14)` | Hairlines |
| `success` / `warning` / `error` | emerald / amber / red | Status |

Global utilities: `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input` in `globals.css` (aligned to the above).

---

## Marketing landing

This section tracks the **public** Alter landing. Product routes use the shell above; copy should say **Alter** everywhere users read it.

## Design system (landing)

| Token | Usage |
|--------|--------|
| **Background** `#0B0F19` | `bg-alter-bg` |
| **Surface** `#111827` | cards, strips |
| **Text** `#E5E7EB` / `#94A3B8` | primary / secondary |
| **Primary** `#4F46E5` | CTAs, key emphasis |
| **Highlight** `#06B6D4` | eyebrows, accents |
| **Secondary accent** `#8B5CF6` | gradients, depth |
| **Success** `#10B981` | trust / local-first |

- **Typography:** `Inter` (body, `font-sans`), `Space Grotesk` (headings, `font-display`). Mono labels via `font-mono` (system stack until JetBrains is wired globally).
- **Spacing:** section rhythm `alter-section` → `py-20 md:py-28`; horizontal `alter-container` → `max-w-6xl` + responsive padding.
- **Buttons:** `alter-btn-primary`, `alter-btn-secondary` in `globals.css`.
- **Cards:** `alter-card`, `alter-card-hover`; border `border-alter-*`, shadow `shadow-alter-card` / `shadow-alter-glow`.
- **Gradients:** hero uses `bg-alter-radial`, `bg-alter-radial-cyan`, subtle `bg-alter-grid`.
- **Motion:** `animate-alter-fade-up`, `animate-alter-pulse-soft` (Tailwind `keyframes` in `tailwind.config.js`).

## Component inventory

| Component | Role |
|-----------|------|
| `AlterLanding` | Composes all sections; full-page `bg-alter-bg`. |
| `AlterSiteHeader` | Sticky wordmark + sign-in / early access. |
| `AlterHero` | Headline, tagline, CTAs, `IdentityVisual`. |
| `IdentityVisual` | Abstract 3-layer diagram (models / personality / actions). |
| `AlterTrustStrip` | Positioning chips. |
| `AlterWhatAlterIs` | Category definition + three pillars. |
| `AlterHowItWorks` | Three product layers with icons. |
| `AlterWhyNow` | Narrative + proof-style bullets. |
| `AlterPrivacy` | Local-first + architecture. |
| `AlterWhoFor` | Persona grid. |
| `AlterDifferentiation` | Comparison table. |
| `AlterPricingCTA` | Early access / waitlist. |
| `AlterFooter` | Brand + minimal links. |

## Recommended site map (marketing + product)

- `/` — Landing (Alter)
- `/sign-in`, `/sign-up` — Clerk (appearance aligned to Alter tokens in root `layout.tsx`)
- `/dashboard` — Product (rename copy to Alter when ready)
- `/onboarding` — Product flow
- Future: `/privacy`, `/security`, `/changelog`, `/careers`, `/blog` (trust + SEO)

## Visual / illustration ideas (not yet built)

- **Diagram:** data flow “sources → on-device profile → model router → actions” (neutral, non-crypto).
- **Abstract UI:** blurred glass panels, monospace metadata (already echoed in `IdentityVisual`).
- **Photography:** avoid stock “happy team”; if used, monochrome + single accent.

## Premium touches to consider next

- Load **JetBrains Mono** via `next/font` for true mono alignment with Tailwind `font-mono`.
- **Reduced motion** query: respect `prefers-reduced-motion` for entrance animations.
- **Open Graph / Twitter** images and `metadata` `openGraph` in `layout.tsx`.
- **Favicon** set matching Alter (indigo + cyan, not generic sparkles).
- **Analytics** with privacy-preserving defaults once you launch.
