import type { Extension } from '@codemirror/state'
import type { App } from 'obsidian'
import { FileTreePreviewExtension } from './fileTreePreviewExtension'

export function createFileTreeExtension(app: App): Extension[] {
  const extension = new FileTreePreviewExtension(app)
  return extension.createExtension()
}
