# Example: project rules file

Every project has its own rules that a model cannot guess. Keep them in the project folder (e.g. `PROJECT-RULES.md`)
and read them at the start of a session. This is an anonymised example from a real website project (a print-shop chain).

```markdown
# Project rules

## File
- Figma file: "<exact file name>" (personal account). Pages: Work (designer's scratch — never touch), Design system, Mockups.
- Working area right now: Mockups → section "Checkout" (244:44773).

## Content
- Facts only. Prices, timings, paper types, formats — from the client's production site (its price tables), never invented.
  Promises ("in an hour", "we'll call back in 2 minutes") are removed unless the client wrote them.
- When the production site contradicts itself (header "from 500" vs table "2 610"), use the table and tell the designer.
- Unknown values: a clearly marked example or an honest sentence ("Price — after you choose a pickup point").
- Product names are shown as they are, in quotes, never declined grammatically (the site cannot decline them).

## Edits by the client
- The client edited the cart frame directly. Those edits are not to be reverted or "fixed" without the designer's word.

## Visual rules
- Brand plates have a 45° cut in one corner; every corner, including both ends of the cut, is rounded 20.
  Build: one auto-layout frame (fill, radius 20, clip) + one "notch" vector in the background colour;
  on photos or with a shadow — one background vector with the cut and the shadow on it.
- Whole, even sizes and spacing from the token scale (4, 8, 12, 16, 20, 24, 32 …). No 22.4.
- Icons: brand "chopped" style — octagons instead of circles, 45° cuts, line 1.5, round joins.
- Russian typography: non-breaking spaces after short words (в, на, и …), before dashes, inside numbers and units.

## Tokens
- Colours: INDIGO/indigo-90-a (text), STEEL/steel-80 (secondary), PLATINUM/platinum-10-a (plates), RED/red-60-a (brand).
- Spacing: Spaces/space_N, radius: Radiuses/radius_N. Text styles: Head/…, Subhead/…, Body/…
```
