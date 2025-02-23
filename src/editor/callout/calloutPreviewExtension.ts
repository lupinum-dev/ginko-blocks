import type { Extension } from '@codemirror/state'
import type { App } from 'obsidian'
import type { PreviewExtensionConfig } from '../_base/basePreviewExtension'
import { StateEffect } from '@codemirror/state'
import { BasePreviewExtension } from '../_base/basePreviewExtension'
import { CalloutWidget } from './calloutWidget'

/**
 * State effect for toggling callout edit mode
 */
export const toggleCalloutEdit = StateEffect.define<{ id: string, value: boolean }>()

/**
 * Extension for handling callout preview functionality
 */
class CalloutPreviewExtension extends BasePreviewExtension<CalloutWidget> {
  constructor(app: App) {
    const config: PreviewExtensionConfig = {
      startTag: '::', // We'll handle the specific callout types in the widget
      endTag: '::',
      fieldName: 'calloutPreview',
    }
    super(app, config)
  }

  protected processContentBlock(content: string): string {
    // Remove the callout tags and return the inner content
    return content
      .replace(/^::\w+(-)?(?:\n--title\s+[^\n]+)?/, '')
      .replace(/\n?::$/, '')
      .trim()
  }

  protected createWidget(content: string, id: string, isEditing: boolean, app: App): CalloutWidget {
    return new CalloutWidget(content, id, isEditing, app)
  }

  protected isToggleEditEffect(effect: StateEffect<unknown>): effect is StateEffect<{ id: string, value: boolean }> {
    return effect.is(toggleCalloutEdit)
  }

  protected shouldHandleBlock(content: string): boolean {
    // Check if the content starts with a valid callout type
    const validTypes = ['tip', 'info', 'warning', 'danger', 'note']
    const match = content.match(/^::(\w+)(-)?/)
    return match ? validTypes.includes(match[1]) : false
  }
}

/**
 * Creates the callout preview extension with the given Obsidian app instance
 */
export function createCalloutPreviewExtension(app: App): Extension[] {
  const extension = new CalloutPreviewExtension(app)
  return extension.createExtension()
}
