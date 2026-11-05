import assert from 'node:assert/strict'
import test from 'node:test'

import { isRepoPath, localMarkdownReferences } from '../lib/markdownReferences.ts'

test('resolves placeholders in a checkout with spaces and supports reference definitions', () => {
  const root = '/tmp/skills repo'
  assert.deepEqual(localMarkdownReferences('[Rule]({{REPO_ROOT}}/rules/entry.md#scope)\n[Guide][g]\n[g]: <references/with space.md> "Title"', `${root}/skills/sample/SKILL.md`, root), [
    { kind: 'markdown', path: `${root}/rules/entry.md` },
    { kind: 'markdown', path: `${root}/skills/sample/references/with space.md` },
  ])
})

test('ignores inline code and fenced examples with longer closing fences or no closing fence', () => {
  const content = ['`[Example](one.md)`', '```md', '[Example](two.md)', '````', '[Real](real.md)', '~~~md', '[Example](three.md)'].join('\n')
  assert.deepEqual(localMarkdownReferences(content, '/repo/SKILL.md', '/repo'), [{ kind: 'markdown', path: '/repo/real.md' }])
})

test('keeps repo-relative dot-prefixed names and excludes paths outside the root', () => {
  assert.equal(isRepoPath('/repo', '/repo/..notes.md'), true)
  assert.equal(isRepoPath('/repo', '/repo-other/entry.md'), false)
  assert.equal(isRepoPath('/repo', '/entry.md'), false)
})

test('supports nested link labels and escaped filename fragments without reading multiline code spans', () => {
  const content = [
    '[Guide [v2]](guide\\#v2.md#section)',
    '`Multiline code', '[Example](missing.md)', 'end`',
    '``Multi ` code', '[Example](also-missing.md)', 'end``',
    '[Encoded](guide%23v2.md)',
  ].join('\n')
  assert.deepEqual(localMarkdownReferences(content, '/repo/SKILL.md', '/repo'), [{ kind: 'markdown', path: '/repo/guide#v2.md' }])
})
