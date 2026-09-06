import { expect, test } from "bun:test"
import { createTargetEntrySpacingFixture } from "./fixtures/target-entry-spacing-fixture"
import { createSelectedTargetEntryFixture } from "./fixtures/target-entry-selected-fixture"

test("configured P7 rejects impossible selected target intervals without losing a connection", (): void => {
  const fixture = createTargetEntrySpacingFixture()
  fixture.nodes[0]!.center = { x: -1, y: 0 }
  fixture.nodes[0]!.width = 2
  fixture.nodes[0]!.height = 2
  for (const [i, y] of [-0.1, 0.1].entries()) {
    const node = fixture.nodes[i + 1]!
    node.center = { x: 1, y }
    node.width = 2
    node.height = 0.02
    fixture.srj.connections[i]!.pointsToConnect[0] = { x: -1, y, layer: "top", pcb_port_id: `remote${i}` }
    fixture.srj.connections[i]!.pointsToConnect[1] = { x: 1, y, layer: "top", pcb_port_id: `pcb_port_${51 + i}` }
    fixture.srj.obstacles[i]!.center = { x: 1, y }
    fixture.srj.obstacles[i]!.width = 0.1
    fixture.srj.obstacles[i]!.height = 0.02
  }
  // Even opposite ends of these two intervals are only0.22mm apart.
  expect(0.22 - fixture.srj.minTraceWidth).toBeLessThan(0.127)
  const { selected, check } = createSelectedTargetEntryFixture(fixture)
  const original = structuredClone(selected)
  expect(() => check()).toThrow(/Target-entry crossing clearance conflict/)
  expect(selected).toEqual(original)
  expect(new Set(selected.flatMap((node) => node.portPoints.map((port) => port.connectionName))).size).toBe(2)
  expect(() => createSelectedTargetEntryFixture(fixture, false).check()).not.toThrow()
})
