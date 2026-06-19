import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

import { repoRoot } from '../lib/utils.ts'

test('repoRoot resolves to the repository root regardless of caller depth', async () => {
  const root = repoRoot()

  // The repo root is the directory that holds package.json and meta.ts,
  // two levels up from this file in scripts/tests/.
  await assert.doesNotReject(access(join(root, 'package.json')))
  await assert.doesNotReject(access(join(root, 'meta.ts')))
})
