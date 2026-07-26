import type { Link, NodeId, Root, RootId, Skill } from './model'

export interface Point {
  x: number
  y: number
}

export interface PreviewNode {
  id: NodeId
  rootId?: RootId
  root: boolean
}

interface LayoutInput {
  roots: Root[]
  skills: Skill[]
  links: Link[]
  preview?: PreviewNode
}

const ROOT_GAP = 1100
const BASE_RING_RADIUS = 205
const RING_DEPTH_GAP = 230
const START_ANGLE = radians(150)
const END_ANGLE = radians(30)
const ROOT_SIZE = 130
const NODE_SIZE = 112
const NODE_CLEARANCE = 14

export function graphLayout({ roots, skills, links, preview }: LayoutInput): Record<NodeId, Point> {
  const allRoots = preview?.root
    ? [...roots, { id: preview.id, title: 'Preview' }]
    : roots
  const allSkills = preview && !preview.root && preview.rootId
    ? [...skills, previewSkill(preview.id, preview.rootId)]
    : skills
  const positions: Record<NodeId, Point> = {}

  allRoots.forEach((root, rootIndex) => {
    const center = { x: 500 + rootIndex * ROOT_GAP, y: 195 }
    const rootSkills = allSkills.filter((skill) => skill.rootId === root.id)
    const depth = depthsFor(root.id, rootSkills, links)
    const angles = new Map<NodeId, number>()
    const groups = new Map<number, Skill[]>()

    positions[root.id] = centeredPosition(center, ROOT_SIZE)
    rootSkills.forEach((skill) => {
      const value = depth.get(skill.id) ?? 1
      groups.set(value, [...(groups.get(value) ?? []), skill])
    })

    let previousRadius = 0

    Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([ring, ringSkills]) => {
        const sorted = [...ringSkills].sort((a, b) => a.id.localeCompare(b.id))
        const minimumDepthRadius = ring === 1 ? BASE_RING_RADIUS : previousRadius + RING_DEPTH_GAP
        const radius = Math.max(minimumDepthRadius, minimumRadiusForCount(sorted.length))
        previousRadius = radius

        sorted.forEach((skill, index) => {
          const parentAngles = links
            .filter((link) => link.to === skill.id)
            .map((link) => angles.get(link.from))
            .filter((angle): angle is number => angle !== undefined)
          const fallback = distributedAngle(index, sorted.length)
          const angle =
            parentAngles.length > 1
              ? clamp(circularMean(parentAngles), radians(15), radians(165))
              : fallback
          const nodeCenter = {
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius
          }

          angles.set(skill.id, angle)
          positions[skill.id] = centeredPosition(nodeCenter, NODE_SIZE)
        })
      })
  })

  return positions
}

function previewSkill(id: NodeId, rootId: RootId): Skill {
  return {
    id,
    rootId,
    title: 'Preview',
    xp: 0,
    maxLevel: 3,
    levelXpRequirements: [100, 200, 300],
    heat: 0,
    gates: []
  }
}

function depthsFor(rootId: RootId, skills: Skill[], links: Link[]): Map<NodeId, number> {
  const ids = new Set(skills.map((skill) => skill.id))
  const depth = new Map<NodeId, number>([[rootId, 0]])

  for (let pass = 0; pass <= skills.length; pass += 1) {
    let changed = false

    skills.forEach((skill) => {
      const sourceDepths = links
        .filter((link) => link.to === skill.id)
        .map((link) => depth.get(link.from))
        .filter((value): value is number => value !== undefined)
      const next = sourceDepths.length > 0 ? Math.max(...sourceDepths) + 1 : 1
      const current = depth.get(skill.id)

      if (current === undefined || next > current) {
        depth.set(skill.id, Math.min(next, ids.size + 1))
        changed = true
      }
    })

    if (!changed) break
  }

  skills.forEach((skill) => {
    if (!depth.has(skill.id)) depth.set(skill.id, 1)
  })

  return depth
}

function minimumRadiusForCount(count: number): number {
  if (count <= 1) return BASE_RING_RADIUS

  const arc = Math.abs(START_ANGLE - END_ANGLE)
  const angleStep = arc / (count - 1)
  const centerSpacing = NODE_SIZE + NODE_CLEARANCE
  return centerSpacing / (2 * Math.sin(angleStep / 2))
}

function distributedAngle(index: number, count: number): number {
  if (count <= 1) return Math.PI / 2
  return START_ANGLE + ((END_ANGLE - START_ANGLE) * index) / (count - 1)
}

function circularMean(angles: number[]): number {
  const x = angles.reduce((sum, angle) => sum + Math.cos(angle), 0)
  const y = angles.reduce((sum, angle) => sum + Math.sin(angle), 0)
  return Math.atan2(y, x)
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function centeredPosition(center: Point, size: number): Point {
  return {
    x: center.x - size / 2,
    y: center.y - size / 2
  }
}
