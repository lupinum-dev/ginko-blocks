import type { App } from 'obsidian'
import { Modal, Setting } from 'obsidian'

export class ResetModal extends Modal {
  constructor(
    app: App,
    public component: string,
    public scope: string,
    public onReset: () => void,
  ) {
    super(app)
  }

  onOpen() {
    const { contentEl, titleEl } = this
    titleEl.setText(`Reset ${this.component}`)

    // Action Summary
    const actionDiv = contentEl.createDiv('ginko-blocks-reset-modal-action')
    actionDiv.createEl('h3', {
      text: 'Proposed Action:',
      cls: 'ginko-blocks-reset-modal-heading',
    })

    const actionDetails = actionDiv.createDiv('ginko-blocks-reset-modal-details')
    actionDetails.createEl('strong', { text: 'WHAT: ' })
    actionDetails.createSpan({ text: `Reset ${this.component}` })
    actionDetails.createEl('br')
    actionDetails.createEl('strong', { text: 'WHERE: ' })
    actionDetails.createSpan({
      text: this.scope === 'current file'
        ? 'Only in the currently active note'
        : 'Across your entire vault',
    })

    // Warning
    contentEl.createEl('p', {
      text: '⚠️ Warning: This action cannot be undone. Please make sure you have a backup of your data before proceeding.',
      cls: 'ginko-blocks-reset-modal-warning',
    })

    // Consequences
    const consequencesDiv = contentEl.createDiv('ginko-blocks-reset-modal-consequences')
    consequencesDiv.createEl('p', { text: 'This will:' })
    const consequencesList = consequencesDiv.createEl('ul')
    consequencesList.createEl('li', {
      text: `Remove all ${this.component} configurations${this.scope === 'current file' ? ' in this note' : ' across your vault'}`,
    })
    consequencesList.createEl('li', {
      text: 'Restore default settings for the affected components',
    })

    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => this.close()),
      )
      .addButton(button => button
        .setButtonText('Reset')
        .setCta()
        .onClick(() => {
          this.onReset()
          this.close()
        }),
      )
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}
