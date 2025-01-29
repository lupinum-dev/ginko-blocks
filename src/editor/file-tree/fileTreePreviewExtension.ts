import type { App } from 'obsidian'
import { StateEffect } from '@codemirror/state'
import { BasePreviewExtension } from '../_base/basePreviewExtension'
import { FileTreeWidget } from './fileTreeWidget'

interface FileTreeToggleEditEffect {
  id: string
  value: boolean
}

export class FileTreePreviewExtension extends BasePreviewExtension<FileTreeWidget> {
  private readonly toggleEditEffect = StateEffect.define<FileTreeToggleEditEffect>()

  constructor(app: App) {
    super(app, {
      startTag: '::file-tree',
      endTag: '::',
      fieldName: 'fileTreePreview',
    })
  }

  protected createWidget(content: string, id: string, isEditing: boolean, app: App): FileTreeWidget {
    return new FileTreeWidget({ content, id, app })
  }

  protected isToggleEditEffect(effect: StateEffect<unknown>): effect is StateEffect<FileTreeToggleEditEffect> {
    return effect.is(this.toggleEditEffect)
  }

  protected shouldProcessContent(content: string): boolean {
    return super.shouldProcessContent(content)
  }

  protected processContentBlock(_content: string, _startPos: number, _endPos: number): void {
    // No additional processing needed for file tree blocks
  }
}
