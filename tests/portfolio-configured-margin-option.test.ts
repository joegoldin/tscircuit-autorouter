import { expect, test } from "bun:test"
import {
  HighDensitySolverA01,
  HighDensitySolverA03,
} from "@tscircuit/high-density-a01"
import { PortfolioSingleIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/PortfolioSingleIntraNodeSolver"

test("portfolio candidates use configured margins only in strict mode", () => {
  for (const [enforceConfiguredClearance, expectedMargin] of [
    [false, 0.1],
    [true, 0.4],
  ] as const) {
    const portfolio = new PortfolioSingleIntraNodeSolver({
      nodeWithPortPoints: {
        capacityMeshNodeId: "node",
        center: { x: 0, y: 0 },
        width: 4,
        height: 4,
        portPoints: [
          { x: -2, y: 0, z: 0, connectionName: "net" },
          { x: 2, y: 0, z: 0, connectionName: "net" },
        ],
      },
      traceWidth: 0.3,
      viaDiameter: 0.5,
      obstacleMargin: 0.4,
      enforceConfiguredClearance,
    })

    const a01 = portfolio.generateSolver({ HIGH_DENSITY_A01: true })
    const a03 = portfolio.generateSolver({ HIGH_DENSITY_A03: true })

    expect(a01).toBeInstanceOf(HighDensitySolverA01)
    expect(a03).toBeInstanceOf(HighDensitySolverA03)
    expect((a01 as unknown as HighDensitySolverA01).traceMargin).toBe(
      expectedMargin,
    )
    expect((a03 as unknown as HighDensitySolverA03).traceMargin).toBe(
      expectedMargin,
    )
  }
})
