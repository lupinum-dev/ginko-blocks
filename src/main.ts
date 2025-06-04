import type { GinkoBlocksSettings } from './settings/settings'
import { Plugin } from 'obsidian'
import { syntaxHighlightField } from './editor/_syntax/syntaxHighlightExtension'
import { createAspectPreviewExtension } from './editor/aspect/aspectPreviewExtension'
import { createFileTreeExtension } from './editor/file-tree/fileTreePostProcessor'
import { createGalleryPreviewExtension } from './editor/gallery/galleryPreviewExtension'
import { createLayoutPreviewExtension } from './editor/layout/layoutPreviewExtension'
import { createStepsPreviewExtension } from './editor/steps/stepsPreviewExtension'
import { TabsPostProcessor } from './editor/tabs/tabsPostProcessor'; // Correct path to NEW file
import { createTabPreviewExtension } from './editor/tabs/tabsPreviewExtension'
import { DEFAULT_SETTINGS, GinkoBlocksSettingTab } from './settings/settings'
import { CURRENT_WELCOME_VERSION, WELCOME_VIEW_TYPE, WelcomeView } from './welcome/welcomeView'
import { createCalloutPreviewExtension } from './editor/callout/calloutPreviewExtension'
import { cleanupExpiredStates } from './editor/utils/blockState'
// Remember to rename these classes and interfaces!

export default class GinkoBlocksPlugin extends Plugin {
  settings: GinkoBlocksSettings;
  private tabsPostProcessorInstance?: TabsPostProcessor; // Store instance

  async onload() {
    console.log("[GinkoBlocks] Plugin loading...");
    cleanupExpiredStates();
    await this.loadSettings();

    this.registerView(
      WELCOME_VIEW_TYPE,
      leaf => new WelcomeView(leaf),
    );

    this.registerEditorExtensions(); // Keep your existing method

    // Instantiate and register the NEW TabsPostProcessor
    // Pass `this.app` to the constructor
    this.tabsPostProcessorInstance = new TabsPostProcessor(this.app);
    this.registerMarkdownPostProcessor(
      (el, ctx) => this.tabsPostProcessorInstance!.process(el, ctx)
    );
    console.log("[GinkoBlocks] NEW TabsPostProcessor registered.");


    // Replace your OLD tabsProcessor registration if it was separate:
    // this.registerMarkdownPostProcessor(tabsProcessor); // REMOVE THIS LINE if it exists

    await this.activateWelcomeView();
    this.addSettingTab(new GinkoBlocksSettingTab(this.app, this));
    console.log("[GinkoBlocks] Plugin loaded successfully.");
  }

  /**
   * Registers editor extensions
   */
  private registerEditorExtensions() {
    // Your existing registrations
    this.registerEditorExtension(createTabPreviewExtension(this.app)); // Keep this for live preview
    this.registerEditorExtension(createCalloutPreviewExtension(this.app));
    // The OLD tabsProcessor is removed from here IF it was registered through this method
    this.registerEditorExtension(syntaxHighlightField);
    this.registerEditorExtension(createLayoutPreviewExtension(this.app));
    this.registerEditorExtension(createStepsPreviewExtension(this.app));
    this.registerEditorExtension(createGalleryPreviewExtension(this.app));
    this.registerEditorExtension(createAspectPreviewExtension(this.app));
    this.registerEditorExtension(createFileTreeExtension(this.app));
    console.log("[GinkoBlocks] Base editor extensions registered.");
  }

  onunload() {
    console.log("[GinkoBlocks] Plugin unloading...");
    this.app.workspace.detachLeavesOfType(WELCOME_VIEW_TYPE);
    // Potentially add cleanup for GlobalTabsManager if needed, e.g., clearing all its file managers
    // For now, Obsidian's unload should handle most DOM cleanup.
    this.app.workspace.updateOptions(); // Force editor refresh
    console.log("[GinkoBlocks] Plugin unloaded.");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateWelcomeView(forceShow = false) {
    const storageKey = `ginko-blocks-welcome-shown-v${CURRENT_WELCOME_VERSION}`;
    if (!forceShow && localStorage.getItem(storageKey)) {
      return;
    }
    const { workspace } = this.app;
    const existingLeaves = workspace.getLeavesOfType(WELCOME_VIEW_TYPE);
    if (existingLeaves.length > 0) {
      workspace.revealLeaf(existingLeaves[0]);
      return;
    }
    const leaf = workspace.getLeaf(true);
    if (leaf) {
      await leaf.setViewState({
        type: WELCOME_VIEW_TYPE,
        active: true,
      });
      workspace.revealLeaf(leaf);
    }
  }
}