import { expect, test } from "bun:test"
import { PortfolioSingleIntraNodeSolver } from "lib/solvers/HyperHighDensitySolver/PortfolioSingleIntraNodeSolver"
import type { SingleTransitionIntraNodeSolver } from "lib/solvers/HighDensitySolver/SingleTransitionIntraNodeSolver"

test("single-transition portfolio candidate preserves copper width and via clearance", () => {
  const portfolio = new PortfolioSingleIntraNodeSolver({
    nodeWithPortPoints: {
      capacityMeshNodeId: "node",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      portPoints: [
        { x: -2, y: 1.9, z: 0, connectionName: "net" },
        { x: 2, y: 1.9, z: 1, connectionName: "net" },
      ],
    },
    traceWidth: 0.3,
    viaDiameter: 0.5,
    obstacleMargin: 0.4,
  })
  const candidate = portfolio.generateSolver({
    CLOSED_FORM_SINGLE_TRANSITION: true,
  }) as SingleTransitionIntraNodeSolver
  candidate.solve()
  expect(candidate.solved).toBe(true)
  expect(candidate.solvedRoutes[0]!.traceThickness).toBe(0.3)
  expect(candidate.solvedRoutes[0]!.vias[0]!.y).toBeCloseTo(1.35)
})
