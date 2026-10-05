# Prismo UI — conventions

Prismo is an NFC/RFID access-control dashboard for hackerspaces. Light theme only: black type on a warm off-white page, translucent-ink greys, two status colours.

## Setup
No provider or wrapper is needed: components are plain React, styled by Tailwind v4 classes that are already compiled into `styles.css`. Load `styles.css` and the components render styled. Put pages on `bg-background-primary`; panels sit on `bg-surface` or `bg-fill-tertiary`.

- `Button` requires `tag` (an analytics id, e.g. `tag="device_save"`). Only pass `to` inside a react-router context; use `href` for plain links and omit both for actions.
- Icons are Iconify names with the `lucide:` or `mdi:` prefix only (`lucide:check`, `mdi:delete-outline`). Any other prefix renders nothing.

## Styling idiom: precompiled Tailwind tokens
Tailwind is compiled ahead of time, so **only classes that already exist in `styles.css` work**. Never invent a utility. When a class you need is missing, use an inline style with a token: `style={{ color: 'var(--color-label-secondary)' }}`.

| Purpose | Classes / tokens |
|---|---|
| Page / surfaces | `bg-background-primary`, `bg-surface`, `bg-fill-tertiary`, `bg-fill-secondary` |
| Text | `text-label-primary`, `text-label-secondary`, `text-label-tertiary` |
| Borders | `border`, `border-separator-primary`, `border-separator-secondary` |
| Status | `text-status-success`, `text-status-error`, `bg-status-success/10`, `bg-status-error/10` |
| Accent (black) | `bg-accent-primary`, `text-accent-primary`, `border-accent-primary` |
| Radius | `rounded-md`, `rounded-xl`, `rounded-2xl` |
| Layout | `flex`, `grid`, `items-center`, `justify-between`, `gap-2/3/4/6`, `p-4/6`, `px-4`, `py-3`, `grid-cols-1`, `lg:grid-cols-2`, `max-w-6xl`, `mx-auto` |
| Type | `text-xs/sm/base/lg/xl`, `font-medium/semibold/bold`, `font-mono` |

CSS variables: `--color-background-primary`, `--color-surface`, `--color-label-{primary,secondary,tertiary}`, `--color-accent-{primary,secondary}`, `--color-fill-{secondary,tertiary}`, `--color-separator-{primary,secondary}`, `--color-status-{success,error}`, `--font-sans`.

## Where the truth lives
Read `styles.css` and `_ds_bundle.css` (the compiled class list) before styling. Each component's `components/general/<Name>/<Name>.prompt.md` and `.d.ts` hold its API.

## Idiomatic panel (the app's own pattern)
```tsx
const { Button, Icon, Tag, TextInput, FieldLabel } = window.PrismoUI;

<div className="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
  <div className="mb-4 flex items-center gap-3">
    <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
      <Icon name="mdi:account-key" className="h-5 w-5" />
    </div>
    <h2 className="text-lg font-bold text-label-primary">Allowed Keys</h2>
    <Tag variant="success" className="ml-auto">Online</Tag>
  </div>
  <FieldLabel htmlFor="key">Key label</FieldLabel>
  <div className="flex gap-2">
    <TextInput id="key" placeholder="e.g. Alice" className="flex-1" />
    <Button tag="add_key" size="sm" icon="mdi:plus">Add</Button>
  </div>
</div>
```
