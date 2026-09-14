/**
 * @module QuicknoteExtension
 * @description
 * Built-in community extension providing a physical sticky note HUD overlay for
 * rapid thought, task, and note capture.
 *
 * Exclusively uses the Noether SDK, IoC Registries, and EventBus.
 *
 * @since 0.2.0
 */

import React from 'react';
import { Extension } from '@/core/extensions/Extension';
import { ExtensionManifest, McpToolResult } from '@/core/extensions/types';
import { NoetherApp } from '@/core/app/NoetherApp';
import { StickyNote02Icon } from '@/components/common/Icons';
import { createDocument } from '@/lib/db/documents';
import { useQuicknoteSettings } from './quicknoteSettings';
import { quicknoteReadme } from './readme';
import { platformAdapter } from '@/lib/platform/platformAdapter';

const LazyQuicknoteModal = React.lazy(() =>
  import('./QuicknoteModal').then((m) => ({ default: m.QuicknoteModal }))
);

const LazyQuicknoteSettingsTab = React.lazy(() =>
  import('./QuicknoteSettingsTab').then((m) => ({ default: m.QuicknoteSettingsTab }))
);

export const QUICKNOTE_MANIFEST: ExtensionManifest = {
  id: 'quicknote',
  name: 'Quicknote',
  version: '1.0.0',
  description: 'Physical sticky note overlay for rapid thought, task, and note capture.',
  author: 'Yuliet Li',
  isCore: false,
  tags: ['quicknote', 'sticky-notes', 'capture', 'post-it', 'scratchpad'],
  readme: quicknoteReadme,
};

export class QuicknoteExtension extends Extension {
  private unregisterGlobalShortcutListener: (() => void) | null = null;
  private unsubscribeSettings: (() => void) | null = null;

  constructor(app: NoetherApp, manifest: ExtensionManifest = QUICKNOTE_MANIFEST) {
    super(app, manifest);
  }

