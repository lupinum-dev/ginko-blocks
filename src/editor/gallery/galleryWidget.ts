import type { EditorView } from '@codemirror/view'
import type { BaseWidgetConfig } from '../_base/baseWidget'
import { imageMeta } from 'image-meta'
import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian'
import { BaseWidget } from '../_base/baseWidget'
import { toggleGalleryEditEffect } from './galleryPreviewExtension'

type GalleryMode = 'rows' | 'columns'

interface GalleryImage {
  src: string
  alt: string
  index: number
  width?: number
  height?: number
  aspectRatio?: number
}

interface ImageMeta {
  width?: number
  height?: number
  timestamp: number
}

interface StoredMeta {
  [key: string]: ImageMeta
}

export class GalleryWidget extends BaseWidget {
  private galleryImages: GalleryImage[] = []
  private readonly CACHE_KEY = 'ginko-blocks-image-gallery-meta'
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days
  private readonly GAP = 8
  private readonly TARGET_HEIGHT = 250

  constructor({ content, id, app }: BaseWidgetConfig) {
    super({ content, id, app })
  }

  private async getImageMeta(src: string): Promise<ImageMeta | null> {
    try {
      // Try to get from cache first
      const cached = this.getFromCache(src)
      if (cached)
        return cached

      const response = await fetch(src)
      const buffer = await response.arrayBuffer()
      const meta = imageMeta(new Uint8Array(buffer))

      if (meta.width && meta.height) {
        const imageMeta = {
          width: meta.width,
          height: meta.height,
          timestamp: Date.now(),
        }
        this.saveToCache(src, imageMeta)
        return imageMeta
      }
    }
    catch (error) {
      console.error('Failed to get image meta:', error)
    }
    return null
  }

