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
 * Valid callout types that we want to handle
 */
const VALID_CALLOUT_TYPES = ['tip', 'info', 'warning', 'danger', 'note'] as const
type CalloutType = typeof VALID_CALLOUT_TYPES[number]

/**
 * Extension for handling a specific callout type
 */
class SingleCalloutPreviewExtension extends BasePreviewExtension<CalloutWidget> {
  private readonly calloutType: CalloutType

  constructor(app: App, type: CalloutType) {
    const config: PreviewExtensionConfig = {
      startTag: `::${type}`,
      endTag: '::',
      fieldName: `calloutPreview-${type}`,
    }
    super(app, config)
    this.calloutType = type
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
    // Only handle blocks that exactly match our type
    return content.startsWith(`::${this.calloutType}`)
  }
}

/**
 * Creates the callout preview extension with the given Obsidian app instance
 */
export function createCalloutPreviewExtension(app: App): Extension[] {
  // Create an extension for each callout type
  return VALID_CALLOUT_TYPES.flatMap(type =>
    new SingleCalloutPreviewExtension(app, type).createExtension()
  )
}
