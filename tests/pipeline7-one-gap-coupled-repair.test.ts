import { expect, test } from "bun:test"
import {
  GlobalDrcBranchPortfolioSolver,
  type HighDensityRoute,
  type SimpleRouteJson as RepairSimpleRouteJson,
} from "high-density-repair03/lib"
import { AutoroutingPipelineSolver7_MultiGraph } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/AutoroutingPipelineSolver7_MultiGraph"
import { createPipeline7AutoroutingDrcEvaluator } from "lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/create-pipeline7-autorouting-drc-evaluator"

type RoutePoint = HighDensityRoute["route"][number]
type FixtureRoutePoint = RoutePoint & { traceThickness?: number }
type FixtureHighDensityRoute = Omit<HighDensityRoute, "route"> & {
  route: FixtureRoutePoint[]
}

type OneGapFixture = {
  srj: RepairSimpleRouteJson
  routes: FixtureHighDensityRoute[]
}

const getPointTraceThickness = (point: RoutePoint): number | undefined => {
  if (!("traceThickness" in point)) return undefined
  if (typeof point.traceThickness !== "number") {
    throw new Error("Route point traceThickness must be a number")
  }
  return point.traceThickness
}

test("repairs the saved one-gap route with the production coupled portfolio", async () => {
  const fixture = (await Bun.file(
    new URL(
      "../docs/clearance-evidence/one-gap-fixture.json",
      import.meta.url,
    ),
  ).json()) as OneGapFixture
  const sourceArtifactJson = JSON.stringify(fixture)
  const { traces: _fixtureTraces, ...routingInput } = structuredClone(
    fixture.srj,
  )
  const pipeline = new AutoroutingPipelineSolver7_MultiGraph(routingInput)
  while (pipeline.currentPipelineStepIndex < 4 && !pipeline.failed) {
    pipeline.step()
  }
  expect(pipeline.failed).toBe(false)
  const srjWithPointPairs = pipeline.srjWithPointPairs!
  if (srjWithPointPairs.traces?.length) {
    throw new Error("One-gap repair input must not contain preloaded traces")
  }
  const { traces: _pipelineTraces, ...repairSrj } = srjWithPointPairs
  const drcEvaluator = createPipeline7AutoroutingDrcEvaluator({
    connections: pipeline.netToPointPairsSolver!.newConnections,
    originalConnections: pipeline.originalSrj.connections,
    layerCount: srjWithPointPairs.layerCount,
    obstacles: pipeline.srj.obstacles,
    defaultViaHoleDiameter: pipeline.viaHoleDiameter,
    connMap: pipeline.connMap,
    srjWithPointPairs,
    originalSrj: pipeline.originalSrj,
  })
  const initialResult = drcEvaluator({
    traces: [],
    hdRoutes: fixture.routes,
  })
  const initialErrors = Array.isArray(initialResult)
    ? initialResult
    : initialResult.errors
  expect(initialErrors).toHaveLength(1)

  const repairSolver = new GlobalDrcBranchPortfolioSolver({
    srj: repairSrj,
    hdRoutes: fixture.routes,
    connMap: pipeline.connMap,
    effort: pipeline.effort,
    viaHoleDiameter: pipeline.viaHoleDiameter,
    drcEvaluator,
    viaInPadDrcEvaluator: drcEvaluator,
    maxIterations: 32,
    enableLargeBoardBroadFallback: false,
    enableBroadFallback: false,
    enableTargetedErrorSweep: true,
    enablePostSolveClearanceRelaxation: false,
    enableSafeTraceLayerMoves: true,
    enableViaInPadLayerMoves: pipeline.originalSrj.allowViaInPad ?? false,
    viaInPadMaxIterations: 32,
    broadMaxIterations: 12,
    broadPassMultiplier: 3,
    coupledBroadPassMultipliers: [1, 2],
  })

  repairSolver.solve()

  const output = repairSolver.getOutput()
  const finalResult = drcEvaluator({
    traces: [],
    hdRoutes: output,
  })
  const finalErrors = Array.isArray(finalResult)
    ? finalResult
    : finalResult.errors
  expect(repairSolver.solved).toBe(true)
  expect(repairSolver.failed).toBe(false)
  expect(output).toHaveLength(148)
  expect(output.every((route) => route.route.length > 0)).toBe(true)
  expect(finalErrors).toHaveLength(0)
  expect(
    output.map(({ connectionName, rootConnectionName }) => ({
      connectionName,
      rootConnectionName,
    })),
  ).toEqual(
    fixture.routes.map(({ connectionName, rootConnectionName }) => ({
      connectionName,
      rootConnectionName,
    })),
  )
  expect(
    output.map(({ route }) => ({
      start: {
        x: route[0]!.x,
        y: route[0]!.y,
        z: route[0]!.z,
        pcb_port_id: route[0]!.pcb_port_id,
      },
      end: {
        x: route.at(-1)!.x,
        y: route.at(-1)!.y,
        z: route.at(-1)!.z,
        pcb_port_id: route.at(-1)!.pcb_port_id,
      },
    })),
  ).toEqual(
    fixture.routes.map(({ route }) => ({
      start: {
        x: route[0]!.x,
        y: route[0]!.y,
        z: route[0]!.z,
        pcb_port_id: route[0]!.pcb_port_id,
      },
      end: {
        x: route.at(-1)!.x,
        y: route.at(-1)!.y,
        z: route.at(-1)!.z,
        pcb_port_id: route.at(-1)!.pcb_port_id,
      },
    })),
  )
  expect(
    output.map(({ traceThickness, viaDiameter, route }) => ({
      traceThickness,
      viaDiameter,
      pointWidths: Array.from(
        new Set(
          route.map(
            (point) => getPointTraceThickness(point) ?? traceThickness,
          ),
        ),
      ),
    })),
  ).toEqual(
    fixture.routes.map(({ traceThickness, viaDiameter, route }) => ({
      traceThickness,
      viaDiameter,
      pointWidths: Array.from(
        new Set(
          route.map((point) => point.traceThickness ?? traceThickness),
        ),
      ),
    })),
  )
  let transitionCount = 0
  for (const route of output) {
    for (let index = 1; index < route.route.length; index += 1) {
      const previous = route.route[index - 1]!
      const point = route.route[index]!
      if (previous.z === point.z) continue
      transitionCount += 1
      expect({ x: point.x, y: point.y }).toEqual({
        x: previous.x,
        y: previous.y,
      })
    }
  }
  expect(transitionCount).toBeGreaterThan(0)
  expect(JSON.stringify(fixture)).toBe(sourceArtifactJson)

  ;(
    pipeline as unknown as {
      globalDrcForceImproveSolver: { getOutput: () => HighDensityRoute[] }
    }
  ).globalDrcForceImproveSolver = { getOutput: () => output }
  const exactStep = pipeline.pipelineDef.find(
    (step) => step.solverName === "exactGeometryDrcForceImproveSolver",
  ) as unknown as {
    getConstructorParams: (
      instance: AutoroutingPipelineSolver7_MultiGraph,
    ) => [
      {
        hdRoutes: HighDensityRoute[]
        drcEvaluator: typeof drcEvaluator
        viaInPadDrcEvaluator: typeof drcEvaluator
        enableBroadFallback: boolean
        enableLargeBoardBroadFallback: boolean
        enablePostSolveClearanceRelaxation: boolean
        coupledBroadPassMultipliers?: readonly number[]
      },
    ]
  }
  const [productionParams] = exactStep.getConstructorParams(pipeline)
  const productionResult = productionParams.drcEvaluator({
    traces: [],
    hdRoutes: productionParams.hdRoutes,
  })
  const productionErrors = Array.isArray(productionResult)
    ? productionResult
    : productionResult.errors
  expect(productionErrors).toHaveLength(0)
  expect(productionParams.viaInPadDrcEvaluator).toBe(
    productionParams.drcEvaluator,
  )
  expect(productionParams.enableBroadFallback).toBe(false)
  expect(productionParams.enableLargeBoardBroadFallback).toBe(false)
  expect(productionParams.enablePostSolveClearanceRelaxation).toBe(false)
  expect(productionParams.coupledBroadPassMultipliers).toEqual([1, 2])
})
