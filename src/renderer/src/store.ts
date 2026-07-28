import { create } from 'zustand'
import type {
  ActivityEntry,
  CreateDraft,
  DraftUpdate,
  GraphStateSnapshot,
  Link,
  NodeId,
  Root,
  RootAccent,
  RootId,
  Skill,
  SkillId,
  SubmitResult
} from './model'
import { earnedXp, isLocked, levelFor } from './xp'

export const MAX_INCOMING_RELATIONSHIPS = 8
export const MAX_OUTGOING_RELATIONSHIPS = 8

export const ROOT_ACCENTS: RootAccent[] = ['teal', 'violet', 'amber', 'rose', 'green', 'blue']

const initialRoots: Root[] = [{ id: 'lifter', title: 'Lifter', accent: 'teal' }]

const levelXpRequirements = [100, 180, 275, 425, 650]

const reached = (...dates: string[]): Array<string | null> => dates

const initialSkills: Skill[] = [
  {
    id: 'a',
    rootId: 'lifter',
    title: 'A',
    xp: 145,
    maxLevel: 5,
    levelXpRequirements,
    levelReachedAt: reached(
      '2026-06-02T14:00:00.000Z'
    ),
    momentum: 6,
    gates: []
  },
  {
    id: 'b',
    rootId: 'lifter',
    title: 'B',
    xp: 1200,
    maxLevel: 5,
    levelXpRequirements,
    levelReachedAt: reached(
      '2026-01-12T14:00:00.000Z',
      '2026-02-21T14:00:00.000Z',
      '2026-04-03T14:00:00.000Z',
      '2026-06-28T14:00:00.000Z'
    ),
    momentum: 73,
    gates: []
  },
  {
    id: 'c',
    rootId: 'lifter',
    title: 'C',
    xp: 350,
    maxLevel: 5,
    levelXpRequirements,
    levelReachedAt: reached(
      '2026-03-05T14:00:00.000Z',
      '2026-05-14T14:00:00.000Z'
    ),
    momentum: 28,
    gates: []
  },
  {
    id: 'd',
    rootId: 'lifter',
    title: 'D',
    xp: 650,
    maxLevel: 5,
    levelXpRequirements,
    levelReachedAt: reached(
      '2026-01-27T14:00:00.000Z',
      '2026-03-18T14:00:00.000Z',
      '2026-06-11T14:00:00.000Z'
    ),
    momentum: 54,
    gates: []
  },
  {
    id: 'e',
    rootId: 'lifter',
    title: 'E',
    xp: 420,
    maxLevel: 5,
    levelXpRequirements,
    levelReachedAt: reached(
      '2026-04-08T14:00:00.000Z',
      '2026-07-01T14:00:00.000Z'
    ),
    momentum: 15,
    gates: []
  },
  {
    id: 'f',
    rootId: 'lifter',
    title: 'F',
    xp: 1350,
    maxLevel: 5,
    levelXpRequirements,
    levelReachedAt: reached(
      '2026-01-09T14:00:00.000Z',
      '2026-02-18T14:00:00.000Z',
      '2026-04-30T14:00:00.000Z',
      '2026-07-10T14:00:00.000Z'
    ),
    momentum: 87,
    gates: []
  },
  {
    id: 'g',
    rootId: 'lifter',
    title: 'G',
    xp: 1880,
    maxLevel: 5,
    levelXpRequirements,
    levelReachedAt: reached(
      '2025-12-18T14:00:00.000Z',
      '2026-01-29T14:00:00.000Z',
      '2026-03-20T14:00:00.000Z',
      '2026-05-22T14:00:00.000Z',
      '2026-07-18T14:00:00.000Z'
    ),
    momentum: 41,
    gates: []
  },
  {
    id: 'h',
    rootId: 'lifter',
    title: 'H',
    xp: 1050,
    maxLevel: 5,
    levelXpRequirements,
    levelReachedAt: reached(
      '2026-01-20T14:00:00.000Z',
      '2026-03-02T14:00:00.000Z',
      '2026-05-07T14:00:00.000Z',
      '2026-07-14T14:00:00.000Z'
    ),
    momentum: 100,
    gates: []
  },
  {
    id: 'i',
    rootId: 'lifter',
    title: 'I',
    xp: 0,
    maxLevel: 5,
    levelXpRequirements,
    levelReachedAt: [],
    momentum: 22,
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
    levelReachedAt: [],
    momentum: 64,
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
  deleteNode: (id: NodeId) => void
  beginCreate: () => void
  setCreateTitle: (title: string) => void
  setCreateAccent: (accent: RootAccent) => void
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

      const updatedSkill: Skill = {
        ...skill,
        xp: skill.xp + xp,
        momentum: Math.min(100, skill.momentum + Math.max(3, Math.round(xp / 12)))
      }

      return recordReachedLevels(updatedSkill, oldLevels.get(skill.id) ?? 0, occurredAt)
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

  deleteNode: (id) =>
    set((state) => {
      const root = state.roots.find((candidate) => candidate.id === id)
      const skill = state.skills.find((candidate) => candidate.id === id)
      if (!root && !skill) return state

      const deletedSkillIds = new Set<SkillId>(
        root
          ? state.skills
              .filter((candidate) => candidate.rootId === root.id)
              .map((candidate) => candidate.id)
          : [id as SkillId]
      )
      const deletedNodeIds = new Set<NodeId>(
        root ? [root.id, ...deletedSkillIds] : deletedSkillIds
      )
      const removedHistory = state.history.filter((entry) => deletedSkillIds.has(entry.nodeId))
      const removedTodayXp = removedHistory
        .filter((entry) => isSameLocalDay(entry.occurredAt, new Date()))
        .reduce((sum, entry) => sum + entry.xp, 0)
      const draft = Object.fromEntries(
        Object.entries(state.draft).filter(([skillId]) => !deletedSkillIds.has(skillId))
      ) as Record<SkillId, DraftUpdate>
      const create = state.create
        ? {
            ...state.create,
            fromIds: state.create.fromIds.filter((nodeId) => !deletedNodeIds.has(nodeId)),
            toIds: state.create.toIds.filter((nodeId) => !deletedNodeIds.has(nodeId))
          }
        : null

      return {
        roots: root ? state.roots.filter((candidate) => candidate.id !== root.id) : state.roots,
        skills: state.skills
          .filter((candidate) => !deletedSkillIds.has(candidate.id))
          .map((candidate) => ({
            ...candidate,
            gates: candidate.gates.filter((gate) => !deletedSkillIds.has(gate.nodeId))
          })),
        links: state.links.filter(
          (link) => !deletedNodeIds.has(link.from) && !deletedNodeIds.has(link.to)
        ),
        history: state.history.filter((entry) => !deletedSkillIds.has(entry.nodeId)),
        todayXp: Math.max(0, state.todayXp - removedTodayXp),
        draft,
        pickedIds: state.pickedIds.filter((pickedId) => !deletedNodeIds.has(pickedId)),
        create,
        lastResult: null,
        lastCreated: null
      }
    }),

  beginCreate: () =>
    set((state) => ({
      create: {
        step: 'from',
        title: 'New mastery',
        accent: ROOT_ACCENTS[state.roots.length % ROOT_ACCENTS.length],
        fromIds: normalizedInitialFrom(state.pickedIds, state.roots, state.skills, state.links),
        toIds: []
      },
      lastCreated: null
    })),

  setCreateTitle: (title) =>
    set((state) => ({
      create: state.create ? { ...state.create, title } : null
    })),

  setCreateAccent: (accent) =>
    set((state) => ({
      create: state.create ? { ...state.create, accent } : null
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

    const id = uniqueId(draft.title, allNodeIds(state.roots, state.skills))

    if (draft.step === 'from' && draft.fromIds.length === 0) {
      const root: Root = {
        id,
        title: draft.title.trim(),
        accent: draft.accent
      }
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
    if (draft.fromIds.length > MAX_INCOMING_RELATIONSHIPS) return
    if (draft.toIds.length > MAX_OUTGOING_RELATIONSHIPS) return
    if (draft.fromIds.some((from) => !canUseFromNode(from, state.links))) return
    if (draft.toIds.some((to) => !canUseToNode(to, state.links))) return

    const skill: Skill = {
      id,
      rootId,
      title: draft.title.trim(),
      xp: 0,
      maxLevel: 3,
      levelXpRequirements: [100, 200, 300],
      levelReachedAt: [],
      momentum: 0,
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

export function graphStateSnapshot(): GraphStateSnapshot {
  const state = useMastery.getState()
  return {
    roots: state.roots,
    skills: state.skills,
    links: state.links,
    history: state.history,
    todayXp: state.todayXp
  }
}

export function applyPersistedSnapshot(snapshot: GraphStateSnapshot): void {
  useMastery.setState({
    roots: snapshot.roots,
    skills: snapshot.skills,
    links: snapshot.links,
    history: snapshot.history,
    todayXp: snapshot.todayXp,
    draft: draftFor(snapshot.skills),
    pickedIds: [],
    create: null,
    lastResult: null,
    lastCreated: null
  })
}

function recordReachedLevels(
  skill: Skill,
  previousLevel: number,
  occurredAt: string
): Skill {
  const nextLevel = levelFor(skill)
  if (nextLevel <= previousLevel) return skill

  const levelReachedAt = [...(skill.levelReachedAt ?? [])]
  for (let level = previousLevel + 1; level <= nextLevel; level += 1) {
    if (!levelReachedAt[level - 1]) levelReachedAt[level - 1] = occurredAt
  }

  return { ...skill, levelReachedAt }
}

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
  return draft.step === 'from'
    ? draft.fromIds.length >= MAX_INCOMING_RELATIONSHIPS
    : draft.toIds.length >= MAX_OUTGOING_RELATIONSHIPS
}

export function canUseFromNode(id: NodeId, links: Link[]): boolean {
  return outgoingRelationshipCount(id, links) < MAX_OUTGOING_RELATIONSHIPS
}

export function canUseToNode(id: NodeId, links: Link[]): boolean {
  return incomingRelationshipCount(id, links) < MAX_INCOMING_RELATIONSHIPS
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
      .filter((skill) => canUseToNode(skill.id, links))
      .filter((skill) => !draft.fromIds.some((source) => hasPath(skill.id, source, links)))
      .map((skill) => skill.id)
  )
}

function isSameLocalDay(occurredAt: string, day: Date): boolean {
  const occurred = new Date(occurredAt)
  return (
    Number.isFinite(occurred.getTime()) &&
    occurred.getFullYear() === day.getFullYear() &&
    occurred.getMonth() === day.getMonth() &&
    occurred.getDate() === day.getDate()
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
    .filter((id) => canUseFromNode(id, links))
    .slice(0, MAX_INCOMING_RELATIONSHIPS)
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
  if (!rootId || !canUseFromNode(id, links)) return current
  const currentRoot = current.length > 0 ? nodeRootId(current[0], roots, skills) : rootId

  if (currentRoot !== rootId) return [id]
  if (current.length >= MAX_INCOMING_RELATIONSHIPS) return current
  return [...current, id]
}

function rootForIds(ids: NodeId[], roots: Root[], skills: Skill[]): RootId | undefined {
  return ids.length > 0 ? nodeRootId(ids[0], roots, skills) : undefined
}

export function incomingRelationshipCount(id: NodeId, links: Link[]): number {
  return links.filter((link) => link.to === id).length
}

export function outgoingRelationshipCount(id: NodeId, links: Link[]): number {
  return links.filter((link) => link.from === id).length
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
