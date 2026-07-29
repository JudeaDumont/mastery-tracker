import type {
  ActivityEntry,
  Effort,
  Gate,
  GraphStateSnapshot,
  Link,
  LevelDefaults,
  NodeId,
  Root,
  RootAccent,
  Skill
} from './model'
import { normalizeDeadlineDay } from './deadline'
import {
  DEFAULT_LEVEL_STEP_XP,
  DEFAULT_MAX_LEVEL,
  MAX_LEVEL_LIMIT,
  ROOT_ACCENTS,
  applyPersistedSnapshot,
  graphStateSnapshot,
  useMastery
} from './store'

export const GRAPH_FILE_FORMAT = 'mastery-tracker.graph'
export const GRAPH_FILE_VERSION = 6

interface GraphFileV6 {
  format: typeof GRAPH_FILE_FORMAT
  schemaVersion: typeof GRAPH_FILE_VERSION
  savedAt: string
  data: GraphStateSnapshot
}

class UnsupportedGraphVersionError extends Error {
  constructor(version: number) {
    super(`Graph file version ${version} is newer than supported version ${GRAPH_FILE_VERSION}.`)
  }
}

let persistenceStarted = false
let lastSerialized = ''

export async function initializeMasteryPersistence(): Promise<void> {
  if (persistenceStarted) return
  persistenceStarted = true

  try {
    const raw = await window.api.graphPersistence.load()
    const migrated = raw === null ? null : migrateGraphFile(raw)

    if (migrated) applyPersistedSnapshot(migrated)

    await persistCurrentState()
    lastSerialized = JSON.stringify(graphStateSnapshot())

    useMastery.subscribe((state) => {
      const snapshot: GraphStateSnapshot = {
        roots: state.roots,
        skills: state.skills,
        links: state.links,
        xpLedger: state.xpLedger,
        todayXp: state.todayXp,
        levelDefaults: state.levelDefaults
      }
      const serialized = JSON.stringify(snapshot)
      if (serialized === lastSerialized) return

      lastSerialized = serialized
      void saveSnapshot(snapshot).catch((error) => {
        console.error('Mastery graph save failed.', error)
      })
    })

    const filePath = await window.api.graphPersistence.getPath()
    console.info(`Mastery graph persistence ready: ${filePath}`)
  } catch (error) {
    if (error instanceof UnsupportedGraphVersionError) {
      console.error(`${error.message} The file was not overwritten.`)
      return
    }

    console.error('Mastery graph persistence could not be initialized.', error)
  }
}

function persistCurrentState(): Promise<void> {
  return saveSnapshot(graphStateSnapshot())
}

function saveSnapshot(snapshot: GraphStateSnapshot): Promise<void> {
  const document: GraphFileV6 = {
    format: GRAPH_FILE_FORMAT,
    schemaVersion: GRAPH_FILE_VERSION,
    savedAt: new Date().toISOString(),
    data: snapshot
  }

  return window.api.graphPersistence.save(document)
}

export function migrateGraphFile(raw: unknown): GraphStateSnapshot | null {
  const object = asObject(raw)
  if (!object) return null

  if (object.format === GRAPH_FILE_FORMAT) {
    const version = finiteInteger(object.schemaVersion, 0)
    if (version > GRAPH_FILE_VERSION) throw new UnsupportedGraphVersionError(version)

    if (version === 6 || version === 5 || version === 4 || version === 3 || version === 2 || version === 1) {
      return normalizeSnapshot(object.data)
    }
    return normalizeSnapshot(object.data ?? object.state ?? object)
  }

  // Backwards compatibility for pre-version files and Zustand persist wrappers.
  return normalizeSnapshot(object.state ?? object.data ?? object)
}

