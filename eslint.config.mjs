import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['node_modules/', '**/node_modules/**/', 'main.js', '**/main.js/**'],
})
