import { expect, test } from "bun:test"
import { PortfolioSingleIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/PortfolioSingleIntraNodeSolver"
import type { HighDensitySolverA03 } from "@tscircuit/high-density-a01"

test("A03 portfolio candidate routes with the requested copper width", () => {
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
    viaDiameter: 0.45,
    obstacleMargin: 0.15,
    enforceConfiguredClearance: true,
  })
  const candidate = portfolio.generateSolver({ HIGH_DENSITY_A03: true }) as unknown as HighDensitySolverA03
  candidate.solve()
  expect(candidate.solved).toBe(true)
  expect(candidate.getOutput()[0]!.traceThickness).toBe(0.3)
})
