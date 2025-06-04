// src/editor/tabs/tabsManager.ts
import { App, MarkdownRenderChild, MarkdownRenderer, TFile } from 'obsidian';
import { createIconElement } from '../utils'; // Your existing util
import { TabSpecificProperties, parseTabDefinitionTag, isTabsEndTag } from './tabsParser'; // From new tabsParser.ts
import { getUID } from '../utils_reference_inspired'; // Or your global getUID

export enum TabTag {
  TabsStart,    // Represents the ::tabs line itself (though not stored as TabElement)
  TabDefinition,// --tab line
  Content,      // Any line that is content for a tab
  TabsEnd,      // :: line
}

export class TabElement {
  id: string;
  originalElement: HTMLElement;
  linesOfElement: string[]; // The raw markdown lines this element originally represented
  tag: TabTag = TabTag.Content; // Initial tag from postprocessor, less critical for final render
  properties?: TabSpecificProperties; // For TabDefinition elements
  title?: string;             // For TabDefinition elements

  constructor(originalElement: HTMLElement, linesOfElement: string[], id: string) {
    this.originalElement = originalElement;
    this.linesOfElement = linesOfElement;
    this.id = id;
    // console.log(`[TabsSystem] TabElement ${this.id}: Created. Lines: [${linesOfElement.join('; ')}]. Original Tag: ${TabTag[this.tag]}`);
  }
}

export class TabsBlockManager {
  id: string;
  rootElement: HTMLElement;
  blockProperties: any;

  private elements: TabElement[] = []; // Sorted by original document order
  private activeTabIndex: number = 0;
  private app: App;

  constructor(id: string, rootElement: HTMLElement, blockProperties: any, app: App) {
    this.id = id;
    this.rootElement = rootElement;
    this.blockProperties = blockProperties;
    this.app = app;
    this.activeTabIndex = this.loadActiveTabState();
    console.log(`[TabsSystem] TabsBlockManager ${this.id}: Initialized. Root:`, rootElement, ` Active tab: ${this.activeTabIndex}`);
    this.rootElement.addClass('ginko-tabs-container-managed');
  }

  private loadActiveTabState(): number {
    const storageKey = `ginko-tabs-${this.id}-active-tab`;
    const storedState = localStorage.getItem(storageKey);
    const index = storedState ? parseInt(storedState, 10) : 0;
    return isNaN(index) ? 0 : index;
  }

  private saveActiveTabState(): void {
    const storageKey = `ginko-tabs-${this.id}-active-tab`;
    localStorage.setItem(storageKey, this.activeTabIndex.toString());
  }

  addElement(newElement: TabElement): void {
    // Try to find if an element representing the same original DOM node or same lines already exists.
    // Note: originalElement might be a new instance for the same logical block on re-render.
    // Comparing linesOfElement is more robust for logical identity.
    const newElementLinesKey = newElement.linesOfElement.join('\n');

    const existingElementIndex = this.elements.findIndex(
      (el) => el.linesOfElement.join('\n') === newElementLinesKey
    );

    if (existingElementIndex !== -1) {
      // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Found existing TabElement for lines, updating (ID ${this.elements[existingElementIndex].id} with new ${newElement.id}). Old originalElement:`, this.elements[existingElementIndex].originalElement, "New:", newElement.originalElement);
      // Replace the old element with the new one, keeping the new originalElement reference
      // but potentially preserving some state if needed (not done here for simplicity).
      // It's important to use the new `originalElement` as Obsidian might have changed it.
      this.elements[existingElementIndex] = newElement;
    } else {
      this.elements.push(newElement);
      // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Added new unique TabElement ${newElement.id}.`);
    }

    // Sort elements based on their original DOM position.
    this.elements.sort((a, b) => {
      if (!a.originalElement || !b.originalElement || !a.originalElement.compareDocumentPosition || !b.originalElement.compareDocumentPosition) {
        // console.warn(`[TabsSystem] TabsBlockManager ${this.id}: Cannot compare document position for sorting, elements might be detached or invalid.`);
        return 0;
      }
      const pos = a.originalElement.compareDocumentPosition(b.originalElement);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Elements count after add/update: ${this.elements.length}. First element lines:`, this.elements[0]?.linesOfElement.join(';').substring(0,50));
  }

  removeElement(elementId: string): void {
    const initialCount = this.elements.length;
    this.elements = this.elements.filter(el => el.id !== elementId);
    if (this.elements.length < initialCount) {
      // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Removed TabElement ${elementId}. Count: ${this.elements.length}`);
    }
  }

