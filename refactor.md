## Overview

Ginko Blocks is an Obsidian plugin that transforms custom syntax into rich UI components in both Live Preview and Reading mode. This guide will help you understand and contribute to the codebase through a phased approach.

## Current Architecture Issues

Before we begin, let's identify what we're improving:
- Complex inheritance hierarchy that's hard to follow
- Tight coupling between components and Obsidian APIs
- Limited test coverage
- Inconsistent patterns across different components
- Difficult to add new block types

## Phase 1: Core Foundation & First Component

### Goal
Create a simple, testable foundation with one working component (Callout) as a reference implementation.

### 1.1 New Architecture Overview

```
src/
├── core/                    # Core functionality
│   ├── BlockRegistry.ts     # Central registry for all blocks
│   ├── BlockParser.ts       # Parses block syntax
│   ├── BlockRenderer.ts     # Renders blocks to DOM
│   └── types.ts            # Shared types
├── blocks/                  # Individual block implementations
│   └── callout/
│       ├── CalloutBlock.ts  # Block definition
│       ├── CalloutParser.ts # Parsing logic
│       ├── CalloutRenderer.ts # Rendering logic
│       └── callout.css      # Styles
├── obsidian/               # Obsidian-specific adapters
│   ├── LivePreviewAdapter.ts
│   └── ReadingViewAdapter.ts
└── tests/                  # Comprehensive tests
```

### 1.2 Core Types

Create `src/core/types.ts`:

```typescript
// Block definition interface
export interface BlockDefinition {
  // Unique identifier for the block type
  id: string;
  
  // Display name for settings
  name: string;
  
  // Start and end markers
  startMarker: string;
  endMarker: string;
  
  // Parser for this block type
  parser: BlockParser;
  
  // Renderer for this block type
  renderer: BlockRenderer;
}

// Parsed block data
export interface ParsedBlock {
  id: string;
  type: string;
  content: string;
  properties: Record<string, any>;
  startPos: number;
  endPos: number;
}

// Parser interface
export interface BlockParser {
  // Parse raw text into structured data
  parse(text: string, startPos: number): ParsedBlock | null;
  
  // Validate if text matches this block type
  matches(text: string): boolean;
}

// Renderer interface
export interface BlockRenderer {
  // Render block to DOM element
  render(block: ParsedBlock, container: HTMLElement): void;
  
  // Clean up when block is removed
  cleanup?(container: HTMLElement): void;
}

// Block state management
export interface BlockState {
  blockId: string;
  state: any;
  timestamp: number;
}
```

### 1.3 Block Registry

Create `src/core/BlockRegistry.ts`:

```typescript
import type { BlockDefinition } from './types';

export class BlockRegistry {
  private blocks = new Map<string, BlockDefinition>();
  
  /**
   * Register a new block type
   */
  register(block: BlockDefinition): void {
    if (this.blocks.has(block.id)) {
      console.warn(`Block type "${block.id}" is already registered`);
      return;
    }
    
    this.blocks.set(block.id, block);
    console.log(`Registered block type: ${block.id}`);
  }
  
  /**
   * Get a block definition by ID
   */
  get(id: string): BlockDefinition | undefined {
    return this.blocks.get(id);
  }
  
  /**
   * Get all registered blocks
   */
  getAll(): BlockDefinition[] {
    return Array.from(this.blocks.values());
  }
  
  /**
   * Check if a block type is registered
   */
  has(id: string): boolean {
    return this.blocks.has(id);
  }
  
  /**
   * Unregister a block type
   */
  unregister(id: string): void {
    this.blocks.delete(id);
  }
}

// Global registry instance
export const blockRegistry = new BlockRegistry();
```

### 1.4 Block Parser Base

Create `src/core/BlockParser.ts`:

