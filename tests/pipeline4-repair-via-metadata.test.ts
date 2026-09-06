import { expect, test } from "bun:test"
import { Pipeline9RegionalFallbackSolver } from "lib/autorouter-pipelines/AutoroutingPipeline9_PreloadedTraceGraph/Pipeline9RegionalFallbackSolver"
import type {
  HighDensityRoute,
  NodeWithPortPoints,
} from "lib/types/high-density-types"
import type { Obstacle } from "lib/types"
import { convertHdRouteToSimplifiedRoute } from "lib/utils/convertHdRouteToSimplifiedRoute"
import { getConnectivityMapFromSimpleRouteJson } from "lib/utils/getConnectivityMapFromSimpleRouteJson"
import { recomputeViasFromRoute } from "lib/utils/recomputeViasFromRoute"

const RF_CONNECTION = "source_trace_110_fixed_3_0"
const GROUND_CONNECTION = "source_net_0_mst85"

const nodeWithPortPoints: NodeWithPortPoints = {
  capacityMeshNodeId: "cmn_109",
  center: { x: 7.561767, y: -0.0960005 },
  width: 1.293534,
  height: 1.167999,
  portPoints: [
    {
      portPointId: "ground:start",
      nextPortPointId: "ground:end",
      x: 7.47568,
      y: 0.4879989,
      z: 0,
      connectionName: GROUND_CONNECTION,
      rootConnectionName: "connectivity_net1",
    },
    {
      portPointId: "ground:end",
      prevPortPointId: "ground:start",
      x: 7.367499,
      y: -0.68,
      z: 0,
      connectionName: GROUND_CONNECTION,
      rootConnectionName: "connectivity_net1",
    },
    {
      portPointId: "rf:start",
      nextPortPointId: "rf:end",
      x: 6.915,
      y: 0,
      z: 0,
      connectionName: RF_CONNECTION,
      rootConnectionName: "connectivity_net31",
    },
    {
      portPointId: "rf:end",
      prevPortPointId: "rf:start",
      x: 7.77,
      y: -0.68,
      z: 0,
      connectionName: RF_CONNECTION,
      rootConnectionName: "connectivity_net31",
    },
  ],
  portPointsInPairs: [],
  availableZ: [0, 1, 2, 3],
}
nodeWithPortPoints.portPointsInPairs = [
  [nodeWithPortPoints.portPoints[0]!, nodeWithPortPoints.portPoints[1]!],
  [nodeWithPortPoints.portPoints[2]!, nodeWithPortPoints.portPoints[3]!],
]

const obstacles: Obstacle[] = [
  { y: -0.8, net: "p0_23" },
  { y: -0.4, net: "p0_24" },
  { y: 0, net: "connectivity_net31" },
  { y: 0.4, net: "connectivity_net1" },
].map(({ y, net }, index) => ({
  type: "rect",
  layers: ["top"],
  center: { x: 6.44, y },
  width: 0.95,
  height: 0.2,
  connectedTo: [`pcb_smtpad_${index + 27}`, net],
}))

test("pipeline4 repair derives via metadata from repaired layer transitions", () => {
  const srj = {
    layerCount: 4,
    minTraceWidth: 0.1,
    minViaDiameter: 0.6,
    defaultObstacleMargin: 0.15,
    bounds: { minX: 5.8, minY: -1.5, maxX: 8.5, maxY: 0.8 },
    obstacles,
    connections: [
      {
        name: GROUND_CONNECTION,
        rootConnectionName: "connectivity_net1",
        pointsToConnect: [
          { x: 7.47568, y: 0.4879989, layer: "top" as const },
          { x: 7.367499, y: -0.68, layer: "top" as const },
        ],
      },
      {
        name: RF_CONNECTION,
        rootConnectionName: "connectivity_net31",
        pointsToConnect: [
          { x: 6.915, y: 0, layer: "top" as const },
          { x: 7.77, y: -0.68, layer: "top" as const },
        ],
      },
    ],
  }
  const solver = new Pipeline9RegionalFallbackSolver({
    nodeWithPortPoints,
    colorMap: {},
    connMap: getConnectivityMapFromSimpleRouteJson(srj),
    viaDiameter: 0.6,
    traceWidth: 0.1,
    obstacleMargin: 0.15,
    effort: 1,
    obstacles,
    layerCount: 4,
  })

  solver.solve()

  expect(solver.failed).toBe(false)
  const repairedRoute = solver.getOutput().find(
    (route) => route.connectionName === RF_CONNECTION,
  ) as HighDensityRoute
  const transitionPoints = repairedRoute.route.filter((point, index) => {
    const previousPoint = repairedRoute.route[index - 1]
    return (
      previousPoint &&
      previousPoint.z !== point.z &&
      previousPoint.toNextSegmentType !== "through_obstacle"
    )
  })
  const uniqueTransitionLocations = [
    ...new Map(
      transitionPoints.map((point) => [`${point.x}:${point.y}`, point]),
    ).values(),
  ]

  expect(repairedRoute.route[0]).toEqual({ x: 6.915, y: 0, z: 0 })
  expect(repairedRoute.route.at(-1)).toEqual({ x: 7.77, y: -0.68, z: 0 })
  expect(repairedRoute.vias).toEqual(
    uniqueTransitionLocations.map(({ x, y }) => ({ x, y })),
  )
  expect(
    convertHdRouteToSimplifiedRoute(repairedRoute, 4).filter(
      (point) => point.route_type === "via",
    ),
  ).toHaveLength(uniqueTransitionLocations.length)
  expect(
    recomputeViasFromRoute(
      [
        { x: 0, y: 0, z: 0, toNextSegmentType: "through_obstacle" },
        { x: 1, y: 1, z: 3 },
        { x: 2, y: 2, z: 3 },
        { x: 2, y: 2, z: 0 },
        { x: 2, y: 2, z: 1 },
      ],
      "test",
    ),
  ).toEqual([{ x: 2, y: 2 }])
})
