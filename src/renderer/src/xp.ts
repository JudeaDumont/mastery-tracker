import type { Effort, Skill } from './model'

export const effortMultiplier: Record<Effort, number> = {
  recovery: 0.5,
  light: 0.75,
  moderate: 1,
  hard: 1.5,
  maximum: 2
}

export function earnedXp(minutes: number, effort: Effort, rate = 1): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  return Math.round(minutes * effortMultiplier[effort] * rate)
}

export function levelFor(skill: Pick<Skill, 'xp' | 'thresholds' | 'maxLevel'>): number {
  return Math.min(
    skill.maxLevel,
    skill.thresholds.reduce((level, threshold) => level + (skill.xp >= threshold ? 1 : 0), 0)
  )
}

export function isLocked(skill: Skill, skills: Skill[]): boolean {
  return skill.gates.some((gate) => {
    const source = skills.find((candidate) => candidate.id === gate.nodeId)
    return !source || levelFor(source) < gate.level
  })
}
