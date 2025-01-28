import type { Extension } from '@codemirror/state'
import type { App } from 'obsidian'
import type { PreviewExtensionConfig } from '../_base/basePreviewExtension'
import { StateEffect } from '@codemirror/state'
import { BasePreviewExtension } from '../_base/basePreviewExtension'
import { TabWidget } from './tabsWidget'

/**
 * State effect for toggling tab edit mode
 */
export const toggleTabEdit = StateEffect.define<{ id: string, value: boolean }>()

/**
 * Extension for handling tab preview functionality
 */
export class TabPreviewExtension extends BasePreviewExtension<TabWidget> {
  constructor(app: App) {
    const config: PreviewExtensionConfig = {
      startTag: '::tabs',
      endTag: '::',
      fieldName: 'tabPreview',
    }
    super(app, config)
  }

  // Override shouldProcessContent for tabs-specific logic
  protected shouldProcessContent(_content: string): boolean {
    // For tabs, we always want to process the content
    // The nested steps will be handled by the steps extension
    return true
  }

  protected createWidget(content: string, id: string, isEditing: boolean, app: App): TabWidget {
    return new TabWidget(content, id, isEditing, app)
  }

  protected processContentBlock(content: string): string {
    return content
  }

  protected isToggleEditEffect(effect: StateEffect<unknown>): effect is StateEffect<{ id: string, value: boolean }> {
    return effect.is(toggleTabEdit)
  }
}

/**
 * Creates the tab preview extension with the given Obsidian app instance
 */
export function createTabPreviewExtension(app: App): Extension[] {
  const extension = new TabPreviewExtension(app)
  return extension.createExtension()
}
