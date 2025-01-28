import type { Line, Transaction } from '@codemirror/state'
import { getIcon } from 'obsidian'

/**
 * Interface for cursor location tracking
 */
export interface CursorLocation {
  line: Line
  position: number
}

/**
 * Interface for region data in the document
 */
export interface RegionData {
  regionText: string
  remainingText: string
  startIndex: number
  endIndex: number
}

/**
 * Interface for column data
 */
export interface ColumnData {
  content: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * Interface for tab properties
 */
export interface TabProperties {
  icon?: string
  title: string
  rawTitle: string // Before markdown cleaning
  [key: string]: string | undefined
}

/**
 * Interface for generic block properties
 */
export interface BlockProperties {
  [key: string]: string | boolean | undefined
}

/**
 * Generates a consistent hash for content comparison
 * @param str - String to hash
 * @returns A consistent hash based on the content
 */
export function hashContent(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).slice(0, 8)
}

/**
 * Gets the next region in the document based on start and end tags
 * @param workingText - The text to search in
 * @param startOffset - The offset to start searching from
 * @param wholeDoc - The entire document text
 * @param startTag - The tag that marks the start of a region
 * @param endTag - The tag that marks the end of a region
 */
export function getNextRegion(
  workingText: string,
  startOffset: number,
  wholeDoc: string,
  startTag: string,
  endTag: string,
): RegionData | null {
  console.log('TEST: getNextRegion - startTag:', startTag, 'endTag:', endTag)
  console.log('TEST: workingText start:', `${workingText.substring(0, 50)}...`)

  const startPosition = workingText.indexOf(startTag)
  if (startPosition === -1) {
    console.log('TEST: No start tag found')
    return null
  }

  const searchStartIndex = startPosition + startTag.length
  const endPosition = workingText.indexOf(endTag, searchStartIndex)
  if (endPosition === -1) {
    console.log('TEST: No end tag found')
    return null
  }

  const startIndex = startOffset + startPosition
  const endIndex = startOffset + endPosition + endTag.length

  const region = {
    regionText: wholeDoc.slice(startIndex, endIndex),
    remainingText: wholeDoc.slice(endIndex),
    startIndex,
    endIndex,
  }

  console.log('TEST: Found region:', {
    startIndex,
    endIndex,
    regionTextPreview: `${region.regionText.substring(0, 50)}...`,
  })

  return region
}

/**
 * Checks if cursor or selection overlaps with a region
 */
export function checkCursorInRegion(
  startIndex: number,
  endIndex: number,
  cursorLocations: CursorLocation[],
  ranges: readonly { from: number, to: number }[],
): boolean {
  // Check individual cursor positions
  for (const loc of cursorLocations) {
    if (valueIsInRange(loc.position, startIndex, endIndex)) {
      return true
    }
  }

  // Check selection ranges
  for (const range of ranges) {
    // Check if selection overlaps with region
    if (valueIsInRange(range.from, startIndex, endIndex)
      || valueIsInRange(range.to, startIndex, endIndex)) {
      return true
    }

    // Check if selection encompasses region
    if (range.from <= startIndex && range.to >= endIndex) {
      return true
    }
  }

  return false
}

/**
 * Gets all cursor locations from a transaction
 */
export function getCursorLocations(transaction: Transaction): CursorLocation[] {
  const ranges: CursorLocation[] = []

  if (transaction.state.selection.ranges) {
    transaction.state.selection.ranges
      .filter(range => range.empty)
      .forEach((range) => {
        const line = transaction.state.doc.lineAt(range.head)
        ranges.push({
          line,
          position: range.head,
        })
      })
  }

  return ranges
}

/**
 * Helper function to check if a value is within a range
 */
export function valueIsInRange(value: number, start: number, end: number): boolean {
  return value >= start && value <= end
}

/**
 * Collects existing widgets from a decoration set
 * @param oldState - The previous decoration set
 * @param docLength - The length of the document
 * @param widgetConstructor - Function to create a new widget
 */
export function collectExistingWidgets<T>(
  oldState: any,
  docLength: number,
  widgetConstructor: Function,
): Map<string, T> {
  const widgets = new Map<string, T>()

  if (!oldState)
    return widgets

  oldState.between(0, docLength, (from: number, to: number, deco: any) => {
    if (deco.widget && deco.widget.constructor === widgetConstructor) {
      const widget = deco.widget as T
      const id = (widget as any).id
      if (id) {
        widgets.set(id, widget)
      }
    }
  })
  return widgets
}

/**
 * Add a generic function to handle different region tags
 */
export function getRegionByTags(
  workingText: string,
  startOffset: number,
  wholeDoc: string,
  startTag: string,
  endTag: string,
): RegionData | null {
  return getNextRegion(workingText, startOffset, wholeDoc, startTag, endTag)
}

/**
 * Add a utility function for logging
 */
export function logDebug(message: string, data: any): void {
  console.debug(message, data)
}

/**
 * Add a utility function to parse columns
 */
export function parseColumns(content: string): readonly ColumnData[] {
  const cleanContent = content
    .replace(/^\+\+layout(?:\((.*?)\))?\n?/, '')
    .replace(/\n?\+\+$/, '')

  const lines = cleanContent.split('\n')
  const columns: ColumnData[] = []
  let currentColumn: { properties: ColumnData, content: string[] } | null = null

  for (const line of lines) {
    if (line.trim().startsWith('--col')) {
      if (currentColumn) {
        columns.push({
          ...currentColumn.properties,
          content: currentColumn.content.join('\n'),
        })
      }
      currentColumn = {
        properties: parseColumnProperties(line),
        content: [],
      }
    }
    else if (currentColumn) {
      currentColumn.content.push(line)
    }
  }

  if (currentColumn) {
    columns.push({
      ...currentColumn.properties,
      content: currentColumn.content.join('\n'),
    })
  }

  return Object.freeze(columns)
}

