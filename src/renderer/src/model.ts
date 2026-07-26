export type NodeId = string
export type SkillId = string
export type RootId = string
export type RootAccent = 'teal' | 'violet' | 'amber' | 'rose' | 'green' | 'blue'

export type Effort = 'recovery' | 'light' | 'moderate' | 'hard' | 'maximum'

export interface Root {
  id: RootId
  title: string
  accent?: RootAccent
}

export interface Link {
  id: string
  from: NodeId
  to: NodeId
}

export interface Gate {
  nodeId: SkillId
  level: number
}

export interface Skill {
  id: SkillId
  rootId: RootId
  title: string
  xp: number
  maxLevel: number
  levelXpRequirements: number[]
  levelReachedAt?: Array<string | null>
  momentum: number
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

export type CreateStep = 'from' | 'to'

export interface CreateDraft {
  step: CreateStep
  title: string
  fromIds: NodeId[]
  toIds: NodeId[]
}