  getElementCount(): number {
    return this.elements.length;
  }

  // Helper structure for rendering
  private getStructuredTabs(): { title: string, properties: TabSpecificProperties, contentLines: string[] }[] {
    const structuredTabs: { title: string, properties: TabSpecificProperties, contentLines: string[] }[] = [];
    let currentTabCollectedContent: string[] = [];
    let currentTabProps: TabSpecificProperties | null = null;
    let currentTabTitle: string | null = null;
    let tabCounterForDefaultTitles = 0; // Ensures unique default titles if needed

    console.log(`[TabsSystem] TabsBlockManager ${this.id}: GETTING STRUCTURED TABS from ${this.elements.length} raw elements.`);

    for (const tabEl of this.elements) { // Iterate over each HTMLElement block Obsidian gave us
      // console.log(`[TabsSystem] TabsBlockManager ${this.id}:   Processing TabElement ${tabEl.id} (Original Tag: ${TabTag[tabEl.tag]}) with ${tabEl.linesOfElement.length} lines:`);
      // tabEl.linesOfElement.forEach((l,idx) => console.log(`[TabsSystem] TabsBlockManager ${this.id}:     Line ${idx}: "${l}"`));

      for (let lineIdx = 0; lineIdx < tabEl.linesOfElement.length; lineIdx++) { // Iterate over each line WITHIN that block
        const line = tabEl.linesOfElement[lineIdx];
        const trimmedLine = line.trim();
        const tabDefMatch = parseTabDefinitionTag(trimmedLine);

        if (tabDefMatch && tabDefMatch.isDefinition) {
          // This line is a tab definition. Finish the previous tab.
          if (currentTabTitle !== null) { // Check if a tab was being collected
            structuredTabs.push({
              title: currentTabTitle,
              properties: currentTabProps || { title: currentTabTitle }, // Fallback for props
              contentLines: currentTabCollectedContent,
            });
            // console.log(`[TabsSystem] TabsBlockManager ${this.id}:     Finished previous tab "${currentTabTitle}" (${currentTabCollectedContent.length} lines). Total structured: ${structuredTabs.length}`);
          }
          // Start new tab
          tabCounterForDefaultTitles++;
          currentTabTitle = tabDefMatch.title; // Already defaults in parser
          currentTabProps = tabDefMatch.properties;
          currentTabCollectedContent = []; // Reset content for the new tab
          console.log(`[TabsSystem] TabsBlockManager ${this.id}:     Line "${trimmedLine}" (from el ${tabEl.id}) DEFINED NEW TAB: "${currentTabTitle}". Props:`, currentTabProps);
        } else if (isTabsEndTag(trimmedLine)) {
          console.log(`[TabsSystem] TabsBlockManager ${this.id}:     Line "${trimmedLine}" (from el ${tabEl.id}) is TABS END.`);
          if (currentTabTitle !== null) { // Finish the current tab before ending
            structuredTabs.push({
              title: currentTabTitle,
              properties: currentTabProps || { title: currentTabTitle },
              contentLines: currentTabCollectedContent,
            });
            // console.log(`[TabsSystem] TabsBlockManager ${this.id}:     Finished final tab "${currentTabTitle}" due to end tag (${currentTabCollectedContent.length} lines). Total structured: ${structuredTabs.length}`);
          } else if (currentTabCollectedContent.length > 0 && structuredTabs.length > 0) {
            // This case implies content appeared after the last defined tab but before '::'
            // Let's append it to the very last tab if one exists.
            const lastTab = structuredTabs[structuredTabs.length - 1];
            lastTab.contentLines.push(...currentTabCollectedContent);
            console.warn(`[TabsSystem] TabsBlockManager ${this.id}:     End tag found. Appended ${currentTabCollectedContent.length} trailing lines to tab "${lastTab.title}".`);
          } else if (currentTabCollectedContent.length > 0) {
            console.warn(`[TabsSystem] TabsBlockManager ${this.id}:     End tag found with ${currentTabCollectedContent.length} unassociated content lines (no prior tabs defined). This content will be dropped.`);
          }
          currentTabTitle = null;
          currentTabCollectedContent = [];
          console.log(`[TabsSystem] TabsBlockManager ${this.id}: FINISHED ALL TABS for block ${this.id} due to '::'. Total structured: ${structuredTabs.length}`);
          return structuredTabs; // Explicit end of the entire tabs block
        } else {
          // This line is content
          if (currentTabTitle !== null) { // Only add content if a tab is currently active
            currentTabCollectedContent.push(line); // Add raw line for later Markdown rendering
            // console.log(`[TabsSystem] TabsBlockManager ${this.id}:     Line "${line.substring(0,30)}..." (from el ${tabEl.id}) added as CONTENT to tab "${currentTabTitle}".`);
          } else {
            // console.log(`[TabsSystem] TabsBlockManager ${this.id}:     Line "${trimmedLine.substring(0,30)}..." (from el ${tabEl.id}) is content, but NO CURRENT TAB defined. Ignoring line for tab structure.`);
          }
        }
      }
    }

    // After all elements and all their lines are processed, add the last collected tab if any
    if (currentTabTitle !== null) {
      structuredTabs.push({
        title: currentTabTitle,
        properties: currentTabProps || { title: currentTabTitle },
        contentLines: currentTabCollectedContent,
      });
      console.log(`[TabsSystem] TabsBlockManager ${this.id}: Finished collecting LAST tab (after all elements processed): "${currentTabTitle}" (${currentTabCollectedContent.length} lines). Total structured: ${structuredTabs.length}`);
    }

    console.log(`[TabsSystem] TabsBlockManager ${this.id}: FINISHED getStructuredTabs. Total structured tabs: ${structuredTabs.length}`);
    // if (structuredTabs.length > 0) {
    //     structuredTabs.forEach((t, i) => console.log(`[TabsSystem] TabsBlockManager ${this.id}:   Logical Tab ${i}: "${t.title}", Content Lines: ${t.contentLines.length > 0 ? t.contentLines[0].substring(0,30)+'...' : '[empty]'}`));
    // }
    return structuredTabs;
  }


