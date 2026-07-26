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
  currentXp: number
  requiredXp: number
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
  const level = levelFor(skill)
  const maxed = level >= skill.maxLevel

  if (maxed) {
    return {
      level: skill.maxLevel,
      currentXp: 0,
      requiredXp: 0,
      maxed: true
    }
  }

  const completedLevelXp = requirements
    .slice(0, level)
    .reduce((total, requiredXp) => total + requiredXp, 0)
  const requiredXp = requirements[level]

  return {
    level,
    currentXp: Math.max(0, Math.min(requiredXp, skill.xp - completedLevelXp)),
    requiredXp,
    maxed: false
  }
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
