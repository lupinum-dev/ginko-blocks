import type { App } from 'obsidian'
import { getIcon } from 'obsidian'

interface SmartIconConfig {
  name: string
  size?: number
}

export class SmartIcon {
  private readonly name: string
  private readonly size: number

  constructor({ name, size = 16 }: SmartIconConfig) {
    this.name = name
    this.size = size
  }

  public render(): Element | null {
    // Check if it's an emoji
    if (this.isEmoji(this.name)) {
      const span = document.createElement('span')
      span.style.fontSize = `${this.size}px`
      span.textContent = this.name
      return span
    }

    // Check if it's a URL/path
    if (this.isUrl(this.name)) {
      const img = document.createElement('img')
      img.src = this.name
      img.style.width = `${this.size}px`
      img.style.height = `${this.size}px`
      img.style.display = 'inline'
      return img
    }

    // Check if it's a Lucide icon
    if (this.name.startsWith('lucide:')) {
      const iconName = this.name.replace('lucide:', '')
      const iconEl = getIcon(iconName)
      if (iconEl) {
        iconEl.style.width = `${this.size}px`
        iconEl.style.height = `${this.size}px`
        return iconEl
      }
    }

    // For other icons, try to use Obsidian's built-in icon system
    const iconEl = getIcon(this.name)
    if (iconEl) {
      iconEl.style.width = `${this.size}px`
      iconEl.style.height = `${this.size}px`
      return iconEl
    }

    return null
  }

  private isEmoji(str: string): boolean {
    const emojiRegex = /[\u00A9\u00AE\u2000-\u3300]|\uD83C[\uD000-\uDFFF]|\uD83D[\uD000-\uDFFF]|\uD83E[\uD000-\uDFFF]/
    return emojiRegex.test(str)
  }

  private isUrl(str: string): boolean {
    if (/\.(?:jpg|jpeg|png|gif|svg|webp)$/i.test(str)) {
      return true
    }

    try {
      return Boolean(new URL(str))
    }
    catch {
      return false
    }
  }
}