```typescript
import type { ParsedBlock, BlockParser as IBlockParser } from './types';

export abstract class BaseBlockParser implements IBlockParser {
  constructor(
    protected startMarker: string,
    protected endMarker: string
  ) {}
  
  /**
   * Check if text matches this block's start marker
   */
  matches(text: string): boolean {
    return text.trim().startsWith(this.startMarker);
  }
  
  /**
   * Parse block content into structured data
   */
  abstract parse(text: string, startPos: number): ParsedBlock | null;
  
  /**
   * Extract properties from a marker line
   * Example: ::callout(type="warning" icon="alert")
   */
  protected parseProperties(line: string): Record<string, any> {
    const props: Record<string, any> = {};
    
    // Extract content within parentheses
    const match = line.match(/\(([^)]+)\)/);
    if (!match) return props;
    
    const propsStr = match[1];
    
    // Parse key="value" pairs
    const propRegex = /(\w+)=["']([^"']+)["']/g;
    let propMatch;
    
    while ((propMatch = propRegex.exec(propsStr)) !== null) {
      props[propMatch[1]] = propMatch[2];
    }
    
    // Parse boolean flags (e.g., "collapsed")
    const flagRegex = /\b(\w+)\b(?!=)/g;
    let flagMatch;
    
    while ((flagMatch = flagRegex.exec(propsStr)) !== null) {
      // Skip if this word is part of a key=value pair
      if (!propsStr.includes(`${flagMatch[1]}=`)) {
        props[flagMatch[1]] = true;
      }
    }
    
    return props;
  }
  
  /**
   * Find the end position of a block
   */
  protected findEndPosition(text: string, startOffset: number): number {
    const endPos = text.indexOf(this.endMarker, startOffset);
    return endPos === -1 ? -1 : endPos + this.endMarker.length;
  }
}
```

### 1.5 Implement Callout Block

Create `src/blocks/callout/CalloutParser.ts`:

```typescript
import { BaseBlockParser } from '../../core/BlockParser';
import type { ParsedBlock } from '../../core/types';

export class CalloutParser extends BaseBlockParser {
  constructor() {
    super('::callout', '::');
  }
  
  parse(text: string, startPos: number): ParsedBlock | null {
    // Find the start of the block
    const startIndex = text.indexOf(this.startMarker);
    if (startIndex === -1) return null;
    
    // Find the end of the block
    const contentStart = startIndex + this.startMarker.length;
    const endPos = this.findEndPosition(text, contentStart);
    if (endPos === -1) return null;
    
    // Extract the first line to get properties
    const firstLineEnd = text.indexOf('\n', startIndex);
    const firstLine = text.substring(startIndex, firstLineEnd > -1 ? firstLineEnd : text.length);
    
    // Parse properties
    const properties = this.parseProperties(firstLine);
    
    // Extract content (excluding markers)
    const content = text.substring(contentStart, endPos - this.endMarker.length).trim();
    
    // Parse title if specified
    const titleMatch = content.match(/^--title\s+(.+)$/m);
    if (titleMatch) {
      properties.title = titleMatch[1].trim();
    }
    
    // Remove title line from content if found
    const cleanContent = content.replace(/^--title\s+.+\n?/m, '').trim();
    
    return {
      id: `callout-${startPos}`,
      type: 'callout',
      content: cleanContent,
      properties,
      startPos: startPos + startIndex,
      endPos: startPos + endPos
    };
  }
}
```

Create `src/blocks/callout/CalloutRenderer.ts`:

```typescript
import type { BlockRenderer, ParsedBlock } from '../../core/types';

export class CalloutRenderer implements BlockRenderer {
  private getIcon(type: string): string {
    const icons: Record<string, string> = {
      info: `<svg>...</svg>`, // Add actual SVG icons
      warning: `<svg>...</svg>`,
      danger: `<svg>...</svg>`,
      tip: `<svg>...</svg>`,
      note: `<svg>...</svg>`
    };
    
    return icons[type] || icons.note;
  }
  
  render(block: ParsedBlock, container: HTMLElement): void {
    // Clear container
    container.empty();
    container.addClass('ginko-callout-container');
    
    // Create callout structure
    const callout = container.createDiv({
      cls: `ginko-callout type-${block.properties.type || 'note'}`
    });
    
    // Header
    const header = callout.createDiv({ cls: 'ginko-callout-header' });
    
    // Icon
    const iconContainer = header.createDiv({ cls: 'ginko-callout-icon' });
    iconContainer.innerHTML = this.getIcon(block.properties.type || 'note');
    
    // Title
    const title = header.createDiv({ cls: 'ginko-callout-title' });
    title.textContent = block.properties.title || this.capitalize(block.properties.type || 'note');
    
    // Content
    const content = callout.createDiv({ cls: 'ginko-callout-content' });
    content.textContent = block.content; // In real implementation, render as markdown
    
    // Handle collapsible state
    if (block.properties.collapsed) {
      callout.addClass('is-collapsed');
      
      const collapseBtn = header.createDiv({ cls: 'ginko-callout-collapse' });
      collapseBtn.innerHTML = `<svg>...</svg>`; // Add chevron icon
      
      collapseBtn.addEventListener('click', () => {
        callout.toggleClass('is-collapsed');
      });
    }
  }
  
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
```

Create `src/blocks/callout/CalloutBlock.ts`:

