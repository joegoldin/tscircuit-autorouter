import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import type { SimpleRouteJson } from "lib/types"

const createSrj = (): SimpleRouteJson => ({
  layerCount: 2,
  minTraceWidth: 0.15,
  minTraceToPadEdgeClearance: 0.15,
  bounds: { minX: -2, minY: -2, maxX: 2, maxY: 2 },
  obstacles: [],
  connections: [
    {
      name: "source_net_1",
      pointsToConnect: [
        { x: -1, y: 0, layer: "top" },
        { x: 1, y: 0, layer: "top" },
      ],
    },
  ],
})

test("Pipeline7 enables configured-clearance geometry only by explicit option", () => {
  for (const [enforceConfiguredClearance, expected] of [
    [undefined, false],
    [true, true],
  ] as const) {
    const solver = new AutoroutingPipelineSolver7_MultiGraph(createSrj(), {
      cacheProvider: null,
      ...(enforceConfiguredClearance === undefined
        ? {}
        : { enforceConfiguredClearance }),
    })

    solver.solve()

    expect(solver.solved).toBeTrue()
    expect(solver.failed).toBeFalse()
    expect(
      solver.topologyPlanningSolver?.inputProblem.enforceConfiguredClearance,
    ).toBe(expected)
    expect(solver.highDensityRouteSolver?.enforceConfiguredClearance).toBe(
      expected,
    )
    expect(
      solver.highDensityRouteSolver?.useConfiguredCopperDimensions,
    ).toBe(expected)
  }
})
