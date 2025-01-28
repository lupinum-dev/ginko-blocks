import type { Extension } from '@codemirror/state'
import type { App } from 'obsidian'
import { StateEffect } from '@codemirror/state'
import { BasePreviewExtension } from '../_base/basePreviewExtension'
import { GalleryWidget } from './galleryWidget'

export const toggleGalleryEditEffect = StateEffect.define<{ id: string, value: boolean }>()

export class GalleryPreviewExtension extends BasePreviewExtension<GalleryWidget> {
  constructor(app: App) {
    super(app, {
      startTag: '++gallery',
      endTag: '++',
      fieldName: 'galleryPreview',
    })
  }

  protected createWidget(content: string, id: string, isEditing: boolean, app: App): GalleryWidget {
    return new GalleryWidget({ content, id, app })
  }

  protected isToggleEditEffect(effect: StateEffect<unknown>): effect is StateEffect<{ id: string, value: boolean }> {
    return effect.is(toggleGalleryEditEffect)
  }

  protected shouldProcessContent(content: string): boolean {
    // Check if content contains at least one image
    return /!\[[^\]]*\]\([^)]+\)/.test(content)
  }

  protected processContentBlock(content: string, startPos: number, endPos: number): void {
    // No additional processing needed for gallery blocks
  }
}

/**
 * Creates the gallery preview extension with the given Obsidian app instance
 */
export function createGalleryPreviewExtension(app: App): Extension[] {
  const extension = new GalleryPreviewExtension(app)
  return extension.createExtension()
}
