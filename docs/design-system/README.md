# jax-sales design-system brief — for Claude (claude.ai)

This folder is a self-contained brief. Upload the whole folder (or these files + the `assets/` image)
to a claude.ai conversation and ask it to design the jax-sales visual system per the brief.

**Read in this order:**

1. **`00-BRIEF.md`** — the design brief: product context, the existing brand to extend, the 5 user
   roles, the 7 pages to design, and what "done" looks like.
2. **`01-CODEBASE-CONTEXT.md`** — technical grounding: current (unstyled) state of the app, the exact
   list of state/status colors that need real values, current markup patterns per page.
3. **`02-DELIVERABLE-SPEC.md`** — what to hand back and in what format, so it's easy to port into the
   real Next.js/Tailwind v4 codebase afterward.

**`assets/jaxtina-logo.png`** — the real Jaxtina logo, currently used only in the IELTS PDF module.

## Suggested opening prompt

> I've attached a design brief (00-BRIEF.md), codebase context (01-CODEBASE-CONTEXT.md), and a
> deliverable spec (02-DELIVERABLE-SPEC.md) for a design system for an internal Vietnamese CRM tool.
> Please read all three, then design the system per the brief — starting with the token system and
> component specs, then the two page mockups (Tasks Kanban + HR Reports) called out in the deliverable
> spec.
