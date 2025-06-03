**Ginko Blocks Plugin Refactor: A Guide**

**1. Introduction & Goals**

*   **1.1. Project Goal:**
    *   The primary goal of this project is to refactor the Ginko Blocks Obsidian plugin to improve its maintainability, testability, code quality, and, most importantly, to add full support for both Live Preview mode (editing) and Reading View mode (rendered output) in Obsidian. This means the plugin will be able to display its rich components correctly whether a user is actively editing a note or just viewing it.
*   **1.2. Overall Objectives:**
    *   Create a more robust and organized codebase.
    *   Establish clear separation of concerns (each piece of code does one thing well).
    *   Reduce code duplication.
    *   Increase test coverage (making it easier to catch bugs and improve reliability).
    *   Improve visual consistency between Live Preview and Reading View.
    *   Make it easier for other developers to contribute to the plugin.

**2. Overall Philosophy & Code Quality**

*   **2.1. Guiding Principles (The "Rules of the Road"):**
    *   **Single Responsibility Principle (SRP):** Each class, module, and function should have one, and only one, clearly defined purpose. For example, a function should either parse data or render HTML, but not both.
    *   **Don't Repeat Yourself (DRY):** Avoid duplicating code. If you find yourself writing the same or very similar code in multiple places, abstract it into a reusable function or class.
    *   **Clarity over Cleverness:** Write code that is easy to read and understand, even if it means sacrificing a bit of perceived "efficiency". Favor clear variable names, meaningful comments, and simple logic.
    *   **Testability:** Design your code in a way that makes it easy to write unit tests (small tests that check individual components). This involves breaking complex logic into smaller functions and avoiding tight coupling between components.
    *   **Modularity:** Build the plugin using independent modules (classes, functions, etc.) that can be combined to create the desired functionality. This makes it easier to maintain and expand the plugin.
    *   **Comments:** Add meaningful comments to your code to explain what it does, why it does it, and any assumptions made. Use JSDoc/TSDoc for public methods, classes, and interfaces.
*   **2.2. Code Quality Examples:**

    *   **Bad:** A function that both parses a string and creates an HTML element.
        ```typescript
        function createAndParseTab(rawTabContent: string): HTMLElement {
          const title = rawTabContent.match(/--tab\s+(.*)/)?.[1] || '';
          const tabDiv = document.createElement('div');
          tabDiv.className = 'ginko-tab';
          tabDiv.innerHTML = `<h3>${title}</h3><p>Tab Content...</p>`;
          return tabDiv;
        }
        ```
    *   **Good (SRP):** Separate parsing and HTML creation.
        ```typescript
        // Parsing function
        interface TabData {
          title: string;
          content: string;
        }

        function parseTab(rawTabContent: string): TabData | null {
          const titleMatch = rawTabContent.match(/--tab\s+(.*)/);
          if (!titleMatch) return null;
          const title = titleMatch[1]?.trim() || '';
          const content = rawTabContent.replace(/--tab\s+.*?\n?/, '').trim(); // Simple content extraction
          return { title, content };
        }

        // Rendering function
        function renderTab(tabData: TabData): HTMLElement {
          const tabDiv = document.createElement('div');
          tabDiv.className = 'ginko-tab';
          tabDiv.innerHTML = `<h3>${tabData.title}</h3><p>${tabData.content}</p>`;
          return tabDiv;
        }
        ```
        **Explanation:** The `parseTab` function is solely responsible for extracting data. The `renderTab` function is solely responsible for creating the HTML based on the parsed data.
    *   **Bad (Duplication):**  Repeating the same logic to get the cursor position.
        ```typescript
        // In AspectWidget:
        const widgetPos = view.posAtDOM(container);
        const content = this.content;
        const aspectLineEnd = content.indexOf('\n');
        const cursorPos = widgetPos + aspectLineEnd + 1;

        // In LayoutWidget:
        const widgetPos = view.posAtDOM(container);
        const content = this.content;
        const searchPos = content.indexOf('--col');
        const lineEnd = content.indexOf('\n', searchPos);
        const nextLineStart = lineEnd + 1;
        const columnPos = widgetPos + nextLineStart;
        ```
    *   **Good (DRY):** Create a helper function to extract cursor positions:
        ```typescript
        import { EditorView } from '@codemirror/view';

        function getCursorPositionForLine(
          view: EditorView,
          container: HTMLElement,
          content: string,
          searchString: string, //"--col", "--step" etc.
        ): number {
          const widgetPos = view.posAtDOM(container);
          const searchPos = content.indexOf(searchString);
          if (searchPos === -1) return widgetPos; // Or handle appropriately
          const lineEnd = content.indexOf('\n', searchPos);
          const nextLineStart = lineEnd !== -1 ? lineEnd + 1 : content.length;
          return widgetPos + nextLineStart;
        }

        // In AspectWidget (simplified):
        const cursorPos = getCursorPositionForLine(view, container, this.content, "\n");

        // In LayoutWidget:
        const columnPos = getCursorPositionForLine(view, container, this.content, "--col");
        ```
    *   **Bad (Inconsistent Class Names):** Using different class names for similar elements.
        ```css
        /* In one component */
        .aspect-container { ... }
        /* In another component */
        .image-box { ... }
        ```
    *   **Good (Consistent Class Names - BEM):** Using a consistent naming convention like BEM (Block Element Modifier).
        ```css
        .ginko-aspect { ... } /* Block */
        .ginko-aspect__image { ... } /* Element (within the block) */
        .ginko-aspect--video { ... } /* Modifier (variant of the block) */
        ```

**3. Obsidian API & CodeMirror 6 Deep Dive - Key Concepts for the Refactor**

*   **3.1. Editor Extensions (CodeMirror 6):**
    *   The heart of Ginko Blocks' Live Preview features. These customize how Obsidian renders and interacts with the document in the editing view.
    *   We use them in `main.ts` with `this.registerEditorExtension()`.
    *   **Types:**  We primarily use:
        *   **State Fields:** To manage state associated with our blocks (e.g., whether a tab is active).
        *   **View Plugins:** To observe the *viewport* (the visible part of the editor) and render decorations (widgets).
        *   **Decorations:** They "decorate" the text, adding custom HTML (our widgets) or styling existing text.
*   **3.2. Markdown Post Processors:**
    *   The mechanism for customizing how the document renders in Reading View.
    *   Registered with `this.registerMarkdownPostProcessor()`.
    *   They get the already-parsed HTML element and can modify it. This is crucial for showing the correct Ginko Block structure when not editing.
