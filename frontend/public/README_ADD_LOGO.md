Place your permanent site logo in `frontend/public` as either `logo.png` or `logo.svg`.

- File path: `frontend/public/logo.png` or `frontend/public/logo.svg`
- Recommended format: SVG (preferred) or PNG (transparent)
- Recommended size: 256x256 (will be scaled in UI), keep important content centered

Steps:
1. Save the desired logo file to `frontend/public/logo.svg` (or `logo.png`).
2. Restart the Next.js dev server if it's running: `npm run dev` from `frontend/`.

The app header and sidebar will use `/logo.svg` if present, falling back to `/logo.png`.
