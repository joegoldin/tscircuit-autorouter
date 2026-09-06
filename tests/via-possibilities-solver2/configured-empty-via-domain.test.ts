import { expect, test } from "bun:test"
import { ViaPossibilitiesSolver2 } from "lib/solvers/ViaPossibilitiesSolver/ViaPossibilitiesSolver2"

test("empty via domain rejects a required via but preserves a zero-via path and legacy behavior", (): void => {
  for (const [endZ, configured] of [[1, true], [0, true], [1, false]] as const) {
    const node = { capacityMeshNodeId: "empty-domain", center: { x: 0, y: 0 }, width: 0.5, height: 2,
      availableZ: [0, 1], portPoints: [
        { connectionName: "route", x: -0.25, y: 0, z: 0, pcb_port_id: "start" },
        { connectionName: "route", x: 0.25, y: 0, z: endZ, pcb_port_id: "end" },
      ] }
    const original = structuredClone(node)
    const solver = new ViaPossibilitiesSolver2({ nodeWithPortPoints: node, viaDiameter: 0.5,
      ...(configured ? { viaCenterBounds: { minX: 0.0635, maxX: -0.0635, minY: -0.6865, maxY: 0.6865 } } : {}),
    })
    solver.solve()
    if (endZ === 1 && configured) {
      expect(solver.failed).toBe(true)
      expect(solver.solved).toBe(false)
      expect(solver.error).toMatch(/empty via-center domain/)
      expect(solver.completedPaths.size).toBe(0)
      expect(solver.portPairMap.size).toBe(1)
    } else {
      expect(solver.solved).toBe(true)
      expect(solver.failed).toBe(false)
      const path = solver.completedPaths.get("route")!
      expect(path[0]).toMatchObject(node.portPoints[0]!)
      expect(path[path.length - 1]).toMatchObject(node.portPoints[1]!)
    }
    expect(node).toEqual(original)
  }
})