function normalizeSnapshot(raw: unknown): GraphStateSnapshot | null {
  const source = asObject(raw)
  if (!source) return null

  const normalizedRoots = normalizeRoots(source.roots)
  if (normalizedRoots.length === 0) return null

  const rootIds = new Set(normalizedRoots.map((root) => root.id))
  const normalizedSkills = normalizeSkills(source.skills, rootIds)
  const allIds = new Set<NodeId>([...rootIds, ...normalizedSkills.map((skill) => skill.id)])
  const links = normalizeLinks(source.links, allIds)

  // Version 1 stored one global history array. Version 2 stores note history on each node.
  const legacyHistory = normalizeHistory(source.history, allIds)
  const { roots, skills } = distributeHistory(normalizedRoots, normalizedSkills, legacyHistory)
  const nodeHistory = [...roots, ...skills].flatMap((node) => node.updateHistory)
  const xpLedger = mergeHistory(
    normalizeHistory(source.xpLedger ?? source.dailyUpdates, allIds),
    nodeHistory
  )

  return {
    roots,
    skills,
    links,
    xpLedger,
    todayXp: finiteNumber(source.todayXp, 0),
    levelDefaults: normalizeLevelDefaults(source)
  }
}

function normalizeLevelDefaults(source: Record<string, unknown>): LevelDefaults {
  const raw = asObject(source.levelDefaults)
  const levelStepXp = Math.max(
    1,
    finiteInteger(raw?.levelStepXp ?? source.defaultLevelStepXp, DEFAULT_LEVEL_STEP_XP)
  )
  const maxLevel = Math.min(
    MAX_LEVEL_LIMIT,
    Math.max(1, finiteInteger(raw?.maxLevel ?? source.defaultMaxLevel, DEFAULT_MAX_LEVEL))
  )

  return { levelStepXp, maxLevel }
}

function normalizeRoots(raw: unknown): Root[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((value, index) => {
    const root = asObject(value)
    const id = stringValue(root?.id)
    if (!root || !id) return []

    return [
      {
        id,
        title: stringValue(root.title) || id,
        accent: rootAccent(root.accent) ?? ROOT_ACCENTS[index % ROOT_ACCENTS.length],
        updateHistory: normalizeNodeHistory(root.updateHistory, id)
      }
    ]
  })
}

function normalizeSkills(raw: unknown, rootIds: Set<string>): Skill[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((value) => {
    const skill = asObject(value)
    const id = stringValue(skill?.id)
    const rootId = stringValue(skill?.rootId)
    if (!skill || !id || !rootId || !rootIds.has(rootId)) return []

    const requirements = normalizeRequirements(skill)
    const maxLevel = Math.max(1, finiteInteger(skill.maxLevel, requirements.length || 3))
    while (requirements.length < maxLevel) {
      requirements.push(requirements.at(-1) ?? 100)
    }

    return [
      {
        id,
        rootId,
        title: stringValue(skill.title) || id,
        xp: Math.max(0, finiteNumber(skill.xp, 0)),
        maxLevel,
        levelXpRequirements: requirements.slice(0, maxLevel),
        levelReachedAt: normalizeReachedDates(skill.levelReachedAt, maxLevel),
        momentum: clamp(finiteNumber(skill.momentum ?? skill.heat, 0), 0, 100),
        gates: normalizeGates(skill.gates),
        updateHistory: normalizeNodeHistory(skill.updateHistory, id)
      }
    ]
  })
}

function normalizeRequirements(skill: Record<string, unknown>): number[] {
  if (Array.isArray(skill.levelXpRequirements)) {
    const values = skill.levelXpRequirements
      .map((value) => Math.max(1, finiteNumber(value, 0)))
      .filter((value) => Number.isFinite(value))
    if (values.length > 0) return values
  }

  // Old prototypes stored cumulative thresholds. Convert them to per-level costs.
  if (Array.isArray(skill.thresholds)) {
    let previous = 0
    const values = skill.thresholds.map((value) => {
      const cumulative = Math.max(previous, finiteNumber(value, previous))
      const cost = Math.max(1, cumulative - previous)
      previous = cumulative
      return cost
    })
    if (values.length > 0) return values
  }

  return [100, 100, 100]
}

