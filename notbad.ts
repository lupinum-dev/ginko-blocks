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

interface TabsCollectionState {
  elements: HTMLElement[]
  content: string[]
  startElement?: HTMLElement
  context?: MarkdownPostProcessorContext
  id: string
  processed?: boolean
  processingTimeout?: ReturnType<typeof setTimeout>
}

// Global state to collect tabs elements across multiple processor calls
const tabsCollections = new Map<string, TabsCollectionState>()

// Cleanup stale collections periodically
setInterval(() => {
  for (const [id, collection] of tabsCollections.entries()) {
    // Remove collections where the start element is no longer connected to DOM
    if (collection.startElement && !collection.startElement.isConnected) {
      console.log('Cleaning up stale collection:', id)
      if (collection.processingTimeout) {
        clearTimeout(collection.processingTimeout)
      }
      tabsCollections.delete(id)
    }
  }
}, 10000)

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

// Function to get active tab from localStorage
function getActiveTab(tabsId: string): number {
  try {
    const stored = localStorage.getItem(`ginko-tabs-${tabsId}`)
    return stored ? parseInt(stored, 10) : 0
  } catch (e) {
    console.log('Error reading active tab from localStorage:', e)
    return 0
  }
}

// Function to save active tab to localStorage
function saveActiveTab(tabsId: string, activeIndex: number): void {
  try {
    localStorage.setItem(`ginko-tabs-${tabsId}`, activeIndex.toString())
    console.log(`Saved active tab ${activeIndex} for tabs ${tabsId}`)
  } catch (e) {
    console.log('Error saving active tab to localStorage:', e)
  }
}

