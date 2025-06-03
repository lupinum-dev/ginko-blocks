import { vi } from 'vitest'

// Mock @codemirror modules
vi.mock('@codemirror/state', () => ({
  Transaction: class MockTransaction { },
  SelectionRange: class MockSelectionRange { },
}))

vi.mock('@codemirror/view', () => ({
  ViewUpdate: class MockViewUpdate { },
}))

// Mock obsidian
vi.mock('obsidian', () => ({
  getIcon: vi.fn(() => ({
    outerHTML: '<svg></svg>',
    cloneNode: vi.fn(),
  })),
  Component: class MockComponent { },
  Plugin: class MockPlugin { },
  Setting: class MockSetting { },
  PluginSettingTab: class MockPluginSettingTab { },
})) 