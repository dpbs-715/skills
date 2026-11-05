import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

export interface LocalReference {
  kind: 'backtick' | 'markdown'
  path: string
}

export function isRepoPath(root: string, path: string): boolean {
  const relPath = relative(root, path)
  return relPath === '' || (relPath !== '..' && !relPath.startsWith(`..${sep}`) && !isAbsolute(relPath))
}

function withoutCodeExamples(content: string): string {
  let fence: { character: string, length: number } | undefined
  const prose = content.split('\n').map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence) {
      if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim())
        fence = undefined
      return ''
    }
    if (marker) {
      fence = { character: marker[1][0], length: marker[1].length }
      return ''
    }
    return line
  }).join('\n')
  return prose.replace(/(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/g, '')
}

function inlineDestinations(prose: string): string[] {
  const destinations: string[] = []
  const destination = /^\(\s*(<[^>\n]+>|(?:\\.|[^()\s\\]|\([^()\n]*\))+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?\s*\)/
  for (let index = 0; index < prose.length; index += 1) {
    if (prose[index] === '\\') {
      index += 1
      continue
    }
    if (prose[index] !== '[')
      continue
    let depth = 1
    let end = index + 1
    for (; end < prose.length && depth > 0; end += 1) {
      if (prose[end] === '\\')
        end += 1
      else if (prose[end] === '[')
        depth += 1
      else if (prose[end] === ']')
        depth -= 1
    }
    if (depth !== 0)
      continue
    const match = destination.exec(prose.slice(end))
    if (match) {
      destinations.push(match[1])
      index = end + match[0].length - 1
    }
  }
  return destinations
}

function pathWithoutFragment(destination: string): string {
  let path = ''
  for (let index = 0; index < destination.length; index += 1) {
    const character = destination[index]
    if (character === '\\' && /[\p{P}\p{S} ]/u.test(destination[index + 1] ?? '')) {
      path += destination[++index]
    }
    else if (character === '#' || character === '?') {
      break
    }
    else {
      path += character
    }
  }
  return path
}

/** Local destinations in inline links and reference definitions; code examples are ignored. */
export function localMarkdownReferences(content: string, sourcePath: string, root: string): LocalReference[] {
  const prose = withoutCodeExamples(content)
  const destinations = inlineDestinations(prose)
  const definitions = /^ {0,3}\[[^\]\n]+\]:[ \t]*(<[^>\n]+>|\S+)/gm
  for (const match of prose.matchAll(definitions))
    destinations.push(match[1])

  const references: LocalReference[] = []
  for (const raw of destinations) {
    const destination = raw.replace(/^<|>$/g, '').replaceAll('{{REPO_ROOT}}', root)
    if (/^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith('//'))
      continue
    const target = pathWithoutFragment(destination)
    if (!target)
      continue
    let decoded: string
    try { decoded = decodeURIComponent(target) }
    catch { decoded = target }
    const path = resolve(dirname(sourcePath), decoded)
    if (isRepoPath(root, path))
      references.push({ kind: 'markdown', path })
  }

  for (const match of content.replaceAll('{{REPO_ROOT}}', root).matchAll(/`([^`\n]+)`/g)) {
    const path = match[1].trim()
    if (isAbsolute(path) && isRepoPath(root, path))
      references.push({ kind: 'backtick', path })
  }
  return references.filter((item, index) => references.findIndex(other => other.kind === item.kind && other.path === item.path) === index)
}
