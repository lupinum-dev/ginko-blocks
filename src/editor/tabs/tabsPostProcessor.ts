import type { MarkdownPostProcessor, MarkdownPostProcessorContext } from 'obsidian'
import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian'
import { createIconElement, parseTabProperties } from '../utils'

export const TABS_REGEX = /::tabs(?:\(.*?\))?\n([\s\S]*?)::$/gm
export const TAB_REGEX = /--tab(?:\(.*?\))?(.*?)(?=\n--tab|\n?::|\n?$)/gm

interface TabData {
  title: string
  content: string
  properties: {
    icon?: string
    title?: string
    [key: string]: any
  }
}

// Function to clean title text from HTML tags and markdown syntax
function cleanTitleText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/^#+\s*/, '') // Remove markdown headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/__(.*?)__/g, '$1') // Remove underline
    .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
    .replace(/==(.*?)==/g, '$1') // Remove highlights
    .replace(/\[\[(.*?)\]\]/g, '$1') // Remove wiki links
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove markdown links
    .trim()
}

export const tabsProcessor: MarkdownPostProcessor = async (element: HTMLElement, context: MarkdownPostProcessorContext) => {
  const elements = Array.from(element.querySelectorAll('p, div.el-p'))

  for (const el of elements) {
    const text = el.innerHTML || ''

    if (text.includes('::tabs')) {
      const container = document.createElement('div')
      container.className = 'ginko-tabs-container ginko-embed-block  show-indentation-guide'
      container.setAttribute('contenteditable', 'false')
      container.setAttribute('tabindex', '-1')

      const tabButtons = document.createElement('div')
      tabButtons.className = 'ginko-tab-buttons'

      const tabContents = document.createElement('div')
      tabContents.className = 'ginko-tab-contents'

      // Parse the tabs content
      const tabs = parseTabs(text)
      const activeTab = 0

      // Create tab buttons and content
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i]

        // Create tab button
        const button = document.createElement('button')
        button.className = `ginko-tab-button${i === activeTab ? ' active' : ''}`

        // Add icon if specified
        if (tab.properties.icon) {
          const iconEl = await createIconElement(tab.properties.icon)
          if (iconEl) {
            button.appendChild(iconEl)
          }
        }

        // Add title
        const textContainer = document.createElement('span')
        textContainer.className = 'ginko-tab-text'
        textContainer.textContent = cleanTitleText(tab.title) || ''
        button.appendChild(textContainer)

        // Add click handler
        button.onclick = (e) => {
          e.preventDefault()
          e.stopPropagation()
          updateActiveTab(container, i)
        }

        tabButtons.appendChild(button)

        // Create tab content
        const content = document.createElement('div')
        content.className = `ginko-tab-content markdown-preview-view${i === activeTab ? ' active' : ''}`

        // Render markdown content
        const markdownChild = new MarkdownRenderChild(content)
        await context.addChild(markdownChild)

        await MarkdownRenderer.renderMarkdown(
          tab.content.trim(),
          content,
          el.getAttribute('src') || '',
          markdownChild,
        )

        tabContents.appendChild(content)
      }

      container.appendChild(tabButtons)
      container.appendChild(tabContents)
      el.replaceWith(container)
    }
  }
}

function parseTabs(content: string): TabData[] {
  const cleanContent = content
    .replace(/^::tabs(?:\(.*?\))?\n?/, '')
    .replace(/\n?::$/, '')
    .replace(/<br>/g, '\n') // Convert HTML line breaks to newlines

  const tabs: TabData[] = []
  let matches: RegExpExecArray | null
  let _lastIndex = 0

  TAB_REGEX.lastIndex = 0 // Reset regex state
  while ((matches = TAB_REGEX.exec(cleanContent)) !== null) {
    const [fullMatch, _titlePart = ''] = matches
    const tabMatch = fullMatch.match(/--tab(?:\((.*?)\))?\s*(.*)/)

    if (!tabMatch)
      continue

    const [_, propString = '', title = ''] = tabMatch
    const properties = parseTabProperties(`--tab(${propString})`)

    // Get the content by looking ahead to the next tab or end
    const startIdx = matches.index + fullMatch.length
    const nextMatch = TAB_REGEX.exec(cleanContent)
    TAB_REGEX.lastIndex = matches.index + 1 // Reset to continue from current position

    const endIdx = nextMatch ? nextMatch.index : cleanContent.length
    const content = cleanContent.slice(startIdx, endIdx).trim()

    tabs.push({
      title: title.trim(),
      content,
      properties,
    })

    _lastIndex = endIdx
  }

  return tabs
}

function updateActiveTab(container: HTMLElement, activeIndex: number): void {
  const buttons = container.querySelectorAll('.ginko-tab-button')
  const contents = container.querySelectorAll('.ginko-tab-content')

  buttons.forEach((button, index) => {
    button.classList.toggle('active', index === activeIndex)
  })

  contents.forEach((content, index) => {
    content.classList.toggle('active', index === activeIndex)
  })
}
