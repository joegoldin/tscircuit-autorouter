import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { ViaPossibilitiesSolver2 } from "lib/solvers/ViaPossibilitiesSolver/ViaPossibilitiesSolver2"
import { makeCrossingNode } from "./test-nodes"

test("ViaPossibilitiesSolver2 still detours around foreign paths", (): void => {
  const solver = new ViaPossibilitiesSolver2({
    nodeWithPortPoints: makeCrossingNode(),
    connMap: new ConnectivityMap({ net_a: ["A"], net_b: ["B"] }),
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(
    Array.from(solver.completedPaths.values()).some((path) =>
      path.some(
        (point, index) => index > 0 && point.z !== path[index - 1].z,
      ),
    ),
  ).toBe(true)
})