export const tabsProcessor: MarkdownPostProcessor = async (element: HTMLElement, context: MarkdownPostProcessorContext) => {
  console.log('=== TABS PROCESSOR START ===')
  console.log('Processing element:', element)
  console.log('Element className:', element.className)
  console.log('Element tagName:', element.tagName)
  console.log('Element innerHTML:', element.innerHTML.substring(0, 200))

  // Skip if this is already a processed tabs container or tab content
  if (element.classList.contains('ginko-tabs-container') ||
    element.classList.contains('ginko-tab-content') ||
    element.querySelector('.ginko-tabs-container')) {
    console.log('Skipping already processed tabs element')
    console.log('=== TABS PROCESSOR END ===')
    return
  }

  // Check if this element contains any tabs-related content
  const text = element.textContent || element.innerHTML || ''
  console.log('Element text content:', text.substring(0, 100))

  // Generate a unique collection ID based on the source path and element position
  // Use a combination of context path and the element's textContent to make it unique per tabs block
  let collectionId = context.sourcePath

  if (text.includes('::tabs')) {
    // For the start of a tabs block, add a timestamp to make it unique
    collectionId = `${context.sourcePath}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
  } else {
    // For content/end elements, find the most recent collection for this file
    const existingCollections = Array.from(tabsCollections.keys()).filter(id => id.startsWith(context.sourcePath))
    if (existingCollections.length > 0) {
      // Use the most recent collection (last one created)
      collectionId = existingCollections[existingCollections.length - 1]
    }
  }

  console.log('Collection ID:', collectionId)

  // Initialize collection if it doesn't exist
  if (!tabsCollections.has(collectionId)) {
    tabsCollections.set(collectionId, {
      elements: [],
      content: [],
      id: collectionId,
      processed: false
    })
    console.log('Initialized new tabs collection')
  }

  const collection = tabsCollections.get(collectionId)!

  // Skip if this collection has already been processed
  if (collection.processed) {
    console.log('Collection already processed, skipping')
    console.log('=== TABS PROCESSOR END ===')
    return
  }

  if (text.includes('::tabs')) {
    console.log('Found ::tabs - starting collection')

    // Clear any existing timeout
    if (collection.processingTimeout) {
      clearTimeout(collection.processingTimeout)
    }

    // Reset collection and mark start
    collection.elements = [element]
    collection.content = [text]
    collection.startElement = element
    collection.context = context
    collection.processed = false
    console.log('Collection started with ::tabs element')
  } else if (text.includes('::') && !text.includes('::tabs')) {
    console.log('Found end marker :: - completing collection')
    // This is the end marker
    collection.elements.push(element)
    collection.content.push(text)

    console.log('Collection complete - processing tabs')
    console.log('Total elements collected:', collection.elements.length)
    console.log('Total content pieces:', collection.content.length)

    // Mark as completed immediately to prevent further additions
    collection.processed = true

    // Clear any existing timeout
    if (collection.processingTimeout) {
      clearTimeout(collection.processingTimeout)
    }

    // Process the complete collection with a small delay to ensure DOM is ready
    collection.processingTimeout = setTimeout(async () => {
      if (collection.startElement && collection.startElement.isConnected) {
        await processCompleteTabsCollection(collection)
        // Clear the collection
        tabsCollections.delete(collectionId)
        console.log('Collection processed and cleared')
      } else if (!collection.startElement?.isConnected) {
        console.log('Start element disconnected, skipping processing')
        tabsCollections.delete(collectionId)
      }
    }, 50)
  } else if (collection.elements.length > 0 && !collection.processed && collection.startElement) {
    console.log('Found tabs content element - adding to collection')
    // This is content between ::tabs and ::
    collection.elements.push(element)
    collection.content.push(text)
    console.log('Added element to collection. Total elements:', collection.elements.length)
  } else if (collection.processed) {
    console.log('Collection already processed, not adding element')
  } else if (collection.elements.length === 0) {
    console.log('No active collection, skipping element')
  }

  console.log('=== TABS PROCESSOR END ===')
}

async function processCompleteTabsCollection(collection: TabsCollectionState): Promise<void> {
  console.log('Processing complete tabs collection:', collection.elements.length, 'elements')

  if (!collection.startElement || !collection.context) {
    console.log('Missing start element or context')
    return
  }

  // Combine all content
  const fullContent = collection.content.join('\n')
  console.log('Full collected content:', fullContent.substring(0, 300))

  // Create tabs component
  const tabsId = `tabs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  console.log('Creating tabs with ID:', tabsId)

  const container = await createTabsContainer(fullContent, tabsId, collection.context, collection.startElement)

  if (container) {
    console.log('Replacing start element with tabs container')
    // Replace the start element with our tabs container
    collection.startElement.replaceWith(container)

    // Remove all other elements
    collection.elements.slice(1).forEach((element, index) => {
      console.log(`Removing element ${index + 1}:`, element.textContent?.substring(0, 50))
      element.remove()
    })

    console.log('Tabs replacement complete')
  }
}

async function createTabsContainer(
  content: string,
  tabsId: string,
  context: MarkdownPostProcessorContext,
  originalElement: HTMLElement
): Promise<HTMLElement | null> {
  console.log('Creating tabs container for content:', content.substring(0, 200))

  try {
    const container = document.createElement('div')
    container.className = 'ginko-tabs-container ginko-embed-block show-indentation-guide'
    container.setAttribute('contenteditable', 'false')
    container.setAttribute('tabindex', '-1')
    container.setAttribute('data-tabs-id', tabsId)

    const tabButtons = document.createElement('div')
    tabButtons.className = 'ginko-tab-buttons'

    const tabContents = document.createElement('div')
    tabContents.className = 'ginko-tab-contents'

    // Parse the tabs content
    console.log('Parsing tabs from content...')
    const tabs = parseTabs(content)
    console.log('Parsed tabs:', tabs.length)
    tabs.forEach((tab, index) => {
      console.log(`Tab ${index}:`, { title: tab.title, contentLength: tab.content.length, properties: tab.properties })
    })

    if (tabs.length === 0) {
      console.log('No tabs found, returning null')
      return null
    }

    const activeTab = getActiveTab(tabsId)
    console.log('Active tab index:', activeTab)

    // Create tab buttons and content
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]
      console.log(`Creating tab ${i}: ${tab.title}`)

      // Create tab button
      const button = document.createElement('button')
      button.className = `ginko-tab-button${i === activeTab ? ' active' : ''}`

      // Add icon if specified
      if (tab.properties.icon) {
        console.log(`Adding icon ${tab.properties.icon} to tab ${i}`)
        const iconEl = await createIconElement(tab.properties.icon)
        if (iconEl) {
          button.appendChild(iconEl)
        }
      }

      // Add title
      const textContainer = document.createElement('span')
      textContainer.className = 'ginko-tab-text'
      textContainer.textContent = cleanTitleText(tab.title) || `Tab ${i + 1}`
      button.appendChild(textContainer)

      // Add click handler
      button.onclick = (e) => {
        console.log(`Tab ${i} clicked`)
        e.preventDefault()
        e.stopPropagation()
        updateActiveTab(container, i)
        saveActiveTab(tabsId, i)
      }

      tabButtons.appendChild(button)

      // Create tab content
      const content = document.createElement('div')
      content.className = `ginko-tab-content markdown-preview-view${i === activeTab ? ' active' : ''}`

      // Render markdown content
      console.log(`Rendering markdown for tab ${i}`)
      const markdownChild = new MarkdownRenderChild(content)
      await context.addChild(markdownChild)

      await MarkdownRenderer.renderMarkdown(
        tab.content.trim(),
        content,
        originalElement.getAttribute('src') || '',
        markdownChild,
      )

      tabContents.appendChild(content)
    }

    container.appendChild(tabButtons)
    container.appendChild(tabContents)

    console.log('Tabs container created successfully')
    return container
  } catch (error) {
    console.error('Error creating tabs container:', error)
    return null
  }
}

