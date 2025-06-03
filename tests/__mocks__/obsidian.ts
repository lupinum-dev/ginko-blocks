// Mock for obsidian module
export const getIcon = (iconName: string) => {
  const mockElement = {
    outerHTML: `<svg><use href="#${iconName}"></use></svg>`,
    cloneNode: () => mockElement,
  }
  return mockElement
}

export class Component {
  // Mock component class
}

export class Plugin {
  // Mock plugin class
}

export class Setting {
  // Mock setting class
}

export class PluginSettingTab {
  // Mock plugin setting tab class
} 