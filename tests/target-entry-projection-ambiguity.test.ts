import { expect, test } from "bun:test"
import { AvailableSegmentPointSolver } from "lib/solvers/AvailableSegmentPointSolver/AvailableSegmentPointSolver"
import { createTargetEntrySpacingFixture } from "./fixtures/target-entry-spacing-fixture"

test("target projection preserves ambiguous, foreign-owned and non-PCB candidate inputs", (): void => {
  for (const variant of ["multiple", "no-pcb-id", "foreign-owner", "shifted-node-center"] as const) {
    const { srj, nodes, edges } = createTargetEntrySpacingFixture()
    if (variant === "multiple") {
      srj.connections[0]!.pointsToConnect.push({ x: -0.9, y: -1.1, layer: "top", pcb_port_id: "another-terminal" })
    } else if (variant === "no-pcb-id") {
      delete srj.connections[0]!.pointsToConnect[1]!.pcb_port_id
    } else if (variant === "foreign-owner") {
      nodes[1]!._connectedTo = ["unrelated-owner"]
    } else {
      nodes[1]!.center.y = -1.02
    }
    const original = structuredClone({ srj, nodes, edges })
    const common = { nodes, edges, traceWidth: 0.15, obstacleMargin: 0.127, shouldReturnCrampedPortPoints: true }
    const legacy = new AvailableSegmentPointSolver(common)
    const configured = new AvailableSegmentPointSolver({ ...common,
      targetPortProjection: { originalSrj: srj, pairedConnections: srj.connections },
    })
    legacy.solve()
    configured.solve()
    const before = legacy.getOutput()[0]!
    const after = configured.getOutput()[0]!
    if (variant === "shifted-node-center") {
      expect(after.portPoints[0]!.y).toBe(-1)
      expect(after.portPoints[0]!.y).not.toBe(nodes[1]!.center.y)
    } else expect(after).toEqual(before)
    for (const segment of configured.getOutput()) {
      expect(configured.edgeSegmentMap.get(segment.edgeId)).toBe(segment)
      for (const port of segment.portPoints) {
        expect(configured.portPointMap.get(port.segmentPortPointId)).toBe(port)
        expect(port.y).toBeGreaterThanOrEqual(Math.min(segment.start.y, segment.end.y))
        expect(port.y).toBeLessThanOrEqual(Math.max(segment.start.y, segment.end.y))
      }
    }
    expect({ srj, nodes, edges }).toEqual(original)
  }
})
