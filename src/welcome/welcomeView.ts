import type { WorkspaceLeaf } from 'obsidian'
import { ItemView, MarkdownRenderer } from 'obsidian'

export const WELCOME_VIEW_TYPE = 'ginko-blocks-welcome-view'

export class WelcomeView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf)
  }

  getViewType(): string {
    return WELCOME_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Welcome to Ginko Blocks'
  }

  getIcon(): string {
    return 'sparkle'
  }

  async onOpen() {
    // Get the content container
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass('ginko-blocks-welcome-view')

    const welcomeContent = `# Welcome to Ginko Blocks! 🎉

## 📚 Documentation

Get started with our comprehensive documentation. Learn about component usage, examples, and best practices.

[Get me started! 🚀](https://ginko.build/docs)

## 🎮 Join Our Community

- Get help and support
- Stay updated on new features

[Join Discord Server](https://discord.gg/SSGK5tuqJh)
`

    await MarkdownRenderer.renderMarkdown(
      welcomeContent,
      container,
      '',
      this,
    )

    // Add "Don't show again" button
    const footerDiv = container.createDiv('ginko-blocks-welcome-footer')
    const button = footerDiv.createEl('button', {
      text: 'Don\'t show again',
      cls: 'mod-cta',
    })

    button.addEventListener('click', () => {
      localStorage.setItem('ginko-blocks-welcome-shown', 'true')
      this.leaf.detach()
    })
  }

  async onClose() {
    // Clean up by emptying the container
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
  }
}
