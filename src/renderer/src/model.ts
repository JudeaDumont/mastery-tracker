export type SkillId = 'squat' | 'deadlift' | 'running'

export type Effort = 'recovery' | 'light' | 'moderate' | 'hard' | 'maximum'

export interface Gate {
  nodeId: SkillId
  level: number
}

export interface Skill {
  id: SkillId
  title: string
  xp: number
  maxLevel: number
  thresholds: number[]
  heat: number
  gates: Gate[]
}

export interface DraftUpdate {
  selected: boolean
  minutes: number
  effort: Effort
  note: string
}

export interface ActivityEntry {
  id: string
  nodeId: SkillId
  occurredAt: string
  minutes: number
  effort: Effort
  xp: number
  note: string
}

export interface SubmitResult {
  totalXp: number
  updatedNodes: number
  levelUps: number
  unlocked: string[]
}
