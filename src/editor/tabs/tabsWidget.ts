import type { App } from 'obsidian'
import type { BaseWidgetConfig } from '../_base/baseWidget'
import type {
  BlockProperties,
  TabProperties,
} from '../utils'
import { StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian'
import { BaseWidget } from '../_base/baseWidget'
import {
  cleanMarkdownString,
  createIconElement,
  parseBlockProperties,
  parseTabProperties,
} from '../utils'

/**
 * Represents a single tab's data structure
 */
interface TabData {
  title: string
  content: string
  properties: TabProperties
}

interface TabWidgetConfig extends BaseWidgetConfig {
  isEditing: boolean
}

/**
 * TabWidget represents a custom widget for rendering tabbed content in the editor.
 * It extends BaseWidget to provide tabbed content functionality with
 * edit/preview modes and persistent state.
 */
export class TabWidget extends BaseWidget {
  private readonly tabs: readonly TabData[]
  private readonly properties: BlockProperties
  private activeTab: number
  private isEditing: boolean
  static readonly toggleEdit = StateEffect.define<boolean>()

  constructor(content: string, id: string, isEditing: boolean, app: App) {
    super({ content, id, app })
    this.isEditing = isEditing
    this.properties = this.parseTabBlockProperties(content)
    this.tabs = this.parseTabs(content)
    this.activeTab = this.loadActiveTab()
  }

  private parseTabBlockProperties(content: string): BlockProperties {
    const match = content.match(/^::tabs(?:\((.*?)\))?\n?/)
    return match ? parseBlockProperties(content, /::tabs\((.*?)\)/) : {}
  }

  /**
   * Generates a storage key for persisting tab state in localStorage
   */
  private getStorageKey(): string {
    return `tabs.${this.id}`
  }

  /**
   * Persists the active tab index to localStorage
   */
  private saveActiveTab(index: number): void {
    try {
      localStorage.setItem(this.getStorageKey(), index.toString())
    }
    catch (e) {
      console.warn('Failed to save tab state:', e)
    }
  }

  /**
   * Retrieves the previously saved active tab index
   */
  private loadActiveTab(): number {
    try {
      const stored = localStorage.getItem(this.getStorageKey())
      if (stored !== null) {
        const index = Number.parseInt(stored)
        if (index >= 0 && index < this.tabs.length) {
          return index
        }
      }
    }
    catch (e) {
      console.warn('Failed to load tab state:', e)
    }
    return 0
  }

  /**
   * Parses the raw content string into structured tab data
   */
  private parseTabs(content: string): readonly TabData[] {
    const cleanContent = content
      .replace(/^::tabs(?:\((.*?)\))?\n?/, '')
      .replace(/\n?::$/, '')

    const lines = cleanContent.split('\n')
    const tabs: TabData[] = []
    let currentTab: { properties: TabProperties, content: string[] } | null = null

    for (const line of lines) {
      // Match tab line with new syntax
      const tabMatch = line.trim().match(/^--tab(?:\((.*?)\))?\s*(.*)$/)

      if (tabMatch) {
        if (currentTab) {
          tabs.push({
            title: cleanMarkdownString(currentTab.properties.title || ''),
            content: currentTab.content.join('\n'),
            properties: currentTab.properties,
          })
        }

        // Parse properties from the captured group, if it exists
        const properties = parseTabProperties(line)

        currentTab = {
          properties,
          content: [],
        }
      }
      else if (currentTab) {
        currentTab.content.push(line)
      }
    }

    // Don't forget to add the last tab
    if (currentTab) {
      tabs.push({
        title: cleanMarkdownString(currentTab.properties.title || ''),
        content: currentTab.content.join('\n'),
        properties: currentTab.properties,
      })
    }

    return Object.freeze(tabs)
  }

  eq(other: TabWidget): boolean {
    return this.id === other.id
      && this.content === other.content
      && this.activeTab === other.activeTab
      && this.isEditing === other.isEditing
  }

  private async createTabButton(tab: TabData, index: number, container: HTMLElement): Promise<HTMLElement> {
    const button = document.createElement('button')
    button.className = `ginko-tab-button${index === this.activeTab ? ' active' : ''}`

    // Create icon container
    const iconName = tab.properties.icon
    if (iconName) {
      try {
        const iconEl = await createIconElement(iconName)
        if (iconEl) {
          button.appendChild(iconEl)
        }
      }
      catch (error) {
        console.warn('Failed to create icon:', error)
      }
    }

    // Create text container
    const textContainer = document.createElement('span')
    textContainer.className = 'ginko-tab-text'
    textContainer.textContent = tab.title
    button.appendChild(textContainer)

    button.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.activeTab = index
      this.saveActiveTab(index)
      this.updateActiveTab(container, index)
    }
    return button
  }

  protected createPreviewView(view: EditorView): HTMLElement {
    const container = this.createContainer('ginko-tabs-container')
    const editButton = this.createEditButton((e) => {
      // Find the position of this widget in the document
      const widgetPos = view.posAtDOM(container)

      // Calculate position of the current active tab
      let tabPos = widgetPos
      const content = this.content
      let searchPos = 0

      // Find the position of the active tab
      for (let i = 0; i <= this.activeTab; i++) {
        searchPos = content.indexOf('--tab', searchPos)
        if (searchPos !== -1) {
          const lineEnd = content.indexOf('\n', searchPos)
          if (lineEnd !== -1) {
            const nextLineStart = lineEnd + 1
            tabPos = widgetPos + nextLineStart
          }
          searchPos = lineEnd + 1
        }
      }

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

      view.focus()
    })

    container.appendChild(editButton)

    const tabButtons = document.createElement('div')
    tabButtons.className = 'ginko-tab-buttons'

    const tabContents = document.createElement('div')
    tabContents.className = 'ginko-tab-contents'

    // Create and add all tab buttons first
    Promise.all(this.tabs.map((tab, index) => this.createTabButton(tab, index, container)))
      .then((buttons) => {
        buttons.forEach(button => tabButtons.appendChild(button))
      })

    // Create and add tab contents
    this.tabs.forEach((tab, index) => {
      const content = this.createTabContent(tab, index)

      const markdownChild = new MarkdownRenderChild(content)

      MarkdownRenderer.render(
        this.app,
        tab.content.trim(),
        content,
        '',
        markdownChild,
      ).then(() => {
        // Remove any nested edit buttons
        content.querySelectorAll('.edit-block-button').forEach(btn => btn.remove())
        tabContents.appendChild(content)
      })
    })

    container.appendChild(tabButtons)
    container.appendChild(tabContents)

    return container
  }

  private createTabContent(tab: TabData, index: number): HTMLElement {
    const content = document.createElement('div')
    content.className = `ginko-tab-content markdown-preview-view${index === this.activeTab ? ' active' : ''}`
    content.setAttribute('data-content', tab.content)
    return content
  }

  private updateActiveTab(container: HTMLElement, activeIndex: number): void {
    const buttons = container.querySelectorAll('.ginko-tab-button')
    const contents = container.querySelectorAll('.ginko-tab-content')

    buttons.forEach((button, index) => {
      button.classList.toggle('active', index === activeIndex)
    })

    contents.forEach((content, index) => {
      content.classList.toggle('active', index === activeIndex)
    })
  }

  isEditingState(): boolean {
    return this.isEditing
  }
}
