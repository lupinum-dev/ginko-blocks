import type { EditorView } from '@codemirror/view'
import type { BaseWidgetConfig } from '../_base/baseWidget'
import { App, MarkdownRenderChild, MarkdownRenderer } from 'obsidian'
import { BaseWidget } from '../_base/baseWidget'
import { toggleGalleryEditEffect } from './galleryPreviewExtension'

interface GalleryImage {
  src: string
  alt: string
  index: number
}

export class GalleryWidget extends BaseWidget {
  private galleryImages: GalleryImage[] = []

  constructor({ content, id, app }: BaseWidgetConfig) {
    super({ content, id, app })
  }

  protected createPreviewView(view: EditorView): HTMLElement {
    const container = this.createContainer('ginko-gallery-container')

    // Create gallery grid
    const galleryGrid = document.createElement('div')
    galleryGrid.className = 'ginko-gallery-grid'

    // Parse content and create image elements
    const images = this.parseImages(this.content)
    this.galleryImages = [] // Reset gallery images

    images.forEach((imgMarkdown, index) => {
      const imgContainer = document.createElement('div')
      imgContainer.className = 'ginko-gallery-item'

      const content = document.createElement('div')
      const markdownChild = new MarkdownRenderChild(content)

      MarkdownRenderer.render(
        this.app,
        imgMarkdown,
        content,
        '',
        markdownChild,
      ).then(() => {
        // Add click handler for lightbox
        const img = content.querySelector('img')
        if (img) {
          // Extract alt text from markdown
          const altMatch = imgMarkdown.match(/!\[(.*?)\]/)
          const alt = altMatch ? altMatch[1] : ''

          // Store image data
          this.galleryImages.push({
            src: img.src,
            alt,
            index,
          })

          img.addEventListener('click', () => this.openLightbox(index))
        }
        imgContainer.appendChild(content)
      })

      galleryGrid.appendChild(imgContainer)
    })

    container.appendChild(galleryGrid)
    container.appendChild(this.createEditButton((e) => {
      e.preventDefault()
      view.dispatch({
        effects: [toggleGalleryEditEffect.of({ id: this.id, value: true })],
      })
    }))

    return container
  }

  private parseImages(content: string): string[] {
    const lines = content.split('\n')
    return lines
      .map(line => line.trim())
      .filter(line => line.startsWith('![') && line.includes('](') && line.endsWith(')'))
  }

  private openLightbox(currentIndex: number): void {
    const lightbox = document.createElement('div')
    lightbox.className = 'ginko-gallery-lightbox'

    // Create container for image and navigation
    const contentContainer = document.createElement('div')
    contentContainer.className = 'ginko-lightbox-content'

    // Create navigation buttons
    const prevButton = document.createElement('button')
    prevButton.className = 'ginko-lightbox-nav prev'
    prevButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>'

    const nextButton = document.createElement('button')
    nextButton.className = 'ginko-lightbox-nav next'
    nextButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>'

    // Create close button
    const closeButton = document.createElement('button')
    closeButton.className = 'ginko-lightbox-close'
    closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'

    // Create image container
    const imageContainer = document.createElement('div')
    imageContainer.className = 'ginko-lightbox-image-container'

    // Create caption
    const caption = document.createElement('div')
    caption.className = 'ginko-lightbox-caption'

    // Function to update image
    const updateImage = (index: number) => {
      if (index < 0 || index >= this.galleryImages.length)
        return
      currentIndex = index

      // Update image
      imageContainer.innerHTML = ''
      const img = document.createElement('img')
      img.src = this.galleryImages[index].src
      img.alt = this.galleryImages[index].alt
      imageContainer.appendChild(img)

      // Update caption
      caption.textContent = this.galleryImages[index].alt || ''

      // Update navigation buttons
      prevButton.style.visibility = index > 0 ? 'visible' : 'hidden'
      nextButton.style.visibility = index < this.galleryImages.length - 1 ? 'visible' : 'hidden'

      // Update counter
      counter.textContent = `${index + 1} / ${this.galleryImages.length}`
    }

    // Create counter
    const counter = document.createElement('div')
    counter.className = 'ginko-lightbox-counter'

    // Add event listeners
    prevButton.addEventListener('click', () => updateImage(currentIndex - 1))
    nextButton.addEventListener('click', () => updateImage(currentIndex + 1))
    closeButton.addEventListener('click', () => lightbox.remove())

    // Keyboard navigation
    const handleKeydown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          updateImage(currentIndex - 1)
          break
        case 'ArrowRight':
          updateImage(currentIndex + 1)
          break
        case 'Escape':
          lightbox.remove()
          break
      }
    }
    document.addEventListener('keydown', handleKeydown)

    // Cleanup on close
    lightbox.addEventListener('remove', () => {
      document.removeEventListener('keydown', handleKeydown)
    })

    // Assemble lightbox
    contentContainer.appendChild(prevButton)
    contentContainer.appendChild(imageContainer)
    contentContainer.appendChild(nextButton)
    lightbox.appendChild(closeButton)
    lightbox.appendChild(contentContainer)
    lightbox.appendChild(caption)
    lightbox.appendChild(counter)

    // Initial image update
    updateImage(currentIndex)

    document.body.appendChild(lightbox)
  }
}
