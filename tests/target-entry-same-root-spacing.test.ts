import { expect, test } from "bun:test"
import { createSelectedTargetEntryFixture } from "./fixtures/target-entry-selected-fixture"
import { createTargetEntrySpacingFixture } from "./fixtures/target-entry-spacing-fixture"
import { assertSelectedTargetPortSpacing } from "lib/solvers/AvailableSegmentPointSolver/assertSelectedTargetPortSpacing"

test("selected target crossings may coincide only with explicitly shared ownership", (): void => {
  for (const sameRoot of [false, true]) {
    const fixture = createTargetEntrySpacingFixture()
    if (sameRoot) {
      fixture.srj.connections[0]!.rootConnectionName = "declared-shared-net"
      fixture.srj.connections[1]!.rootConnectionName = "declared-shared-net"
    }
    const { selected } = createSelectedTargetEntryFixture(fixture)
    for (const node of selected) {
      for (const port of node.portPoints.filter((port) => port.portPointId)) {
        port.y = -1.2
        // Undeclared display/root metadata must not create an electrical alias.
        port.rootConnectionName = "same-display-label"
      }
    }
    const original = structuredClone(selected)
    const check = () => assertSelectedTargetPortSpacing({
      nodesWithPortPoints: selected,
      capacityNodes: fixture.nodes,
      originalSrj: fixture.srj,
      pairedConnections: fixture.srj.connections,
      traceWidth: fixture.srj.minTraceWidth,
      clearance: 0.127,
    })
    if (sameRoot) expect(check).not.toThrow()
    else expect(check).toThrow(/Target-entry crossing clearance conflict/)
    expect(selected).toEqual(original)
    expect(new Set(selected.flatMap((node) => node.portPoints.map((port) => port.connectionName))).size).toBe(2)
  }
})
