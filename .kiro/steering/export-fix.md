---
inclusion: manual
---

# Export Fix — Tauri XLSX Save

## Problem (recurring)

In Tauri desktop apps, `URL.createObjectURL` + `a.click()` does NOT trigger a file download.
Tauri's WebView blocks filesystem access via browser APIs.

Dynamic imports of `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` can also fail
if Vite doesn't bundle them correctly at build time.

## Permanent Solution

**File:** `analyzer-pro/src/utils/exportUtils.ts`

### In Tauri environment:
1. Detect Tauri via `window.__TAURI_INTERNALS__`
2. Use `invoke('plugin:dialog|save', { defaultPath, filters })` to open native save dialog
3. Use `invoke('export_native_excel', { filePath, demographics, likert, generalCommentary })` to build and write the file via the Rust backend

The Rust command `export_native_excel` is registered in:
- `analyzer-pro/src-tauri/src/lib.rs` — `invoke_handler`
- `analyzer-pro/src-tauri/src/export.rs` — implementation using `rust_xlsxwriter`

### In browser environment:
Use ExcelJS + Blob + `<a download>` as normal.

### Key rule:
NEVER use `@tauri-apps/plugin-dialog` or `@tauri-apps/plugin-fs` via dynamic import.
ALWAYS use `invoke()` from `@tauri-apps/api/core` directly.

## Capabilities/Permissions

`analyzer-pro/src-tauri/capabilities/default.json` must include:
- `"dialog:default"`
- `"fs:default"`
- `"fs:allow-write-file"` with `{ "path": "**" }`
