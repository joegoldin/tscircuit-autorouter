import { expect, test } from "bun:test"
import { filterTargetPortPointsByPhysicalClearance } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/filterTargetPortPointsByPhysicalClearance"
import { createPhysicalTargetPortFixture } from "./fixtures/physical-target-port-fixture"

test("physical target exemptions require common explicit ownership independent of order", (): void => {
  for (const mode of ["common", "reversed", "unknown", "disjoint", "ambiguous", "coincident", "keepout", "retained"] as const) {
    const { srj, nodes, segments } = createPhysicalTargetPortFixture()
    segments[0].portPoints = [segments[0].portPoints[1]]
    if (mode === "reversed") {
      nodes.reverse()
      segments[0].portPoints[0].nodeIds.reverse()
      srj.obstacles.reverse()
      for (const obstacle of srj.obstacles) obstacle.connectedTo.reverse()
      srj.connections.reverse()
    }
    if (mode === "unknown") nodes[1]._connectedTo = ["unknown"]
    if (mode === "disjoint") nodes[1]._connectedTo = ["foreign"]
    if (mode === "ambiguous") for (const node of nodes) node._connectedTo = ["net", "foreign"]
    if (mode === "coincident" || mode === "keepout") srj.obstacles.push({
      ...structuredClone(srj.obstacles[0]), connectedTo: mode === "coincident" ? ["foreign"] : [],
    })
    if (mode === "retained") {
      nodes[1]._connectedTo = ["retained-trace"]
      srj.traces = [{ type: "pcb_trace", pcb_trace_id: "retained-trace", connection_name: "retained", connectsTo: ["b"], route: [] }]
    }
    const original = structuredClone({ srj, nodes, segments })
    const result = filterTargetPortPointsByPhysicalClearance({
      originalSrj: srj, pairedConnections: srj.connections, capacityMeshNodes: nodes,
      sharedEdgeSegments: segments, traceWidth: 0.15, obstacleMargin: 0.127,
    })
    const expectedZ = ["common", "reversed", "retained"].includes(mode) ? [0, 1] : [1]
    expect(result[0].portPoints[0].availableZ).toEqual(expectedZ)
    expect(result[0].portPoints[0].segmentPortPointId).toBe("port1")
    expect(result[0].portPoints[0].tinyHypergraphPortPenalty).toBe(7)
    expect({ srj, nodes, segments }).toEqual(original)
  }
})
