import type { Extension } from '@codemirror/state'
import type { App } from 'obsidian'
import { StateEffect } from '@codemirror/state'
import { BasePreviewExtension } from '../_base/basePreviewExtension'
import { AspectWidget } from './aspectWidget'

export const toggleAspectEditEffect = StateEffect.define<{ id: string, value: boolean }>()

export class AspectPreviewExtension extends BasePreviewExtension<AspectWidget> {
  constructor(app: App) {
    super(app, {
      startTag: '++aspect',
      endTag: '++',
      fieldName: 'aspectPreview',
    })
  }

  protected createWidget(content: string, id: string, isEditing: boolean, app: App): AspectWidget {
    return new AspectWidget({ content, id, app })
  }

  protected isToggleEditEffect(effect: StateEffect<unknown>): effect is StateEffect<{ id: string, value: boolean }> {
    return effect.is(toggleAspectEditEffect)
  }

  protected shouldProcessContent(content: string): boolean {
    // Check if content contains an image and aspect ratio
    return content.includes('++aspect') && /!\[[^\]]*\]\([^)]+\)/.test(content)
  }

  protected processContentBlock(content: string, startPos: number, endPos: number): void {
    // No additional processing needed for aspect blocks
  }
}

/**
 * Creates the aspect preview extension with the given Obsidian app instance
 */
export function createAspectPreviewExtension(app: App): Extension[] {
  const extension = new AspectPreviewExtension(app)
  return extension.createExtension()
}
