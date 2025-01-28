import type { App, Editor } from 'obsidian'
import type { GinkoBlocksSettings } from './settings/settings'
import { MarkdownView, Modal, Notice, Plugin, Setting } from 'obsidian'
import { DEFAULT_SETTINGS, GinkoBlocksSettingTab } from './settings/settings'
import { WELCOME_VIEW_TYPE, WelcomeView } from './welcome/welcomeView'

// Remember to rename these classes and interfaces!

export default class GinkoBlocksPlugin extends Plugin {
  settings: GinkoBlocksSettings

  async onload() {
    await this.loadSettings()

    // Register the welcome view type
    this.registerView(
      WELCOME_VIEW_TYPE,
      leaf => new WelcomeView(leaf),
    )

    // Show welcome view on first load
    if (!localStorage.getItem('ginko-blocks-welcome-shown')) {
      await this.activateWelcomeView()
    }

    // Add command to show welcome view
    this.addCommand({
      id: 'show-welcome-view',
      name: 'Show Welcome View',
      callback: () => {
        this.activateWelcomeView()
      },
    })

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon('sparkle', 'Ginko Blocks', async () => {
      await this.activateWelcomeView()
    })
    // Perform additional things with the ribbon
    ribbonIconEl.addClass('ginko-blocks-ribbon-class')

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem()
    statusBarItemEl.setText('Status Bar Text')

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: 'open-ginko-blocks-modal-simple',
      name: 'Open Ginko Blocks modal (simple)',
      callback: () => {
        new GinkoBlocksModal(this.app).open()
      },
    })
    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: 'ginko-blocks-editor-command',
      name: 'Ginko Blocks editor command',
      editorCallback: (editor: Editor, _: MarkdownView) => {
        editor.replaceSelection('Sample Editor Command')
      },
    })
    // This adds a complex command that can check whether the current state of the app allows execution of the command
    this.addCommand({
      id: 'open-ginko-blocks-modal-complex',
      name: 'Open Ginko Blocks modal (complex)',
      checkCallback: (checking: boolean) => {
        // Conditions to check
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (markdownView) {
          // If checking is true, we're simply "checking" if the command can be run.
          // If checking is false, then we want to actually perform the operation.
          if (!checking) {
            new GinkoBlocksModal(this.app).open()
          }

          // This command will only show up in Command Palette when the check function returns true
          return true
        }
      },
    })

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new GinkoBlocksSettingTab(this.app, this))

    // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // Using this function will automatically remove the event listener when this plugin is disabled.
    this.registerDomEvent(document, 'click', (_: MouseEvent) => {
      // Click event handling if needed
    })

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    this.registerInterval(window.setInterval(() => {
      // Interval handling if needed
    }, 5 * 60 * 1000))
  }

  onunload() {
    // Unregister the welcome view type
    this.app.workspace.detachLeavesOfType(WELCOME_VIEW_TYPE)
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  async activateWelcomeView() {
    const { workspace } = this.app

    // First check if view is already open
    const existingLeaves = workspace.getLeavesOfType(WELCOME_VIEW_TYPE)
    if (existingLeaves.length > 0) {
      // A leaf with our view already exists, use that
      workspace.revealLeaf(existingLeaves[0])
      return
    }

    // Create a new leaf in the root split (main content area)
    // Use 'split' parameter to ensure we create in the root split
    const leaf = workspace.getLeaf(true)
    if (leaf) {
      await leaf.setViewState({
        type: WELCOME_VIEW_TYPE,
        active: true,
      })
      workspace.revealLeaf(leaf)
    }
  }
}

class GinkoBlocksModal extends Modal {
  constructor(app: App) {
    super(app)
  }

  onOpen() {
    const { contentEl } = this
    contentEl.setText('Woah!')
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}
