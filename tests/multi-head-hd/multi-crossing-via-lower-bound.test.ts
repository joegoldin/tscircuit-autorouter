import { expect, test } from "bun:test"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"
import { computeViaCountVariants } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/computeViaCountVariants"

type Point = { x: number; y: number; z1: number; z2: number }
const point = (x: number, y: number): Point => ({ x, y, z1: 0, z2: 0 })
type PortPairEntry = [
  connectionName: string,
  pair: { start: ReturnType<typeof point>; end: ReturnType<typeof point> },
]

test("one two-via bridge can resolve multiple same-layer crossings", () => {
  const pairs: PortPairEntry[] = [
    ["parallel-a", { start: point(-2, -0.5), end: point(2, -0.5) }],
    ["parallel-b", { start: point(-2, 0.5), end: point(2, 0.5) }],
    ["bridge", { start: point(0, -2), end: point(0, 2) }],
  ]
  const node = {
    capacityMeshNodeId: "multi-crossing",
    center: { x: 0, y: 0 },
    width: 4,
    height: 4,
    availableZ: [0, 1],
    portPoints: pairs.flatMap(([connectionName, pair]) => [
      { ...pair.start, z: 0, connectionName },
      { ...pair.end, z: 0, connectionName },
    ]),
  }

  const solver = new MultiHeadPolyLineIntraNodeSolver({
    nodeWithPortPoints: node,
    hyperParameters: { SEGMENTS_PER_POLYLINE: 3 },
  })
  expect(solver.failed).toBe(false)
  expect(solver.minViaCount).toBe(0)

  const variants = computeViaCountVariants(pairs, 3, 3, solver.minViaCount)
  expect(variants).toContainEqual([0, 0, 2])
})
