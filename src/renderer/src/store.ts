import { create } from 'zustand'
import type {
  ActivityEntry,
  CreateDraft,
  DraftUpdate,
  Link,
  NodeId,
  Root,
  RootId,
  Skill,
  SkillId,
  SubmitResult
} from './model'
import { earnedXp, isLocked, levelFor } from './xp'

export const NODE_CAPACITY = 4
export const ROOT_CAPACITY = 8

const initialRoots: Root[] = [{ id: 'lifter', title: 'Lifter' }]

const levelXpRequirements = [100, 180, 275, 425, 650]

const initialSkills: Skill[] = [
  {
    id: 'a',
    rootId: 'lifter',
    title: 'A',
    xp: 145,
    maxLevel: 5,
    levelXpRequirements,
    heat: 35,
    gates: []
  },
  {
    id: 'b',
    rootId: 'lifter',
    title: 'B',
    xp: 1200,
    maxLevel: 5,
    levelXpRequirements,
    heat: 65,
    gates: []
  },
  {
    id: 'c',
    rootId: 'lifter',
    title: 'C',
    xp: 350,
    maxLevel: 5,
    levelXpRequirements,
    heat: 42,
    gates: []
  },
  {
    id: 'd',
    rootId: 'lifter',
    title: 'D',
    xp: 650,
    maxLevel: 5,
    levelXpRequirements,
    heat: 58,
    gates: []
  },
  {
    id: 'e',
    rootId: 'lifter',
    title: 'E',
    xp: 420,
    maxLevel: 5,
    levelXpRequirements,
    heat: 70,
    gates: []
  },
  {
    id: 'f',
    rootId: 'lifter',
    title: 'F',
    xp: 1350,
    maxLevel: 5,
    levelXpRequirements,
    heat: 62,
    gates: []
  },
  {
    id: 'g',
    rootId: 'lifter',
    title: 'G',
    xp: 1880,
    maxLevel: 5,
    levelXpRequirements,
    heat: 50,
    gates: []
  },
  {
    id: 'h',
    rootId: 'lifter',
    title: 'H',
    xp: 1050,
    maxLevel: 5,
    levelXpRequirements,
    heat: 68,
    gates: []
  },
  {
    id: 'i',
    rootId: 'lifter',
    title: 'I',
    xp: 0,
    maxLevel: 5,
    levelXpRequirements,
    heat: 18,
    gates: [
      { nodeId: 'a', level: 2 },
      { nodeId: 'b', level: 3 },
      { nodeId: 'c', level: 3 },
      { nodeId: 'd', level: 4 },
      { nodeId: 'e', level: 2 },
      { nodeId: 'f', level: 4 },
      { nodeId: 'g', level: 5 },
      { nodeId: 'h', level: 5 }
    ]
  },
  {
    id: 'j',
    rootId: 'lifter',
    title: 'J',
    xp: 0,
    maxLevel: 5,
    levelXpRequirements,
    heat: 24,
    gates: [
      { nodeId: 'a', level: 2 },
      { nodeId: 'b', level: 3 },
      { nodeId: 'c', level: 3 },
      { nodeId: 'd', level: 4 },
      { nodeId: 'e', level: 2 },
      { nodeId: 'f', level: 4 },
      { nodeId: 'g', level: 5 },
      { nodeId: 'h', level: 5 }
    ]
  }
]

const initialLinks: Link[] = [
  { id: 'lifter-a', from: 'lifter', to: 'a' },
  { id: 'lifter-b', from: 'lifter', to: 'b' },
  { id: 'lifter-c', from: 'lifter', to: 'c' },
  { id: 'lifter-d', from: 'lifter', to: 'd' },
  { id: 'lifter-e', from: 'lifter', to: 'e' },
  { id: 'lifter-f', from: 'lifter', to: 'f' },
  { id: 'lifter-g', from: 'lifter', to: 'g' },
  { id: 'lifter-h', from: 'lifter', to: 'h' },
  { id: 'a-i', from: 'a', to: 'i' },
  { id: 'b-i', from: 'b', to: 'i' },
  { id: 'c-i', from: 'c', to: 'i' },
  { id: 'd-i', from: 'd', to: 'i' },
  { id: 'e-i', from: 'e', to: 'i' },
  { id: 'f-i', from: 'f', to: 'i' },
  { id: 'g-i', from: 'g', to: 'i' },
  { id: 'h-i', from: 'h', to: 'i' },
  { id: 'a-j', from: 'a', to: 'j' },
  { id: 'b-j', from: 'b', to: 'j' },
  { id: 'c-j', from: 'c', to: 'j' },
  { id: 'd-j', from: 'd', to: 'j' },
  { id: 'e-j', from: 'e', to: 'j' },
  { id: 'f-j', from: 'f', to: 'j' },
  { id: 'g-j', from: 'g', to: 'j' },
  { id: 'h-j', from: 'h', to: 'j' }
]