function parseTabs(content: string): TabData[] {
  console.log('Parsing tabs from content:', content.substring(0, 200))

  // Clean the content
  const cleanContent = content
    .replace(/^.*?::tabs(?:\(.*?\))?\s*\n?/g, '') // Remove everything before and including ::tabs
    .replace(/\s*::\s*$/g, '') // Remove ending ::
    .replace(/<br\s*\/?>/g, '\n') // Convert HTML line breaks to newlines
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .trim()

  console.log('Cleaned content for parsing:', cleanContent.substring(0, 200))

  const tabs: TabData[] = []

  // Split by --tab to get individual tabs
  const tabSections = cleanContent.split(/(?=--tab)/).filter(section => section.trim() && section.startsWith('--tab'))

  console.log('Found tab sections:', tabSections.length)

  tabSections.forEach((section, index) => {
    console.log(`Processing tab section ${index}:`, section.substring(0, 100))

    // Parse the tab header
    const lines = section.split('\n')
    const headerLine = lines[0]
    console.log('Header line:', headerLine)

    // Extract title and properties from header
    const tabMatch = headerLine.match(/--tab(?:\((.*?)\))?\s*(.*)/)

    if (!tabMatch) {
      console.log('No tab match found for section:', section.substring(0, 50))
      return
    }

    const [, propString = '', title = ''] = tabMatch
    console.log('Extracted:', { propString, title })

    const properties = propString ? parseTabProperties(`--tab(${propString})`) : {}

    // Get the content (everything after the first line)
    const content = lines.slice(1).join('\n').trim()

    console.log(`Tab ${index} parsed:`, {
      title: title.trim(),
      contentLength: content.length,
      properties
    })

    tabs.push({
      title: title.trim(),
      content,
      properties,
    })
  })

  console.log('Final parsed tabs:', tabs.length)
  return tabs
}

// Helper function to check if an element contains the end marker, including nested elements
function containsEndMarker(element: HTMLElement): boolean {
  const text = element.textContent || element.innerHTML || ''

  // Check if the text contains :: but not ::tabs
  if (text.includes('::') && !text.includes('::tabs')) {
    console.log('Found :: marker in text:', text.substring(Math.max(0, text.indexOf('::') - 20), text.indexOf('::') + 20))
    return true
  }

  // Also check if it's just "::" on its own line or at the end of text
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.trim() === '::') {
      console.log('Found standalone :: marker')
      return true
    }
  }

  return false
}

function updateActiveTab(container: HTMLElement, activeIndex: number): void {
  console.log('Updating active tab to:', activeIndex)

  const buttons = container.querySelectorAll('.ginko-tab-button')
  const contents = container.querySelectorAll('.ginko-tab-content')

  buttons.forEach((button, index) => {
    const isActive = index === activeIndex
    button.classList.toggle('active', isActive)
    console.log(`Button ${index} active:`, isActive)
  })

  contents.forEach((content, index) => {
    const isActive = index === activeIndex
    content.classList.toggle('active', isActive)
    console.log(`Content ${index} active:`, isActive)
  })
}
