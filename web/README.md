# A-SYNCH interface

The production interface and API are served together by the Next.js application at the repository root. This avoids cross-origin configuration and keeps one deployable source of truth.

From the repository root:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Deploy the repository root to Vercel; do not deploy this folder as a separate project.

The Vite project remains available for focused interface development. Run `npm install && npm run dev` in this directory; its development proxy expects the root Next server on port 3000.
