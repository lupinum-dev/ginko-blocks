import type { App } from 'obsidian'
import type GinkoBlocksPlugin from './main'
import { Modal, PluginSettingTab, Setting } from 'obsidian'

export interface GinkoBlocksSettings {
  components: {
    aspectImage: boolean
    card: boolean
    cardGrid: boolean
    fileTree: boolean
    gallery: boolean
    galleryFolder: boolean
    layout: boolean
    steps: boolean
    tabs: boolean
  }
  mySetting: string
}

export const DEFAULT_SETTINGS: GinkoBlocksSettings = {
  components: {
    aspectImage: false,
    card: false,
    cardGrid: false,
    fileTree: false,
    gallery: false,
    galleryFolder: false,
    layout: false,
    steps: false,
    tabs: false,
  },
  mySetting: 'default',
}

export class GinkoBlocksSettingTab extends PluginSettingTab {
  plugin: GinkoBlocksPlugin

  constructor(app: App, plugin: GinkoBlocksPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    // Banner
    const bannerDiv = containerEl.createDiv('ginko-blocks-banner')
    bannerDiv.createDiv('ginko-blocks-logo')
    const titleDiv = bannerDiv.createDiv('ginko-blocks-title')
    titleDiv.setText('Ginko Blocks')
    const descDiv = bannerDiv.createDiv('ginko-blocks-description')
    descDiv.setText('Enhance your notes with powerful block components')

    // Documentation Area
    containerEl.createEl('h2', { text: 'Documentation' })
    const docDiv = containerEl.createDiv('ginko-blocks-documentation')
    docDiv.createEl('p', {
      text: 'Please refer to our comprehensive documentation to get the most out of Ginko Blocks. We have detailed guides on component usage, examples, and best practices.',
    })
    new Setting(docDiv)
      .addButton(button => button
        .setButtonText('📚 Read Documentation')
        .setCta()
        .onClick(() => {
          window.open('https://ginko-blocks.com/docs', '_blank')
        }))

    // Discord Community
    containerEl.createEl('h2', { text: 'Join Our Community' })
    const discordDiv = containerEl.createDiv('ginko-blocks-discord')
    const discordList = discordDiv.createEl('ul')
    const discordItems = [
      'Get help and support',
      'Share your creations',
      'Connect with other users',
      'Stay updated on new features',
    ]
    discordItems.forEach((item) => {
      discordList.createEl('li', { text: item })
    })
    new Setting(discordDiv)
      .addButton(button => button
        .setButtonText('🎮 Join Discord')
        .setCta()
        .onClick(() => {
          window.open('https://discord.gg/SSGK5tuqJh', '_blank')
        }))

    // Components Section
    containerEl.createEl('h2', { text: 'Components' })

    const components = [
      {
        id: 'aspectImage',
        name: 'Aspect',
        description: 'Create responsive images with maintained aspect ratios',
        docLink: '/aspect-image',
      },
      {
        id: 'card',
        name: 'Card',
        description: 'Design beautiful content cards with customizable layouts and styles',
        docLink: '/card',
      },
      {
        id: 'cardGrid',
        name: 'Card Grid',
        description: 'Organize cards in responsive grid layouts with automatic spacing',
        docLink: '/card-grid',
      },
      {
        id: 'fileTree',
        name: 'File Tree',
        description: 'Display your vault structure in an interactive tree view',
        docLink: '/file-tree',
      },
      {
        id: 'gallery',
        name: 'Gallery',
        description: 'Create beautiful image galleries with customizable layouts',
        docLink: '/gallery',
      },
      {
        id: 'galleryFolder',
        name: 'Gallery Folder',
        description: 'Automatically generate galleries from folder contents',
        docLink: '/gallery-folder',
      },
      {
        id: 'layout',
        name: 'Layout',
        description: 'Create flexible layouts with columns, rows, and nested components',
        docLink: '/layout',
      },
      {
        id: 'steps',
        name: 'Steps',
        description: 'Create step-by-step guides with numbered or custom markers',
        docLink: '/steps',
      },
      {
        id: 'tabs',
        name: 'Tabs',
        description: 'Organize content in tabbed interfaces for better navigation',
        docLink: '/tabs',
      },
    ]

    components.forEach((component) => {
      const setting = new Setting(containerEl)
      setting.setName(component.name)
      setting.setDesc(createFragment((el) => {
        el.createSpan({ text: component.description })
        el.createEl('a', {
          text: 'Read documentation',
          cls: 'ginko-blocks-doc-link',
          href: `https://ginko.build/docs/components/${component.docLink}`,
        })
      }))
      setting.addToggle(toggle => toggle
        .setValue(this.plugin.settings.components[component.id])
        .onChange(async (value) => {
          this.plugin.settings.components[component.id] = value
          await this.plugin.saveSettings()
        }))
    })

    // Reset Section - Danger Zone
    containerEl.createEl('h2', { text: 'Danger Zone' })

    const dangerZone = containerEl.createDiv('ginko-blocks-danger-zone')
    const dangerHeader = dangerZone.createDiv('ginko-blocks-danger-header')

    new Setting(dangerHeader)
      .setName('Show Reset Options')
      .setDesc('Display options to reset components. Be careful with these settings!')
      .addToggle(toggle => toggle
        .setValue(false)
        .onChange((value) => {
          dangerContent.style.display = value ? 'block' : 'none'
        }))

    const dangerContent = dangerZone.createDiv('ginko-blocks-danger-content')
    dangerContent.style.display = 'none'

    // Move reset options inside dangerContent
    components.forEach((component) => {
      new Setting(dangerContent)
        .setName(`Reset ${component.name}`)
        .addButton(button => button
          .setButtonText('Current File')
          .onClick(() => this.showResetConfirmation(component.name, 'current file')),
        )
        .addButton(button => button
          .setButtonText('Whole Vault')
          .onClick(() => this.showResetConfirmation(component.name, 'whole vault')),
        )
    })

    // Reset All button inside danger zone
    dangerContent.createEl('h3', { text: 'Reset All Components' })
    new Setting(dangerContent)
      .setDesc('Reset all components at once')
      .addButton(button => button
        .setButtonText('Reset Current File')
        .onClick(() => this.showResetConfirmation('all components', 'current file')),
      )
      .addButton(button => button
        .setButtonText('Reset Whole Vault')
        .onClick(() => this.showResetConfirmation('all components', 'whole vault')),
      )
  }

