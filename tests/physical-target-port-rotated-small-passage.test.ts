import { expect, test } from "bun:test"
import { filterTargetPortPointsByPhysicalClearance } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/filterTargetPortPointsByPhysicalClearance"
import { addApproximatingRectsToSrj } from "lib/utils/addApproximatingRectsToSrj"
import { createPhysicalTargetPortFixture } from "./fixtures/physical-target-port-fixture"

test("target crossing checks normalized rotated slices without rejecting small or bottom passages", (): void => {
  const { srj, nodes, segments } = createPhysicalTargetPortFixture()
  srj.obstacles[1] = { type: "rect", center: { x: 0, y: 0.1 }, width: 0.8,
    height: 0.1, ccwRotationDegrees: 45, layers: ["top"], connectedTo: [] }
  for (const node of nodes) { node.width = 0.01; node.height = 0.01 }
  const normalized = addApproximatingRectsToSrj({ ...srj, obstacles: [srj.obstacles[1]], connections: [] })
  expect(normalized.obstacles.length).toBeGreaterThan(1)
  segments[0].portPoints[1].x = 2
  const legalPort = segments[0].portPoints[1]
  const result = filterTargetPortPointsByPhysicalClearance({
    originalSrj: srj, pairedConnections: srj.connections, capacityMeshNodes: nodes,
    sharedEdgeSegments: segments, traceWidth: 0.15, obstacleMargin: 0.127,
  })
  expect(result[0].portPoints[0].availableZ).toEqual([1])
  expect(result[0].portPoints[1]).toBe(legalPort)
})
