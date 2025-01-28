import type { Extension, StateEffect } from '@codemirror/state'
import type { App } from 'obsidian'
import type { PreviewExtensionConfig } from '../_base/basePreviewExtension'
import { BasePreviewExtension } from '../_base/basePreviewExtension'
import { StepsWidget, toggleStepsEdit } from './stepsWidget'

/**
 * Extension for handling steps preview functionality
 */
class StepsPreviewExtension extends BasePreviewExtension<StepsWidget> {
  constructor(app: App) {
    const config: PreviewExtensionConfig = {
      startTag: '::steps',
      endTag: '::',
      fieldName: 'stepsPreview',
    }
    super(app, config)
  }

  // Override shouldProcessContent for steps-specific logic
  protected shouldProcessContent(content: string): boolean {
    // For steps, we only want to process content that starts with ::steps
    return content.trim().startsWith('::steps')
  }

  protected createWidget(content: string, id: string, isEditing: boolean, app: App): StepsWidget {
    return new StepsWidget(content, id, isEditing, app)
  }

  protected isToggleEditEffect(effect: StateEffect<unknown>): effect is StateEffect<{ id: string, value: boolean }> {
    return effect.is(toggleStepsEdit)
  }

  protected processContentBlock(content: string, startPos: number, endPos: number): void {
    // Basic implementation - can be enhanced based on specific needs
    console.log('Processing steps content block:', { content, startPos, endPos })
  }
}

/**
 * Creates the steps preview extension with the given Obsidian app instance
 */
export function createStepsPreviewExtension(app: App): Extension[] {
  const extension = new StepsPreviewExtension(app)
  return extension.createExtension()
}
