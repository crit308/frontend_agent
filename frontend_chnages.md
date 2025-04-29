[ ] **Phase 0 — Project Preparation**

- [ ] Create a new Git branch `feat/ldcb-integration` dedicated to the migration.
- [ ] Make sure `learn-draw-chat-buddy-main` folder is committed so we can reference code during the migration.
- [ ] Confirm the dev server (`npm run dev`) starts without errors in both projects.

---

[ ] **Phase 1 — Dependencies & Tooling Alignment**

1. 📦 Dependencies
   - [ ] Compare `package.json` files of both projects.
   - [ ] Install missing runtime dependencies required by **LDCB** (learn-draw-chat-buddy) components, e.g. `lucide-react`, `class-variance-authority`, `@radix-ui/react-*`, `zustand`, `sonner`, etc.
   - [ ] Align versions of common libraries (`react`, `react-dom`, `@headlessui/*`, `tailwindcss`, `autoprefixer`, `postcss`, etc.) to the newest version used by either project.
   - [ ] Re-run `npm install` and commit the updated `package-lock.json`.

2. ⚙️ Configuration files
   - [ ] Merge **Tailwind** config (`tailwind.config.ts` → `tailwind.config.js`).
     - [ ] Copy theme extensions (colors, fontFamily, keyframes, etc.).
     - [ ] Add the LDCB `content` globs (e.g. `src/**/*.{ts,tsx}`) so new UI components are styled.
   - [ ] Merge **ESLint/TSConfig/Prettier** custom rules if any.
   - [ ] Add/merge `postcss.config.js` plugins if LDCB uses extras (e.g. `tailwindcss-animate`).

---

[ ] **Phase 2 — Port the Design System / UI Library**

- [ ] Create `src/components/ui/` in the AI-Tutor repo (if not already present).
- [ ] Copy all files from `learn-draw-chat-buddy-main/src/components/ui/*` into the new folder **without modifications**.
- [ ] Fix absolute/relative import paths inside the copied files (e.g. replace `@/lib/utils` → `../../lib/utils`).
- [ ] Copy supportive utility files:
  - [ ] `learn-draw-chat-buddy-main/src/lib/utils.ts` → `src/lib/utils.ts`.
  - [ ] Any hooks used by UI components (e.g. `use-toast.ts`).
- [ ] Run `npm run lint` / `tsc` and resolve any type errors.

---

[x] **Phase 3 — Global Styling**

- [x] Copy `index.css` (or equivalent global stylesheet) additions such as `tailwindcss/animate.css` imports.
- [x] Ensure custom CSS variables declared in LDCB (`:root {}`) are present in the main app.
- [x] Verify dark-mode class (`dark`) handling matches our current setup; adjust `globals.css` if necessary.

---

[x] **Phase 4 — Application Layout (Visual Structure)**

1. Root Layout
   - [x] Create/Update `src/components/layout/RootLayout.tsx` (or `app/layout.tsx` if using App Router) to use the **Sidebar** (`components/ui/sidebar.tsx`) and top-level navigation from LDCB.
2. Pages
   - [x] Update existing pages to render inside the new layout (wrap with `<RootLayout>`).
   - [x] Remove/replace the old navbar/aside components that conflict.
3. Meta & SEO
   - [x] Port any `<Head>` meta tags from LDCB `index.html` (title, description, favicon links).

---

[ ] **Phase 5 — Feature Components Integration**

1. 💬 Chat Interface
   - [x] Copy `ChatInterface.tsx`, `ChatMessage.tsx` into `src/components/chat/`.
   - [x] Replace internal state/store in these components with the existing AI-Tutor chat logic (API calls, context provider).
   - [/] Remove duplicate logic that already exists in AI-Tutor. (Marked as in progress - message display needs further work)

2. 📝 Whiteboard
   - [x] Copy `Whiteboard.tsx` and `WhiteboardTools.tsx` into `src/components/whiteboard/`.
   - [x] Ensure drawing library deps (`@svgdotjs/svg.js`, `penpal`, etc.) are installed or migrated. (Installed svg.js, panzoom, react-hooks-svgdrawing)
   - [ ] Connect whiteboard save/submit actions to our backend (if applicable).

---

[ ] **Phase 6 — Routing & State Management**

- [x] Wire up routes or dynamic tabs so users can switch between Chat and Whiteboard views, matching the LDCB UX. (Implemented Tabs in /learn page)
- [x] Verify existing global state management (`context`, `zustand`, `redux`, etc.) is compatible with new components. (ChatInterface adapted to useSessionStore; Whiteboard seems ok for now)
- [ ] Remove redundant state stores. (Checked ChatInterface/Whiteboard, none found that needed removal)

---

[ ] **Phase 7 — QA & Polish**

- [ ] Run the dev server and manually test all user journeys.
- [ ] Fix visual glitches (spacing, colors, responsiveness).
- [ ] Write unit/component tests for newly integrated components.
- [ ] Confirm Lighthouse scores (performance & accessibility) are not degraded.

---

[ ] **Phase 8 — Cleanup**

- [ ] Delete old, now unused components/styles.
- [ ] Grep for any remaining imports from `learn-draw-chat-buddy-main` and update/remove.
- [ ] Ensure `npm run build` succeeds.
- [ ] Push branch and create PR for review.

---

[ ] **Phase 9 — Remove Temporary Folder**

- [ ] Once PR is approved & merged, **delete the folder** `learn-draw-chat-buddy-main/` and commit.
- [ ] Tag release `ldcb-integration-complete`.

---

### Progress Legend

```
[ ]  = Todo
[/] = In Progress
[x]  = Complete
```
