<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend UI Standards

Based on project conventions, please adhere to the following when developing React components for the web app:

1. **Forms vs. Event Handlers:** Do NOT use `<form>` elements and `FormData` just to make simple REST API calls. Prefer simple `onClick` handlers directly on action buttons to keep the DOM clean.
2. **Design System:** Use standard UI components (e.g., `import { Button } from "@/components/ui/button"`) rather than native HTML elements like `<button>`. Utilize the built-in props provided by the component (e.g., the `icon="mdi:icon-name"` prop on `Button` instead of manually nesting an `<Icon>` component).
3. **Loading States:** Do NOT add manual loading logic or "spinners" for network requests triggered by buttons. The project explicitly omits these in favor of maximum simplicity unless specifically requested.