  async render(): Promise<void> {
    const structuredTabs = this.getStructuredTabs();
    // The console log from getStructuredTabs now reports the final count.
    // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Render call. Logical tabs from structure: ${structuredTabs.length}. Active tab index: ${this.activeTabIndex}`);

    while (this.rootElement.firstChild) {
      this.rootElement.removeChild(this.rootElement.firstChild);
    }

    if (structuredTabs.length === 0) {
      const placeholderText = this.elements.length > 0 ? "[No valid tab definitions found within block]" : "[Tabs block is empty]";
      this.rootElement.createDiv({ text: placeholderText, cls: "tabs-placeholder" });
      // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Render: No logical tabs structured. Displaying placeholder.`);
      return;
    }

    const tabButtonsContainer = this.rootElement.createDiv({ cls: 'ginko-tab-buttons' });
    const tabContentsContainer = this.rootElement.createDiv({ cls: 'ginko-tab-contents' });

    if (this.activeTabIndex < 0 || this.activeTabIndex >= structuredTabs.length) {
      const oldIndex = this.activeTabIndex;
      this.activeTabIndex = structuredTabs.length > 0 ? 0 : -1;
      console.warn(`[TabsSystem] TabsBlockManager ${this.id}: Render: Active tab index ${oldIndex} out of bounds for ${structuredTabs.length} tabs. Reset to ${this.activeTabIndex}.`);
      if (this.activeTabIndex !== -1) this.saveActiveTabState();
    }

    structuredTabs.forEach(async (tabData, index) => {
      const button = tabButtonsContainer.createEl('button', {
        cls: `ginko-tab-button ${index === this.activeTabIndex ? 'active' : ''}`,
      });

      if (tabData.properties?.icon) {
        try {
          const iconEl = await createIconElement(tabData.properties.icon); // Ensure createIconElement is robust
          if (iconEl) button.appendChild(iconEl);
        } catch (iconError) {
          console.error(`[TabsSystem] TabsBlockManager ${this.id}: Error creating icon "${tabData.properties.icon}" for tab "${tabData.title}":`, iconError);
        }
      }
      button.createSpan({ cls: 'ginko-tab-text', text: tabData.title }); // Title from structuredTabs

      button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.activeTabIndex !== index) {
          this.activeTabIndex = index;
          this.saveActiveTabState();
          this.render();
          console.log(`[TabsSystem] TabsBlockManager ${this.id}: Tab ${index} ("${tabData.title}") clicked. New active index: ${this.activeTabIndex}`);
        }
      };
    });

    if (this.activeTabIndex >= 0 && this.activeTabIndex < structuredTabs.length) {
      const activeTabData = structuredTabs[this.activeTabIndex];
      const activeContentPanel = tabContentsContainer.createDiv({
        cls: 'ginko-tab-content active markdown-preview-view',
      });

      if (activeTabData.contentLines.length > 0) {
        const markdownToRender = activeTabData.contentLines.join('\n');
        // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Rendering markdown for active tab "${activeTabData.title}":\n"${markdownToRender.substring(0,100)}..."`);

        const renderChild = new MarkdownRenderChild(activeContentPanel);
        // Try to get the source path more reliably
        let filePath = "";
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          filePath = activeFile.path;
        } else {
          // Fallback if no active file, try from root element's parent chain if available
          const sourceView = this.rootElement.closest('.markdown-source-view');
          if (sourceView) {
            filePath = sourceView.getAttribute('data-path') || "";
          }
          console.warn(`[TabsSystem] TabsBlockManager ${this.id}: Could not determine active file path for MarkdownRenderer. Using: "${filePath}"`);
        }

        await MarkdownRenderer.render(
          this.app,
          markdownToRender,
          activeContentPanel,
          filePath,
          renderChild
        );
        activeContentPanel.querySelectorAll('.edit-block-button').forEach(btn => btn.remove());
        // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Rendered content for tab "${activeTabData.title}".`);
      } else {
        activeContentPanel.setText("[This tab is empty]");
        // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Active tab "${activeTabData.title}" has no content lines.`);
      }
    } else if (structuredTabs.length > 0) {
      tabContentsContainer.createDiv({ cls: 'ginko-tab-content active', text: "[Error: No active tab selected]" });
      console.error(`[TabsSystem] TabsBlockManager ${this.id}: Render: No active tab to display, though ${structuredTabs.length} tabs exist. Active index: ${this.activeTabIndex}`);
    }

    // console.log(`[TabsSystem] TabsBlockManager ${this.id}: Render cycle complete.`);
  }
}


