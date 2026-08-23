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

interface TreeLayout {
  positions: Record<NodeId, Point>
  minX: number
  maxX: number
}

const MIN_ROOT_CENTER_GAP = 1800
const TREE_GUTTER = 800
const GRAPH_LEFT_MARGIN = 220
const ROOT_CENTER_Y = 195
const BASE_RING_RADIUS = 205
const RING_DEPTH_GAP = 230
const START_ANGLE = radians(150)
const END_ANGLE = radians(30)
const ROOT_SIZE = 130
const NODE_SIZE = 112
const NODE_CLEARANCE = 14
const ANGLE_EPSILON = radians(0.1)

export function graphLayout({ roots, skills, links, preview }: LayoutInput): Record<NodeId, Point> {
  const allRoots = preview?.root
    ? [...roots, { id: preview.id, title: 'Preview' }]
    : roots
  const allSkills = preview && !preview.root && preview.rootId
    ? [...skills, previewSkill(preview.id, preview.rootId)]
    : skills
  const positions: Record<NodeId, Point> = {}
  const treeLayouts = allRoots.map((root) =>
    layoutTree(
      root.id,
      allSkills.filter((skill) => skill.rootId === root.id),
      links
    )
  )

  let previousCenterX: number | undefined
  let previousRightExtent = 0

  treeLayouts.forEach((tree) => {
    const leftExtent = Math.max(0, -tree.minX)
    const rightExtent = Math.max(0, tree.maxX)
    const centerX =
      previousCenterX === undefined
        ? Math.max(500, GRAPH_LEFT_MARGIN + leftExtent)
        : previousCenterX +
          Math.max(
            MIN_ROOT_CENTER_GAP,
            previousRightExtent + leftExtent + TREE_GUTTER
          )

    Object.entries(tree.positions).forEach(([nodeId, point]) => {
      positions[nodeId] = {
        x: point.x + centerX,
        y: point.y
      }
    })

    previousCenterX = centerX
    previousRightExtent = rightExtent
  })

  return positions
}

function layoutTree(rootId: RootId, rootSkills: Skill[], links: Link[]): TreeLayout {
  const center = { x: 0, y: ROOT_CENTER_Y }
  const positions: Record<NodeId, Point> = {}
  const depth = depthsFor(rootId, rootSkills, links)
  const angles = new Map<NodeId, number>([[rootId, Math.PI / 2]])
  const groups = new Map<number, Skill[]>()
  const rootPosition = centeredPosition(center, ROOT_SIZE)
  let minX = rootPosition.x
  let maxX = rootPosition.x + ROOT_SIZE

  positions[rootId] = rootPosition
  rootSkills.forEach((skill) => {
    const value = depth.get(skill.id) ?? 1
    groups.set(value, [...(groups.get(value) ?? []), skill])
  })

  let previousRadius = 0

  Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([ring, ringSkills]) => {
      const minimumDepthRadius = ring === 1 ? BASE_RING_RADIUS : previousRadius + RING_DEPTH_GAP
      const radius = Math.max(minimumDepthRadius, minimumRadiusForCount(ringSkills.length))
      previousRadius = radius

      const ordered = orderRing(ring, ringSkills, links, angles)
      const ringAngles = anglesForRing(ring, ordered, links, angles, radius)

      ordered.forEach((skill, index) => {
        const angle = ringAngles[index]
        const nodeCenter = {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        }
        const nodePosition = centeredPosition(nodeCenter, NODE_SIZE)

        angles.set(skill.id, angle)
        positions[skill.id] = nodePosition
        minX = Math.min(minX, nodePosition.x)
        maxX = Math.max(maxX, nodePosition.x + NODE_SIZE)
      })
    })

  return { positions, minX, maxX }
}

function orderRing(
  ring: number,
  skills: Skill[],
  links: Link[],
  angles: Map<NodeId, number>
): Skill[] {
  if (ring === 1) return [...skills].sort((a, b) => a.id.localeCompare(b.id))

  return [...skills].sort((left, right) => {
    const leftAnchor = parentAnchor(left.id, links, angles)
    const rightAnchor = parentAnchor(right.id, links, angles)

    if (leftAnchor !== undefined && rightAnchor !== undefined) {
      const delta = rightAnchor - leftAnchor
      if (Math.abs(delta) > ANGLE_EPSILON) return delta
    } else if (leftAnchor !== undefined) {
      return -1
    } else if (rightAnchor !== undefined) {
      return 1
    }

    return left.id.localeCompare(right.id)
  })
}

function anglesForRing(
  ring: number,
  ordered: Skill[],
  links: Link[],
  parentAngles: Map<NodeId, number>,
  radius: number
): number[] {
  if (ordered.length === 0) return []
  if (ring === 1) {
    return ordered.map((_skill, index) => distributedAngle(index, ordered.length))
  }

  const minimumStep = minimumAngleStep(radius)
  const desired = ordered.map((skill, index) => {
    return parentAnchor(skill.id, links, parentAngles) ?? distributedAngle(index, ordered.length)
  })

  // Nodes with the same parent anchor are siblings or convergence peers. Spread them
  // symmetrically around that anchor before enforcing global ring spacing.
  let runStart = 0
  while (runStart < desired.length) {
    let runEnd = runStart + 1
    while (
      runEnd < desired.length &&
      Math.abs(desired[runEnd] - desired[runStart]) <= ANGLE_EPSILON
    ) {
      runEnd += 1
    }

    const count = runEnd - runStart
    if (count > 1) {
      const anchor = desired[runStart]
      for (let index = 0; index < count; index += 1) {
        desired[runStart + index] = anchor + ((count - 1) / 2 - index) * minimumStep
      }
    }

    runStart = runEnd
  }

  return constrainDescendingAngles(desired, minimumStep)
}

function constrainDescendingAngles(desired: number[], minimumStep: number): number[] {
  const count = desired.length
  if (count === 1) return [clamp(desired[0], END_ANGLE, START_ANGLE)]

  const result = desired.map((angle, index) => {
    const upper = START_ANGLE - index * minimumStep
    const lower = END_ANGLE + (count - 1 - index) * minimumStep
    return clamp(angle, lower, upper)
  })

  for (let index = 1; index < count; index += 1) {
    result[index] = Math.min(result[index], result[index - 1] - minimumStep)
  }

  for (let index = count - 2; index >= 0; index -= 1) {
    result[index] = Math.max(result[index], result[index + 1] + minimumStep)
  }

  return result
}

function parentAnchor(
  nodeId: NodeId,
  links: Link[],
  angles: Map<NodeId, number>
): number | undefined {
  const values = links
    .filter((link) => link.to === nodeId)
    .map((link) => angles.get(link.from))
    .filter((angle): angle is number => angle !== undefined)

  if (values.length === 0) return undefined
  if (values.length === 1) return values[0]
  return clamp(circularMean(values), END_ANGLE, START_ANGLE)
}

function previewSkill(id: NodeId, rootId: RootId): Skill {
  return {
    id,
    rootId,
    title: 'Preview',
    xp: 0,
    maxLevel: 3,
    levelXpRequirements: [100, 100, 100],
    momentum: 0,
    gates: [],
    updateHistory: []
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

function minimumAngleStep(radius: number): number {
  const spacingRatio = Math.min(1, (NODE_SIZE + NODE_CLEARANCE) / (2 * radius))
  return 2 * Math.asin(spacingRatio)
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
