import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { computeViaCountVariants } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/computeViaCountVariants"

type Point = { x: number; y: number; z1: number; z2: number }
const point = (x: number, y: number): Point => ({ x, y, z1: 0, z2: 0 })
type PortPairEntry = [
  connectionName: string,
  pair: { start: ReturnType<typeof point>; end: ReturnType<typeof point> },
]

test("connected route aliases do not require vias at their shared contact", () => {
  const pairs: PortPairEntry[] = [
    ["branch-a", { start: point(-1, -1), end: point(0, 0) }],
    ["branch-b", { start: point(-1, 1), end: point(0, 0) }],
  ]
  const connMap = new ConnectivityMap({ power: ["branch-a", "branch-b"] })

  const variants = computeViaCountVariants(
    pairs,
    3,
    3,
    0,
    (first, second) => connMap.areIdsConnected(first, second),
  )

  expect(variants).toContainEqual([0, 0])
})
