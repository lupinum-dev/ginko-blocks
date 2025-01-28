import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  checkCursorInRegion,
  getCursorLocations,
  getRegionByTags,
} from './utils'

export function createNoLineBreaksExtension(): Extension {
  let lastProcessedPositions = new Set<number>()

  return EditorView.updateListener.of((update) => {
    // Check if either the document changed or the selection (cursor) moved
    if (update.docChanged || update.selectionSet) {
      const changes = []
      const cursorLocations = getCursorLocations(update)
      const selectionRanges = update.state.selection.ranges
      let pos = 0

      // Track current cursor positions
      const currentPositions = new Set(cursorLocations.map(loc => loc.position))

      // Process layout blocks
      while (pos < update.state.doc.length) {
        const workingText = update.state.doc.sliceString(pos)
        const region = getRegionByTags(
          workingText,
          pos,
          update.state.doc.toString(),
          '::layout',
          '::',
        )

        if (!region)
          break

        const isOutside = !checkCursorInRegion(
          region.startIndex,
          region.endIndex,
          cursorLocations,
          selectionRanges,
        )

        // Check if we just moved out of this block
        const wasInside = Array.from(lastProcessedPositions).some(pos =>
          pos >= region.startIndex && pos <= region.endIndex,
        )

        // Process if we're outside and either just moved out or the document changed
        if (isOutside && (wasInside || update.docChanged)) {
          const processedBlock = processLayoutBlock(region.regionText)
          if (processedBlock !== region.regionText) {
            changes.push({
              from: region.startIndex,
              to: region.endIndex,
              insert: processedBlock,
            })
          }
        }

        pos = region.endIndex
      }

      // Update last processed positions
      lastProcessedPositions = currentPositions

      // Apply changes if any were found
      if (changes.length > 0) {
        update.view.dispatch({
          changes,
        })
      }
    }
  })
}

function processLayoutBlock(text: string): string {
  // Split into lines and process
  const lines = text.split('\n')
  const processedLines = lines.map(line => line.trim()).filter(line => line.length > 0)

  // Join all lines with a single newline
  return processedLines.join('\n')
}
