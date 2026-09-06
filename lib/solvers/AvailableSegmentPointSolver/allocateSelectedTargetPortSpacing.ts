import type { CapacityMeshNode, SimpleRouteConnection, SimpleRouteJson } from "lib/types"
import type { NodeWithPortPoints, PortPoint } from "lib/types/high-density-types"
import { createPhysicalObstacleClearanceChecker } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/createPhysicalObstacleClearanceChecker"
import { createExplicitOwnershipMap } from "lib/utils/createExplicitOwnershipMap"
import type { SharedEdgeSegment } from "./AvailableSegmentPointSolver"
import { assertSelectedTargetPortSpacing } from "./assertSelectedTargetPortSpacing"

interface Variable {
  id: string
  owner: string
  width: number
  original: number
  min: number
  max: number
  edgeId: string
  z: number
}

export function allocateSelectedTargetPortSpacing({
  nodesWithPortPoints,
  capacityNodes,
  sharedEdgeSegments,
  originalSrj,
  pairedConnections,
  traceWidth,
  clearance,
}: {
  nodesWithPortPoints: NodeWithPortPoints[]
  capacityNodes: CapacityMeshNode[]
  sharedEdgeSegments: SharedEdgeSegment[]
  originalSrj: SimpleRouteJson
  pairedConnections: SimpleRouteConnection[]
  traceWidth: number
  clearance: number
}): NodeWithPortPoints[] {
  const connMap = createExplicitOwnershipMap(originalSrj, pairedConnections)
  const nodeById = new Map(capacityNodes.map((node) => [node.capacityMeshNodeId, node]))
  const eligible = sharedEdgeSegments.filter((segment) =>
    segment.nodeIds.filter((id) => nodeById.get(id)?._containsTarget).length === 1)
  const selectedById = new Map<string, PortPoint[]>()
  for (const node of nodesWithPortPoints) {
    for (const port of node.portPoints) {
      if (!port.portPointId || port.pcb_port_id) continue
      const entries = selectedById.get(port.portPointId) ?? []
      entries.push(port)
      selectedById.set(port.portPointId, entries)
    }
  }
  const isClear = createPhysicalObstacleClearanceChecker({
    originalSrj, pairedConnections, obstacleMargin: clearance,
  })
  const selectedForSegment = (segment: SharedEdgeSegment): PortPoint[] =>
    segment.portPoints.flatMap((candidate) => candidate.availableZ.flatMap((z) =>
      selectedById.get(`${candidate.segmentPortPointId}::${z}`) ?? []))
  const segmentsConflict = (first: SharedEdgeSegment, second: SharedEdgeSegment): boolean =>
    selectedForSegment(first).some((a) => selectedForSegment(second).some((b) => {
      const ownerA = connMap.getNetConnectedToId(a.connectionName)
      const ownerB = connMap.getNetConnectedToId(b.connectionName)
      if (!ownerA || !ownerB || ownerA === ownerB || a.z !== b.z) return false
      const required = traceWidth + clearance
      return Math.hypot(a.x - b.x, a.y - b.y) < required - 1e-9
    }))
  const replacements = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()

  for (const seed of eligible) {
    if (visited.has(seed.edgeId)) continue
    const vertical = Math.abs(seed.start.x - seed.end.x) < 1e-9
    const horizontal = Math.abs(seed.start.y - seed.end.y) < 1e-9
    if (!vertical && !horizontal) continue
    const group: SharedEdgeSegment[] = []
    const queue = [seed]
    while (queue.length > 0) {
      const current = queue.pop()!
      if (visited.has(current.edgeId)) continue
      visited.add(current.edgeId)
      group.push(current)
      const currentNonTargets = current.nodeIds.filter((id) => !nodeById.get(id)?._containsTarget)
      for (const candidate of eligible) {
        if (visited.has(candidate.edgeId)) continue
        const sameLine = vertical
          ? Math.abs(candidate.start.x - candidate.end.x) < 1e-9 && Math.abs(candidate.start.x - seed.start.x) < 1e-9
          : Math.abs(candidate.start.y - candidate.end.y) < 1e-9 && Math.abs(candidate.start.y - seed.start.y) < 1e-9
        if (!sameLine ||
          !candidate.nodeIds.some((id) => currentNonTargets.includes(id)) ||
          !segmentsConflict(current, candidate)) continue
        const [a0, a1] = vertical
          ? [Math.min(current.start.y, current.end.y), Math.max(current.start.y, current.end.y)]
          : [Math.min(current.start.x, current.end.x), Math.max(current.start.x, current.end.x)]
        const [b0, b1] = vertical
          ? [Math.min(candidate.start.y, candidate.end.y), Math.max(candidate.start.y, candidate.end.y)]
          : [Math.min(candidate.start.x, candidate.end.x), Math.max(candidate.start.x, candidate.end.x)]
        if (Math.max(a0, b0) <= Math.min(a1, b1) + 1e-9) queue.push(candidate)
      }
    }
    if (group.length < 2) continue

    const variables: Variable[] = []
    let ambiguous = false
    for (const segment of group) {
      for (const candidate of segment.portPoints) {
        for (const z of candidate.availableZ) {
          const id = `${candidate.segmentPortPointId}::${z}`
          const selected = selectedById.get(id)
          if (!selected?.length) continue
          const owners = new Set(selected.map((port) => connMap.getNetConnectedToId(port.connectionName)))
          if (owners.size !== 1 || owners.has(undefined)) {
            ambiguous = true
            continue
          }
          const coordinates = new Set(selected.map((port) => JSON.stringify([port.x, port.y, port.z])))
          if (coordinates.size !== 1 || selected.some((port) => port.z !== z)) {
            ambiguous = true
            continue
          }
          const owner = [...owners][0]!
          const original = vertical ? selected[0]!.y : selected[0]!.x
          variables.push({
            id, owner, width: traceWidth, original,
            min: vertical ? Math.min(segment.start.y, segment.end.y) : Math.min(segment.start.x, segment.end.x),
            max: vertical ? Math.max(segment.start.y, segment.end.y) : Math.max(segment.start.x, segment.end.x),
            edgeId: segment.edgeId, z,
          })
        }
      }
    }
    if (ambiguous || variables.length < 2) continue
    variables.sort((a, b) => a.original - b.original || a.id.localeCompare(b.id))
    if (new Set(variables.map((variable) => variable.id)).size !== variables.length) continue

    const gap = (left: Variable, right: Variable): number => {
      let required = 0
      if (left.edgeId === right.edgeId) required = right.original - left.original
      if (left.owner !== right.owner && left.z === right.z) {
        required = Math.max(required, left.width / 2 + right.width / 2 + clearance)
      }
      return required
    }
    const solveAtDisplacement = (displacement: number): number[][] => {
      const lows = variables.map((variable) => Math.max(variable.min, variable.original - displacement))
      const highs = variables.map((variable) => Math.min(variable.max, variable.original + displacement))
      const earliest: number[] = []
      for (let i = 0; i < variables.length; i++) {
        let value = lows[i]!
        for (let j = 0; j < i; j++) value = Math.max(value, earliest[j]! + gap(variables[j]!, variables[i]!))
        if (value > highs[i]! + 1e-9) return []
        earliest.push(value)
      }
      const backward = [...earliest]
      for (let i = variables.length - 1; i >= 0; i--) {
        let upper = highs[i]!
        for (let j = i + 1; j < variables.length; j++) upper = Math.min(upper, backward[j]! - gap(variables[i]!, variables[j]!))
        backward[i] = Math.max(earliest[i]!, Math.min(variables[i]!.original, upper))
      }
      const forward: number[] = []
      for (let i = 0; i < variables.length; i++) {
        let lower = lows[i]!
        for (let j = 0; j < i; j++) lower = Math.max(lower, forward[j]! + gap(variables[j]!, variables[i]!))
        if (lower > highs[i]! + 1e-9) return [backward]
        forward.push(Math.max(lower, Math.min(variables[i]!.original, highs[i]!)))
      }
      return [backward, forward]
    }
    const isPhysicallyClear = (positions: number[]): boolean =>
      positions.every((position, index) => {
        const variable = variables[index]!
        const point = vertical ? { x: seed.start.x, y: position } : { x: position, y: seed.start.y }
        return isClear(point, variable.z, variable.owner, variable.width)
      })
    let low = 0
    let high = Math.max(...variables.map((variable) => variable.max - variable.min))
    const choosePhysical = (solutions: number[][]): number[] | undefined =>
      solutions.filter((positions) => {
        if (!isPhysicallyClear(positions)) return false
        return positions.every((position, i) =>
          position >= variables[i]!.min - 1e-9 &&
          position <= variables[i]!.max + 1e-9 &&
          variables.slice(0, i).every((_, j) =>
            position - positions[j]! >= gap(variables[j]!, variables[i]!) - 1e-9))
      }).sort((a, b) =>
        a.reduce((sum, value, index) => sum + (value - variables[index]!.original) ** 2, 0) -
        b.reduce((sum, value, index) => sum + (value - variables[index]!.original) ** 2, 0))[0]
    if (solveAtDisplacement(high).length === 0) continue
    for (let iteration = 0; iteration < 60; iteration++) {
      const middle = (low + high) / 2
      if (solveAtDisplacement(middle).length > 0) high = middle
      else low = middle
    }
    const positions = choosePhysical(solveAtDisplacement(high + 1e-10))
    if (!positions) continue
    for (let i = 0; i < variables.length; i++) {
      replacements.set(variables[i]!.id, vertical
        ? { x: seed.start.x, y: positions[i]! }
        : { x: positions[i]!, y: seed.start.y })
    }
  }

  const orthogonalConflicts = new Map<string, Set<string>>()
  for (let i = 0; i < sharedEdgeSegments.length; i++) {
    const first = sharedEdgeSegments[i]!
    for (let j = i + 1; j < sharedEdgeSegments.length; j++) {
      const second = sharedEdgeSegments[j]!
      const firstVertical = Math.abs(first.start.x - first.end.x) < 1e-9
      const secondVertical = Math.abs(second.start.x - second.end.x) < 1e-9
      if (firstVertical === secondVertical || !segmentsConflict(first, second)) continue
      const sharedNode = first.nodeIds.filter((id) =>
        second.nodeIds.includes(id) && !nodeById.get(id)?._containsTarget)
      const touchesTarget = [...first.nodeIds, ...second.nodeIds].some((id) =>
        nodeById.get(id)?._containsTarget)
      const sharedCorners = [first.start, first.end].filter((point) =>
        [second.start, second.end].some((other) =>
          Math.hypot(point.x - other.x, point.y - other.y) < 1e-9))
      if (!touchesTarget || sharedNode.length !== 1 || sharedCorners.length !== 1) continue
      const firstLinks = orthogonalConflicts.get(first.edgeId) ?? new Set<string>()
      const secondLinks = orthogonalConflicts.get(second.edgeId) ?? new Set<string>()
      firstLinks.add(second.edgeId)
      secondLinks.add(first.edgeId)
      orthogonalConflicts.set(first.edgeId, firstLinks)
      orthogonalConflicts.set(second.edgeId, secondLinks)
    }
  }
  const segmentById = new Map(sharedEdgeSegments.map((segment) => [segment.edgeId, segment]))
  const completedOrthogonal = new Set<string>()
  for (const [firstId, links] of orthogonalConflicts) {
    if (completedOrthogonal.has(firstId) || links.size !== 1) continue
    const secondId = [...links][0]!
    if (orthogonalConflicts.get(secondId)?.size !== 1) continue
    completedOrthogonal.add(firstId)
    completedOrthogonal.add(secondId)
    const first = segmentById.get(firstId)!
    const second = segmentById.get(secondId)!
    const getVariable = (segment: SharedEdgeSegment): {
      id: string
      point: PortPoint
      owner: string
    } | undefined => {
      const selected = selectedForSegment(segment)
      const unique = new Map(selected.map((point) => [
        JSON.stringify([point.portPointId, point.connectionName]), point,
      ]))
      if (unique.size !== 1) return undefined
      const point = unique.values().next().value!
      const owner = connMap.getNetConnectedToId(point.connectionName)
      if (!owner || selected.some((other) =>
        connMap.getNetConnectedToId(other.connectionName) !== owner ||
        other.x !== point.x || other.y !== point.y || other.z !== point.z)) return undefined
      return { id: point.portPointId!, point, owner }
    }
    const firstVariable = getVariable(first)
    const secondVariable = getVariable(second)
    if (!firstVariable || !secondVariable ||
      firstVariable.owner === secondVariable.owner ||
      firstVariable.point.z !== secondVariable.point.z) continue
    if (replacements.has(firstVariable.id) || replacements.has(secondVariable.id)) continue
    const corner = [first.start, first.end].find((point) =>
      [second.start, second.end].some((other) =>
        Math.hypot(point.x - other.x, point.y - other.y) < 1e-9))!
    const farPoint = (segment: SharedEdgeSegment) =>
      Math.hypot(segment.start.x - corner.x, segment.start.y - corner.y) >
        Math.hypot(segment.end.x - corner.x, segment.end.y - corner.y)
        ? segment.start : segment.end
    const moveAway = (point: PortPoint, segment: SharedEdgeSegment, displacement: number) => {
      const far = farPoint(segment)
      const length = Math.hypot(far.x - corner.x, far.y - corner.y)
      const distance = Math.hypot(point.x - corner.x, point.y - corner.y)
      const nextDistance = Math.min(length, distance + displacement)
      return {
        x: corner.x + (far.x - corner.x) * nextDistance / length,
        y: corner.y + (far.y - corner.y) * nextDistance / length,
      }
    }
    const required = traceWidth + clearance
    const firstDistance = Math.hypot(firstVariable.point.x - corner.x, firstVariable.point.y - corner.y)
    const secondDistance = Math.hypot(secondVariable.point.x - corner.x, secondVariable.point.y - corner.y)
    const firstCapacity = Math.hypot(farPoint(first).x - corner.x, farPoint(first).y - corner.y) - firstDistance
    const secondCapacity = Math.hypot(farPoint(second).x - corner.x, farPoint(second).y - corner.y) - secondDistance
    const distanceAt = (displacement: number) => Math.hypot(
      firstDistance + Math.min(displacement, firstCapacity),
      secondDistance + Math.min(displacement, secondCapacity),
    )
    if (distanceAt(Math.max(firstCapacity, secondCapacity)) < required - 1e-9) continue
    let low = 0
    let high = Math.max(firstCapacity, secondCapacity)
    for (let iteration = 0; iteration < 60; iteration++) {
      const middle = (low + high) / 2
      if (distanceAt(middle) >= required) high = middle
      else low = middle
    }
    const firstPosition = moveAway(firstVariable.point, first, high + 1e-10)
    const secondPosition = moveAway(secondVariable.point, second, high + 1e-10)
    if (!isClear(firstPosition, firstVariable.point.z, firstVariable.owner, traceWidth) ||
      !isClear(secondPosition, secondVariable.point.z, secondVariable.owner, traceWidth)) continue
    replacements.set(firstVariable.id, firstPosition)
    replacements.set(secondVariable.id, secondPosition)
  }

  if (replacements.size === 0) return nodesWithPortPoints
  const replace = (port: PortPoint): PortPoint => {
    const replacement = port.portPointId ? replacements.get(port.portPointId) : undefined
    return replacement ? { ...port, ...replacement } : port
  }
  const output = nodesWithPortPoints.map((node) => ({
    ...node,
    portPoints: node.portPoints.map(replace),
    portPointsInPairs: node.portPointsInPairs?.map((pair) => pair.map(replace) as typeof pair),
  }))
  try {
    assertSelectedTargetPortSpacing({
      nodesWithPortPoints: output,
      capacityNodes,
      originalSrj,
      pairedConnections,
      traceWidth,
      clearance,
    })
  } catch (error) {
    if (error instanceof Error &&
      (error.message.startsWith("Target-entry crossing clearance conflict:") ||
        error.message.startsWith("Inconsistent shared crossing coordinates"))) {
      return nodesWithPortPoints
    }
    throw error
  }
  return output
}
