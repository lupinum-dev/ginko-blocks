import type { App } from 'obsidian'
import type { BaseWidgetConfig } from '../_base/baseWidget'
import type { BlockProperties } from '../utils'
import { StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian'
import { BaseWidget } from '../_base/baseWidget'
import { parseColumns, parseLayoutProperties } from '../utils'

// Define the toggle effect locally since it's used in both files
export const toggleLayoutEdit = StateEffect.define<{ id: string, value: boolean }>()

const SIZE_MAP: Record<string, number> = {
  xs: 512,
  sm: 640,
  base: 768,
  md: 1024,
  lg: 1280,
  xl: 1536,
}

/**
 * Represents a single column's data structure
 */
interface ColumnData {
  content: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

interface LayoutWidgetConfig extends BaseWidgetConfig {
  isEditing: boolean
}

/**
 * LayoutWidget represents a custom widget for rendering columnar layouts in the editor.
 * It extends BaseWidget to provide layout functionality with edit/preview modes.
 */
export class LayoutWidget extends BaseWidget {
  private readonly columns: readonly ColumnData[]
  private readonly properties: BlockProperties
  private isEditing: boolean
  static readonly toggleEdit = StateEffect.define<boolean>()

  constructor(content: string, id: string, isEditing: boolean, app: App) {
    super({ content, id, app })
    this.isEditing = isEditing
    // Parse layout properties from the content
    this.properties = this.parseLayoutProperties(content)
    // Use the utility function to parse columns
    this.columns = parseColumns(content)
  }

  private parseLayoutProperties(content: string): BlockProperties {
    const match = content.match(/^::layout(?:\((.*?)\))?\n?/)
    return match ? parseLayoutProperties(content) : {}
  }

  eq(other: LayoutWidget): boolean {
    return this.id === other.id
      && this.content === other.content
      && this.isEditing === other.isEditing
  }

  protected createPreviewView(view: EditorView): HTMLElement {
    const container = this.createContainer('ginko-layout-container')
    const editButton = this.createEditButton((_e) => {
      // Find the position of this widget in the document
      const widgetPos = view.posAtDOM(container)

      // Find the first --col position
      const content = this.content
      const searchPos = content.indexOf('--col')
      if (searchPos !== -1) {
        // Find the end of the --col line
        const lineEnd = content.indexOf('\n', searchPos)
        if (lineEnd !== -1) {
          // Position cursor at the start of the next line
          const nextLineStart = lineEnd + 1
          const tabPos = widgetPos + nextLineStart

          // Set cursor position and scroll into view
          view.dispatch({
            selection: { anchor: tabPos, head: tabPos },
            effects: EditorView.scrollIntoView(tabPos, {
              y: 'center',
              x: 'nearest',
              yMargin: 50,
              xMargin: 20,
            }),
          })

          // Ensure focus is set on the editor
          view.focus()
        }
      }
    })

    container.appendChild(editButton)

    // Handle single column case like CenterWidget
    if (this.columns.length === 1 && this.columns[0].size) {
      const size = this.columns[0].size
      if (size && SIZE_MAP[size]) {
        container.style.maxWidth = `${SIZE_MAP[size]}px`
        container.classList.add('ginko-center-container')
      }
    }

    const columnsContainer = document.createElement('div')
    columnsContainer.className = this.columns.length === 1 ? 'ginko-center-content' : 'ginko-layout-columns'

    // Calculate column widths
    const columnWidths = this.calculateColumnWidths()

    this.columns.forEach((column, index) => {
      const columnElement = document.createElement('div')
      columnElement.className = this.columns.length === 1 ? 'markdown-preview-view' : 'ginko-layout-column'

      // Apply calculated width for multi-column layouts
      if (this.columns.length > 1) {
        columnElement.style.width = `${columnWidths[index]}%`
      }

      // Add click handler for each column
      columnElement.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()

        // Find the position of this widget in the document
        const widgetPos = view.posAtDOM(container)

        // Find the corresponding --col marker and its content start
        const content = this.content
        let searchPos = 0
        let columnPos = widgetPos

        for (let i = 0; i <= index; i++) {
          searchPos = content.indexOf('--col', searchPos)
          if (searchPos !== -1) {
            // Find the end of the --col line
            const lineEnd = content.indexOf('\n', searchPos)
            if (lineEnd !== -1) {
              // Position cursor at the start of the next line
              const nextLineStart = lineEnd + 1
              columnPos = widgetPos + nextLineStart
            }
            searchPos = lineEnd + 1
          }
        }

        // Set cursor to the start of the column content
        view.dispatch({
          selection: { anchor: columnPos, head: columnPos },
          effects: EditorView.scrollIntoView(columnPos, {
            y: 'center',
            x: 'nearest',
            yMargin: 50,
            xMargin: 20,
          }),
        })

        // Ensure focus is set on the editor
        view.focus()
      })

      const content = document.createElement('div')

      const markdownChild = new MarkdownRenderChild(content)
      MarkdownRenderer.render(
        this.app,
        column.content.replace(/::$/, '').trim(),
        content,
        '',
        markdownChild,
      ).then(() => {
        content.querySelectorAll('.edit-block-button').forEach(btn => btn.remove())
        columnElement.appendChild(content)
      })

      columnsContainer.appendChild(columnElement)
    })

    container.appendChild(columnsContainer)
    return container
  }

  private getSizeUnits(size: string): number {
    switch (size) {
      case 'xs': return 25 // 3/12
      case 'sm': return 33.33 // 4/12
      case 'md': return 50 // 6/12
      case 'lg': return 66.67 // 8/12
      case 'xl': return 75 // 9/12
      default: return -1 // Signal no size specified
    }
  }

  /**
   * Calculates the width for each column based on their size properties
   * @returns Array of column widths in percentages
   */
  private calculateColumnWidths(): number[] {
    if (this.columns.length === 0)
      return []
    if (this.columns.length === 1)
      return [100]

    const widths: number[] = Array.from({ length: this.columns.length })
    const remainingIndices: number[] = []
    let remainingWidth = 100
    let specifiedCount = 0

    // First pass: Handle explicitly sized columns
    this.columns.forEach((column, index) => {
      if (column.size) {
        const width = this.getSizeUnits(column.size)
        if (width > 0) {
          widths[index] = width
          remainingWidth -= width
          specifiedCount++
        }
        else {
          remainingIndices.push(index)
        }
      }
      else {
        remainingIndices.push(index)
      }
    })

    // Handle remaining columns
    if (remainingIndices.length > 0) {
      if (specifiedCount === 0) {
        // If no columns have specified sizes, use equal distribution
        const equalWidth = 100 / this.columns.length
        return this.columns.map(() => equalWidth)
      }
      else {
        // Distribute remaining width equally among unspecified columns
        const defaultWidth = remainingWidth / remainingIndices.length
        remainingIndices.forEach((index) => {
          widths[index] = defaultWidth
        })
      }
    }

    return widths
  }

  isEditingState(): boolean {
    return this.isEditing
  }
}
