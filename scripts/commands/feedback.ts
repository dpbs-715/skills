import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

import { feedbackEnabled, reportFeedback, setFeedbackEnabled } from '../lib/skillFeedback.ts'

export async function run(args: string[]): Promise<void> {
  const [action, ...rest] = args
  if (rest.length === 0) {
    if (action === 'status') {
      console.log(await feedbackEnabled() ? 'enabled' : 'disabled')
      return
    }
    if (action === 'enable' || action === 'disable') {
      await setFeedbackEnabled(action === 'enable')
      console.log(action === 'enable' ? 'enabled' : 'disabled')
      return
    }
  }
  const [flag, file] = rest
  if (action !== 'report' || rest.length !== 2 || flag !== '--input' || !file)
    throw new Error('Usage: skills feedback enable|disable|status, or skills feedback report --input <json-file|->')
  let input: unknown
  try {
    input = JSON.parse(file === '-' ? readFileSync(0, 'utf8') : await readFile(file, 'utf8'))
  }
  catch {
    throw new Error('Could not read feedback input as JSON.')
  }
  console.log(JSON.stringify(await reportFeedback(input)))
}
