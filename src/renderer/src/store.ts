import { create } from 'zustand'
import type { ActivityEntry, DraftUpdate, Skill, SkillId, SubmitResult } from './model'
import { earnedXp, isLocked, levelFor } from './xp'

const initialSkills: Skill[] = [
  {
    id: 'squat',
    title: 'Squat',
    xp: 145,
    maxLevel: 5,
    thresholds: [100, 300, 600, 1000, 1500],
    heat: 82,
    gates: []
  },
  {
    id: 'deadlift',
    title: 'Deadlift',
    xp: 120,
    maxLevel: 5,
    thresholds: [100, 300, 600, 1000, 1500],
    heat: 67,
    gates: []
  },
  {
    id: 'running',
    title: 'Running',
    xp: 0,
    maxLevel: 3,
    thresholds: [100, 300, 650],
    heat: 18,
    gates: [
      { nodeId: 'squat', level: 2 },
      { nodeId: 'deadlift', level: 2 }
    ]
  }
]

const blankDraft = (): Record<SkillId, DraftUpdate> => ({
  squat: { selected: false, minutes: 60, effort: 'moderate', note: '' },
  deadlift: { selected: false, minutes: 60, effort: 'moderate', note: '' },
  running: { selected: false, minutes: 30, effort: 'moderate', note: '' }
})

interface MasteryStore {
  skills: Skill[]
  draft: Record<SkillId, DraftUpdate>
  history: ActivityEntry[]
  todayXp: number
  lastResult: SubmitResult | null
  toggle: (id: SkillId) => void
  edit: (id: SkillId, patch: Partial<DraftUpdate>) => void
  submit: () => void
}

export const useMastery = create<MasteryStore>((set, get) => ({
  skills: initialSkills,
  draft: blankDraft(),
  history: [],
  todayXp: 0,
  lastResult: null,

  toggle: (id) =>
    set((state) => {
      const skill = state.skills.find((candidate) => candidate.id === id)
      if (!skill || isLocked(skill, state.skills)) return state

      return {
        draft: {
          ...state.draft,
          [id]: { ...state.draft[id], selected: !state.draft[id].selected }
        }
      }
    }),

  edit: (id, patch) =>
    set((state) => ({
      draft: {
        ...state.draft,
        [id]: { ...state.draft[id], ...patch }
      }
    })),

  submit: () => {
    const before = get()
    const oldLevels = new Map(before.skills.map((skill) => [skill.id, levelFor(skill)]))
    const previouslyLocked = new Map(
      before.skills.map((skill) => [skill.id, isLocked(skill, before.skills)])
    )

    let totalXp = 0
    let updatedNodes = 0
    const occurredAt = new Date().toISOString()
    const entries: ActivityEntry[] = []

    const skills = before.skills.map((skill) => {
      const update = before.draft[skill.id]
      if (!update.selected || isLocked(skill, before.skills)) return skill

      const xp = earnedXp(update.minutes, update.effort)
      if (xp <= 0) return skill

      totalXp += xp
      updatedNodes += 1
      entries.push({
        id: `${occurredAt}-${skill.id}`,
        nodeId: skill.id,
        occurredAt,
        minutes: update.minutes,
        effort: update.effort,
        xp,
        note: update.note.trim()
      })

      return {
        ...skill,
        xp: skill.xp + xp,
        heat: Math.min(100, skill.heat + Math.max(3, Math.round(xp / 12)))
      }
    })

    const levelUps = skills.reduce((count, skill) => {
      return count + Math.max(0, levelFor(skill) - (oldLevels.get(skill.id) ?? 0))
    }, 0)

    const unlocked = skills
      .filter((skill) => previouslyLocked.get(skill.id) && !isLocked(skill, skills))
      .map((skill) => skill.title)

    set({
      skills,
      draft: blankDraft(),
      history: [...before.history, ...entries],
      todayXp: before.todayXp + totalXp,
      lastResult: { totalXp, updatedNodes, levelUps, unlocked }
    })
  }
}))

export function projectedXp(update: DraftUpdate): number {
  return update.selected ? earnedXp(update.minutes, update.effort) : 0
}