*   **3.3. Key Obsidian/CodeMirror 6 Classes and Methods:**
    *   **`EditorView`:** The main class representing the editor in CodeMirror 6.  You'll use it to get the cursor position, dispatch transactions, etc.  You get access to it within the `editorCallback` of a command or through the `getActiveViewOfType` method.  You get the `EditorView` in the `ViewUpdate` parameter of the update method of view plugins.
    *   **`StateField`:** A way to manage the state of the editor. Think of it as a data store for your plugin's needs (like whether a tab is active). You define a state field using `StateField.define<YourStateType>()`.
    *   **`ViewPlugin`:** Observes the editor's viewport, allowing you to render UI elements or apply styles based on what's visible.
        *   You create it with `ViewPlugin.fromClass(YourPluginClass, PluginSpec)`.
        *   `update(update: ViewUpdate)`: The core method. Called whenever something changes. The `update` object provides information about the changes (e.g., the selection, document changes, viewport changes).
        *   `decorations: (value: YourPluginClass) => DecorationSet`: The key to rendering in a ViewPlugin. It *provides* the `DecorationSet`.
    *   **`Decoration` & `DecorationSet`:**
        *   `Decoration`: Represents a single change to how text is displayed (e.g., replacing a text range with a widget, adding a CSS class).
        *   `DecorationSet`: A set of decorations applied to the editor. Your state fields and view plugins provide a `DecorationSet`.
        *   Common `Decoration` methods:
            *   `Decoration.replace({ widget: myWidget })`: Replaces a text range with a widget. This is core to the Ginko Blocks' live preview.
            *   `Decoration.mark({class: 'my-class'})`: Adds a CSS class to a text range.
    *   **`WidgetType`:** The base class for creating custom widgets that you display in the editor (inside `Decoration.replace`).  You implement the `toDOM(view: EditorView): HTMLElement` method to generate the widget's HTML.
    *   **`Transaction`:**  Represents a group of changes applied to the document. In your code, you create these (with actions like inserting, deleting, or changing selection). Then you *dispatch* them to the `EditorView` using `view.dispatch({ changes: [...] })`.
    *   **`MarkdownRenderer` (for Reading View):** The Obsidian API provides `MarkdownRenderer.render(app, markdown, el, sourcePath, component)` to render Markdown. This is essential for the `renderReadingView` functions. You'll need to render *within* a post-processor's `el` (the main container element).
    *   **`MarkdownRenderChild` (for Reading View):** This is required when rendering content in a post-processor. It handles the Obsidian's lifecycle for loading resources (e.g., images).
    *   **`Plugin`:** The base class for your Obsidian plugin.
        *   `onload()`: Called when the plugin is loaded. This is where you register editor extensions, commands, and post processors.
        *   `onunload()`: Called when the plugin is unloaded. You should unregister any extensions and other resources to avoid memory leaks.

**4. Phase 1: Unified Block Definition & Parsing (Detailed Instructions)**

*   **4.1. Goal:**
    *   Create a centralized parsing service that can identify and parse all Ginko Blocks. This service will be used by both Live Preview and Reading View rendering.
