// src/editor/utils_reference_inspired.ts
import { App, MarkdownSectionInformation, WorkspaceLeaf } from 'obsidian';

export function fileStillInView(sourcePath: string, app: App): boolean {
  // console.log(`[TabsSystem] fileStillInView: Checking for ${sourcePath}`);
  if (!app || !app.workspace) {
    console.log('[TabsSystem] fileStillInView: App or workspace not available.');
    return true; // Conservative default if app state is weird
  }
  const markdownLeaves = app.workspace.getLeavesOfType("markdown");
  if (markdownLeaves.length === 0) {
    // console.log(`[TabsSystem] fileStillInView: No markdown leaves open.`);
    return false;
  }
  for (let i = 0; i < markdownLeaves.length; i++) {
    const leafState = markdownLeaves[i].getViewState();
    if (leafState.state?.file === sourcePath) {
      // console.log(`[TabsSystem] fileStillInView: File ${sourcePath} IS in view.`);
      return true;
    }
  }
  // console.log(`[TabsSystem] fileStillInView: File ${sourcePath} NOT in view.`);
  return false;
}

export interface ElementRelativeLocationData {
  linesAboveArray: string[];
  linesOfElement: string[];
  linesBelowArray: string[];
  textOfElement: string;
}

export function extractElementRelativeLocationDataLocal(docLines: string[], info: MarkdownSectionInformation): ElementRelativeLocationData {
  const linesAboveArray = docLines.slice(0, info.lineStart);
  const linesOfElement = docLines.slice(info.lineStart, info.lineEnd + 1);
  const textOfElement = linesOfElement.join("\n"); // Join with newline as it was split by newline
  const linesBelowArray = docLines.slice(info.lineEnd + 1);

  return {
    linesAboveArray,
    linesOfElement,
    linesBelowArray,
    textOfElement
  };
}

// Placeholder for getUID if you don't have one globally
export function getUID(length: number = 6): string {
  return Math.random().toString(36).substring(2, 2 + length);
}