function draftFor(skills: Skill[]): Record<SkillId, DraftUpdate> {
  return Object.fromEntries(
    skills.map((skill) => [
      skill.id,
      {
        selected: false,
        minutes: skill.id === 'running' ? 30 : 60,
        effort: 'moderate',
        note: ''
      }
    ])
  )
}

interface MasteryStore {
  roots: Root[]
  skills: Skill[]
  links: Link[]
  pickedIds: NodeId[]
  create: CreateDraft | null
  draft: Record<SkillId, DraftUpdate>
  history: ActivityEntry[]
  todayXp: number
  lastResult: SubmitResult | null
  lastCreated: string | null
  toggle: (id: SkillId) => void
  edit: (id: SkillId, patch: Partial<DraftUpdate>) => void
  submit: () => void
  togglePicked: (id: NodeId) => void
  beginCreate: () => void
  setCreateTitle: (title: string) => void
  toggleCreateNode: (id: NodeId) => void
  clearCreateSelection: () => void
  continueCreate: () => void
  escapeCreate: () => void
}

export const useMastery = create<MasteryStore>((set, get) => ({
  roots: initialRoots,
  skills: initialSkills,
  links: initialLinks,
  pickedIds: [],
  create: null,
  draft: draftFor(initialSkills),
  history: [],
  todayXp: 0,
  lastResult: null,
  lastCreated: null,

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
      if (!update?.selected || isLocked(skill, before.skills)) return skill

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
      draft: draftFor(skills),
      pickedIds: [],
      history: [...before.history, ...entries],
      todayXp: before.todayXp + totalXp,
      lastResult: { totalXp, updatedNodes, levelUps, unlocked }
    })
  },

  togglePicked: (id) =>
    set((state) => {
      const picked = state.pickedIds.includes(id)
      const pickedIds = picked
        ? state.pickedIds.filter((pickedId) => pickedId !== id)
        : [...state.pickedIds, id]
      const skill = state.skills.find((candidate) => candidate.id === id)

      if (!skill) return { pickedIds }

      const selected = !picked && !isLocked(skill, state.skills)

      return {
        pickedIds,
        draft: {
          ...state.draft,
          [id]: { ...state.draft[id], selected }
        }
      }
    }),

  beginCreate: () =>
    set((state) => ({
      create: {
        step: 'from',
        title: 'New mastery',
        fromIds: normalizedInitialFrom(state.pickedIds, state.roots, state.skills, state.links),
        toIds: []
      },
      lastCreated: null
    })),

  setCreateTitle: (title) =>
    set((state) => ({
      create: state.create ? { ...state.create, title } : null
    })),

  toggleCreateNode: (id) =>
    set((state) => {
      const draft = state.create
      if (!draft) return state

      if (draft.step === 'from') {
        const fromIds = toggleFromId(id, draft.fromIds, state.roots, state.skills, state.links)
        return { create: { ...draft, fromIds, toIds: [] } }
      }

      const selected = draft.toIds.includes(id)
      if (selected) {
        return { create: { ...draft, toIds: draft.toIds.filter((nodeId) => nodeId !== id) } }
      }

      const candidates = toCandidateIds(state.roots, state.skills, state.links, draft)
      if (!candidates.has(id) || createSelectionFull(draft)) return state

      return { create: { ...draft, toIds: [...draft.toIds, id] } }
    }),

  clearCreateSelection: () =>
    set((state) => {
      if (!state.create) return state
      return {
        create:
          state.create.step === 'from'
            ? { ...state.create, fromIds: [], toIds: [] }
            : { ...state.create, toIds: [] }
      }
    }),

  continueCreate: () => {
    const state = get()
    const draft = state.create
    if (!draft || !draft.title.trim()) return

    if (draft.step === 'from' && draft.fromIds.length === 0) {
      const id = uniqueId(draft.title, allNodeIds(state.roots, state.skills))
      const root: Root = { id, title: draft.title.trim() }
      set({
        roots: [...state.roots, root],
        create: null,
        pickedIds: [id],
        lastCreated: `${root.title} root created`
      })
      return
    }

    if (draft.step === 'from') {
      set({ create: { ...draft, step: 'to', toIds: [] } })
      return
    }

    const rootId = rootForIds(draft.fromIds, state.roots, state.skills)
    if (!rootId) return

    const id = uniqueId(draft.title, allNodeIds(state.roots, state.skills))
    const skill: Skill = {
      id,
      rootId,
      title: draft.title.trim(),
      xp: 0,
      maxLevel: 3,
      levelXpRequirements: [100, 200, 300],
      heat: 0,
      gates: []
    }
    const links = [
      ...state.links,
      ...draft.fromIds.map((from) => ({ id: `${from}-${id}`, from, to: id })),
      ...draft.toIds.map((to) => ({ id: `${id}-${to}`, from: id, to }))
    ]

    set({
      skills: [...state.skills, skill],
      links,
      draft: {
        ...state.draft,
        [id]: { selected: true, minutes: 60, effort: 'moderate', note: '' }
      },
      create: null,
      pickedIds: [id],
      lastCreated: `${skill.title} created and placed automatically`
    })
  },

  escapeCreate: () =>
    set((state) => {
      if (!state.create) return state
      if (state.create.step === 'to') {
        return { create: { ...state.create, step: 'from', toIds: [] } }
      }
      return { create: null }
    })
}))