*   **4.2. Actions:**
    1.  **Create `src/editor/utils/parsing.ts`:** This will hold the core parsing logic.
    2.  **Define `ParsedBlock` interface:**
        ```typescript
        // src/editor/utils/parsing.ts
        export interface ParsedBlock {
          type: string; // e.g., "tabs", "aspect", "callout"
          startIndex: number; // In the original document text
          endIndex: number;   // In the original document text
          rawContent: string; // The full text of the block (::type ... ::)
          innerContent: string; // The content between the start and end tags.
          properties: BlockProperties; // Parsed properties from the start tag.
          parts?: ParsedBlockPart[]; // e.g., columns, steps, individual tabs
        }

        export interface BlockProperties {
          [key: string]: string | boolean | undefined;
        }

        export interface ParsedBlockPart {
          type: 'column' | 'step' | 'tab-item'; // More specific part type
          rawContent: string; // e.g., --col(md) ... content ...
          properties: BlockProperties; // Parsed from the part's tag
          innerContent: string; // Content within this part
        }
        ```
    3.  **Create the `GinkoBlockParser` class:**
        ```typescript
        // src/editor/utils/parsing.ts

        import { App } from 'obsidian';

        export interface GinkoBlockDefinition {
          type: string;
          startTagRegex: RegExp; // To capture type and properties, e.g., /^::tabs(?:\(([^)]*)\))?/
          endTag: string; // e.g., "::"
          // For blocks with internal parts:
          partTagRegex?: RegExp; // e.g., /^--tab(?:\(([^)]*)\))?(.*)/
          // Function to create the live preview widget
          createWidget: (app: App, parsedBlock: ParsedBlock, isEditing: boolean, id: string) => BaseWidget;
          // Function to render for post-processor (reading view)
          renderReadingView: (app: App, parsedBlock: ParsedBlock, containerEl: HTMLElement, context: MarkdownPostProcessorContext) => Promise<void>;
        }

        export class GinkoBlockParser {
          private readonly definitions: GinkoBlockDefinition[] = [];

          constructor() {}

          registerBlockDefinition(definition: GinkoBlockDefinition) {
            this.definitions.push(definition);
          }

          parseBlocks(text: string): ParsedBlock[] {
            const parsedBlocks: ParsedBlock[] = [];
            let currentIndex = 0;

            while (currentIndex < text.length) {
              let foundBlock = false;

              for (const definition of this.definitions) {
                const match = text.match(definition.startTagRegex);

                if (match && match.index !== undefined && match.index >= currentIndex) {
                  const startIndex = match.index;
                  const type = definition.type;
                  const rawContent = this.extractRawContent(text, startIndex, definition.endTag);

                  if (rawContent !== null) {
                    const endIndex = startIndex + rawContent.length;
                    const innerContent = text.substring(startIndex + match[0].length, endIndex - definition.endTag.length).trim();
                    const properties = this.parseProperties(match[1] || ''); // Assuming properties are captured in group 1
                    let parts: ParsedBlockPart[] | undefined = undefined;
                    if (definition.partTagRegex) {
                      parts = this.parseBlockParts(innerContent, definition.partTagRegex);
                    }
                    parsedBlocks.push({
                      type,
                      startIndex,
                      endIndex: endIndex,
                      rawContent: text.substring(startIndex, endIndex),
                      innerContent,
                      properties,
                      parts,
                    });
                    currentIndex = endIndex; // Move past the end tag
                    foundBlock = true;
                    break;
                  }
                }
              }
              if (!foundBlock) {
                currentIndex++;  // Move to the next character to prevent infinite loops if no block is found.
              }
            }
            return parsedBlocks;
          }
          private extractRawContent(text: string, startIndex: number, endTag: string): string | null {
            const endIndex = text.indexOf(endTag, startIndex + 1); // Start search from after the tag
            if (endIndex === -1) {
              return null; // Invalid block
            }
            return text.substring(startIndex, endIndex + endTag.length);
          }

          private parseProperties(propString: string): BlockProperties {
            const properties: BlockProperties = {};
            if (!propString) return properties;

            const propMatches = propString.matchAll(/(\w+)(?:=(?:"([^"]*)"|(\w+)))?/g);

            for (const match of Array.from(propMatches)) {
              if (match && match[1]) {
                const key = match[1];
                if (!match[2] && !match[3]) {
                  properties[key] = true;
                }
                else if (match[2] !== undefined) {
                  properties[key] = match[2];
                }
                else if (match[3] !== undefined) {
                  properties[key] = match[3].toLowerCase() === 'true';
                }
              }
            }
            return properties;
          }

          private parseBlockParts(innerContent: string, partTagRegex: RegExp): ParsedBlockPart[] {
            const parts: ParsedBlockPart[] = [];
            let match;
            let lastIndex = 0;

            const regex = new RegExp(partTagRegex, 'gm');  // Ensure global and multiline flags

            while ((match = regex.exec(innerContent)) !== null) {
              const partStartIndex = match.index;
              const partRawContent = match[0];
              const partType = 'column' // or "tab-item", or "step" - depending on the block type
              const partInnerContent = innerContent.substring(match.index + match[0].length).trim();
              const partProperties = this.parseProperties(match[1] || '');

              parts.push({
                type: partType,  // or "tab-item", or "step"
                rawContent: partRawContent,
                properties: partProperties,
                innerContent: partInnerContent,
              });
              lastIndex = regex.lastIndex;
            }
            return parts;
          }
        }
        ```
    4.  **Register Block Definitions:** You'll need to *register* each block type with an instance of the `GinkoBlockParser`.
        *   This involves creating `GinkoBlockDefinition` objects for each block type.
        *   These definitions are critical for the plugin's dual-mode rendering.
        *   **Examples:**
            ```typescript
            // In the relevant PreviewExtension, or a dedicated file for definitions.

            // Aspect Block Definition
            import { AspectWidget } from './aspectWidget';
            import { MarkdownPostProcessorContext } from 'obsidian';

            const aspectBlockDefinition: GinkoBlockDefinition = {
              type: 'aspect',
              startTagRegex: /^::aspect(?:\((.*?)\))?\s*(!\[.*\]\((.*?)\).*?)?\s*::/s,  // More accurate
              endTag: '::',
              createWidget: (app, parsedBlock, isEditing, id) => {
                return new AspectWidget({
                  content: parsedBlock.rawContent, // Pass the raw content
                  id,
                  app,
                });
              },
              renderReadingView: async (app: App, parsedBlock: ParsedBlock, containerEl: HTMLElement, context: MarkdownPostProcessorContext) => {
                // Create a container
                const aspectContainer = containerEl.createDiv({ cls: 'ginko-blocks-aspect-container' });
                const wrapper = aspectContainer.createDiv({cls: 'ginko-blocks-aspect-wrapper'});
                // Get the image markdown - very robust and flexible
                const imageMarkdown = parsedBlock.innerContent.trim();

                // Render the image
                const contentDiv = document.createElement('div');
                const markdownChild = new MarkdownRenderChild(contentDiv);

                await MarkdownRenderer.render(
                  app,
                  imageMarkdown,
                  contentDiv,
                  '',
                  markdownChild,
                );
                // Append the rendered image to the wrapper.
                wrapper.appendChild(contentDiv);
              },
            };
            ```
            ```typescript
            // Tabs Block Definition
            import { TabWidget } from './tabsWidget';
            import { tabsProcessor } from './tabsPostProcessor'; //For post processing
            import { MarkdownPostProcessorContext } from 'obsidian';

            const tabsBlockDefinition: GinkoBlockDefinition = {
              type: 'tabs',
              startTagRegex: /^::tabs(?:\((.*?)\))?\n/,
              endTag: '::',
              partTagRegex: /^--tab(?:\((.*?)\))?\s*(.*)$/gm, // Added multi-line support
              createWidget: (app, parsedBlock, isEditing, id) => {
                return new TabWidget(
                  parsedBlock.rawContent,
                  id,
                  isEditing,
                  app
                );
              },
              renderReadingView: async (app: App, parsedBlock: ParsedBlock, containerEl: HTMLElement, context: MarkdownPostProcessorContext) => {
                // Create main container
                const container = containerEl.createDiv({ cls: 'ginko-tabs-container ginko-embed-block show-indentation-guide' });
                container.setAttribute('contenteditable', 'false');
                container.setAttribute('tabindex', '-1');
                const tabButtons = container.createDiv({ cls: 'ginko-tab-buttons' });
                const tabContents = container.createDiv({ cls: 'ginko-tab-contents' });
                // Parse the tabs content (using the parser!)
                if (!parsedBlock.parts || parsedBlock.parts.length === 0) {
                    return;
                }
                //Create tab buttons and content
                for (let i = 0; i < parsedBlock.parts.length; i++) {
                    const tab = parsedBlock.parts[i];
                    // Create tab button
                    const button = tabButtons.createEl('button', { cls: `ginko-tab-button${i === 0 ? ' active' : ''}` });
                    // Add title
                    const textContainer = button.createSpan({ cls: 'ginko-tab-text' });
                    textContainer.textContent =  tab.properties.title || '';
                    // Create tab content
                    const content = tabContents.createDiv({
                        cls: `ginko-tab-content markdown-preview-view${i === 0 ? ' active' : ''}`,
                    });
                    // Render markdown content
                    const markdownChild = new MarkdownRenderChild(content);
                    await context.addChild(markdownChild);
                    await MarkdownRenderer.render(
                        app,
                        tab.innerContent.trim(),
                        content,
                        '',
                        markdownChild,
                    );
                }
              },
            };
            ```
            ```typescript
            //  Layout Block Definition - Example
            import { LayoutWidget } from './layoutWidget';
            import { MarkdownPostProcessorContext } from 'obsidian';

            const layoutBlockDefinition: GinkoBlockDefinition = {
              type: 'layout',
              startTagRegex: /::layout(?:\((.*?)\))?\n/,
              endTag: '::',
              partTagRegex: /--col(?:\((.*?)\))?/g,
              createWidget: (app, parsedBlock, isEditing, id) => {
                  return new LayoutWidget(
                      parsedBlock.rawContent,
                      id,
                      isEditing,
                      app
                  );
              },
              renderReadingView: async (app: App, parsedBlock: ParsedBlock, containerEl: HTMLElement, context: MarkdownPostProcessorContext) => {
                  const container = containerEl.createDiv({ cls: 'ginko-layout-container ginko-embed-block  show-indentation-guide' });
                  container.setAttribute('contenteditable', 'false');
                  container.setAttribute('tabindex', '-1');
                  const columnsContainer = container.createDiv({ cls: 'ginko-layout-columns' });

                  if (!parsedBlock.parts || parsedBlock.parts.length === 0) {
                      return;
                  }
                  for (const col of parsedBlock.parts) {
                      const columnElement = columnsContainer.createDiv({ cls: 'ginko-layout-column' });

                      // Render the content of each column
                      const contentDiv = document.createElement('div');
                      const markdownChild = new MarkdownRenderChild(contentDiv);
                      await context.addChild(markdownChild); // Add as child for lifecycle management

                      await MarkdownRenderer.render(
                          app,
                          col.innerContent.trim(), // Assuming innerContent is markdown
                          contentDiv,
                          '',
                          markdownChild
                      );

                      //Append rendered content to column
                      columnElement.appendChild(contentDiv);
                  }
              },
            };
            ```
    5.  **Register block definitions in `main.ts`:** You'll have one instance of the parser, and each `GinkoBlockDefinition` needs to be registered with the parser.
        ```typescript
        // main.ts
        import { GinkoBlockParser, GinkoBlockDefinition } from './src/editor/utils/parsing';

        // Import all your block definitions
        import { aspectBlockDefinition } from './src/editor/aspect/aspectPreviewExtension';
        import { tabsBlockDefinition } from './src/editor/tabs/tabsPostProcessor'; // Or wherever you define them
        import { layoutBlockDefinition } from './src/editor/layout/layoutPostProcessor';

        export default class GinkoBlocksPlugin extends Plugin {
          // ... other plugin code ...
          private blockParser: GinkoBlockParser;

          async onload() {
            // ...
            this.blockParser = new GinkoBlockParser(); // Instantiate the parser

            // Register the block definitions
            this.blockParser.registerBlockDefinition(aspectBlockDefinition);
            this.blockParser.registerBlockDefinition(tabsBlockDefinition);
            this.blockParser.registerBlockDefinition(layoutBlockDefinition);
            // ... register other definitions ...

            this.registerEditorExtensions(); // This registers the editor extensions
            this.registerMarkdownPostProcessors(); // This registers the post processors
          }

          private registerMarkdownPostProcessors() {
              this.registerMarkdownPostProcessor(this.createGinkoBlockPostProcessor()); // Create a single post processor.
          }

          private createGinkoBlockPostProcessor() {
            return async (element: HTMLElement, context: MarkdownPostProcessorContext) => {
                const text = element.innerHTML || ''; // Or .textContent, check content.
                const parsedBlocks = this.blockParser.parseBlocks(text);
                for (const parsedBlock of parsedBlocks) {
                    const blockDefinition = this.getBlockDefinition(parsedBlock.type); // Get the definition

                    if (blockDefinition) {
                        // Create a div to hold the rendered output (replaces the original content)
                        const replacementDiv = document.createElement('div');
                        // Render the reading view content (from the definition)
                        await blockDefinition.renderReadingView(this.app, parsedBlock, replacementDiv, context);
                        // Replace the original HTML.  This is the trickiest part!
                        // Find the HTML element in element (the document fragment from the main parser) and replace it.
                        const blockElement = this.findBlockElement(element, parsedBlock); // Implementation details follow
                        if (blockElement) {
                          blockElement.replaceWith(replacementDiv);
                        }
                    }
                }
            };
          }
          // Find the actual HTML element from original parsing.
          private findBlockElement(element: HTMLElement, parsedBlock: ParsedBlock): HTMLElement | null {
              // VERY IMPORTANT: This part can be tricky. You need to identify
              // the HTML element(s) that correspond to parsedBlock.rawContent.
              // This might require some heuristics:
              // 1.  Find a direct child of element whose content matches
              //    parsedBlock.rawContent. This will work for very simple blocks.
              // 2. More complex blocks (e.g., those that Obsidian's core markdown
              //    renderer wraps in <p> tags or other elements) require more
              //    sophisticated methods. For example, matching content by
              //    range. The post processor should search through the child
              //    elements and identify the element(s) that correspond to
              //    the block. You might need to combine textContent matching
              //    with range calculations.
              // For example, find all code blocks and compare the content.
              //   const codeBlocks = element.querySelectorAll('code');
              //   for (let codeBlock of codeBlocks) {
              //      if (codeBlock.innerText.trim() === parsedBlock.rawContent) {
              //        return codeBlock;
              //    }
              //   }
              const rawContent = parsedBlock.rawContent;
              if (!rawContent) return null;

              let foundElement: HTMLElement | null = null;
              // Iterate through child nodes to find matching text
              for (let i = 0; i < element.childNodes.length; i++) {
                const childNode = element.childNodes[i];
                if (childNode.nodeType === Node.TEXT_NODE) {
                  // If rawContent is contained in a single text node
                  if ((childNode.textContent?.trim() || '').includes(rawContent.trim())) {
                    //Find Parent
                    if (childNode.parentNode && childNode.parentNode instanceof HTMLElement) {
                      foundElement = childNode.parentNode;
                    }
                    break;
                  }
                } else if (childNode instanceof HTMLElement && childNode.textContent?.trim() === rawContent.trim()) {
                  // Check element content for a direct match
                  foundElement = childNode;
                  break;
                }
                else if (childNode instanceof HTMLElement) { //Check recursively.
                  const recursiveResult = this.findBlockElement(childNode, parsedBlock);
                  if (recursiveResult) {
                    foundElement = recursiveResult;
                    break; // Exit outer loop if found in child
                  }
                }
              }

              return foundElement;
          }

          private getBlockDefinition(type: string): GinkoBlockDefinition | undefined {
              return this.definitions.find(def => def.type === type);
          }

          private registerEditorExtensions() {
              // Your existing registerEditorExtensions() but altered to call  createEditorExtensions
              const editorExtensions = this.createEditorExtensions();
              this.registerEditorExtension(editorExtensions);
          }

          //This is where the editor extension are registered.
          private createEditorExtensions(): Extension[] {
            const extensions: Extension[] = [];
            for (const def of this.definitions) {
              // Assuming def.createWidget returns an editor extension
              if (def.createWidget) {
                  extensions.push(this.createBlockExtension(def));
              }
            }
            // Add other extensions here if needed, e.g., syntax highlighting
            extensions.push(syntaxHighlightField);  // Make sure it still works
            return extensions;
          }
          private createBlockExtension(definition: GinkoBlockDefinition): Extension {
              const blockType = definition.type;
              const startTagRegex = definition.startTagRegex;
              const createWidget = definition.createWidget;
              const toggleEditEffect = StateEffect.define<{ id: string, blockType: string, value: boolean }>();

              return [
                  StateField.define<DecorationSet>({
                    create: () => Decoration.none,
                    update: (oldState, transaction) => {
                      // Get all blocks with a single call.
                      const parsedBlocks = this.blockParser.parseBlocks(transaction.state.doc.toString());
                      const builder = new RangeSetBuilder<Decoration>();
                      const cursorLocations = getCursorLocations(transaction); //Get the current cursor/selection
                      const selectionRanges = transaction.state.selection.ranges;
                      const existingWidgets = collectExistingWidgets(oldState, transaction.state.doc.length, createWidget(''.app, {type: blockType, startIndex: 0, endIndex:0, rawContent:"", innerContent:"", properties: {}}, false, 'test').constructor);

                      for (const parsedBlock of parsedBlocks) {
                        if (parsedBlock.type === blockType) {
                          const id = `${blockType}-${hashContent(parsedBlock.rawContent)}`;
                          const isEditing = transaction.state.field(toggleEditEffect).get(id) || false; // Check the state

                          // Create the widget, passing the parsed block data and ID
                          const widget = createWidget(this.app, parsedBlock, isEditing, id);
                          const cursorInRegion = checkCursorInRegion(
                              parsedBlock.startIndex,
                              parsedBlock.endIndex,
                              cursorLocations,
                              Array.from(transaction.state.selection.ranges),
                          );

                          if (cursorInRegion) {
                            continue;
                          }
                          builder.add(parsedBlock.startIndex, parsedBlock.endIndex, Decoration.replace({ widget, inclusive: true }));
                        }
                      }
                      return builder.finish();
                    },
                    provide: field => EditorView.decorations.from(field),
                  }),
                  StateField.define<Map<string, boolean>>({ // State for showing edit mode
                      create: () => new Map(),
                      update: (value, tr) => {
                        const newValue = new Map(value);
                        for (const effect of tr.effects) {
                          if (effect.is(toggleEditEffect)) {
                            const { id, value } = effect.value;
                            value ? newValue.set(id, true) : newValue.delete(id);
                          }
                        }
                        return newValue;
                      },
                    })
              ];
            }
        }
      // ... other plugin code ...
        ```
    6.  **Update existing `create...PreviewExtension()` and post-processor functions:**
        *   They are now *deprecated* and will be removed.
        *   **Remove** the old `registerEditorExtension` calls for each block.

