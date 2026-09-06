import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { MultiHeadPolyLineIntraNodeSolver } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/MultiHeadPolyLineIntraNodeSolver"
import { computeViaCountVariants } from "lib/solvers/HighDensitySolver/MultiHeadPolyLineIntraNodeSolver/computeViaCountVariants"

test("cmn62 initializer does not turn pair crossings into a hard via bound", () => {
  const pairs = [
    ["source_net_0_mst48", [-2.713, -5.038], [-2.0325, -0.962]],
    ["source_net_8_mst8", [-2.713, -0.962], [-1.577, -1.8]],
    ["source_net_8_mst17", [-3.512, -4.528], [-1.577, -1.8]],
    ["source_net_11_mst2", [-3.512, -1.47], [-1.577, -2.2]],
    ["source_net_9_mst1", [-3.512, -2.488], [-1.577, -1.132]],
    ["source_net_10", [-1.577, -1.4], [-3.512, -3.508]],
  ] as const
  const rootByConnection = new Map([
    ["source_net_8_mst8", "source_net_8"],
    ["source_net_8_mst17", "source_net_8"],
  ])
  const solver = new MultiHeadPolyLineIntraNodeSolver({
    nodeWithPortPoints: {
      capacityMeshNodeId: "cmn_62",
      center: { x: -2.5445, y: -3 },
      width: 1.935,
      height: 4.076,
      availableZ: [0, 1],
      portPoints: pairs.flatMap(([connectionName, start, end]) =>
        [start, end].map(([x, y]) => ({
          x,
          y,
          z: 0,
          connectionName,
          rootConnectionName: rootByConnection.get(connectionName) ?? connectionName,
        })),
      ),
    },
    connMap: new ConnectivityMap({
      source_net_8: ["source_net_8_mst8", "source_net_8_mst17"],
    }),
    viaDiameter: 0.5,
    traceWidth: 0.15,
    obstacleMargin: 0.127,
    enforceConfiguredClearance: true,
    hyperParameters: { SEGMENTS_PER_POLYLINE: 6 },
  })

  expect(solver.failed).toBe(false)
  expect(solver.minViaCount).toBe(0)
  expect(solver.maxViaCount).toBe(6)
  const variants = computeViaCountVariants(
    pairs.map(([connectionName, start, end]) => [
      connectionName,
      {
        start: { x: start[0], y: start[1], z1: 0, z2: 0 },
        end: { x: end[0], y: end[1], z1: 0, z2: 0 },
      },
    ]),
    solver.SEGMENTS_PER_POLYLINE,
    solver.maxViaCount,
    solver.minViaCount,
    (first, second) => solver.connMap?.areIdsConnected(first, second) ?? false,
  )
  expect(variants.length).toBeGreaterThan(0)

  solver.step()
  expect(solver.failed).toBe(false)
  expect(solver.phase).toBe("setup")
  expect(solver.initialCandidateAttempts).toBe(100)
})