function normalizeReachedDates(raw: unknown, maxLevel: number): Array<string | null> {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, maxLevel).map((value) => (typeof value === 'string' ? value : null))
}

function normalizeGates(raw: unknown): Gate[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((value) => {
    const gate = asObject(value)
    const nodeId = stringValue(gate?.nodeId)
    if (!gate || !nodeId) return []
    return [{ nodeId, level: Math.max(0, finiteInteger(gate.level, 0)) }]
  })
}

function normalizeLinks(raw: unknown, allIds: Set<string>): Link[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((value, index) => {
    const link = asObject(value)
    const from = stringValue(link?.from ?? link?.source)
    const to = stringValue(link?.to ?? link?.target)
    if (!link || !from || !to || !allIds.has(from) || !allIds.has(to)) return []

    return [{ id: stringValue(link.id) || `${from}-${to}-${index}`, from, to }]
  })
}

function normalizeNodeHistory(raw: unknown, nodeId: NodeId): ActivityEntry[] {
  return normalizeHistory(raw, new Set([nodeId]), nodeId)
}

function normalizeHistory(
  raw: unknown,
  nodeIds: Set<NodeId>,
  fallbackNodeId?: NodeId
): ActivityEntry[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((value, index) => {
    const entry = asObject(value)
    const nodeId = stringValue(entry?.nodeId) || fallbackNodeId || ''
    if (!entry || !nodeId || !nodeIds.has(nodeId)) return []
    const deadlineOn = normalizeDeadlineDay(
      entry.deadlineOn ?? entry.deadlineAt ?? entry.deadline
    )
    const opportuneOn = normalizeDeadlineDay(
      entry.opportuneOn ?? entry.opportunityOn ?? entry.opportuneAt ?? entry.opportunityAt
    )

    return [
      {
        id: stringValue(entry.id) || `${nodeId}-legacy-entry-${index}`,
        nodeId,
        occurredAt: stringValue(entry.occurredAt) || new Date(0).toISOString(),
        minutes: Math.max(0, finiteNumber(entry.minutes, 0)),
        effort: effortValue(entry.effort),
        xp: Math.max(0, finiteNumber(entry.xp, 0)),
        note: stringValue(entry.note),
        ...(deadlineOn ? { deadlineOn } : {}),
        ...(opportuneOn ? { opportuneOn } : {})
      }
    ]
  })
}

function distributeHistory(
  roots: Root[],
  skills: Skill[],
  legacyHistory: ActivityEntry[]
): { roots: Root[]; skills: Skill[] } {
  const byNode = new Map<NodeId, ActivityEntry[]>()
  legacyHistory.forEach((entry) => {
    const entries = byNode.get(entry.nodeId) ?? []
    entries.push(entry)
    byNode.set(entry.nodeId, entries)
  })

  return {
    roots: roots.map((root) => ({
      ...root,
      updateHistory: mergeHistory(root.updateHistory, byNode.get(root.id) ?? [])
    })),
    skills: skills.map((skill) => ({
      ...skill,
      updateHistory: mergeHistory(skill.updateHistory, byNode.get(skill.id) ?? [])
    }))
  }
}

function mergeHistory(...groups: ActivityEntry[][]): ActivityEntry[] {
  const byId = new Map<string, ActivityEntry>()
  groups.flat().forEach((entry) => {
    if (!byId.has(entry.id)) byId.set(entry.id, entry)
  })

  return [...byId.values()].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
}

function rootAccent(value: unknown): RootAccent | undefined {
  return ROOT_ACCENTS.includes(value as RootAccent) ? (value as RootAccent) : undefined
}

function effortValue(value: unknown): Effort {
  return ['recovery', 'light', 'moderate', 'hard', 'maximum'].includes(String(value))
    ? (value as Effort)
    : 'moderate'
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function finiteInteger(value: unknown, fallback: number): number {
  return Math.trunc(finiteNumber(value, fallback))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
