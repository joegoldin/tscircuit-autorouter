import { expect, test } from "bun:test"
import { createInvalidDirectConnectionRoutes } from "lib/solvers/HyperHighDensitySolver/GrowShrinkHighDensityIntraNodeSolver/invalidSameLayerCrossingGeometry"

test("direct repair candidates preserve endpoint layers and represent transitions with vias", () => {
  const routes = createInvalidDirectConnectionRoutes({
    capacityMeshNodeId: "node",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    availableZ: [0, 1],
    portPoints: [
      { x: -1, y: 0, z: 1, connectionName: "net" },
      { x: 1, y: 0, z: 0, connectionName: "net" },
    ],
  }, 0.15, 0.5)
  const route = routes[0]!
  expect(route.route[0]).toEqual({ x: -1, y: 0, z: 1 })
  expect(route.route.at(-1)).toEqual({ x: 1, y: 0, z: 0 })
  expect(route.vias).toHaveLength(1)
  for (let index = 1; index < route.route.length; index++) {
    const a = route.route[index - 1]!
    const b = route.route[index]!
    if (a.z !== b.z) {
      expect(a.x).toBe(b.x)
      expect(a.y).toBe(b.y)
      expect(route.vias).toContainEqual({ x: a.x, y: a.y })
    }
  }
})
