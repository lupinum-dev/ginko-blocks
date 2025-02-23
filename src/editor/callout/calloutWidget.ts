import type { App } from 'obsidian'
import type { BaseWidgetConfig } from '../_base/baseWidget'
import { StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { MarkdownRenderChild, MarkdownRenderer, getIcon } from 'obsidian'
import { BaseWidget } from '../_base/baseWidget'
import { getBlockState, setBlockState } from '../utils/blockState'

// Define the toggle effect
export const toggleCalloutEdit = StateEffect.define<{ id: string, value: boolean }>()

interface CalloutProperties {
  type: string
  title?: string
  collapsed?: boolean
}

interface CalloutWidgetConfig extends BaseWidgetConfig {
  isEditing: boolean
}

export class CalloutWidget extends BaseWidget {
  private readonly properties: CalloutProperties
  private isEditing: boolean
  protected content: string // Changed to protected to match base class
  private isCollapsed: boolean

  constructor(content: string, id: string, isEditing: boolean, app: App) {
    super({ content, id, app })
    this.isEditing = isEditing
    this.content = content
    this.properties = this.parseCalloutProperties(content)
    this.isCollapsed = this.loadCollapsedState()
  }

  private loadCollapsedState(): boolean {
    return getBlockState<boolean>(this.id, 'callout', this.properties.collapsed || false)
  }

  private saveCollapsedState(collapsed: boolean): void {
    setBlockState<boolean>(this.id, 'callout', collapsed)
  }

  private parseCalloutProperties(content: string): CalloutProperties {
    const firstLine = content.split('\n')[0]
    const properties: CalloutProperties = {
      type: 'note',
      collapsed: false
    }

    // Parse the callout type and collapsed state
    const match = firstLine.match(/^::(\w+)(-)?/)
    if (match) {
      properties.type = match[1]
      properties.collapsed = !!match[2]
    }

    // Parse title if present
    const titleMatch = content.match(/--title\s+(.+)/)
    if (titleMatch) {
      properties.title = titleMatch[1].trim()
    }

    return properties
  }

  private getCalloutContent(): string {
    let content = this.content
      .replace(/^::\w+(-)?/, '') // Remove the callout type
      .replace(/--title\s+[^\n]+\n?/, '') // Remove the title line
      .replace(/\n?::$/, '') // Remove the ending tag
      .trim()

    return content
  }

  eq(other: BaseWidget): boolean {
    if (!(other instanceof CalloutWidget)) return false
    return this.id === other.id
      && this.content === other.content
      && this.isEditing === other.isEditing
      && this.isCollapsed === other.isCollapsed
  }

  protected createPreviewView(view: EditorView): HTMLElement {
    const container = document.createElement('div')
    container.className = `ginko-callout type-${this.properties.type}`
    if (this.isCollapsed) {
      container.classList.add('is-collapsed')
    }

    // Create header
    const header = document.createElement('div')
    header.className = 'ginko-callout-header'

    // Add icon
    const icon = document.createElement('div')
    icon.className = 'ginko-callout-icon'
    const iconEl = this.getIconForType(this.properties.type)
    if (iconEl) icon.appendChild(iconEl)
    header.appendChild(icon)

    // Add title
    const title = document.createElement('div')
    title.className = 'ginko-callout-title'
    title.textContent = this.properties.title || this.capitalizeFirstLetter(this.properties.type)

    // Add originally-collapsed indicator if it was defined with a minus
    if (this.properties.collapsed) {
      const indicator = document.createElement('div')
      indicator.className = 'originally-collapsed'
      indicator.title = 'Originally defined as collapsed'

      // Create custom thick minus icon
      const minusIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      minusIcon.setAttribute('viewBox', '0 0 24 24')
      minusIcon.setAttribute('width', '14')
      minusIcon.setAttribute('height', '14')
      minusIcon.setAttribute('fill', 'none')
      minusIcon.setAttribute('stroke', 'currentColor')
      minusIcon.setAttribute('stroke-width', '3')
      minusIcon.setAttribute('stroke-linecap', 'round')

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', '4')
      line.setAttribute('y1', '12')
      line.setAttribute('x2', '20')
      line.setAttribute('y2', '12')

      minusIcon.appendChild(line)
      indicator.appendChild(minusIcon)
      title.appendChild(indicator)
    }

    header.appendChild(title)

    // Add collapse button
    const collapseBtn = document.createElement('div')
    collapseBtn.className = 'ginko-callout-collapse'
    const collapseIcon = getIcon(this.isCollapsed ? 'chevron-down' : 'chevron-up')
    if (collapseIcon) collapseBtn.appendChild(collapseIcon)
    collapseBtn.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed
      container.classList.toggle('is-collapsed')
      this.saveCollapsedState(this.isCollapsed)
      const newIcon = getIcon(this.isCollapsed ? 'chevron-down' : 'chevron-up')
      if (newIcon) {
        collapseBtn.innerHTML = ''
        collapseBtn.appendChild(newIcon)
      }
    })
    header.appendChild(collapseBtn)

    container.appendChild(header)

    // Create content container
    const contentEl = document.createElement('div')
    contentEl.className = 'ginko-callout-content'

    // Render markdown content
    const markdownChild = new MarkdownRenderChild(contentEl)
    MarkdownRenderer.render(
      this.app,
      this.getCalloutContent(),
      contentEl,
      '',
      markdownChild,
    )

    container.appendChild(contentEl)
    return container
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1)
  }

  private getIconForType(type: string): SVGSVGElement | null {
    const icons: Record<string, string> = {
      tip: 'lightbulb',
      info: 'info',
      warning: 'alert-triangle',
      danger: 'alert-octagon',
      note: 'pencil',
    }
    return getIcon(icons[type] || 'pencil')
  }

  isEditingState(): boolean {
    return this.isEditing
  }
}
