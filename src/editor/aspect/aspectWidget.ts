import type { BaseWidgetConfig } from '../_base/baseWidget'
import { EditorView } from '@codemirror/view'
import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian'
import { BaseWidget } from '../_base/baseWidget'
import { toggleAspectEditEffect } from './aspectPreviewExtension'

type AspectRatio = 'square' | 'video' | 'mobile' | 'photo' | 'portrait' | 'landscape' | 'pano'

const ASPECT_RATIOS: Record<AspectRatio, number> = {
  square: 1,
  video: 9 / 16,
  mobile: 16 / 9,
  photo: 3 / 4,
  portrait: 4 / 3,
  landscape: 3 / 4,
  pano: 9 / 28,
}

export class AspectWidget extends BaseWidget {
  private aspectRatio: AspectRatio = 'square'

  constructor({ content, id, app }: BaseWidgetConfig) {
    super({ content, id, app })
    this.parseAspectRatio(content)
  }

  private parseAspectRatio(content: string): void {
    const match = content.match(/::aspect\((.*?)\)/)
    if (match && match[1]) {
      const ratio = match[1].trim() as AspectRatio
      if (ratio in ASPECT_RATIOS) {
        this.aspectRatio = ratio
      }
    }
  }

  protected createPreviewView(view: EditorView): HTMLElement {
    const container = this.createContainer('ginko-blocks-aspect-container')

    // Create aspect ratio wrapper
    const wrapper = document.createElement('div')
    wrapper.className = 'ginko-blocks-aspect-wrapper'
    wrapper.style.setProperty('--aspect-ratio', ASPECT_RATIOS[this.aspectRatio].toString())

    // Extract image markdown from content
    const imageMatch = this.content.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (imageMatch) {
      const [fullMatch, _alt, _src] = imageMatch
      const content = document.createElement('div')
      const markdownChild = new MarkdownRenderChild(content)

      MarkdownRenderer.render(
        this.app,
        fullMatch,
        content,
        '',
        markdownChild,
      ).then(() => {
        // Find the rendered image element
        const imageEmbed = content.querySelector('.internal-embed.image-embed')
        if (imageEmbed) {
          // Add our aspect ratio class to the img element inside the embed
          const img = imageEmbed.querySelector('img')
          if (img) {
            img.className = 'ginko-blocks-aspect-image'
          }
        }
        wrapper.appendChild(content)
      })
    }

    container.appendChild(wrapper)
    container.appendChild(this.createEditButton((e) => {
      e.preventDefault()

      // Find the position of this widget in the document
      const widgetPos = view.posAtDOM(container)

      // Find the position after the ::aspect line
      const content = this.content
      const aspectLineEnd = content.indexOf('\n')
      if (aspectLineEnd !== -1) {
        const cursorPos = widgetPos + aspectLineEnd + 1

        // Set cursor position and scroll into view
        view.dispatch({
          selection: { anchor: cursorPos, head: cursorPos },
          effects: [
            toggleAspectEditEffect.of({ id: this.id, value: true }),
            EditorView.scrollIntoView(cursorPos),
          ],
        })
      }

      view.focus()
    }))

    return container
  }
}
