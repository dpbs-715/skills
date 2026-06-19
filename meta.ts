export interface VendorSkillMeta {
  source: string
  skills: Record<string, string>
}

export const templateSkills = [
  'engineering-rules',
  'personal-knowledge',
] as const

export const linkedSkills = [
  'engineering-rules',
  'personal-knowledge',
] as const

export const vendors: Record<string, VendorSkillMeta> = {

}
