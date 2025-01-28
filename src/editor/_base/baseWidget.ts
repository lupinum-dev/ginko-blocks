import type { EditorView } from '@codemirror/view'
import type { App } from 'obsidian'
import { randomUUID } from 'node:crypto'
import { WidgetType } from '@codemirror/view'
import { hashContent, logDebug } from '../utils'

export interface BaseWidgetConfig {
  content: string
  id: string
  app: App
}

/**
 * BaseWidget provides common functionality for all editor widgets
 * Handles instance management, content parsing, and basic DOM operations
 */
export abstract class BaseWidget extends WidgetType {
  protected readonly instanceId: string
  protected readonly content: string
  protected readonly id: string
  protected readonly app: App

  constructor({ content, id, app }: BaseWidgetConfig) {
    super()
    this.instanceId = randomUUID()
    this.content = content
    this.id = id
    this.app = app

    logDebug(`${this.constructor.name} constructor called:`, {
      instanceId: this.instanceId,
      widgetId: id,
      contentHash: hashContent(content),
      time: new Date().toISOString(),
    })
  }

  /**
   * Default equality check based on id and content
   */
  eq(other: BaseWidget): boolean {
    return this.id === other.id
      && this.content === other.content
  }

  /**
   * Creates the widget's DOM structure
   */
  toDOM(view: EditorView): HTMLElement {
    return this.createPreviewView(view)
  }

  /**
   * Abstract method that must be implemented by child classes to create the preview view
   */
  protected abstract createPreviewView(view: EditorView): HTMLElement

  /**
   * Creates an edit button with the specified click handler
   */
  protected createEditButton(clickHandler: (e: MouseEvent) => void): HTMLElement {
    const editButton = document.createElement('div')
    editButton.className = 'edit-block-button'
    editButton.setAttribute('aria-label', 'Edit this block')
    editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-code-2"><path d="m18 16 4-4-4-4"></path><path d="m6 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path></svg>`

    editButton.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      clickHandler(e)
    })

    return editButton
  }

  /**
   * Creates a container element with common attributes
   */
  protected createContainer(className: string): HTMLElement {
    const container = document.createElement('div')
    container.className = `${className} ginko-embed-block markdown-rendered show-indentation-guide`
    container.setAttribute('contenteditable', 'false')
    container.setAttribute('tabindex', '-1')
    return container
  }

  /**
   * Utility method to get widget content
   */
  getContent(): string {
    return this.content
  }

  /**
   * Utility method to get widget instance ID
   */
  getInstanceId(): string {
    return this.instanceId
  }

  /**
   * Default implementation for cursor region check
   */
  checkCursorInRegion(start: number, end: number, cursorLocations: number[], selectionRanges: { from: number, to: number }[]): boolean {
    const cursorPosition = cursorLocations[0]
    return cursorPosition >= start && cursorPosition <= end
  }
}
