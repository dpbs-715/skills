export interface VendorSkillMeta {
  source: string
  skills: Record<string, string>
}

export const rules = [
  'engineering',
] as const

export const manual = [
  'engineering-rules',
  'personal-knowledge',
] as const

export const sources = {} as const

export const vendors: Record<string, VendorSkillMeta> = {

}
