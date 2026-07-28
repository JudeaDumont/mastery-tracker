import type { Effort, Skill } from './model'

export const effortMultiplier: Record<Effort, number> = {
  recovery: 0.5,
  light: 0.75,
  moderate: 1,
  hard: 1.5,
  maximum: 2
}

export interface LevelProgress {
  level: number
  /** Lifetime XP accumulated by the node. */
  currentXp: number
  /** Cumulative XP total required for the next level, or the current cap. */
  requiredXp: number
  overflowXp: number
  maxed: boolean
}

export function earnedXp(minutes: number, effort: Effort, rate = 1): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  return Math.round(minutes * effortMultiplier[effort] * rate)
}

export function levelFor(
  skill: Pick<Skill, 'xp' | 'levelXpRequirements' | 'maxLevel'>
): number {
  let remainingXp = Math.max(0, skill.xp)
  let level = 0

  for (const requiredXp of requirementsFor(skill)) {
    if (remainingXp < requiredXp) break
    remainingXp -= requiredXp
    level += 1
  }

  return level
}

export function levelProgressFor(
  skill: Pick<Skill, 'xp' | 'levelXpRequirements' | 'maxLevel'>
): LevelProgress {
  const requirements = requirementsFor(skill)
  const currentXp = Math.max(0, skill.xp)
  const level = levelFor(skill)
  const maxed = level >= skill.maxLevel
  const totalRequiredXp = requirements.reduce(
    (total, requiredXp) => total + requiredXp,
    0
  )

  if (maxed) {
    return {
      level: skill.maxLevel,
      currentXp,
      requiredXp: totalRequiredXp,
      overflowXp: Math.max(0, currentXp - totalRequiredXp),
      maxed: true
    }
  }

  const requiredXp = requirements
    .slice(0, level + 1)
    .reduce((total, levelRequiredXp) => total + levelRequiredXp, 0)

  return {
    level,
    currentXp,
    requiredXp,
    overflowXp: 0,
    maxed: false
  }
}

export function currentLevelProgressFor(
  skill: Pick<Skill, 'xp' | 'levelXpRequirements' | 'maxLevel'>
): number {
  const requirements = requirementsFor(skill)
  const currentXp = Math.max(0, skill.xp)
  let completedXp = 0

  for (const requiredXp of requirements) {
    const nextTarget = completedXp + requiredXp
    if (currentXp >= nextTarget) {
      completedXp = nextTarget
      continue
    }

    return Math.max(0, Math.min(1, (currentXp - completedXp) / requiredXp))
  }

  return 1
}

export function uniformLevelStepXp(
  skill: Pick<Skill, 'levelXpRequirements' | 'maxLevel'>
): number | null {
  const requirements = requirementsFor(skill)
  const first = requirements[0]
  if (first === undefined) return null
  return requirements.every((requiredXp) => requiredXp === first) ? first : null
}

export function totalXpRequired(
  skill: Pick<Skill, 'levelXpRequirements' | 'maxLevel'>
): number {
  return requirementsFor(skill).reduce((total, requiredXp) => total + requiredXp, 0)
}

export function remainingXpToMax(
  skill: Pick<Skill, 'xp' | 'levelXpRequirements' | 'maxLevel'>
): number {
  return Math.max(0, totalXpRequired(skill) - Math.max(0, skill.xp))
}

export function isMaxLevel(
  skill: Pick<Skill, 'xp' | 'levelXpRequirements' | 'maxLevel'>
): boolean {
  return levelFor(skill) >= skill.maxLevel
}

export function isLocked(skill: Skill, skills: Skill[]): boolean {
  return skill.gates.some((gate) => {
    const source = skills.find((candidate) => candidate.id === gate.nodeId)
    return !source || levelFor(source) < gate.level
  })
}

function requirementsFor(
  skill: Pick<Skill, 'levelXpRequirements' | 'maxLevel'>
): number[] {
  return Array.from({ length: skill.maxLevel }, (_, index) => {
    const configured = skill.levelXpRequirements[index]
    return Number.isFinite(configured) && configured > 0 ? configured : 1
  })
}
