import * as dataset01 from "@tscircuit/autorouting-dataset-01"
import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver4 } from "lib/autorouter-pipelines/AutoroutingPipeline4_TinyHypergraph/AutoroutingPipelineSolver4_TinyHypergraph"
import type { SimpleRouteJson } from "lib/types"
import { convertHdRouteToSimplifiedRoute } from "lib/utils/convertHdRouteToSimplifiedRoute"

test("pipeline4 repair preserves an expanded through-obstacle transition", () => {
  const input = (dataset01 as Record<string, unknown>)
    .circuit003 as SimpleRouteJson
  const solver = new AutoroutingPipelineSolver4(input)

  solver.solve()

  expect(solver.failed).toBe(false)
  const repairedRoute = solver.highDensityRepairSolver
    ?.getOutput()
    .find(
      (route) =>
        route.connectionName === "source_net_3_mst2" &&
        route.route[0]?.x === -4.064 &&
        route.route[0]?.y === -5.114,
    )
  expect(repairedRoute).toBeDefined()
  expect(repairedRoute!.route).toEqual([
    { x: -4.064, y: -5.114, z: 1 },
    {
      x: -3.864,
      y: -5.114,
      z: 1,
      toNextSegmentType: "through_obstacle",
    },
    { x: -3.864, y: -5.08, z: 0 },
    { x: -3.175, y: -5.08, z: 0 },
  ])
  expect(repairedRoute!.vias).toEqual([])
  const convertedRoute = convertHdRouteToSimplifiedRoute(
    repairedRoute!,
    input.layerCount,
  )
  expect(
    convertedRoute.filter(
      (point) => point.route_type === "through_obstacle",
    ),
  ).toEqual([
    expect.objectContaining({
      start: { x: -3.864, y: -5.114 },
      end: { x: -3.864, y: -5.08 },
      from_layer: "bottom",
      to_layer: "top",
    }),
  ])
  expect(
    convertedRoute.filter((point) => point.route_type === "via"),
  ).toEqual([])
})
