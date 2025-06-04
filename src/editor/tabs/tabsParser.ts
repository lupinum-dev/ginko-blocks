// src/editor/tabs/tabsParser.ts
import { getUID } from '../utils_reference_inspired';
import { parseBlockProperties as parseGenericBlockProperties } from '../utils';

export interface TabSpecificProperties {
  icon?: string;
  title?: string;
  [key: string]: any;
}

export interface TabsStartTagMatch {
  isStart: boolean;
  id: string;
  properties: any;
  rawLine: string;
  sectionLineNumber?: number;
}

export interface TabDefinitionMatch {
  isDefinition: boolean;
  title: string; // Now guaranteed to have a value
  properties: TabSpecificProperties;
  rawLine: string;
}

const TABS_START_REGEX = /^::tabs(?:\(([^)]*)\))?/;
const TAB_DEFINITION_REGEX = /^--tab(?: *\(([^)]*)\))?(?: +(.*))?/;
const TABS_END_REGEX = /^::$/;

export function parseTabsStartTag(
  line: string,
  sectionLineNum?: number
): TabsStartTagMatch | null {
  const trimmedLine = line.trim();
  const match = trimmedLine.match(TABS_START_REGEX);
  if (!match) return null;

  const rawPropsString = match[1] || "";
  const properties = parseGenericBlockProperties(`::tabs(${rawPropsString})`, /::tabs\((.*?)\)/);

  let finalId: string;
  const explicitId = properties.id as string;

  if (explicitId) {
    finalId = explicitId;
  } else {
    if (sectionLineNum !== undefined) {
      finalId = `tabs-autogen-L${sectionLineNum}`;
    } else {
      finalId = `tabs-autogen-${getUID(6)}`;
    }
    properties.id = finalId;
  }

  return {
    isStart: true,
    id: finalId,
    properties: properties,
    rawLine: trimmedLine,
    sectionLineNumber: sectionLineNum
  };
}

export function parseTabDefinitionTag(line: string): TabDefinitionMatch | null {
  const trimmedLine = line.trim();
  const match = trimmedLine.match(TAB_DEFINITION_REGEX);
  if (!match) return null;

  const rawPropsString = match[1] || "";
  const parsedProps = parseGenericBlockProperties(`--tab(${rawPropsString})`, /--tab\((.*?)\)/) as TabSpecificProperties;

  const titleFromText = match[2]?.trim();
  // Ensure a default title if none is explicitly provided in props or as trailing text.
  const finalTitle = parsedProps.title || titleFromText || `Tab`;
  // If title came from text, ensure it's also in properties for consistency
  const properties: TabSpecificProperties = { ...parsedProps, title: finalTitle };

  return {
    isDefinition: true,
    title: finalTitle, // This will now always have a value
    properties: properties,
    rawLine: trimmedLine,
  };
}

export function isTabsEndTag(line: string): boolean {
  return TABS_END_REGEX.test(line.trim());
}

export function findNearestTabsStartTagAbove(
  linesAbove: string[],
  fullDocLines: string[], // Not strictly needed for this version of ID logic, but kept for context
  currentElementOriginalLineStart: number
): TabsStartTagMatch | null {
  let openTabsBlocks: TabsStartTagMatch[] = [];

  for (let i = 0; i < linesAbove.length; i++) {
    const lineContent = linesAbove[i];
    const potentialStartTagOriginalLine = currentElementOriginalLineStart - (linesAbove.length - i);
    const startMatch = parseTabsStartTag(lineContent, potentialStartTagOriginalLine);

    if (startMatch && startMatch.isStart) {
      openTabsBlocks.push(startMatch);
    } else if (isTabsEndTag(lineContent)) {
      if (openTabsBlocks.length > 0) {
        openTabsBlocks.pop();
      }
    }
  }

  if (openTabsBlocks.length > 0) {
    return openTabsBlocks[openTabsBlocks.length - 1];
  }
  return null;
}