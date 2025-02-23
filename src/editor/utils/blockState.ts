interface BlockState {
  [blockId: string]: {
    type: 'tab' | 'callout'
    state: any
    lastModified: number // Unix timestamp in milliseconds
  }
}

const STORAGE_KEY = 'ginko-block-state'
const EXPIRY_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Clean up expired block states (older than 30 days)
 */
export function cleanupExpiredStates(): void {
  const states = loadBlockStates()
  const now = Date.now()
  let hasChanges = false

  for (const [blockId, blockState] of Object.entries(states)) {
    if (now - blockState.lastModified > EXPIRY_DAYS * MS_PER_DAY) {
      delete states[blockId]
      hasChanges = true
    }
  }

  if (hasChanges) {
    saveBlockStates(states)
  }
}

/**
 * Load the entire block state from localStorage
 */
function loadBlockStates(): BlockState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  }
  catch (e) {
    console.warn('Failed to load block states:', e)
  }
  return {}
}

/**
 * Save the entire block state to localStorage
 */
function saveBlockStates(states: BlockState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states))
  }
  catch (e) {
    console.warn('Failed to save block states:', e)
  }
}

/**
 * Get state for a specific block
 */
export function getBlockState<T>(blockId: string, type: 'tab' | 'callout', defaultValue: T): T {
  const states = loadBlockStates()
  const blockState = states[blockId]
  if (blockState && blockState.type === type) {
    // Update last modified time on access
    blockState.lastModified = Date.now()
    saveBlockStates(states)
    return blockState.state as T
  }
  return defaultValue
}

/**
 * Set state for a specific block
 */
export function setBlockState<T>(blockId: string, type: 'tab' | 'callout', state: T): void {
  const states = loadBlockStates()
  states[blockId] = {
    type,
    state,
    lastModified: Date.now()
  }
  saveBlockStates(states)
}

/**
 * Remove state for a specific block
 */
export function removeBlockState(blockId: string): void {
  const states = loadBlockStates()
  delete states[blockId]
  saveBlockStates(states)
}

/**
 * Clear all block states
 */
export function clearBlockStates(): void {
  localStorage.removeItem(STORAGE_KEY)
} 