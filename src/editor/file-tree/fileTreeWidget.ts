import type { EditorView } from '@codemirror/view'
import type { App } from 'obsidian'
import { BaseWidget } from '../_base/baseWidget'
import { createIconElement, parseBlockProperties } from '../utils'

interface FileTreeNode {
  name: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
  highlighted?: boolean
}

export class FileTreeWidget extends BaseWidget {
  private showIcons: boolean = true

  constructor({ content, id, app }: { content: string, id: string, app: App }) {
    super({ content, id, app })
    const properties = this.parseProperties()
    this.showIcons = properties['no-icons'] !== true
  }

  protected createPreviewView(_view: EditorView): HTMLElement {
    const container = this.createContainer('ginko-filetree-container')
    const tree = this.parseFileTree()

    // Create the tree view
    const treeView = this.createTreeView(tree)
    container.appendChild(treeView)

    // Add edit button
    const editButton = this.createEditButton(() => {
      // Handle edit click
    })
    container.appendChild(editButton)

    return container
  }

  private parseProperties(): Record<string, boolean> {
    const firstLine = this.content.split('\n')[0]
    const props = parseBlockProperties(firstLine, /::file-tree\((.*?)\)/)
    return Object.fromEntries(
      Object.entries(props)
        .filter(([_, value]) => typeof value === 'boolean'),
    ) as Record<string, boolean>
  }

  private parseFileTree(): FileTreeNode[] {
    const lines = this.content
      .split('\n')
      .filter(line => line.trim())
      .filter(line => !line.startsWith('::file-tree') && line !== '::')

    const tree: FileTreeNode[] = []
    const stack: { node: FileTreeNode, level: number }[] = []

    for (const line of lines) {
      const level = (line.match(/^\s*/)?.[0].length || 0) / 2
      const name = line.trim().replace(/^[-+*]\s*/, '')
      const isHighlighted = name.startsWith('^') && name.endsWith('^')
      const cleanName = isHighlighted ? name.slice(1, -1) : name

      const node: FileTreeNode = {
        name: cleanName,
        type: cleanName.endsWith('/') ? 'folder' : 'file',
        highlighted: isHighlighted,
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      if (stack.length === 0) {
        tree.push(node)
      }
      else {
        const parent = stack[stack.length - 1].node
        if (!parent.children)
          parent.children = []
        parent.children.push(node)
      }

      if (node.type === 'folder') {
        stack.push({ node, level })
      }
    }

    return tree
  }

  private createTreeView(nodes: FileTreeNode[]): HTMLElement {
    const list = document.createElement('ul')
    list.className = 'ginko-filetree-list'

    for (const node of nodes) {
      const item = document.createElement('li')
      item.className = 'ginko-filetree-item'
      if (node.highlighted)
        item.classList.add('highlighted')

      const itemContent = document.createElement('div')
      itemContent.className = 'ginko-filetree-item-content'

      // Create icon if enabled
      if (this.showIcons) {
        const iconContainer = document.createElement('span')
        iconContainer.className = 'ginko-filetree-icon'
        itemContent.appendChild(iconContainer)

        // Load icon asynchronously
        const iconName = node.type === 'folder' ? 'lucide:folder' : this.getFileIcon(node.name)
        createIconElement(iconName).then((iconEl) => {
          if (iconEl) {
            iconContainer.appendChild(iconEl)
          }
        })
      }

      // Add name
      const nameSpan = document.createElement('span')
      nameSpan.textContent = node.name
      nameSpan.className = 'ginko-filetree-name'
      itemContent.appendChild(nameSpan)

      item.appendChild(itemContent)

      // Add children
      if (node.children) {
        const childList = this.createTreeView(node.children)
        item.appendChild(childList)
      }

      list.appendChild(item)
    }

    return list
  }

  private getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()

    // Define common file type icons
    const iconMap: Record<string, string> = {
      js: 'lucide:file-code',
      ts: 'lucide:file-code',
      jsx: 'lucide:file-code',
      tsx: 'lucide:file-code',
      vue: 'lucide:file-code',
      css: 'lucide:file-type',
      scss: 'lucide:file-type',
      html: 'lucide:file-code',
      md: 'lucide:file-text',
      json: 'lucide:file-json',
      // Add more file types as needed
    }

    return iconMap[ext || ''] || 'lucide:file'
  }
}
