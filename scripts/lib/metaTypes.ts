export interface DirectorySkillSource {
  kind: 'directory'
  name: string
  path: string
}

export interface DocumentSkillSource {
  description: string
  instructions: readonly string[]
  kind: 'document'
  name: string
  shortDescription?: string
  source: string
  title: string
}

export type LocalSkillSource = DirectorySkillSource | DocumentSkillSource

export interface VendorSkillMeta {
  source: string
  skills: Record<string, string>
}

export interface DirectoryLinkTarget {
  dir: string
  kind: 'skill' | 'rule'
  include: readonly string[]
}

export interface JsonArrayConfigTarget {
  file: string
  kind: 'json-array'
  property: string
  include: readonly string[]
}

export type LinkTarget = DirectoryLinkTarget | JsonArrayConfigTarget
