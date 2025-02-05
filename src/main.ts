import type { GinkoBlocksSettings } from './settings/settings'
import { Plugin } from 'obsidian'
import { syntaxHighlightField } from './editor/_syntax/syntaxHighlightExtension'
import { createAspectPreviewExtension } from './editor/aspect/aspectPreviewExtension'
import { createFileTreeExtension } from './editor/file-tree/fileTreePostProcessor'
import { createGalleryPreviewExtension } from './editor/gallery/galleryPreviewExtension'
import { createLayoutPreviewExtension } from './editor/layout/layoutPreviewExtension'
import { createStepsPreviewExtension } from './editor/steps/stepsPreviewExtension'
import { tabsProcessor } from './editor/tabs/tabsPostProcessor'
import { createTabPreviewExtension } from './editor/tabs/tabsPreviewExtension'
import { DEFAULT_SETTINGS, GinkoBlocksSettingTab } from './settings/settings'
import { CURRENT_WELCOME_VERSION, WELCOME_VIEW_TYPE, WelcomeView } from './welcome/welcomeView'

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

    this.registerEditorExtensions()

    // Show welcome view on first load
    await this.activateWelcomeView()

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new GinkoBlocksSettingTab(this.app, this))
  }

  /**
   * Registers editor extensions
   */
  private registerEditorExtensions() {
    this.registerEditorExtension(createTabPreviewExtension(this.app))
    this.registerMarkdownPostProcessor(tabsProcessor)
    this.registerEditorExtension(syntaxHighlightField)
    this.registerEditorExtension(createLayoutPreviewExtension(this.app))
    this.registerEditorExtension(createStepsPreviewExtension(this.app))
    // this.registerEditorExtension(createNoLineBreaksExtension());
    this.registerEditorExtension(createGalleryPreviewExtension(this.app))
    this.registerEditorExtension(createAspectPreviewExtension(this.app))
    this.registerEditorExtension(createFileTreeExtension(this.app))
  }

  onunload() {
    // Unregister the welcome view type by detaching leaves
    this.app.workspace.detachLeavesOfType(WELCOME_VIEW_TYPE)

    // Force editor refresh to clean up extensions
    this.app.workspace.updateOptions()
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  async activateWelcomeView(forceShow = false) {
    const storageKey = `ginko-blocks-welcome-shown-v${CURRENT_WELCOME_VERSION}`

    // Don't show if user has already seen this version (unless forced)
    if (!forceShow && localStorage.getItem(storageKey)) {
      return
    }

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
