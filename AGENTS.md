# AGENTS.md — Estatica (Kynari Landing Page)

## Repository
Single-file static landing page for **Kynari** (ciberseguridad & desarrollo seguro).
No build system, no package manager, no test suite.

## Entry point
`kanario-landing_neww.html` — self-contained HTML with embedded `<style>` and `<script>`.

## Assets
- `kynari-logo.png` — brand logo (used in hero)
- `mqxe9f5s-mqxe81z6-perfil.jpg` — profile photo (used in "Sobre mí")

## How to run
Open `kanario-landing_neww.html` in a browser. No dev server needed.

## Structure
- Single page with sections: Hero, Stats, Servicios, Sobre mí, Portafolio, Contacto, FAQ
- Vanilla JS: matrix rain canvas, floating particles, scroll reveal (IntersectionObserver), mobile nav toggle, FAQ accordion, stat counter animation
- Contact form is client-side only — shows success message but submits nowhere
- All CSS custom properties defined in `:root` — use these for theming
- `data-od-id` attributes on sections are export artifacts from a design tool — do not remove (used as stable selectors)
- Honors `prefers-reduced-motion` — animations and canvas effects disabled

## Conventions
- Language: Spanish (`es-ES`, all content and labels)
- Fonts: Inter Tight (display), Inter (body), JetBrains Mono (mono) via Google Fonts
- No external dependencies beyond Google Fonts
- All rights reserved (footer)
