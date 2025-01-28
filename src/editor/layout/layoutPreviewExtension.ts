import type { Extension } from '@codemirror/state'
import type { App } from 'obsidian'
import type { PreviewExtensionConfig } from '../_base/basePreviewExtension'
import { StateEffect } from '@codemirror/state'
import { BasePreviewExtension } from '../_base/basePreviewExtension'
import { LayoutWidget } from './layoutWidget'

/**
 * State effect for toggling layout edit mode
 */
export const toggleLayoutEdit = StateEffect.define<{ id: string, value: boolean }>()

/**
 * Extension for handling layout preview functionality
 */
class LayoutPreviewExtension extends BasePreviewExtension<LayoutWidget> {
  constructor(app: App) {
    const config: PreviewExtensionConfig = {
      startTag: '::layout',
      endTag: '::',
      fieldName: 'layoutPreview',
    }
    super(app, config)
  }

  protected createWidget(content: string, id: string, isEditing: boolean, app: App): LayoutWidget {
    return new LayoutWidget(content, id, isEditing, app)
  }

  protected isToggleEditEffect(effect: StateEffect<unknown>): effect is StateEffect<{ id: string, value: boolean }> {
    return effect.is(toggleLayoutEdit)
  }
}

/**
 * Creates the layout preview extension with the given Obsidian app instance
 */
export function createLayoutPreviewExtension(app: App): Extension[] {
  const extension = new LayoutPreviewExtension(app)
  return extension.createExtension()
}
