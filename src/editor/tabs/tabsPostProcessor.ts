// src/editor/tabs/tabsPostProcessor.ts
import { App, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownSectionInformation, TFile } from 'obsidian';
import { GlobalTabsManager, TabElement, TabTag } from './tabsManager';
// Ensure these imports point to your revised tabsParser.ts
import { parseTabsStartTag, parseTabDefinitionTag, isTabsEndTag, findNearestTabsStartTagAbove } from './tabsParser';
import { extractElementRelativeLocationDataLocal, fileStillInView, getUID } from '../utils_reference_inspired';

export class TabsPostProcessor {
  private globalTabsManager: GlobalTabsManager;
  private app: App;

  constructor(app: App) {
    this.app = app;
    this.globalTabsManager = new GlobalTabsManager(this.app);
    console.log("[TabsSystem] TabsPostProcessor: Initialized.");
  }

  async process(el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
    const sourcePath = ctx.sourcePath;
    // console.log(`[TabsSystem] TabsPostProcessor: Processing element in ${sourcePath}. First 50 chars:`, el.textContent?.trim().substring(0, 50));

    const fileTabsManager = this.globalTabsManager.getFileManager(sourcePath);

    const sectionInfo = ctx.getSectionInfo(el);
    if (!sectionInfo) {
      if (el.closest('.ginko-tabs-container-managed')) {
        // console.log("[TabsSystem] TabsPostProcessor: Skipping element already part of a managed ginko-tabs-container.", el.className);
        return;
      }
      console.warn("[TabsSystem] TabsPostProcessor: No sectionInfo for element. Skipping.", el.className, el.textContent?.substring(0, 50));
      return;
    }

    let docString = sectionInfo.text;
    if (typeof docString !== 'string') {
      console.warn(`[TabsSystem] TabsPostProcessor: sectionInfo.text not available for ${sourcePath} line ${sectionInfo.lineStart}. Reading file content.`);
      const file = this.app.vault.getAbstractFileByPath(sourcePath);
      if (file instanceof TFile) {
        docString = await this.app.vault.cachedRead(file);
      } else {
        console.error(`[TabsSystem] TabsPostProcessor: Could not get TFile for ${sourcePath}. Cannot process.`);
        return;
      }
    }

    const docLines = docString.split('\n');
    const { linesAboveArray, linesOfElement, textOfElement } = extractElementRelativeLocationDataLocal(docLines, sectionInfo);

    const tabsStartMatch = parseTabsStartTag(textOfElement, sectionInfo.lineStart);
    if (tabsStartMatch && tabsStartMatch.isStart) {
      const tabsId = tabsStartMatch.id;
      console.log(`[TabsSystem] TabsPostProcessor: Detected ::tabs START tag. Resolved ID: ${tabsId}. Raw line: "${tabsStartMatch.rawLine}" (Original section line: ${sectionInfo.lineStart})`);

      el.setAttribute("data-tabs-id", tabsId);
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }

      if (fileTabsManager.hasTabsBlockManager(tabsId)) {
        const existingManager = fileTabsManager.getTabsBlockManager(tabsId);
        if (existingManager && existingManager.rootElement === el) {
          console.log(`[TabsSystem] TabsPostProcessor: Re-processing known root element for Tabs ID "${tabsId}". Updating properties and re-rendering.`);
          existingManager.blockProperties = tabsStartMatch.properties;
          existingManager.render();

          const mdChildExists = Array.from(el.children).some(child =>
            (child instanceof MarkdownRenderChild) && (child as any).tabsId === tabsId
          );
          if (!mdChildExists && ctx) {
            const mdChild = new MarkdownRenderChild(el);
            (mdChild as any).tabsId = tabsId;
            mdChild.onunload = () => this.handleUnload(tabsId, sourcePath, fileTabsManager);
            ctx.addChild(mdChild);
          }
          return;
        } else {
          console.warn(`[TabsSystem] TabsPostProcessor: Duplicate Tabs ID "${tabsId}" conflict in ${sourcePath}. New element wants to claim an existing ID. Markdown might have duplicate (id=${tabsId}) or very similar ::tabs lines near same original line number (L${sectionInfo.lineStart}).`);
          el.createDiv({ cls: "tabs-error", text: `Error: Tabs ID "${tabsId}" conflict. Ensure (id=...) is unique if used, or check ::tabs blocks near line ${sectionInfo.lineStart + 1}.` });
          return;
        }
      }

      console.log(`[TabsSystem] TabsPostProcessor: Creating new TabsBlockManager for ID ${tabsId}.`);
      fileTabsManager.createTabsBlockManager(tabsId, el, tabsStartMatch.properties);

      if (ctx) {
        const mdChild = new MarkdownRenderChild(el);
        (mdChild as any).tabsId = tabsId;
        mdChild.onunload = () => this.handleUnload(tabsId, sourcePath, fileTabsManager);
        ctx.addChild(mdChild);
      }
      return;
    }

