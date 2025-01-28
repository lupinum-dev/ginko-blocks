import type { Transaction } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { Extension, RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'

// Create decorations with specific classes
function createDecoration(className: string) {
  return Decoration.mark({
    attributes: { class: className },
  })
}

// Define our decoration types
const decorations = {
  startMarker: (category: string) => createDecoration(`ginko-blocks-syntax-marker ginko-blocks-syntax-start ginko-blocks-syntax-${category}`),
  middleMarker: (category: string) => createDecoration(`ginko-blocks-syntax-marker ginko-blocks-syntax-middle ginko-blocks-syntax-${category}`),
  endMarker: () => createDecoration('ginko-blocks-syntax-marker ginko-blocks-syntax-end'),
  propsContainer: (category: string) => createDecoration(`ginko-blocks-syntax-props-container ginko-blocks-syntax-${category}`),
  booleanProp: (category: string) => createDecoration(`ginko-blocks-syntax-prop-boolean ginko-blocks-syntax-${category}`),
  propName: (category: string) => createDecoration(`ginko-blocks-syntax-prop-name ginko-blocks-syntax-${category}`),
  propEquals: (category: string) => createDecoration(`ginko-blocks-syntax-prop-equals ginko-blocks-syntax-${category}`),
  propValue: (category: string) => createDecoration(`ginko-blocks-syntax-prop-value ginko-blocks-syntax-${category}`),
}

// Syntax patterns
const patterns = {
  start: /^(::)(\w+)(?:\((.*)\))?$/,
  middle: /^(--\w+)(?:\((.*)\))?(.*)$/,
  end: /^(::|)$/,
}

// Helper class to manage decorations and ensure proper sorting
class DecorationManager {
  private decorations: Array<{ from: number, to: number, decoration: Decoration }> = []

  add(from: number, to: number, decoration: Decoration) {
    this.decorations.push({ from, to, decoration })
  }

  // Add all decorations to builder in sorted order
  applyTo(builder: RangeSetBuilder<Decoration>) {
    this.decorations.sort((a, b) => a.from - b.from || a.to - b.to)
      .forEach(({ from, to, decoration }) => {
        builder.add(from, to, decoration)
      })
  }
}

function processProps(
  manager: DecorationManager,
  lineStart: number,
  text: string,
  category: string,
): void {
  const propsStart = text.indexOf('(')
  const propsEnd = text.lastIndexOf(')')

  if (propsStart === -1 || propsEnd === -1)
    return

  // Add container decoration for entire props section
  manager.add(
    lineStart + propsStart,
    lineStart + propsEnd + 1,
    decorations.propsContainer(category),
  )

  // Process the props content
  const propsContent = text.slice(propsStart + 1, propsEnd)
  let pos = 0

  while (pos < propsContent.length) {
    // Skip whitespace
    while (pos < propsContent.length && /\s/.test(propsContent[pos])) pos++
    if (pos >= propsContent.length)
      break

    // Find prop name
    const nameStart = pos
    while (pos < propsContent.length && /[\w-]/.test(propsContent[pos])) pos++
    const name = propsContent.slice(nameStart, pos)

    // Skip whitespace after name
    while (pos < propsContent.length && /\s/.test(propsContent[pos])) pos++

    // Check if it's a string prop
    if (pos < propsContent.length && propsContent[pos] === '=') {
      // String prop
      const equalsPos = pos
      pos++ // Skip equals

      // Skip whitespace after equals
      while (pos < propsContent.length && /\s/.test(propsContent[pos])) pos++

      if (pos < propsContent.length && propsContent[pos] === '"') {
        const valueStart = pos
        pos++ // Skip opening quote

        // Find closing quote
        while (pos < propsContent.length && propsContent[pos] !== '"') pos++
        if (pos < propsContent.length)
          pos++ // Skip closing quote

        // Add decorations in order
        manager.add(
          lineStart + propsStart + 1 + nameStart,
          lineStart + propsStart + 1 + nameStart + name.length,
          decorations.propName(category),
        )

        manager.add(
          lineStart + propsStart + 1 + equalsPos,
          lineStart + propsStart + 1 + equalsPos + 1,
          decorations.propEquals(category),
        )

        manager.add(
          lineStart + propsStart + 1 + valueStart,
          lineStart + propsStart + 1 + pos,
          decorations.propValue(category),
        )
      }
    }
    else {
      // Boolean prop
      manager.add(
        lineStart + propsStart + 1 + nameStart,
        lineStart + propsStart + 1 + pos,
        decorations.booleanProp(category),
      )
    }

    // Skip to next prop
    while (pos < propsContent.length && /[\s,]/.test(propsContent[pos])) pos++
  }
}

export const syntaxHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(oldState: DecorationSet, tr: Transaction) {
    const builder = new RangeSetBuilder<Decoration>()
    const manager = new DecorationManager()

    for (let pos = 0; pos < tr.state.doc.length;) {
      const line = tr.state.doc.lineAt(pos)
      const text = line.text.trim()

      // Start marker
      const startMatch = text.match(patterns.start)
      if (startMatch) {
        const [full, marker, category] = startMatch
        const markerLength = marker.length + category.length

        manager.add(
          line.from,
          line.from + markerLength,
          decorations.startMarker(category),
        )

        if (text.includes('(')) {
          processProps(manager, line.from, text, category)
        }
      }

      // Middle marker
      const middleMatch = text.match(patterns.middle)
      if (middleMatch) {
        const [full, marker] = middleMatch
        const category = marker.slice(2)

        manager.add(
          line.from,
          line.from + marker.length,
          decorations.middleMarker(category),
        )

        if (text.includes('(')) {
          processProps(manager, line.from, text, category)
        }
      }

      // End marker
      const endMatch = text.match(patterns.end)
      if (endMatch) {
        manager.add(
          line.from,
          line.to,
          decorations.endMarker(),
        )
      }

      pos = line.to + 1
    }

    // Apply all decorations in sorted order
    manager.applyTo(builder)
    return builder.finish()
  },
  provide(field) {
    return EditorView.decorations.from(field)
  },
})

export const syntaxHighlight = [syntaxHighlightField]
