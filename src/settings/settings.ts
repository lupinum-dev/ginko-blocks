import type { App } from 'obsidian'
import type GinkoBlocksPlugin from '../main'
import { PluginSettingTab, Setting } from 'obsidian'
import { ResetModal } from './resetModal'
import { ResetStorageModal } from './resetStorage'

interface UtilityLink {
  text: string
  url: string
}

interface Utility {
  id: keyof GinkoBlocksSettings['utilities']
  name: string
  description: string
  warning: string
  links: UtilityLink[]
}

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
    [key: string]: boolean
  }
  utilities: {
    iconify: boolean
    [key: string]: boolean
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
  utilities: {
    iconify: false,
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
    const bannerDiv = containerEl.createDiv('ginko-blocks-settings-banner')
    bannerDiv.createDiv('ginko-blocks-settings-logo')
    const titleDiv = bannerDiv.createDiv('ginko-blocks-settings-title')
    titleDiv.setText('Ginko Blocks')
    const descDiv = bannerDiv.createDiv('ginko-blocks-settings-description')
    descDiv.setText('Enhance your notes with powerful block components')

    // Documentation Area
    containerEl.createEl('h2', { text: 'Documentation' })
    const docDiv = containerEl.createDiv('ginko-blocks-settings-documentation')
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
    const discordDiv = containerEl.createDiv('ginko-blocks-settings-discord')
    const discordList = discordDiv.createEl('ul')
    const discordItems = [
      'Get help and support',
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
        // Create description container
        const descContainer = el.createDiv({ cls: 'ginko-blocks-settings-description-container' })

        // Add description text
        descContainer.createDiv({
          text: component.description,
          cls: 'ginko-blocks-settings-component-description',
        })

        // Add documentation link
        descContainer.createEl('a', {
          text: 'Read documentation',
          cls: 'ginko-blocks-settings-doc-link',
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

    // Add Utilities Section
    containerEl.createEl('h2', { text: 'Utilities' })

    const utilities: Utility[] = [
      {
        id: 'iconify',
        name: 'Iconify Icons',
        description: 'Extend the standard Lucide icons with 200,000+ ready-to-use icons from Iconify.',
        warning: 'Note: This feature makes network requests to the Iconify API to fetch icons.',
        links: [
          { text: 'Read our documentation', url: 'https://ginko.build/docs/utilities/iconify' },
          { text: 'Browse available icons', url: 'https://icones.js.org/' },
          { text: 'Learn more about Iconify', url: 'https://iconify.design/' },
        ],
      },
    ]

    utilities.forEach((utility) => {
      const setting = new Setting(containerEl)
      setting.setName(utility.name)
      setting.setDesc(createFragment((el) => {
        // Create main description container
        const descContainer = el.createDiv({ cls: 'ginko-blocks-settings-description-container' })

        // Add main description text
        descContainer.createDiv({
          text: utility.description,
          cls: 'ginko-blocks-settings-utility-description',
        })

        // Add warning text if present
        if (utility.warning) {
          descContainer.createDiv({
            text: utility.warning,
            cls: ['ginko-blocks-settings-warning', 'mod-warning'],
          })
        }

        // Add links if present
        if (utility.links && utility.links.length > 0) {
          const linksContainer = descContainer.createDiv({ cls: 'ginko-blocks-settings-links-container' })
          utility.links.forEach((link) => {
            linksContainer.createEl('a', {
              text: link.text,
              cls: 'ginko-blocks-settings-doc-link',
              href: link.url,
            })
          })
        }
      }))
      setting.addToggle(toggle => toggle
        .setValue(this.plugin.settings.utilities[utility.id])
        .onChange(async (value) => {
          this.plugin.settings.utilities[utility.id] = value
          await this.plugin.saveSettings()
        }))
    })

    // Reset Section - Danger Zone
    containerEl.createEl('h2', { text: 'Danger Zone' })

    const dangerZone = containerEl.createDiv('ginko-blocks-settings-danger-zone')
    const dangerHeader = dangerZone.createDiv('ginko-blocks-settings-danger-header')
    const dangerContent = dangerZone.createDiv('ginko-blocks-settings-danger-content')
    dangerContent.style.display = 'none'

    new Setting(dangerHeader)
      .setName('Show Reset Options')
      .setDesc('Display options to reset components. Be careful with these settings!')
      .addToggle(toggle => toggle
        .setValue(false)
        .onChange((value) => {
          dangerContent.style.display = value ? 'block' : 'none'
        }))

    // Move reset options inside dangerContent
    dangerContent.createEl('h3', { text: 'Reset Components' })
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

    // Add Local Storage Reset Section
    dangerContent.createEl('h3', { text: 'Reset Local Storage' })
    new Setting(dangerContent)
      .setDesc('View and delete Ginko Blocks local storage data')
      .addButton(button => button
        .setButtonText('Manage Local Storage')
        .setWarning()
        .onClick(() => {
          new ResetStorageModal(this.app).open()
        }))
  }

  private showResetConfirmation(component: string, scope: string): void {
    new ResetModal(
      this.app,
      component,
      scope,
      () => {
        // TODO: Implement actual reset logic here
      },
    ).open()
  }
}
