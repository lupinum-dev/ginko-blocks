import type { App } from 'obsidian'
import { Modal, Notice, Setting } from 'obsidian'

interface StorageItem {
  key: string
  value: string
}

export class ResetStorageModal extends Modal {
  private storageItems: StorageItem[] = []

  constructor(app: App) {
    super(app)
    this.loadStorageItems()
  }

  private loadStorageItems(): void {
    this.storageItems = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('ginko-blocks')) {
        const value = localStorage.getItem(key) || ''
        this.storageItems.push({ key, value })
      }
    }
  }

  onOpen() {
    const { contentEl } = this

    contentEl.empty()
    contentEl.addClass('ginko-blocks-reset-storage-modal')

    contentEl.createEl('h2', { text: 'Reset Local Storage' })

    if (this.storageItems.length === 0) {
      new Notice('No Ginko Blocks storage items found')
      this.close()
      return
    }

    // Create list of storage items
    const storageList = contentEl.createDiv('storage-list')

    this.storageItems.forEach((item) => {
      const itemSetting = new Setting(storageList)
        .setName(item.key)
        .setDesc(`Value: ${item.value}`)
        .addButton(button => button
          .setButtonText('Delete')
          .onClick(() => {
            localStorage.removeItem(item.key)
            itemSetting.settingEl.remove()
            new Notice(`Deleted ${item.key}`)

            // Refresh the list
            this.loadStorageItems()
            if (this.storageItems.length === 0) {
              this.close()
            }
          }))
    })

    // Add delete all button
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Delete All')
        .setWarning()
        .onClick(() => {
          this.storageItems.forEach((item) => {
            localStorage.removeItem(item.key)
          })
          new Notice('All Ginko Blocks storage items deleted')
          this.close()
        }))
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}