export function projectedXp(update: DraftUpdate, skill: Skill): number {
  if (!update.selected) return 0
  return earnedXp(update.minutes, update.effort)
}

export function nodeTitle(id: NodeId, roots: Root[], skills: Skill[]): string {
  return roots.find((root) => root.id === id)?.title
    ?? skills.find((skill) => skill.id === id)?.title
    ?? id
}

export function nodeRootId(id: NodeId, roots: Root[], skills: Skill[]): RootId | undefined {
  const root = roots.find((candidate) => candidate.id === id)
  if (root) return root.id
  return skills.find((skill) => skill.id === id)?.rootId
}

export function createSelectionFull(draft: CreateDraft): boolean {
  return draft.fromIds.length + draft.toIds.length >= NODE_CAPACITY
}

export function canUseFromNode(id: NodeId, roots: Root[], links: Link[]): boolean {
  const capacity = roots.some((root) => root.id === id) ? ROOT_CAPACITY : NODE_CAPACITY
  return degreeFor(id, links) < capacity
}

export function toCandidateIds(
  roots: Root[],
  skills: Skill[],
  links: Link[],
  draft: CreateDraft
): Set<NodeId> {
  if (draft.step !== 'to') return new Set()
  const rootId = rootForIds(draft.fromIds, roots, skills)
  if (!rootId) return new Set()

  return new Set(
    skills
      .filter((skill) => skill.rootId === rootId)
      .filter((skill) => !draft.fromIds.includes(skill.id))
      .filter((skill) => degreeFor(skill.id, links) < NODE_CAPACITY)
      .filter((skill) => !draft.fromIds.some((source) => hasPath(skill.id, source, links)))
      .map((skill) => skill.id)
  )
}

function normalizedInitialFrom(
  ids: NodeId[],
  roots: Root[],
  skills: Skill[],
  links: Link[]
): NodeId[] {
  if (ids.length === 0) return []
  const rootId = nodeRootId(ids[0], roots, skills)
  if (!rootId) return []
  return ids
    .filter((id) => nodeRootId(id, roots, skills) === rootId)
    .filter((id) => canUseFromNode(id, roots, links))
    .slice(0, NODE_CAPACITY)
}

function toggleFromId(
  id: NodeId,
  current: NodeId[],
  roots: Root[],
  skills: Skill[],
  links: Link[]
): NodeId[] {
  if (current.includes(id)) return current.filter((nodeId) => nodeId !== id)

  const rootId = nodeRootId(id, roots, skills)
  if (!rootId || !canUseFromNode(id, roots, links)) return current
  const currentRoot = current.length > 0 ? nodeRootId(current[0], roots, skills) : rootId

  if (currentRoot !== rootId) return [id]
  if (current.length >= NODE_CAPACITY) return current
  return [...current, id]
}

function rootForIds(ids: NodeId[], roots: Root[], skills: Skill[]): RootId | undefined {
  return ids.length > 0 ? nodeRootId(ids[0], roots, skills) : undefined
}

function degreeFor(id: NodeId, links: Link[]): number {
  return links.filter((link) => link.from === id || link.to === id).length
}

function hasPath(from: NodeId, to: NodeId, links: Link[]): boolean {
  const stack = [from]
  const visited = new Set<NodeId>()

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    if (current === to) return true
    visited.add(current)
    links
      .filter((link) => link.from === current)
      .forEach((link) => stack.push(link.to))
  }

  return false
}

function allNodeIds(roots: Root[], skills: Skill[]): Set<NodeId> {
  return new Set([...roots.map((root) => root.id), ...skills.map((skill) => skill.id)])
}

function uniqueId(title: string, ids: Set<NodeId>): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'node'
  let id = base
  let suffix = 2
  while (ids.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  return id
}