  private showResetConfirmation(component: string, scope: string): void {
    const modal = new Modal(this.app)
    modal.titleEl.setText(`Reset ${component}`)

    const content = modal.contentEl
    content.empty()

    // Action Summary
    const actionDiv = content.createDiv('ginko-blocks-modal-action')
    actionDiv.createEl('h3', {
      text: 'Proposed Action:',
      cls: 'ginko-blocks-modal-heading',
    })

    const actionDetails = actionDiv.createDiv('ginko-blocks-modal-details')
    actionDetails.createEl('strong', { text: 'WHAT: ' })
    actionDetails.createSpan({ text: `Reset ${component}` })
    actionDetails.createEl('br')
    actionDetails.createEl('strong', { text: 'WHERE: ' })
    actionDetails.createSpan({
      text: scope === 'current file'
        ? 'Only in the currently active note'
        : 'Across your entire vault',
    })

    // Warning
    content.createEl('p', {
      text: '⚠️ Warning: This action cannot be undone. Please make sure you have a backup of your data before proceeding.',
      cls: 'ginko-blocks-modal-warning',
    })

    // Consequences
    const consequencesDiv = content.createDiv('ginko-blocks-modal-consequences')
    consequencesDiv.createEl('p', { text: 'This will:' })
    const consequencesList = consequencesDiv.createEl('ul')
    consequencesList.createEl('li', {
      text: `Remove all ${component} configurations${scope === 'current file' ? ' in this note' : ' across your vault'}`,
    })
    consequencesList.createEl('li', {
      text: 'Restore default settings for the affected components',
    })

    new Setting(content)
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => modal.close()),
      )
      .addButton(button => button
        .setButtonText('Reset')
        .setCta()
        .onClick(() => {
          // TODO: Implement actual reset logic here
          modal.close()
        }),
      )

    modal.open()
  }
}
