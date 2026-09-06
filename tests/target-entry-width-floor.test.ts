import { expect, test } from "bun:test"
import { createSelectedTargetEntryFixture } from "./fixtures/target-entry-selected-fixture"
import { createTargetEntrySpacingFixture } from "./fixtures/target-entry-spacing-fixture"
import { assertSelectedTargetPortSpacing } from "lib/solvers/AvailableSegmentPointSolver/assertSelectedTargetPortSpacing"

test("selected crossing clearance uses the actual routing-stage width, not the nominal widening goal", (): void => {
  const fixture = createTargetEntrySpacingFixture()
  fixture.srj.connections[0]!.nominalTraceWidth = 0.5
  fixture.srj.connections[1]!.nominalTraceWidth = 0.05
  const { selected, check } = createSelectedTargetEntryFixture(fixture)
  // Nominal width is a later best-effort widening target. Pre-HD copper is0.15mm.
  expect(() => check()).not.toThrow()
  expect(() => assertSelectedTargetPortSpacing({
    nodesWithPortPoints: selected,
    capacityNodes: fixture.nodes,
    originalSrj: fixture.srj,
    pairedConnections: fixture.srj.connections,
    traceWidth: 0.5,
    clearance: 0.127,
  })).toThrow(/require 0.627mm/)
  for (const node of selected) {
    for (const port of node.portPoints.filter((port) => port.portPointId && port.connectionName === "crystal1")) port.z = 1
  }
  expect(() => check()).not.toThrow()
})