```typescript
import type { BlockDefinition } from '../../core/types';
import { CalloutParser } from './CalloutParser';
import { CalloutRenderer } from './CalloutRenderer';

export const CalloutBlock: BlockDefinition = {
  id: 'callout',
  name: 'Callout',
  startMarker: '::callout',
  endMarker: '::',
  parser: new CalloutParser(),
  renderer: new CalloutRenderer()
};
```

### 1.6 Obsidian Adapter

Create `src/obsidian/LivePreviewAdapter.ts`:

```typescript
import { EditorView, ViewUpdate } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import { blockRegistry } from '../core/BlockRegistry';
import type { ParsedBlock } from '../core/types';

export class LivePreviewAdapter {
  createExtension() {
    return StateField.define<ParsedBlock[]>({
      create: () => [],
      
      update: (blocks, tr) => {
        if (!tr.docChanged) return blocks;
        
        const newBlocks: ParsedBlock[] = [];
        const text = tr.state.doc.toString();
        
        // Try each registered block type
        for (const blockDef of blockRegistry.getAll()) {
          let pos = 0;
          
          while (pos < text.length) {
            const nextPos = text.indexOf(blockDef.startMarker, pos);
            if (nextPos === -1) break;
            
            const block = blockDef.parser.parse(text.slice(nextPos), nextPos);
            if (block) {
              newBlocks.push(block);
              pos = block.endPos;
            } else {
              pos = nextPos + 1;
            }
          }
        }
        
        return newBlocks;
      },
      
      provide: field => EditorView.decorations.from(field, blocks => {
        // Create decorations for each block
        // This is simplified - real implementation would create widgets
        return Decoration.none;
      })
    });
  }
}
```

### 1.7 Testing

Create `src/blocks/callout/CalloutParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CalloutParser } from './CalloutParser';

describe('CalloutParser', () => {
  const parser = new CalloutParser();
  
  describe('matches', () => {
    it('should match valid callout syntax', () => {
      expect(parser.matches('::callout')).toBe(true);
      expect(parser.matches('::callout(type="info")')).toBe(true);
      expect(parser.matches('  ::callout  ')).toBe(true);
    });
    
    it('should not match invalid syntax', () => {
      expect(parser.matches('::other')).toBe(false);
      expect(parser.matches('callout')).toBe(false);
      expect(parser.matches('')).toBe(false);
    });
  });
  
  describe('parse', () => {
    it('should parse basic callout', () => {
      const text = `::callout
This is content
::`;
      const result = parser.parse(text, 0);
      
      expect(result).toBeDefined();
      expect(result?.type).toBe('callout');
      expect(result?.content).toBe('This is content');
    });
    
    it('should parse callout with properties', () => {
      const text = `::callout(type="warning" collapsed)
Warning content
::`;
      const result = parser.parse(text, 0);
      
      expect(result?.properties.type).toBe('warning');
      expect(result?.properties.collapsed).toBe(true);
    });
    
    it('should parse callout with title', () => {
      const text = `::callout
--title Important Note
Content here
::`;
      const result = parser.parse(text, 0);
      
      expect(result?.properties.title).toBe('Important Note');
      expect(result?.content).toBe('Content here');
    });
  });
});
```

### 1.8 Integration

Update `src/main.ts`:

```typescript
import { Plugin } from 'obsidian';
import { blockRegistry } from './core/BlockRegistry';
import { CalloutBlock } from './blocks/callout/CalloutBlock';
import { LivePreviewAdapter } from './obsidian/LivePreviewAdapter';

export default class GinkoBlocksPlugin extends Plugin {
  async onload() {
    // Register blocks
    blockRegistry.register(CalloutBlock);
    
    // Set up Live Preview
    const livePreview = new LivePreviewAdapter();
    this.registerEditorExtension(livePreview.createExtension());
    
    // Add settings, welcome view, etc.
  }
  
  onunload() {
    // Cleanup
  }
}
```

## Phase 1 Checklist

- [ ] Set up new directory structure
- [ ] Create core types and interfaces
- [ ] Implement BlockRegistry
- [ ] Create base parser and renderer classes
- [ ] Implement Callout block as reference
- [ ] Create Obsidian adapters
- [ ] Write comprehensive tests
- [ ] Update main plugin file
- [ ] Ensure existing functionality still works

## Next Steps (Phase 2 Preview)

Phase 2 will focus on:
- Migrating remaining components to new architecture
- Creating a plugin system for blocks
- Implementing proper state management
- Adding development tools and documentation

This architecture provides:
1. **Clear separation of concerns** - Parsing, rendering, and Obsidian integration are separate
2. **Easy testing** - Each component can be tested in isolation
3. **Simple block addition** - Just create parser, renderer, and register
4. **Type safety** - Strong typing throughout
5. **Maintainability** - Clear structure and patterns to follow