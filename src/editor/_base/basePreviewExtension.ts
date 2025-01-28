import type {
  Extension,
  StateEffect,
  Transaction,
} from '@codemirror/state'
import type {
  DecorationSet,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import type { App } from 'obsidian'
import type { CursorLocation, RegionData } from '../utils'
import { syntaxTree } from '@codemirror/language'
import {
  RangeSetBuilder,
  StateField,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
} from '@codemirror/view'
import { editorLivePreviewField } from 'obsidian'
import {
  checkCursorInRegion,
  collectExistingWidgets,

  getCursorLocations,
  getRegionByTags,
  hashContent,

} from '../utils'

/**
 * Base interface for update context shared across all preview extensions
 */
export interface BaseUpdateContext<T extends WidgetType> {
  docText: string
  editState: Map<string, boolean>
  ranges: CursorLocation[]
  existingWidgets: Map<string, T>
  app: App
  transaction: Transaction
}

/**
 * Configuration for creating a preview extension
 */
export interface PreviewExtensionConfig {
  startTag: string // e.g., "++center"
  endTag: string // e.g., "++"
  fieldName: string // e.g., "centerPreview"
}

/**
 * Abstract base class for preview extensions
 */
export abstract class BasePreviewExtension<T extends WidgetType> {
  protected readonly app: App
  protected readonly config: PreviewExtensionConfig
  protected readonly editStateField: StateField<Map<string, boolean>>

  constructor(app: App, config: PreviewExtensionConfig) {
    this.app = app
    this.config = config
    this.editStateField = this.createEditStateField()
  }

  /**
   * Creates the preview extension with all necessary state fields
   */
  public createExtension(): Extension[] {
    const previewField = StateField.define<DecorationSet>({
      create: () => Decoration.none,
      update: (oldState, transaction) => this.updatePreviews(oldState, transaction),
      provide: field => EditorView.decorations.from(field),
    })

    return [previewField, this.editStateField]
  }

  /**
   * Creates a widget instance. Must be implemented by derived classes.
   */
  protected abstract createWidget(
    content: string,
    id: string,
    isEditing: boolean,
    app: App
  ): T

  /**
   * Creates the edit state field for tracking widget edit states
   */
  private createEditStateField(): StateField<Map<string, boolean>> {
    return StateField.define<Map<string, boolean>>({
      create: () => new Map(),
      update: (value, tr) => {
        const newValue = new Map(value)
        for (const effect of tr.effects) {
          if (this.isToggleEditEffect(effect)) {
            const { id, value } = effect.value
            value ? newValue.set(id, true) : newValue.delete(id)
          }
        }
        return newValue
      },
    })
  }

  /**
   * Type guard for toggle edit effects
   */
  protected abstract isToggleEditEffect(effect: StateEffect<unknown>): effect is StateEffect<{ id: string, value: boolean }>

  /**
   * Updates previews based on the current transaction
   */
  private updatePreviews(oldState: DecorationSet, transaction: Transaction): DecorationSet {
    if (!this.shouldUpdatePreviews(transaction)) {
      return oldState
    }

    const docText = transaction.state.doc.toString()
    if (!docText.includes(this.config.startTag)) {
      return Decoration.none
    }

    const builder = new RangeSetBuilder<Decoration>()
    let pos = 0

    while (pos < docText.length) {
      const nextTag = docText.indexOf(this.config.startTag, pos)
      if (nextTag === -1)
        break

      const parseResult = this.parseContent(docText, nextTag)

      if (parseResult) {
        if (this.shouldProcessContent(parseResult.content)) {
          const region: RegionData = {
            startIndex: nextTag,
            endIndex: parseResult.endPos,
            regionText: parseResult.content,
            remainingText: docText.slice(parseResult.endPos),
          }

          const context: BaseUpdateContext<T> = {
            docText,
            editState: transaction.state.field(this.editStateField),
            ranges: getCursorLocations(transaction),
            existingWidgets: collectExistingWidgets(
              oldState,
              transaction.state.doc.length,
              this.createWidget('', '', false, this.app).constructor,
            ),
            app: this.app,
            transaction,
          }

          const decoration = this.createDecoration(region, context)
          if (decoration) {
            builder.add(region.startIndex, region.endIndex, decoration)
          }
        }
        pos = parseResult.endPos
      }
      else {
        pos = nextTag + this.config.startTag.length
      }
    }

    return builder.finish()
  }

  /**
   * Determines if previews should be updated based on transaction
   */
  protected shouldUpdatePreviews(transaction: Transaction): boolean {
    // First check if live preview is enabled
    if (transaction.state.field(editorLivePreviewField) === false) {
      return false
    }

    // Check if we need to update based on changes
    const shouldUpdate = transaction.docChanged
      || transaction.effects.length > 0
      || !!transaction.selection

    return shouldUpdate
  }

  /**
   * Builds decorations for all regions
   */
  protected buildDecorations(context: BaseUpdateContext<T>): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    let workingText = context.docText
    let startIndexOffset = 0

    while (true) {
      const region = getRegionByTags(
        workingText,
        startIndexOffset,
        context.docText,
        this.config.startTag,
        this.config.endTag,
      )

      if (!region)
        break

      workingText = region.remainingText
      startIndexOffset = region.endIndex

      const decoration = this.createDecoration(region, context)
      if (decoration) {
        builder.add(region.startIndex, region.endIndex, decoration)
      }
    }

    return builder.finish()
  }

  /**
   * Creates a decoration for a single region
   */
  protected createDecoration(region: RegionData, context: BaseUpdateContext<T>): Decoration | null {
    // First check if we're in a code block
    if (this.isInCodeBlock(context.transaction, region.startIndex)) {
      return null
    }

    const cursorInRegion = checkCursorInRegion(
      region.startIndex,
      region.endIndex,
      context.ranges,
      Array.from(context.transaction.state.selection.ranges),
    )

    if (cursorInRegion) {
      return null
    }

    const contentHash = hashContent(region.regionText)
    const id = `${this.config.fieldName}-${contentHash}`
    const isEditing = context.editState.get(id) || false

    const widget = this.getOrCreateWidget(region, id, isEditing, context)
    return Decoration.replace({
      widget,
      inclusive: true,
    })
  }

  /**
   * Gets an existing widget or creates a new one
   */
  protected getOrCreateWidget(
    region: RegionData,
    id: string,
    isEditing: boolean,
    context: BaseUpdateContext<T>,
  ): T {
    const existingWidget = context.existingWidgets.get(id)
    if (existingWidget) {
      return existingWidget
    }

    return this.createWidget(region.regionText, id, isEditing, context.app)
  }

  protected parseContent(text: string, startPos: number): { content: string, endPos: number } | null {
    const stack: string[] = []
    let currentPos = startPos
    let contentStart = -1
    let nestingLevel = 0

    // Split text into lines for easier processing
    const lines = text.slice(startPos).split('\n')

    // Track the initial tag we're looking for
    let initialTag = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineStart = currentPos

      // Check for end tags first
      if (line.trim() === '::') {
        if (stack.length > 0) {
          nestingLevel--
          const lastTag = stack.pop()

          // Only return content if we're closing our initial tag
          if (nestingLevel === 0 && lastTag === initialTag) {
            const content = text.slice(contentStart, lineStart + line.length).trim()
            return {
              content,
              endPos: lineStart + line.length,
            }
          }
        }
      }
      // Then check for start tags
      else if (line.trim().startsWith('::')) {
        const tagName = line.trim().split(/[\s(]/)[0] // Get the tag name before any parameters

        if (contentStart === -1) {
          contentStart = lineStart
          initialTag = tagName
        }
        nestingLevel++
        stack.push(tagName)
      }

      currentPos += line.length + 1 // +1 for the newline character
    }

    return null
  }

  protected shouldProcessContent(content: string): boolean {
    // Check if we're inside a code block by looking at the document structure
    const lines = content.split('\n')
    const firstLine = lines[0].trim()

    // If the content starts with ``` it's a code block, don't process
    if (firstLine.startsWith('```')) {
      return false
    }

    return true
  }

  /**
   * Process a content block - must be implemented by derived classes
   */
  protected abstract processContentBlock(content: string, startPos: number, endPos: number): void

  // Update the update method to use these new helpers
  update(transaction: ViewUpdate): void {
    const docText = transaction.state.doc.toString()

    if (!docText.includes(this.config.startTag)) {
      return
    }

    let pos = 0
    while (pos < docText.length) {
      const nextTag = docText.indexOf(this.config.startTag, pos)
      if (nextTag === -1) {
        break
      }

      const parseResult = this.parseContent(docText, nextTag)

      if (parseResult) {
        if (this.shouldProcessContent(parseResult.content)) {
          this.processContentBlock(parseResult.content, nextTag, parseResult.endPos)
        }
      }

      pos = parseResult ? parseResult.endPos : nextTag + this.config.startTag.length
    }
  }

  protected isInCodeBlock(transaction: Transaction, pos: number): boolean {
    const tree = syntaxTree(transaction.state)
    let currentNode = tree.resolveInner(pos, 1)

    // Check if we're inside a code block
    while (currentNode && currentNode.parent) { // Add null check for parent
      if (currentNode.type.name.includes('codeblock')
        || currentNode.type.name.includes('code_block')
        || currentNode.type.name.includes('HyperMD-codeblock')) {
        return true
      }
      currentNode = currentNode.parent
    }
    return false
  }
}
