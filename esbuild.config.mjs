import process from 'node:process'
import builtins from 'builtin-modules'
import * as dotenv from 'dotenv'
import esbuild from 'esbuild'

const banner
  = `/*
THIS IS A PLUGIN BUILT BY LUPINUM 
if you want to view the source, please visit the github repository of this plugin
https://github.com/lupinum-dev/ginko-blocks
*/
`

const prod = (process.argv[2] === 'production')
dotenv.config()

const context = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: [
    './src/main.ts',
    './src/styles.css',
  ],
  bundle: true,
  platform: 'node',
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outdir: process.env.OUTPATH || './',
  outbase: 'src',
  entryNames: '[name]',
  minify: prod,
  loader: { '.css': 'css' },
})

if (prod) {
  await context.rebuild()
  process.exit(0)
}
else {
  await context.watch()
}
