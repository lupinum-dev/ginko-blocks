import type { Transaction } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'

/**
 * Configuration for syntax highlighting behavior
 */
const CONFIG = {
  maxPropLength: 1000, // Prevent excessive prop parsing
  patterns: {
    start: /^::([\w-]+)(?:\(([^)]*)\))?$/,
    middle: /^--[\w-]+(?:\(([^)]*)\))?(?:[ \t].*)?$/,
    end: /^::$/, // Only match exactly '::'
  },
  codeBlockTypes: new Set([
    'codeblock',
    'code_block',
    'HyperMD-codeblock',
  ]),
} as const

/**
 * Types for improved type safety
 */
type BlockCategory = string
type DecorationFactory = (category?: string) => Decoration
interface DecorationFactories {
  [key: string]: DecorationFactory
}

/**
 * Creates a CodeMirror decoration with the specified class name.
 * Used to apply syntax highlighting styles to different parts of the text.
 */
function createDecoration(className: string) {
  return Decoration.mark({
    attributes: { class: className },
  })
}

/**
 * Collection of decoration factories with improved type safety
 */
const decorations: DecorationFactories = {
  startMarker: (category: string) => createDecoration(`ginko-blocks-syntax-marker ginko-blocks-syntax-start ginko-blocks-syntax-${category}`),
  middleMarker: (category: string) => createDecoration(`ginko-blocks-syntax-marker ginko-blocks-syntax-middle ginko-blocks-syntax-${category}`),
  endMarker: () => createDecoration('ginko-blocks-syntax-marker ginko-blocks-syntax-end'),
  propsContainer: () => createDecoration('ginko-blocks-syntax-props-container'),
  booleanProp: () => createDecoration('ginko-blocks-syntax-prop-boolean'),
  propName: () => createDecoration('ginko-blocks-syntax-prop-name'),
  propEquals: () => createDecoration('ginko-blocks-syntax-prop-equals'),
  propValue: () => createDecoration('ginko-blocks-syntax-prop-value'),
  content: () => createDecoration('ginko-blocks-syntax-content'),
}

/**
 * Manages the collection and application of decorations for syntax highlighting.
 * Ensures decorations are applied in the correct order and prevents duplicate decorations.
 * Tracks the state of props processing to prevent recursive decoration application.
 */
class DecorationManager {
  private decorations: Array<{ from: number, to: number, decoration: Decoration }> = []
  private processedRanges: Set<string> = new Set()
  private inProps = false
  private errors: Error[] = []

  add(from: number, to: number, decoration: Decoration) {
    try {
      const range = `${from}-${to}`
      if (this.processedRanges.has(range)) {
        this.addError(new Error(`Duplicate decoration for range: ${range}`))
        return
      }
      if (from < 0 || to < 0 || from > to) {
        this.addError(new Error(`Invalid decoration range: ${from}-${to}`))
        return
      }
      this.processedRanges.add(range)
      this.decorations.push({ from, to, decoration })
    }
    catch (error) {
      this.addError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  addError(error: Error) {
    this.errors.push(error)
    console.warn('[DecorationManager]', error.message)
  }

  applyTo(builder: RangeSetBuilder<Decoration>) {
    this.decorations.sort((a, b) => a.from - b.from || a.to - b.to)
      .forEach(({ from, to, decoration }) => {
        builder.add(from, to, decoration)
      })
  }

  enterProps() {
    this.inProps = true
  }

  exitProps() {
    this.inProps = false
  }

  isInProps() {
    return this.inProps
  }

  getErrors(): readonly Error[] {
    return [...this.errors]
  }
}

/**
 * Processes and decorates properties within block markers.
 * Handles both string props (key="value") and boolean props (flag).
 *
 * The function carefully parses the props section to apply appropriate decorations
 * while avoiding infinite loops and handling edge cases. It uses a position-based
 * approach to process each prop sequentially.
 *
 * @param manager - The decoration manager instance
 * @param lineStart - The starting position of the current line
 * @param text - The full text of the line containing props
 * @param _category - The block category
 */
function processProps(
  manager: DecorationManager,
  lineStart: number,
  text: string,
  _category: BlockCategory,
): void {
  try {
    const propsStart = text.indexOf('(')
    const propsEnd = text.lastIndexOf(')')

    if (propsStart === -1 || propsEnd === -1 || propsEnd <= propsStart) {
      return
    }

    const propsContent = text.slice(propsStart + 1, propsEnd)
    if (propsContent.length > CONFIG.maxPropLength) {
      manager.addError(new Error(`Props content exceeds maximum length of ${CONFIG.maxPropLength}`))
      return
    }

    manager.enterProps()

    manager.add(
      lineStart + propsStart,
      lineStart + propsEnd + 1,
      decorations.propsContainer(),
    )

    let pos = 0

    while (pos < propsContent.length) {
      const startPos = pos

      while (pos < propsContent.length && /\s/.test(propsContent[pos])) pos++
      if (pos >= propsContent.length)
        break

      const nameStart = pos
      while (pos < propsContent.length && /[\w-]/.test(propsContent[pos])) pos++
      const name = propsContent.slice(nameStart, pos)

      if (!name) {
        pos++
        continue
      }

      while (pos < propsContent.length && /\s/.test(propsContent[pos])) pos++

      if (pos < propsContent.length && propsContent[pos] === '=') {
        const equalsPos = pos
        pos++

        while (pos < propsContent.length && /\s/.test(propsContent[pos])) pos++

        if (pos < propsContent.length && propsContent[pos] === '"') {
          const valueStart = pos
          pos++

          while (pos < propsContent.length && propsContent[pos] !== '"') pos++
          if (pos < propsContent.length)
            pos++

          manager.add(
            lineStart + propsStart + 1 + nameStart,
            lineStart + propsStart + 1 + nameStart + name.length,
            decorations.propName(),
          )

          manager.add(
            lineStart + propsStart + 1 + equalsPos,
            lineStart + propsStart + 1 + equalsPos + 1,
            decorations.propEquals(),
          )

          manager.add(
            lineStart + propsStart + 1 + valueStart,
            lineStart + propsStart + 1 + pos,
            decorations.propValue(),
          )
        }
      }
      else {
        manager.add(
          lineStart + propsStart + 1 + nameStart,
          lineStart + propsStart + 1 + pos,
          decorations.booleanProp(),
        )
      }

      while (pos < propsContent.length && /[\s,]/.test(propsContent[pos])) pos++

      if (pos === startPos) {
        break
      }
    }
  }
  catch (error) {
    manager.addError(error instanceof Error ? error : new Error(String(error)))
  }
  finally {
    manager.exitProps()
  }
}

/**
 * Determines if a given position in the document is inside a code block.
 * This is crucial for preventing syntax highlighting within code blocks
 * where the markers should be treated as literal text.
 *
 * @param transaction - The current CodeMirror transaction
 * @param pos - The position to check
 * @returns true if the position is inside a code block
 */
function isInCodeBlock(transaction: Transaction, pos: number): boolean {
  try {
    const tree = syntaxTree(transaction.state)
    let currentNode = tree.resolveInner(pos, 1)

    while (currentNode && currentNode.parent) {
      if (CONFIG.codeBlockTypes.has(currentNode.type.name)) {
        return true
      }
      currentNode = currentNode.parent
    }
    return false
  }
  catch (error) {
    console.warn('[isInCodeBlock]', error)
    return false // Fail safe - better to not highlight than crash
  }
}

/**
 * CodeMirror state field that manages syntax highlighting for block markers.
 * This field tracks and updates decorations as the document changes.
 *
 * The field processes the document line by line, identifying and decorating:
 * - Block start markers (::type)
 * - Block continuation markers (--type)
 * - Block end markers (::)
 * - Properties within markers
 *
 * It carefully handles edge cases and prevents decoration conflicts by:
 * - Skipping code blocks
 * - Preventing recursive decoration in props
 * - Managing decoration ranges to avoid overlaps
 */
export const syntaxHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },

  update(oldState: DecorationSet, tr: Transaction) {
    try {
      const builder = new RangeSetBuilder<Decoration>()
      const manager = new DecorationManager()

      if (!tr.state || !tr.state.doc) {
        return oldState
      }

      const docText = tr.state.doc.toString()
      let pos = 0

      while (pos < docText.length) {
        const line = tr.state.doc.lineAt(pos)
        const lineText = line.text

        if (!lineText) {
          pos = line.to + 1
          continue
        }

        // Skip if we're in a code block
        if (isInCodeBlock(tr, line.from)) {
          pos = line.to + 1
          continue
        }

        const startMatch = CONFIG.patterns.start.exec(lineText.trim())
        const middleMatch = CONFIG.patterns.middle.exec(lineText.trim())
        const endMatch = CONFIG.patterns.end.exec(lineText.trim())

        if (startMatch) {
          // Highlight the start marker (::type)
          const markerEnd = lineText.includes('(') ? lineText.indexOf('(') : lineText.includes(' ') ? lineText.indexOf(' ') : lineText.length
          manager.add(line.from, line.from + markerEnd, decorations.startMarker(startMatch[1]))

          // Process props if they exist
          if (startMatch[2]) {
            processProps(manager, line.from, lineText, startMatch[1])
          }

          // Highlight remaining content
          const contentStart = lineText.includes(')') ? lineText.indexOf(')') + 1 : markerEnd
          if (contentStart < lineText.length) {
            manager.add(line.from + contentStart, line.to, decorations.content())
          }
        }
        else if (middleMatch) {
          // Highlight the middle marker (--type)
          const markerEnd = lineText.includes('(') ? lineText.indexOf('(') : lineText.includes(' ') ? lineText.indexOf(' ') : lineText.length
          const category = lineText.trim().slice(2, markerEnd).trim()
          manager.add(line.from, line.from + markerEnd, decorations.middleMarker(category))

          // Process props if they exist
          if (middleMatch[1]) {
            processProps(manager, line.from, lineText, category)
          }

          // Highlight remaining content
          const contentStart = lineText.includes(')') ? lineText.indexOf(')') + 1 : markerEnd
          if (contentStart < lineText.length) {
            manager.add(line.from + contentStart, line.to, decorations.content())
          }
        }
        else if (endMatch) {
          manager.add(line.from, line.to, decorations.endMarker())
        }

        pos = line.to + 1
      }

      manager.applyTo(builder)
      return builder.finish()
    }
    catch (error) {
      console.warn('[syntaxHighlightField]', error)
      return oldState
    }
  },

  provide(field) {
    return EditorView.decorations.from(field)
  },
})

export const syntaxHighlight = [syntaxHighlightField]
