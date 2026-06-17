import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// Minimal, dependency-light lint: official eslint + typescript-eslint.
// Covers correctness (unused imports/vars, etc.); no style/formatting rules.
// Generated and third-party skill output is ignored, as is Markdown prose.
export default tseslint.config(
  { ignores: ['.idea/**', '.obsidian/**', 'vendor/**', 'sources/**', 'skills/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
)
