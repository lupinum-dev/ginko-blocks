import type { App } from 'obsidian'
import { Modal, Setting } from 'obsidian'

export class WelcomeModal extends Modal {
  constructor(app: App) {
    super(app)
  }

  onOpen() {
    const { contentEl, titleEl } = this
    titleEl.setText('Welcome to Ginko Blocks! 🎉')

    const container = contentEl.createDiv('ginko-blocks-welcome-modal')

    // Documentation Section
    const docsDiv = container.createDiv('ginko-blocks-welcome-section')
    docsDiv.createEl('h3', { text: '📚 Documentation' })
    docsDiv.createEl('p', {
      text: 'Get started with our comprehensive documentation. Learn about component usage, examples, and best practices.',
    })
    const docsButtonContainer = docsDiv.createDiv('ginko-blocks-welcome-buttons')
    new Setting(docsButtonContainer)
      .addButton(button => button
        .setButtonText('Get me started! 🚀')
        .setCta()
        .onClick(() => {
          window.open('https://ginko.build/docs', '_blank')
        }))

    // Discord Section
    const discordDiv = container.createDiv('ginko-blocks-welcome-section')
    discordDiv.createEl('h3', { text: '🎮 Join Our Community' })
    const discordList = discordDiv.createEl('ul')
    const discordItems = [
      'Get help and support',
      'Stay updated on new features',
    ]
    discordItems.forEach((item) => {
      discordList.createEl('li', { text: item })
    })
    const discordButtonContainer = discordDiv.createDiv('ginko-blocks-welcome-buttons')
    new Setting(discordButtonContainer)
      .addButton(button => button
        .setButtonText('Join Discord Server')
        .setCta()
        .onClick(() => {
          window.open('https://discord.gg/SSGK5tuqJh', '_blank')
        }))

    // Footer Actions
    const footerDiv = container.createDiv('ginko-blocks-welcome-footer')

    // Get Started Button
    new Setting(footerDiv)
      .setClass('ginko-blocks-welcome-start')
      .addButton(button => button
        .setButtonText('Don\'t show again')
        .setCta()
        .onClick(() => {
          localStorage.setItem('ginko-blocks-welcome-shown', 'true')
          this.close()
        }))
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}