  private getFromCache(src: string): ImageMeta | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY)
      if (!cached)
        return null

      const data: StoredMeta = JSON.parse(cached)
      const meta = data[src]

      if (!meta)
        return null

      // Check if cache is still valid
      if (Date.now() - meta.timestamp > this.CACHE_DURATION) {
        delete data[src]
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data))
        return null
      }

      return meta
    }
    catch (error) {
      console.error('Failed to get from cache:', error)
      return null
    }
  }

  private saveToCache(src: string, meta: ImageMeta): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY)
      const data: StoredMeta = cached ? JSON.parse(cached) : {}

      data[src] = meta
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data))
    }
    catch (error) {
      console.error('Failed to save to cache:', error)
    }
  }

  protected createPreviewView(view: EditorView): HTMLElement {
    const container = this.createContainer('ginko-gallery-container')
    const galleryGrid = document.createElement('div')

    // Parse mode from content
    const mode = this.parseMode()
    galleryGrid.className = `ginko-gallery-grid ginko-gallery-${mode}`

    // Start loading images
    this.loadGalleryImages(galleryGrid, this.parseImages(this.content), mode)

    container.appendChild(galleryGrid)
    container.appendChild(this.createEditButton((e) => {
      e.preventDefault()
      view.dispatch({
        effects: [toggleGalleryEditEffect.of({ id: this.id, value: true })],
      })
    }))

    return container
  }

  private parseMode(): GalleryMode {
    const modeMatch = this.content.match(/^::gallery\((.*?)\)/)
    if (modeMatch) {
      const mode = modeMatch[1] as GalleryMode
      if (['rows', 'columns'].includes(mode)) {
        return mode
      }
    }
    return 'rows' // default mode
  }

  private async loadGalleryImages(container: HTMLElement, images: string[], mode: GalleryMode): Promise<void> {
    const processedImages = await Promise.all(
      images.map(async (imgMarkdown, index) => {
        const imgContainer = document.createElement('div')
        imgContainer.className = 'ginko-gallery-item'

        const content = document.createElement('div')
        const markdownChild = new MarkdownRenderChild(content)

        await MarkdownRenderer.render(
          this.app,
          imgMarkdown,
          content,
          '',
          markdownChild,
        )

        const img = content.querySelector('img')
        if (!img)
          return null

        const altMatch = imgMarkdown.match(/!\[(.*?)\]/)
        const alt = altMatch ? altMatch[1] : ''
        const meta = await this.getImageMeta(img.src)

        const galleryImage: GalleryImage = {
          src: img.src,
          alt,
          index,
          width: meta?.width,
          height: meta?.height,
          aspectRatio: meta?.width && meta?.height ? meta.width / meta.height : undefined,
        }

        this.galleryImages.push(galleryImage)

        img.addEventListener('click', () => this.openLightbox(index))
        imgContainer.appendChild(content)

        return { container: imgContainer, image: galleryImage }
      }),
    )

    const validImages = processedImages.filter((img): img is NonNullable<typeof img> => img !== null)

    switch (mode) {
      case 'rows':
        this.organizeIntoRows(container, validImages)
        break
      case 'columns':
        this.organizeIntoColumns(container, validImages)
        break
    }
  }

  private organizeIntoColumns(
    container: HTMLElement,
    images: Array<{ container: HTMLElement, image: GalleryImage }>,
  ): void {
    const columnCount = 4
    const columns: HTMLDivElement[] = Array.from({ length: columnCount }, () => {
      const column = document.createElement('div')
      column.className = 'ginko-gallery-column'
      container.appendChild(column)
      return column
    })

    // Calculate column widths based on image ratios
    const columnRatios = columns.map((_, i) => 0.15 + (i * 0.01)) // Progressive width increase
    const totalRatio = columnRatios.reduce((sum, ratio) => sum + ratio, 0)

    // Set column widths
    columns.forEach((column, i) => {
      const width = (columnRatios[i] / totalRatio) * 100
      column.style.width = `${width}%`
    })

    // Distribute images across columns
    images.forEach((img, index) => {
      const column = columns[index % columnCount]
      column.appendChild(img.container)
    })
  }

  private organizeIntoRows(
    container: HTMLElement,
    images: Array<{ container: HTMLElement, image: GalleryImage }>,
  ): void {
    let currentRow: typeof images = []
    let currentRowAspectRatio = 0
    const targetAspectRatio = 3 // Desired row aspect ratio (width/height)
    const minItems = 3 // Minimum items per row
    const maxItems = 5 // Maximum items per row

    const processRow = (row: typeof images, _isLastRow: boolean) => {
      if (row.length === 0)
        return

      const rowElement = document.createElement('div')
      rowElement.className = 'ginko-gallery-row'

      // Calculate total aspect ratio and widths
      const totalAspectRatio = row.reduce((sum, img) => sum + (img.image.aspectRatio || 1), 0)

      row.forEach(({ container: imgContainer, image }) => {
        const aspectRatio = image.aspectRatio || 1
        const relativeWidth = aspectRatio / totalAspectRatio
        const percentWidth = relativeWidth * 100

        imgContainer.style.width = `${percentWidth}%`
        rowElement.appendChild(imgContainer)
      })

      container.appendChild(rowElement)
    }

    images.forEach((img, index) => {
      const aspectRatio = img.image.aspectRatio || 1
      currentRow.push(img)
      currentRowAspectRatio += aspectRatio

      const shouldProcessRow
        = currentRow.length >= maxItems
          || (currentRow.length >= minItems && currentRowAspectRatio >= targetAspectRatio)
          || index === images.length - 1

      if (shouldProcessRow) {
        processRow(currentRow, index === images.length - 1)
        currentRow = []
        currentRowAspectRatio = 0
      }
    })
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

    // Create counter
    const counter = document.createElement('div')
    counter.className = 'ginko-lightbox-counter'

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

      // Set aspect ratio if available
      const aspectRatio = this.galleryImages[index].aspectRatio
      if (aspectRatio) {
        img.style.setProperty('aspect-ratio', aspectRatio.toString())
      }

      imageContainer.appendChild(img)

      // Update caption
      caption.textContent = this.galleryImages[index].alt || ''

      // Update navigation buttons
      prevButton.style.visibility = index > 0 ? 'visible' : 'hidden'
      nextButton.style.visibility = index < this.galleryImages.length - 1 ? 'visible' : 'hidden'

      // Update counter
      counter.textContent = `${index + 1} / ${this.galleryImages.length}`
    }

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
