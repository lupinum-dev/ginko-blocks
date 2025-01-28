import type { App } from 'obsidian'
import type GinkoBlocksPlugin from './main'
import { PluginSettingTab, Setting } from 'obsidian'

export interface GinkoBlocksSettings {
  mySetting: string
}

export const DEFAULT_SETTINGS: GinkoBlocksSettings = {
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

    new Setting(containerEl)
      .setName('Setting #1')
      .setDesc('It\'s a secret')
      .addText(text => text
        .setPlaceholder('Enter your secret')
        .setValue(this.plugin.settings.mySetting)
        .onChange(async (value) => {
          this.plugin.settings.mySetting = value
          await this.plugin.saveSettings()
        }))
  }
}