  public onload(): void {
    // 1. Register Quicknote Modal dynamically into the global app modal host
    this.registerModal({
      id: 'quicknote-modal',
      render: () => (
        <React.Suspense fallback={null}>
          <LazyQuicknoteModal />
        </React.Suspense>
      ),
    });

    // 2. Register Quicknote Command & In-App Hotkey
    this.addCommand({
      id: 'quicknote:capture',
      title: 'Quicknote: Capture sticky note',
      section: 'Quick Capture',
      icon: <StickyNote02Icon size={16} />,
      hotkey: 'Ctrl+Shift+Space',
      action: () => {
        useQuicknoteSettings.getState().toggleQuicknote();
      },
    });

    // 3. Register Action Rail Icon
    this.addActionRailIcon(
      'quicknote-action-rail',
      <StickyNote02Icon size={16} />,
      'Quicknote (Ctrl+Shift+Space)',
      () => {
        useQuicknoteSettings.getState().toggleQuicknote();
      },
      2
    );

    // 4. Register Extension Settings Tab
    this.registerSettingTab({
      id: 'quicknote-settings',
      name: 'Quicknote',
      icon: <StickyNote02Icon size={14} />,
      render: () => (
        <React.Suspense fallback={null}>
          <LazyQuicknoteSettingsTab />
        </React.Suspense>
      ),
    });

    // 5. Register System-Wide Global Hotkey
    const currentShortcut = useQuicknoteSettings.getState().quicknoteShortcut || 'Ctrl+Shift+Space';
    platformAdapter.registerGlobalShortcut('quicknote', currentShortcut);

    this.unregisterGlobalShortcutListener = platformAdapter.onGlobalShortcut((id: string) => {
      if (id === 'quicknote') {
        useQuicknoteSettings.getState().toggleQuicknote();
      }
    });

    // Listen for shortcut changes in settings
    this.unsubscribeSettings = useQuicknoteSettings.subscribe((state, prevState) => {
      if (state.quicknoteShortcut !== prevState.quicknoteShortcut) {
        platformAdapter.registerGlobalShortcut('quicknote', state.quicknoteShortcut || 'Ctrl+Shift+Space');
      }
    });

    // 5a. Register Omnibox Search Provider (Ctrl+P / Ctrl+K with 'qn:')
    if (typeof (this as any).registerSearchProvider === 'function') {
      (this as any).registerSearchProvider({
        id: 'quicknote-search',
        prefix: 'qn:',
        placeholder: 'Type quicknote thought to capture or find...',
        search: async (query: string) => {
          const q = query.trim();
          if (!q) {
            return [
              {
                id: 'qn:open-modal',
                title: 'Open Quicknote Sticky HUD',
                description: 'Toggle quick capture overlay (Ctrl+Shift+Space)',
                category: 'Quicknote',
                badge: 'HUD',
                onSelect: () => {
                  useQuicknoteSettings.getState().toggleQuicknote();
                },
              },
            ];
          }

          return [
            {
              id: `qn:capture-${Date.now()}`,
              title: `Capture Quicknote: "${q}"`,
              description: 'Save new quick note immediately to configured folder',
              category: 'Quicknote',
              badge: 'Capture',
              onSelect: async () => {
                const folderName = (useQuicknoteSettings.getState().quicknoteFolder || 'Quicknotes').trim();
                const allDocs = this.app.hearth.documents;
                let targetFolderId: string | null = null;
                if (folderName) {
                  const existingFolder = allDocs.find(
                    (d: any) => d.is_folder && d.title.toLowerCase() === folderName.toLowerCase()
                  );
                  if (existingFolder) {
                    targetFolderId = existingFolder.id;
                  }
                }
                const noteTitle = q.length > 40 ? q.slice(0, 40) + '...' : q;
                const newDoc = await this.app.hearth.createNewNote(noteTitle, targetFolderId);
                if (newDoc) {
                  const docContent = {
                    type: 'doc',
                    content: [
                      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: noteTitle }] },
                      { type: 'paragraph', content: [{ type: 'text', text: q }] },
                    ],
                  };
                  await this.app.hearth.saveDocument(newDoc.id, JSON.stringify(docContent), noteTitle);
                  this.app.workspace.showToast(`Saved quicknote: "${noteTitle}"`, 'success');
                }
              },
            },
          ];
        },
      });
    }

    // 5b. Register Tab Context Menu Action
    if (typeof (this as any).registerTabContextMenuAction === 'function') {
      (this as any).registerTabContextMenuAction({
        id: 'quicknote:open-scratch',
        title: 'Open Quicknote Scratchpad',
        order: 60,
        action: () => {
          useQuicknoteSettings.getState().toggleQuicknote();
        },
      });
    }

    // 5c. Register Custom Canvas Card Renderer via EventBus
    this.app.events.emit('canvas:register-card-renderer', {
      id: 'quicknote-card',
      match: (doc: any) => doc?.title?.toLowerCase?.().includes('quicknote') || false,
      render: (props: any) => {
        return React.createElement(
          'div',
          {
            className: 'w-full h-full p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-sans select-none overflow-hidden flex flex-col',
          },
          React.createElement(
            'div',
            { className: 'font-semibold text-amber-300 mb-1 flex items-center gap-1.5' },
            React.createElement('span', { className: 'w-2 h-2 rounded-full bg-amber-400' }),
            props.doc?.title || 'Quicknote'
          ),
          React.createElement(
            'div',
            { className: 'text-[var(--noether-text-secondary,#bbb)] line-clamp-4' },
            typeof props.doc?.content_json === 'string' ? props.doc.content_json.slice(0, 150) : ''
          )
        );
      },
    });

    // 6. Register MCP Tools
    // ── Tool: capture ──
    this.registerTool({
      name: 'capture',
      description: 'Capture a quick note into the configured quicknotes folder.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Optional title for the quick note',
          },
          content: {
            type: 'string',
            description: 'Note body text content',
          },
        },
        required: ['content'],
      },
      handler: async (args: Record<string, unknown>): Promise<McpToolResult> => {
        try {
          const content = String(args.content ?? '');
          if (!content.trim() && !args.title) {
            throw new Error('Cannot capture an empty quick note.');
          }

          const rawTitle = args.title ? String(args.title).trim() : '';
          const folderName = (useQuicknoteSettings.getState().quicknoteFolder || 'Quicknotes').trim();

          const allDocs = this.app.hearth.documents;
          let targetFolderId: string | null = null;

          if (folderName) {
            const existingFolder = allDocs.find(
              (d) => d.is_folder && d.title.toLowerCase() === folderName.toLowerCase()
            );
            if (existingFolder) {
              targetFolderId = existingFolder.id;
            } else {
              const newFolder = await createDocument(folderName, null, true, 'base');
              targetFolderId = newFolder.id;
            }
          }

          // Derive title
          let noteTitle = rawTitle;
          if (!noteTitle) {
            const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            if (lines.length > 0) {
              const firstLine = lines[0].replace(/^(?:#{1,6}|[-*•]|\>|\-\s*\[[ xX]\])\s*/, '').trim();
              if (firstLine) {
                noteTitle = firstLine.slice(0, 50).trim();
              }
            }
          }
          if (!noteTitle) {
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}.${String(now.getSeconds()).padStart(2, '0')}`;
            noteTitle = `Quicknote - ${dateStr} ${timeStr}`;
          }

          const docContent: any = {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: noteTitle }],
              },
            ],
          };

          for (const line of content.split('\n')) {
            docContent.content.push({
              type: 'paragraph',
              content: line ? [{ type: 'text', text: line }] : [],
            });
          }

          const contentJson = JSON.stringify(docContent);
          const newDoc = await this.app.hearth.createNewNote(noteTitle, targetFolderId);
          if (newDoc) {
            this.app.hearth.saveDocument(newDoc.id, contentJson, noteTitle);
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  document: {
                    id: newDoc?.id,
                    title: noteTitle,
                    folderId: targetFolderId,
                    folderName,
                  },
                }),
              },
            ],
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            isError: true,
            content: [{ type: 'text', text: msg }],
          };
        }
      },
    });
  }

  public onunload(): void {
    if (this.unregisterGlobalShortcutListener) {
      this.unregisterGlobalShortcutListener();
      this.unregisterGlobalShortcutListener = null;
    }
    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
      this.unsubscribeSettings = null;
    }
    platformAdapter.unregisterGlobalShortcut('quicknote');
  }
}

export default QuicknoteExtension;
