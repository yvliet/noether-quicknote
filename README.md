# Quicknote for Noether

Instant floating scratchpad drawer for capturing thoughts, web snippets, and fleeting ideas without leaving your flow.

---

## 1. Overview & User Experience

When inspiration strikes in the middle of writing or browsing, you shouldn't have to navigate away from your current workspace or create a full file in the explorer just to jot down a sentence.

**Quicknote** provides an instant floating scratchpad drawer. Summoned with a single hotkey, it glides into view, lets you type or paste quick notes, and automatically saves or appends them to your daily journal or designated inbox note.

### Where It Lives in Noether
- **Global Floating Drawer**: Press `Ctrl+Alt+N` from anywhere in Noether to toggle the scratchpad overlay.
- **Command Palette**: Run "Toggle Quicknote scratchpad" to open the drawer.
- **Status Bar**: A minimal scratchpad icon in the status bar opens your drawer with 1 click.

## 2. Features & Step-by-Step Guide

### 1. Capturing Fleeting Notes
1. Press `Ctrl+Alt+N` at any time while working in Noether.
2. The minimal scratchpad appears over your active workspace with automatic cursor focus.
3. Type your fleeting thought, code snippet, or meeting task.
4. Press `Ctrl+Enter` to save it to your `Inbox.md` note, or press `Escape` to dismiss the drawer.

### 2. Customizing Destination Note
Open **Settings** (`Ctrl+,`) → **Quicknote** to customize:
- Destination inbox note path (default: `Inbox.md`).
- Prepend or append timestamp headings.
- Hotkey bindings.

## 3. Architecture & SDK Blueprint (For Extension Builders)

Quicknote demonstrates how to mount floating modal drawers and bind global window keyboard hooks via the Noether SDK.

### SDK Extension Points Used
- `this.registerPortalSlot()`: Injects modal drawer components into host layout overlays.
- `this.addCommand()`: Registers the global `Ctrl+Alt+N` toggle shortcut.
- `this.app.vault`: Appends scratchpad entries to target notes atomically.

### Real SDK Implementation Pattern

```typescript
import { Extension, NoetherApp } from 'noether';

export default class QuicknoteExtension extends Extension {
  async onload(): Promise<void> {
    this.addCommand({
      id: 'quicknote:toggle',
      title: 'Quicknote: Toggle Scratchpad',
      hotkey: 'Mod-Alt-n',
      action: (app: NoetherApp) => {
        this.toggleDrawer();
      },
    });
  }
}
```

## 4. MCP Tools Reference

### 1. `quicknote_capture`
- **Description**: Appends a text entry to the Quicknote inbox scratchpad.
- **Parameters**:
  - `text` (string, required): Content to append.

## 5. Development & Local Building

To build and test this community extension locally:

```bash
git clone https://github.com/yvliet/noether-quicknote.git
cd noether-quicknote
npm install
npm run build
```

Copy the compiled bundle `dist/main.js` and `manifest.json` into your vault's `.noether/extensions/noether-quicknote/` directory and reload Noether.

## 6. License

MIT © [Yuliet Li](https://github.com/yvliet)