// FileTabsManager and GlobalTabsManager (no changes from previous version, ensure they are here)
export class FileTabsManager {
  private tabsBlocks: Map<string, TabsBlockManager> = new Map();
  private sourcePath: string;
  private app: App;

  constructor(sourcePath: string, app: App) {
    this.sourcePath = sourcePath;
    this.app = app;
    // console.log(`[TabsSystem] FileTabsManager for ${this.sourcePath}: Initialized.`);
  }

  createTabsBlockManager(id: string, rootElement: HTMLElement, blockProperties: any): TabsBlockManager {
    // console.log(`[TabsSystem] FileTabsManager for ${this.sourcePath}: Creating TabsBlockManager for ID ${id}.`);
    if (this.tabsBlocks.has(id)) {
      console.warn(`[TabsSystem] FileTabsManager for ${this.sourcePath}: TabsBlockManager with ID ${id} already exists. Overwriting. This might indicate an issue if the rootElement differs or state is lost.`);
      this.removeTabsBlockManager(id, false);
    }
    const manager = new TabsBlockManager(id, rootElement, blockProperties, this.app);
    this.tabsBlocks.set(id, manager);
    return manager;
  }

  getTabsBlockManager(id: string): TabsBlockManager | undefined {
    const manager = this.tabsBlocks.get(id);
    return manager;
  }

  hasTabsBlockManager(id: string): boolean {
    return this.tabsBlocks.has(id);
  }

  removeTabsBlockManager(id: string, removeFromMap: boolean = true): void {
    console.log(`[TabsSystem] FileTabsManager for ${this.sourcePath}: Removing TabsBlockManager for ID ${id}.`);
    const manager = this.tabsBlocks.get(id);
    if (manager) {
      while (manager.rootElement.firstChild) {
        manager.rootElement.removeChild(manager.rootElement.firstChild);
      }
      manager.rootElement.textContent = `[Tabs block ${id} unloaded or removed]`;
    }
    if (removeFromMap) {
      this.tabsBlocks.delete(id);
    }
  }

  getAllManagers(): TabsBlockManager[] {
    return Array.from(this.tabsBlocks.values());
  }

  getManagerCount(): number {
    return this.tabsBlocks.size;
  }
}

export class GlobalTabsManager {
  private fileManagers: Map<string, FileTabsManager> = new Map();
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  getFileManager(sourcePath: string): FileTabsManager {
    if (!this.fileManagers.has(sourcePath)) {
      this.fileManagers.set(sourcePath, new FileTabsManager(sourcePath, this.app));
    }
    return this.fileManagers.get(sourcePath)!;
  }

  removeFileManager(sourcePath: string): void {
    console.log(`[TabsSystem] GlobalTabsManager: Removing FileTabsManager for ${sourcePath}.`);
    const fileManager = this.fileManagers.get(sourcePath);
    if (fileManager) {
      fileManager.getAllManagers().forEach(blockManager => {
        fileManager.removeTabsBlockManager(blockManager.id);
      });
    }
    this.fileManagers.delete(sourcePath);
  }
}