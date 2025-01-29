import type { MarkdownPostProcessor, MarkdownPostProcessorContext } from 'obsidian'

export const LAYOUT_REGEX = /\+\+layout(?:\(.*?\))?\n([\s\S]*?)\+\+/g
export const COL_REGEX = /--col\n([\s\S]*?)(?=--col|\+\+)/g

const SIZE_MAP: Record<string, number> = {
  xs: 25, // 3/12
  sm: 33.33, // 4/12
  md: 50, // 6/12
  lg: 66.67, // 8/12
  xl: 75, // 9/12
}

export const layoutProcessor: MarkdownPostProcessor = (element: HTMLElement, _context: MarkdownPostProcessorContext) => {
  const elements = Array.from(element.querySelectorAll('p, .ginko-layout-container'))

  let currentLayout: HTMLElement | null = null
  let isProcessingLayout = false
  let currentColumn: HTMLElement | null = null
  let i = 0

  while (i < elements.length) {
    const el = elements[i]
    const text = el.textContent?.trim() || ''

    if (text.startsWith('++layout')) {
      isProcessingLayout = true
      currentLayout = createLayoutContainer()

      if (text.includes('++\n') || text.endsWith('++')) {
        const content = text.split('\n')
        processLayoutContent(content, currentLayout)
        el.replaceWith(currentLayout)
        isProcessingLayout = false
        currentLayout = null
        i++
        continue
      }

      let nextElement = el.nextElementSibling
      if (!nextElement && el.parentElement) {
        nextElement = el.parentElement.nextElementSibling
      }

      const layoutContent: string[] = []
      let foundEnd = false
      while (nextElement) {
        const siblingText = nextElement.textContent?.trim() || ''
        if (siblingText === '++') {
          foundEnd = true
          nextElement.remove()
          break
        }
        layoutContent.push(siblingText)
        const currentSibling = nextElement
        nextElement = nextElement.nextElementSibling
          || (nextElement.parentElement?.nextElementSibling || null)
        currentSibling.remove()
      }

      if (layoutContent.length > 0) {
        processLayoutContent(layoutContent, currentLayout)
      }

      if (foundEnd) {
        isProcessingLayout = false
        currentLayout = null
      }

      i++
      continue
    }

    if (text.startsWith('--col') && currentLayout && isProcessingLayout) {
      const colContent = text.replace('--col', '').trim()
      currentColumn = createColumn(colContent)
      currentLayout.appendChild(currentColumn)
      el.remove()
      i++

      while (i < elements.length) {
        const nextEl = elements[i]
        const nextText = nextEl.textContent?.trim() || ''

        if (nextText.startsWith('--col') || nextText === '::' || nextText === '++') {
          break
        }

        if (currentColumn) {
          const cleanText = nextText.replace(/::$/, '')
          if (cleanText) {
            const contentEl = nextEl.cloneNode(true) as HTMLElement
            contentEl.textContent = cleanText
            currentColumn.appendChild(contentEl)
          }
        }
        nextEl.remove()
        i++
      }
      continue
    }

    if (text === '++' && isProcessingLayout) {
      isProcessingLayout = false
      currentLayout = null
      currentColumn = null
      el.remove()
      i++
      continue
    }

    i++
  }
}

function processLayoutContent(content: string[], layoutContainer: HTMLElement) {
  const columnsContainer = layoutContainer.querySelector('.ginko-layout-columns')
  if (!columnsContainer)
    return

  let currentColumn: HTMLElement | null = null
  let currentContentWrapper: HTMLElement | null = null
  let remainingWidth = 100
  let unspecifiedColumns = 0
  const columns: { element: HTMLElement, size?: string }[] = []

  // First pass: Create columns and collect size information
  content.forEach((line) => {
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('--col')) {
      // Parse column size if specified
      const sizeMatch = trimmedLine.match(/--col\((\w+)\)/)
      const size = sizeMatch ? sizeMatch[1] : undefined

      currentColumn = document.createElement('div')
      currentColumn.className = 'ginko-layout-column'

      currentContentWrapper = document.createElement('div')
      currentColumn.appendChild(currentContentWrapper)
      columnsContainer.appendChild(currentColumn)

      columns.push({ element: currentColumn, size })

      if (size && SIZE_MAP[size]) {
        remainingWidth -= SIZE_MAP[size]
      }
      else {
        unspecifiedColumns++
      }

      // Handle content on the same line as --col
      const colContent = trimmedLine.replace(/--col(?:\(\w+\))?/, '').trim()
      if (colContent) {
        const p = document.createElement('p')
        p.setAttribute('dir', 'auto')
        p.textContent = colContent
        currentContentWrapper.appendChild(p)
      }
    }
    else if (currentColumn && currentContentWrapper && trimmedLine && !trimmedLine.startsWith('++')) {
      const p = document.createElement('p')
      p.setAttribute('dir', 'auto')
      p.textContent = trimmedLine
      currentContentWrapper.appendChild(p)
    }
  })

  // Handle single column case
  if (columns.length === 1) {
    const singleColumn = columns[0]
    layoutContainer.classList.add('ginko-center-container')
    columnsContainer.className = 'ginko-center-content'

    if (singleColumn.size) {
      // Apply max-width based on size
      layoutContainer.style.maxWidth = `${SIZE_MAP[singleColumn.size]}%`
    }
    return
  }

  // Multiple columns: Set column widths
  columnsContainer.className = 'ginko-layout-columns'
  columns.forEach(({ element, size }) => {
    if (size && SIZE_MAP[size]) {
      element.style.width = `${SIZE_MAP[size]}%`
    }
    else {
      // Distribute remaining width among unspecified columns
      const defaultWidth = unspecifiedColumns > 0 ? remainingWidth / unspecifiedColumns : 100 / columns.length
      element.style.width = `${defaultWidth}%`
    }
  })
}

function createLayoutContainer(): HTMLElement {
  const container = document.createElement('div')
  container.className = 'ginko-layout-container ginko-embed-block  show-indentation-guide'
  container.setAttribute('contenteditable', 'false')
  container.setAttribute('tabindex', '-1')

  const columnsContainer = document.createElement('div')
  columnsContainer.className = 'ginko-layout-columns'
  container.appendChild(columnsContainer)

  return container
}

function createColumn(initialContent: string): HTMLElement {
  const column = document.createElement('div')
  column.className = 'ginko-layout-column'

  // Calculate default width (equal distribution)
  column.style.width = '50%' // Default to 50% for 2 columns

  if (initialContent) {
    const contentWrapper = document.createElement('div')
    const p = document.createElement('p')
    p.setAttribute('dir', 'auto')
    p.textContent = initialContent
    contentWrapper.appendChild(p)
    column.appendChild(contentWrapper)
  }

  return column
}