*   **Testing Opportunities:**
    *   **Register and Initialize:** Verify that the `GinkoBlockParser` and `GinkoBlockDefinitions` are registered correctly in `main.ts`.

**Phase 2: Rendering Logic & Widget/Reading View Consistency (Detailed)**

***5.1. Goal:** Create shared rendering logic that allows for visual consistency between Live Preview widgets and Reading View renderings. The goal is to have code re-use and similar outputs.
**Phase 2: Rendering Logic & Widget/Reading View Consistency (Detailed - Continued)**

*   **5.2. Actions (Continued):**
    1.  **`BaseWidget` Changes (Live Preview) - Continued:**
        *   **Example (`AspectWidget`) - Continued:**
            ```typescript
            // src/editor/aspect/aspectWidget.ts
            import type { ParsedBlock } from '../utils/parsing'; // Import ParsedBlock

            // ... (other imports and AspectRatio type)

            export class AspectWidget extends BaseWidget {
              private aspectRatio: AspectRatio = 'square'; // Default

              constructor({ content, id, app, parsedBlock }: { content: string, id: string, app: App, parsedBlock: ParsedBlock }) {
                super({ content, id, app }); // content here is rawContent from ParsedBlock
                this.parseAspectRatioFromProps(parsedBlock.properties); // Parse from properties
              }

              private parseAspectRatioFromProps(properties: BlockProperties): void {
                // Assuming aspect ratio is passed as a property like ::aspect(ratio="video")
                // Or ::aspect(video) if "video" is treated as a boolean flag or a direct value.
                // Adjust this based on how your GinkoBlockParser and property parsing are set up.
                const ratioProp = properties.ratio || Object.keys(ASPECT_RATIOS).find(key => properties[key] === true);
                if (ratioProp && ratioProp in ASPECT_RATIOS) {
                  this.aspectRatio = ratioProp as AspectRatio;
                }
              }

              protected createPreviewView(view: EditorView): HTMLElement {
                const container = this.createContainer('ginko-blocks-aspect-container');
                const wrapper = document.createElement('div');
                wrapper.className = 'ginko-blocks-aspect-wrapper';
                wrapper.style.setProperty('--aspect-ratio', ASPECT_RATIOS[this.aspectRatio].toString());

                // The innerContent of ParsedBlock should contain just the image markdown
                // Assuming parsedBlock is accessible here (e.g., passed to toDOM or stored in constructor)
                // This needs to be wired up from BasePreviewExtension -> createWidget -> AspectWidget
                const imageMarkdown = this.content.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[0]; // A bit fragile, better if innerContent is clean

                if (imageMarkdown) {
                  const contentDiv = document.createElement('div');
                  const markdownChild = new MarkdownRenderChild(contentDiv); // Important for Obsidian's resource handling

                  MarkdownRenderer.render(
                    this.app,
                    imageMarkdown, // Render just the image markdown
                    contentDiv,
                    '', // sourcePath - can be empty or derived if needed for relative paths
                    markdownChild,
                  ).then(() => {
                    const imageEmbed = contentDiv.querySelector('.internal-embed.image-embed img, img'); // More robust selector
                    if (imageEmbed instanceof HTMLImageElement) {
                      imageEmbed.className = 'ginko-blocks-aspect-image';
                    }
                    wrapper.appendChild(contentDiv);
                  });
                } else {
                    wrapper.setText('Image markdown not found in block content.'); // Fallback
                }

                container.appendChild(wrapper);
                container.appendChild(this.createEditButton((e) => {
                  // Edit button logic (uses generic toggle effect from BasePreviewExtension)
                  e.preventDefault();
                  const widgetPos = view.posAtDOM(container);
                  // Example: position cursor after the ::aspect(...) line
                  const firstLineEnd = this.content.indexOf('\n');
                  const cursorPos = widgetPos + (firstLineEnd !== -1 ? firstLineEnd + 1 : this.content.length);

                  view.dispatch({
                    selection: { anchor: cursorPos, head: cursorPos },
                    effects: [
                      // Assuming toggleBlockEditEffect is defined in BasePreviewExtension
                      // and the blockType is available (e.g., this.blockType)
                      // BasePreviewExtension.toggleBlockEditEffect.of({ blockId: this.id, blockType: "aspect", value: true }),
                      EditorView.scrollIntoView(cursorPos),
                    ],
                  });
                  view.focus();
                }));
                return container;
              }
            }
            ```
            **Important Note:** The `BasePreviewExtension` will need to pass the `ParsedBlock` data when it calls `definition.createWidget`. The widget's constructor should then store relevant parts of this `ParsedBlock` (like `rawContent` for the `content` property and `properties` for its own parsing).
    2.  **Reading View Render Functions (`renderReadingView` in `GinkoBlockDefinition`):**
        *   This function receives the `ParsedBlock` and the `containerEl` (the div it should render into).
        *   It's responsible for building the *static* HTML representation for the reading view.
        *   It *must* use `MarkdownRenderer.render(app, markdown, el, sourcePath, component)` for rendering any Markdown content within the block to ensure Obsidian features like links, embeds, and other formatting work correctly. The `component` argument should be the `MarkdownRenderChild` instance.
        *   **Example (Conceptual for `AspectWidget`'s `renderReadingView`):**
            ```typescript
            // In aspectBlockDefinition (from Phase 1)
            // ...
            renderReadingView: async (app: App, parsedBlock: ParsedBlock, containerEl: HTMLElement, context: MarkdownPostProcessorContext) => {
              // containerEl is the div provided by the post-processor framework where this block should render
              containerEl.empty(); // Clear any placeholder content
              containerEl.addClasses(['ginko-blocks-aspect-container', 'ginko-embed-block', 'show-indentation-guide']); // Apply base classes

              const properties = parsedBlock.properties;
              let aspectRatioName: AspectRatio = 'square'; // Default
              const ratioProp = properties.ratio || Object.keys(ASPECT_RATIOS).find(key => properties[key] === true);
              if (ratioProp && ratioProp in ASPECT_RATIOS) {
                aspectRatioName = ratioProp as AspectRatio;
              }

              const wrapper = containerEl.createDiv({ cls: 'ginko-blocks-aspect-wrapper' });
              wrapper.style.setProperty('--aspect-ratio', ASPECT_RATIOS[aspectRatioName].toString());

              // parsedBlock.innerContent should contain the image markdown
              // Or, if the startTagRegex captures the image markdown directly, use that part of the match
              const imageMarkdown = parsedBlock.innerContent.trim(); // Assuming innerContent is JUST the image markdown

              if (imageMarkdown) {
                const contentDiv = wrapper.createDiv(); // Render directly into the wrapper
                const markdownChild = new MarkdownRenderChild(contentDiv);
                context.addChild(markdownChild); // CRITICAL: Add to context for lifecycle management

                await MarkdownRenderer.render(
                  app,
                  imageMarkdown,
                  contentDiv,
                  context.sourcePath, // Use sourcePath from context
                  markdownChild,
                );
                const imageElement = contentDiv.querySelector('.internal-embed img, img');
                if (imageElement) {
                  imageElement.addClass('ginko-blocks-aspect-image');
                }
              } else {
                  wrapper.setText('Image markdown not found.');
              }
            },
            // ...
            ```
    3.  **Shared HTML Structure/Logic (`src/editor/utils/dom.ts`):**
        *   If you find common HTML patterns (e.g., creating a "card" structure used by multiple components), extract these into functions in `dom.ts`.
        *   **Example:**
            ```typescript
            // src/editor/utils/dom.ts
            export function createCardElement(title: string, contentMarkdown: string): HTMLElement {
              const card = document.createElement('div');
              card.className = 'ginko-card';
              // ... add more structure ...
              return card;
            }
            ```
            Both a `CardWidget.createPreviewView` and a `CardBlockDefinition.renderReadingView` could then use `createCardElement`.
    4.  **CSS Consistency:**
        *   Review all CSS files (`aspect.css`, `tabs.css`, etc.).
        *   Ensure class names are used consistently by both the Live Preview widgets (generated by `createPreviewView`) and the Reading View renderings (generated by `renderReadingView`).
        *   The goal is that `div.ginko-tabs-container` (for example) looks and behaves similarly (styling-wise) in both modes. The interactivity might differ.

*   **5.3. Testing Opportunities:**
    *   **Shared Rendering Helpers:** Unit test functions in `dom.ts`.
    *   **Visual Consistency (Manual):** After implementing `renderReadingView` for a component, open a note with that Ginko Block. Switch between Live Preview and Reading View. Do they look the same (or as intended for each mode)? Check on different themes.
    *   **`renderReadingView` Functions (Unit-like):** You can't easily unit test the full `MarkdownRenderer` behavior, but you can test that your `renderReadingView` function:
        *   Creates the correct top-level HTML structure.
        *   Calls `MarkdownRenderer.render` with the expected inner content.
        *   Correctly applies properties from `ParsedBlock.properties` to its HTML.

**Phase 3: Specific Component Refinements (Dual-Mode Aware - Detailed)**

*   **6.1. Goal:** Go through each Ginko Block component and implement/refine its `GinkoBlockDefinition` (especially the `createWidget` and `renderReadingView` parts) and its corresponding `Widget.ts` file.
*   **6.2. General Process for Each Component (e.g., "Tabs"):**
    1.  **Define/Refine `GinkoBlockDefinition` (e.g., `tabsBlockDefinition`):**
        *   **`type`**: `"tabs"`
        *   **`startTagRegex`**: `^::tabs(?:\(([^)]*)\))?\n` (Ensure it captures properties correctly).
        *   **`endTag`**: `" :: "`
        *   **`partTagRegex`**: `^--tab(?:\(([^)]*)\))?\s*(.*)$/gm` (For parsing individual ` --tab ` lines).
        *   **`createWidget` function:**
            *   Takes `(app, parsedBlock, isEditing, id)`.
            *   Returns `new TabWidget(app, parsedBlock, isEditing, id)`.
        *   **`renderReadingView` function:**
            *   Takes `(app, parsedBlock, containerEl, context)`.
            *   Will parse `parsedBlock.parts` (which are the individual tabs from `GinkoBlockParser`).
            *   For each part (tab):
                *   Create a button element for the tab title (using `tabPart.properties.title`).
                *   Create a content div.
                *   Use `MarkdownRenderer.render(app, tabPart.innerContent, contentDiv, ...)` to render the tab's content.
            *   Add simple JS for tab switching (toggling 'active' classes on buttons and content divs). This JS will be attached directly by the `renderReadingView` function.
                ```javascript
                // Inside renderReadingView for Tabs, after creating buttons and content divs:
                buttons.forEach((button, index) => {
                  button.addEventListener('click', () => {
                    buttons.forEach(btn => btn.classList.remove('active'));
                    contents.forEach(cont => cont.classList.remove('active'));
                    button.classList.add('active');
                    contents[index].classList.add('active');
                  });
                });
                ```
    2.  **Refactor `Widget.ts` (e.g., `TabWidget.ts`):**
        *   Constructor: `constructor(app: App, parsedBlock: ParsedBlock, isEditing: boolean, id: string)`
        *   It should use `parsedBlock.rawContent` for its `this.content` (if needed for hashing or the edit button).
        *   It should use `parsedBlock.properties` for its main properties.
        *   It should use `parsedBlock.parts` to get data for individual tabs/steps/columns. It should *not* re-parse these from `this.content`.
        *   **Example `TabWidget` constructor & parsing:**
            ```typescript
            // src/editor/tabs/tabsWidget.ts
            // ...
            export class TabWidget extends BaseWidget {
              private readonly tabsData: readonly ParsedBlockPart[]; // Store parsed tab parts
              private readonly blockProperties: BlockProperties;
              private activeTab: number;
              // ...

              constructor(app: App, parsedBlock: ParsedBlock, isEditing: boolean, id: string) {
                super({ content: parsedBlock.rawContent, id, app }); // Use rawContent for BaseWidget
                this.isEditing = isEditing;
                this.blockProperties = parsedBlock.properties;
                this.tabsData = parsedBlock.parts || []; // Get pre-parsed tab parts
                this.activeTab = this.loadActiveTab(); // Existing logic for active tab state
              }

              // Method to create tab buttons and content in createPreviewView
              // will now iterate over this.tabsData
              // ...
              protected createPreviewView(view: EditorView): HTMLElement {
                const container = this.createContainer('ginko-tabs-container');
                // ... (edit button logic) ...

                const tabButtons = document.createElement('div');
                tabButtons.className = 'ginko-tab-buttons';

                const tabContents = document.createElement('div');
                tabContents.className = 'ginko-tab-contents';

                this.tabsData.forEach((tabPart, index) => {
                  // Create button from tabPart.properties.title and tabPart.properties.icon
                  const button = this.createTabButtonElement(tabPart, index, container /* for updating active tab */);
                  tabButtons.appendChild(button);

                  // Create content div
                  const contentEl = this.createTabContentElement(tabPart, index);
                  // Render tabPart.innerContent using MarkdownRenderer
                  const markdownChild = new MarkdownRenderChild(contentEl);
                  MarkdownRenderer.render(this.app, tabPart.innerContent.trim(), contentEl, '', markdownChild)
                    .then(() => {
                      contentEl.querySelectorAll('.edit-block-button').forEach(btn => btn.remove());
                    });
                  tabContents.appendChild(contentEl);
                });

                container.appendChild(tabButtons);
                container.appendChild(tabContents);
                return container;
              }

              private createTabButtonElement(tabPart: ParsedBlockPart, index: number, mainContainer: HTMLElement): HTMLElement {
                const button = document.createElement('button');
                button.className = `ginko-tab-button${index === this.activeTab ? ' active' : ''}`;
                // Add icon from tabPart.properties.icon if it exists
                // Add title from tabPart.properties.title
                const titleText = tabPart.properties.title as string || `Tab ${index + 1}`;
                button.textContent = titleText; // Simplified, add icon logic
                button.onclick = (e) => {
                  e.preventDefault();
                  this.activeTab = index;
                  this.saveActiveTab(index); // Persist
                  this.updateActiveWidgetTabVisuals(mainContainer, index); // Update classes in this widget
                };
                return button;
              }
              // ... (other methods like createTabContentElement, updateActiveWidgetTabVisuals)
            }
            ```
    3.  **State Management (`blockState.ts`):**
        *   **Live Preview:** Widgets like `TabWidget` (active tab) and `CalloutWidget` (collapsed state) will continue to use `blockState.ts` to persist their UI state *during an editing session*.
        *   **Reading View:** `blockState.ts` is generally *not* suitable for persisting UI state in Reading View because post-processors re-run on every view change, and they don't have the same stable "widget ID" concept tied to CodeMirror's decoration state.
            *   For Reading View, interactive elements (like tabs) will typically reset to their default state (e.g., first tab active) each time the view is rendered.
            *   If properties specify a default (e.g., `::tabs(defaultActive="2")`), the `renderReadingView` function should respect that.
    4.  **CSS:** Ensure CSS applies correctly to both the widget's structure and the `renderReadingView`'s structure.
*   **6.3. Specific Components - Key Considerations:**
    *   **Callout:**
        *   `renderReadingView` will check `parsedBlock.properties.collapsed` (e.g., from `::info-`) for initial state. JS for toggling in reading view is optional.
    *   **Layout, Steps:**
        *   `renderReadingView` will iterate `parsedBlock.parts` and use `MarkdownRenderer` for each part's `innerContent`.
    *   **Gallery:**
        *   `renderReadingView` will also need to parse image markdown from `parsedBlock.innerContent` (or parts if gallery supports multiple image lines). It will create the grid. The lightbox functionality will need to be re-initialized by the `renderReadingView` JS if desired in reading mode.
    *   **FileTree:**
        *   `renderReadingView` will parse the tree structure from `parsedBlock.innerContent` and render it as static HTML.
*   **6.4. Testing Opportunities:**
    *   For each component:
        *   **Parsing:** Does the `GinkoBlockParser` correctly identify it and extract its `properties` and `parts`?
        *   **Live Preview Widget:**
            *   Does it render correctly using the `ParsedBlock` data?
            *   Do interactions (edit button, tab clicks, collapse) work?
            *   Does it use `blockState.ts` correctly?
        *   **Reading View (`renderReadingView`):**
            *   Does it render correctly using `ParsedBlock` data and `MarkdownRenderer`?
            *   Does it respect default properties (e.g., initially collapsed callout)?
            *   If simple JS is added (like for tab switching), does it work?

**Phase 4: Utilities, Settings, Code Quality & Finalization (Detailed)**

*   **7.1. Goal:** Polish the plugin, ensure all utilities are well-organized, settings work, and the codebase is clean.
*   **7.2. Actions:**
    1.  **`utils.ts` Split (Finalize):**
        *   Ensure `parsing.ts` contains only parsing logic (including `GinkoBlockParser`, `GinkoBlockDefinition`, `ParsedBlock`, property parsers).
        *   `codemirror.ts`: Utilities related to CodeMirror interactions (`checkCursorInRegion`, `getCursorLocations`, `collectExistingWidgets`).
        *   `dom.ts`: DOM creation helpers (`createIconElement`, shared HTML structure functions).
        *   `general.ts`: `hashContent`, etc.
        *   `blockState.ts`: Keep as is.
    2.  **Update `BasePreviewExtension` (Finalize):**
        *   It should now use the `GinkoBlockParser` instance (passed from `main.ts` or accessed via a singleton service).
        *   Its `updatePreviews` method:
            *   Gets *all* `ParsedBlock`s from the parser.
            *   Filters for blocks matching `this.blockType` (which is now a property of `BasePreviewExtension` set by its constructor).
            *   Calls `this.blockDefinition.createWidget(...)` to get the widget.
        *   Define the generic `toggleBlockEditEffect` here. Widgets will dispatch this.
            ```typescript
            // src/editor/_base/basePreviewExtension.ts
            export const toggleBlockEditEffect = StateEffect.define<{ blockId: string, blockType: string, value: boolean }>();

            export abstract class BasePreviewExtension<T extends WidgetType> {
              protected readonly app: App;
              protected readonly blockDefinition: GinkoBlockDefinition; // Store the full definition
              protected readonly editStateField: StateField<Map<string, boolean>>;
              protected readonly ginkoBlockParser: GinkoBlockParser; // Instance of the parser

              constructor(app: App, definition: GinkoBlockDefinition, parser: GinkoBlockParser) {
                this.app = app;
                this.blockDefinition = definition;
                this.ginkoBlockParser = parser;
                this.editStateField = this.createEditStateField();
              }

              private createEditStateField(): StateField<Map<string, boolean>> {
                return StateField.define<Map<string, boolean>>({
                  create: () => new Map(),
                  update: (value, tr) => {
                    const newValue = new Map(value);
                    for (const effect of tr.effects) {
                      if (effect.is(toggleBlockEditEffect) && effect.value.blockType === this.blockDefinition.type) {
                        const { blockId, value: effectValue } = effect.value;
                        effectValue ? newValue.set(blockId, true) : newValue.delete(blockId);
                      }
                    }
                    return newValue;
                  },
                });
              }

              // updatePreviews will use this.ginkoBlockParser and this.blockDefinition
              // ...
            }
            ```
    3.  **`syntaxHighlightExtension.ts` (Finalize):**
        *   It *must* use the `GinkoBlockParser` or a compatible regex set derived from the `GinkoBlockDefinition`s' `startTagRegex` and `partTagRegex`.
        *   This ensures that what's highlighted as a "tab start" is actually what the parser considers a tab start.
    4.  **`main.ts` Registration (Finalize):**
        *   **Editor Extensions:**
            *   Instantiate `GinkoBlockParser` once.
            *   For each `GinkoBlockDefinition`, create an instance of a (possibly new, more generic) `LivePreviewEnablerExtension` class that takes the `definition` and `parser` and sets up the `StateField` for decorations and the `editStateField`.
            *   Register these extension instances.
        *   **Post Processor:**
            *   Register a *single* main post-processor.
            *   This post-processor iterates through the HTML `element`.
            *   It uses the `GinkoBlockParser` to find Ginko Blocks in `element.innerHTML` (or similar).
            *   For each `ParsedBlock`, it looks up the corresponding `GinkoBlockDefinition` (e.g., from a map stored in the plugin or the parser).
            *   It then calls `definition.renderReadingView(app, parsedBlock, replacementDiv, context)`.
            *   It carefully replaces the original placeholder text/elements in the main `element` with the `replacementDiv`.
    5.  **Review `noLineBreaksExtension.ts`:**
        *   **Purpose:** Currently, it seems to auto-trim whitespace in `::layout` blocks when the cursor is outside.
        *   **Decision:** Is this essential? Could it be a user preference? Does it interfere with how users expect Markdown to behave?
        *   If kept, ensure it doesn't conflict with the main parser. It might be simpler to have the `LayoutWidget` and `LayoutDefinition.renderReadingView` normalize content if needed, rather than a separate extension modifying the source document. **Recommendation:** Consider removing or making it an optional feature if it causes complexity.
    6.  **Settings (`settings.ts`, `resetModal.ts`, `resetStorage.ts`):**
        *   Ensure all settings toggles correctly enable/disable features. This means the registration of extensions and post-processors in `main.ts` might need to be conditional based on settings.
        *   Implement the actual "Reset" logic for components (this will involve finding and removing/replacing Ginko Block syntax from notes). This is a destructive operation and needs to be handled with extreme care (backups recommended to users).
    7.  **Code Quality Checks:**
        *   **Linters/Formatters:** Run ESLint and Prettier (or your chosen tools) across the entire codebase.
        *   **Remove `console.log`s:** Except for intentional debug messages gated by the debug setting.
        *   **Type Safety:** Hunt down any remaining `any` types and replace them with specific types.
        *   **Dead Code:** Remove any unused functions, classes, or old post-processor files if they are now fully handled by the new system.
*   **7.3. Testing Opportunities:**
    *   **End-to-End (Manual):**
        *   Test each Ginko Block type in Live Preview: rendering, interaction, editing.
        *   Test each Ginko Block type in Reading View: rendering, visual consistency with Live Preview.
        *   Test on Canvas.
        *   Test with various themes.
        *   Test settings toggles: do features enable/disable correctly?
        *   Test reset functionality thoroughly (on test vaults!).
    *   **Automated Tests (if time allows beyond unit tests):**
        *   Simple integration tests for the parser + renderer for a few block types.

**Phase 5: Documentation & Contribution Guide (Detailed)**

*   **8.1. Goal:** Make the plugin accessible and easy to contribute to.
*   **8.2. Actions:**
    1.  **`README.md`:**
        *   **High-Level Architecture:** Briefly explain:
            *   The role of `GinkoBlockParser`.
            *   The `GinkoBlockDefinition` interface as the core of a component.
            *   How Live Preview uses `BasePreviewExtension` (or its successor) and `BaseWidget`.
            *   How Reading View uses the main Post Processor and `renderReadingView`.
        *   **Adding a New Ginko Block:** Provide a step-by-step guide:
            1.  Define the syntax (e.g., `::myblock ... ::`).
            2.  Create the `MyBlockWidget.ts` (extending `BaseWidget`).
            3.  Create the `myBlockDefinition.ts` (implementing `GinkoBlockDefinition`), including:
                *   `type`, `startTagRegex`, `endTag`, `partTagRegex` (if any).
                *   `createWidget` function (returns `new MyBlockWidget(...)`).
                *   `renderReadingView` function.
            4.  Register the `myBlockDefinition` in `main.ts` with the `GinkoBlockParser`.
            5.  Add CSS for the new block.
            6.  Add a setting toggle in `settings.ts`.
    2.  **JSDoc/TSDoc Comments:**
        *   Ensure all public classes, methods, interfaces, and complex functions have clear TSDoc comments.
        *   Explain parameters, return types, purpose, and any non-obvious behavior.
        *   **Example for `GinkoBlockParser.parseBlocks`:**
            ```typescript
            /**
             * Parses a given text string to find and extract all recognized Ginko Blocks.
             * Iterates through registered GinkoBlockDefinitions to identify block boundaries
             * and parse their properties and internal parts.
             *
             * @param text The raw Markdown text to parse.
             * @returns An array of ParsedBlock objects, each representing a found Ginko Block.
             *          Returns an empty array if no blocks are found.
             */
            parseBlocks(text: string): ParsedBlock[] { /* ... */ }
            ```
    3.  **`CONTRIBUTING.md` (Create this file):**
        *   **Development Setup:**
            *   How to clone the repository.
            *   Required tools (Node.js, npm/yarn).
            *   How to install dependencies (`npm install`).
            *   How to build the plugin for development (`npm run dev`).
            *   How to load the plugin into Obsidian for testing.
        *   **Coding Style:**
            *   Refer to ESLint/Prettier configurations.
            *   Mention key principles (SRP, DRY, clarity).
            *   Naming conventions (e.g., PascalCase for classes/interfaces, camelCase for functions/variables).
        *   **Branching Strategy:** (e.g., feature branches, pull requests to `develop` or `main`).
        *   **Pull Request Process:**
            *   Ensure tests pass (if automated tests are set up).
            *   Ensure linter passes.
            *   Describe changes clearly in the PR.
        *   **Reporting Bugs/Requesting Features:** Link to GitHub Issues.
    4.  **Code Structure Overview (in `README.md` or a separate `ARCHITECTURE.md`):**
        *   Briefly explain the purpose of key directories:
            *   `src/editor/_base/`: Core abstractions for live preview.
            *   `src/editor/[component-name]/`: Files specific to each Ginko Block.
            *   `src/editor/utils/`: Shared utility functions.
            *   `src/settings/`: Plugin settings UI.
            *   `src/welcome/`: Welcome screen.
            *   `src/main.ts`: Plugin entry point, registration.
*   **8.3. Testing Opportunities:**
    *   Have another developer (or yourself after a break) try to follow the "Adding a New Ginko Block" guide in the `README.md`. Is it clear? Are there missing steps? This is a great way to test your documentation.