    const nearestTabsStart = findNearestTabsStartTagAbove(linesAboveArray, docLines, sectionInfo.lineStart);
    if (nearestTabsStart) {
      const tabsId = nearestTabsStart.id;
      // console.log(`[TabsSystem] TabsPostProcessor: Element is INSIDE tabs block. Nearest start ID: ${tabsId}. Current element text:`, textOfElement.substring(0,50));

      const tabsBlockManager = fileTabsManager.getTabsBlockManager(tabsId);

      if (!tabsBlockManager) {
        console.warn(`[TabsSystem] TabsPostProcessor: No manager for Tabs ID "${tabsId}" (expected from line "${nearestTabsStart.rawLine}", orig line ~${nearestTabsStart.sectionLineNumber}). Current el (text: "${textOfElement.substring(0, 30)}"). Managers:`, Array.from(fileTabsManager.getAllManagers().map(m => m.id)));
        return;
      }

      el.style.display = 'none';
      el.classList.add('ginko-tab-managed-element-hidden');

      const tabElementId = `${tabsId}-el-${getUID(8)}`; // Element ID includes its manager's ID
      const tabElement = new TabElement(el, linesOfElement, tabElementId);

      // Determine tag based on the *first line* of this element's content,
      // as Obsidian might merge. The render() method will do finer parsing.
      const firstLineTrimmed = linesOfElement[0]?.trim() || "";
      const tabDefinitionMatch = parseTabDefinitionTag(firstLineTrimmed);

      if (tabDefinitionMatch && tabDefinitionMatch.isDefinition) {
        tabElement.tag = TabTag.TabDefinition;
        tabElement.properties = tabDefinitionMatch.properties;
        tabElement.title = tabDefinitionMatch.title;
      } else if (isTabsEndTag(firstLineTrimmed)) {
        tabElement.tag = TabTag.TabsEnd;
      } else {
        tabElement.tag = TabTag.Content;
      }
      // console.log(`[TabsSystem] TabsPostProcessor: TabElement ${tabElement.id} created with initial tag ${TabTag[tabElement.tag]} for manager ${tabsId}`);

      tabsBlockManager.addElement(tabElement);

      if (ctx) {
        const mdChild = new MarkdownRenderChild(el);
        (mdChild as any).tabElementId = tabElementId;
        mdChild.onunload = () => {
          // console.log(`[TabsSystem] TabsPostProcessor: Unloading TabElement ${tabElement.id} (initial tag: ${TabTag[tabElement.tag]}) from manager ${tabsId}.`);
          tabsBlockManager.removeElement(tabElement.id);
          tabsBlockManager.render();
        };
        ctx.addChild(mdChild);
      }

      // console.log(`[TabsSystem] TabsPostProcessor: Triggering render for TabsBlockManager ${tabsId} after adding/updating TabElement ${tabElement.id}.`);
      tabsBlockManager.render();
      return;
    }
  }

  private handleUnload(tabsId: string, sourcePath: string, fileTabsManager: ReturnType<GlobalTabsManager['getFileManager']>) {
    console.log(`[TabsSystem] TabsPostProcessor: Unloading markdown child for ::tabs block ID ${tabsId} in ${sourcePath}.`);
    if (!fileStillInView(sourcePath, this.app)) {
      console.log(`[TabsSystem] TabsPostProcessor: File ${sourcePath} is no longer in view. Removing entire FileTabsManager.`);
      this.globalTabsManager.removeFileManager(sourcePath);
    } else {
      const manager = fileTabsManager.getTabsBlockManager(tabsId);
      if (manager && (!manager.rootElement || !document.body.contains(manager.rootElement))) {
        console.log(`[TabsSystem] TabsPostProcessor: Root element for TabsBlockManager ${tabsId} is detached. Removing manager.`);
        fileTabsManager.removeTabsBlockManager(tabsId);
        if (fileTabsManager.getManagerCount() === 0) {
          console.log(`[TabsSystem] TabsPostProcessor: FileTabsManager for ${sourcePath} is now empty.`);
        }
      } else if (manager) {
        // console.log(`[TabsSystem] TabsPostProcessor: Root element for TabsBlockManager ${tabsId} still in DOM. Manager not removed.`);
      } else {
        // console.log(`[TabsSystem] TabsPostProcessor: Unload called for TabsBlockManager ${tabsId}, but manager no longer exists.`);
      }
    }
  }
}