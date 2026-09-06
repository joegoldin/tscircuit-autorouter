import { expect, test } from "bun:test"
import { TinyHypergraphPortPointPathingSolver } from "lib/solvers/PortPointPathingSolver/tinyhypergraph/TinyHypergraphPortPointPathingSolver"
import { createOwnershipParams, getOwnership } from "./fixtures/tiny-root-ownership"

test("declared root preserves a buried thermal bridge through Tiny routing", () => {
  const params = createOwnershipParams()
  const original = structuredClone(params)
  const owners = getOwnership(params)
  expect(owners.get("hole")).toBe(owners.get("top"))
  expect(owners.get("bottom")).toBe(owners.get("top"))
  const solver = new TinyHypergraphPortPointPathingSolver(params)
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  const nodes = solver.getOutput().nodesWithPortPoints
  const hole = nodes.find((node) => node.capacityMeshNodeId === "hole")!
  expect(hole.availableZ).toEqual([0, 1])
  expect(hole.portPoints.map(({ x, y, z }) => ({ x, y, z }))).toEqual([
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
  ])
  expect(nodes.flatMap((node) => node.portPoints).filter((port) => port.pcb_port_id)
    .map(({ x, y, z, pcb_port_id }) => ({ x, y, z, pcb_port_id }))).toEqual([
      { x: 1, y: 0, z: 0, pcb_port_id: "pcb_port_source" },
      { x: -3.325, y: 0, z: 0, pcb_port_id: "pcb_port_destination" },
    ])
  expect(params).toEqual(original)
})