/**
 * Parses properties from a block declaration line
 * Examples:
 * ++tabs(defaultTab="2" showIcons=true)
 * --col(xs showBorder=true title="My Column")
 *
 * @param line - The line containing properties
 * @param pattern - Regex pattern to match the properties section
 * @returns Parsed properties
 */
export function parseBlockProperties(line: string, pattern: RegExp): BlockProperties {
  const properties: BlockProperties = {}

  const match = line.match(pattern)
  if (!match || !match[1])
    return properties

  const propString = match[1].trim()
  // Match:
  // - key="value" (string properties)
  // - key=true|false (boolean properties)
  // - key (implicit boolean true)
  const propMatches = propString.matchAll(/(\w+)(?:=(?:"([^"]*)"|(\w+)))?/g)

  for (const match of Array.from(propMatches)) {
    if (match && match[1]) {
      const key = match[1]
      // If there's no value or quoted string, it's a boolean flag
      if (!match[2] && !match[3]) {
        properties[key] = true
      }
      // If there's a quoted string
      else if (match[2] !== undefined) {
        properties[key] = match[2]
      }
      // If there's an unquoted value (true/false)
      else if (match[3] !== undefined) {
        properties[key] = match[3].toLowerCase() === 'true'
      }
    }
  }

  return properties
}

/**
 * Parses tab properties from a tab line
 */
export function parseTabProperties(tabLine: string): TabProperties {
  const properties: TabProperties = { title: '', rawTitle: '' }

  // Extract title and properties
  const titleMatch = tabLine.match(/--tab(?:\((.*?)\))?\s*(.*)$/)
  if (!titleMatch)
    return properties

  // Parse properties if they exist
  if (titleMatch[1]) {
    const blockProps = parseBlockProperties(tabLine, /--tab\((.*?)\)/)
    Object.assign(properties, blockProps) // Make sure we merge all properties
  }

  // Set title properties after merging other properties
  properties.rawTitle = titleMatch[2]?.trim() || ''
  properties.title = cleanMarkdownString(properties.rawTitle)

  return properties
}

/**
 * Parses column properties from a column line
 */
export function parseColumnProperties(colLine: string): ColumnData {
  const properties = parseBlockProperties(colLine, /--col\((.*?)\)/)

  // Handle size shortcuts (xs, sm, md, lg, xl)
  const sizeShortcuts = ['xs', 'sm', 'md', 'lg', 'xl']
  for (const size of sizeShortcuts) {
    if (properties[size] === true) {
      return {
        content: '',
        size: size as ColumnData['size'],
      }
    }
  }

  return {
    content: '',
    size: properties.size as ColumnData['size'],
  }
}

/**
 * Parses layout block properties
 */
export function parseLayoutProperties(layoutLine: string): BlockProperties {
  return parseBlockProperties(layoutLine, /\+\+layout\((.*?)\)/)
}

/**
 * Cleans a markdown string
 * @param str - The markdown string to clean
 * @returns Cleaned markdown string
 */
export function cleanMarkdownString(str: string): string {
  return str
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1') // Remove ** and __
    .replace(/^#{1,6}\s+/g, '') // Remove heading markers
    .trim()
}

/**
 * Handles icon rendering with Iconify API and localStorage caching
 */
export async function createIconElement(iconName: string | null): Promise<HTMLElement | null> {
  if (!iconName)
    return null

  const iconContainer = document.createElement('span')
  iconContainer.className = 'ginko-icon'

  // Check if it's a Lucide icon
  if (iconName.startsWith('lucide:')) {
    const name = iconName.replace('lucide:', '')
    const iconEl = getIcon(name)
    if (iconEl) {
      iconEl.addClass('svg-icon')
      iconContainer.appendChild(iconEl)
      return iconContainer
    }
    return null
  }

  // Check if it's another Iconify icon (contains ':')
  if (iconName.includes(':')) {
    const [prefix, name] = iconName.split(':')
    const iconKey = `${prefix}:${name}`

    // Try to get cached SVG from localStorage
    let cachedIcons
    try {
      cachedIcons = JSON.parse(localStorage.getItem('ginko-iconify-icons') || '{}')
    }
    catch (e) {
      cachedIcons = {}
    }

    if (cachedIcons[iconKey]) {
      // Use cached SVG
      iconContainer.innerHTML = cachedIcons[iconKey]
    }
    else {
      // Fetch from Iconify API and cache
      try {
        const response = await fetch(`https://api.iconify.design/${prefix}/${name}.svg?height=16`)
        const svgData = await response.text()
        // Cache the SVG data
        cachedIcons[iconKey] = svgData
        localStorage.setItem('ginko-iconify-icons', JSON.stringify(cachedIcons))
        iconContainer.innerHTML = svgData
      }
      catch (error) {
        console.error('Failed to fetch icon:', error)
        return null
      }
    }
  }
  else {
    // Use Obsidian's built-in icon
    const iconEl = getIcon(iconName)
    if (iconEl) {
      iconEl.addClass('svg-icon')
      iconContainer.appendChild(iconEl)
    }
    else {
      return null
    }
  }

  return iconContainer
}
