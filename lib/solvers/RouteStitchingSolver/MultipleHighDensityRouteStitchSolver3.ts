import { distance, type Point3 } from "@tscircuit/math-utils"
import { ConnectivityMap } from "connectivity-map"
import { GraphicsObject } from "graphics-debug"
import { SimpleRouteConnection } from "lib/types"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { getConnectionPointLayer } from "lib/types/srj-types"
import { getJumpersGraphics } from "lib/utils/getJumperGraphics"
import { mapLayerNameToZ } from "lib/utils/mapLayerNameToZ"
import { BaseSolver } from "../BaseSolver"
import { safeTransparentize } from "../colors"
import { RouteStitchClearanceValidator } from "./route-stitch-clearance-validator"
import { SingleHighDensityRouteStitchSolver3 } from "./SingleHighDensityRouteStitchSolver3"
import {
  EndpointClusterIndex,
  hasStitchableGapBetweenUnsolvedRoutes,
  selectIslandEndpoints,
  selectRoutesAlongEndpointPath,
  snapIslandEndpointToNearestTerminal,
} from "./routeStitchingEndpointHelpers"
import {
  compareRoutes,
  MAX_TERMINAL_STITCH_GAP_DISTANCE_3,
} from "./routeStitchingShared"

export type UnsolvedRoute3 = {
  connectionName: string
  hdRoutes: HighDensityIntraNodeRoute[]
  start: Point3
  end: Point3
}

export class MultipleHighDensityRouteStitchSolver3 extends BaseSolver {
  override getSolverName(): string {
    return "MultipleHighDensityRouteStitchSolver3"
  }

  unsolvedRoutes: UnsolvedRoute3[]
  activeSolver: SingleHighDensityRouteStitchSolver3 | null = null
  mergedHdRoutes: HighDensityIntraNodeRoute[] = []
  colorMap: Record<string, string> = {}
  defaultTraceThickness: number
  defaultViaDiameter: number
  allowedLayerTransitionPointKeys?: Set<string>
  preserveTerminalPcbPortIds: boolean
  private endpointIndex: EndpointClusterIndex
  private clearanceValidator: RouteStitchClearanceValidator

  private canStitchBetweenTerminals(params: {
    connectionName: string
    hdRoutes: HighDensityIntraNodeRoute[]
    start: Point3 & { pcb_port_id?: string }
    end: Point3 & { pcb_port_id?: string }
    requireCompletePath?: boolean
  }): boolean {
    const endpoints = params.hdRoutes.flatMap((route) => [
      { point: route.route[0], portId: route.startPcbPortId },
      { point: route.route[route.route.length - 1], portId: route.endPcbPortId },
    ])
    if (params.requireCompletePath && ![params.start, params.end].every((terminal) => endpoints.some(
      ({ point, portId }) => point.z === terminal.z &&
        distance(point, terminal) <= MAX_TERMINAL_STITCH_GAP_DISTANCE_3 &&
        (!terminal.pcb_port_id || !portId || portId === terminal.pcb_port_id),
    ))) return false

    const stitchSolver = new SingleHighDensityRouteStitchSolver3({
      connectionName: params.connectionName,
      hdRoutes: params.hdRoutes,
      start: params.start,
      end: params.end,
      colorMap: this.colorMap,
      defaultTraceThickness: this.defaultTraceThickness,
      defaultViaDiameter: this.defaultViaDiameter,
      allowedLayerTransitionPointKeys: this.allowedLayerTransitionPointKeys,
      preserveTerminalPcbPortIds: this.preserveTerminalPcbPortIds,
      isStitchSegmentClear: (stitchSegment) =>
        this.clearanceValidator.isSegmentClear(stitchSegment),
      stitchClearanceMode: "require_clear",
    })

    while (
      !stitchSolver.solved &&
      !stitchSolver.failed &&
      stitchSolver.iterations < stitchSolver.MAX_ITERATIONS
    ) {
      stitchSolver.step()
    }

    if (stitchSolver.failed) return false

    const routeStart = stitchSolver.mergedHdRoute.route[0]
    const routeEnd =
      stitchSolver.mergedHdRoute.route[
        stitchSolver.mergedHdRoute.route.length - 1
      ]

    if (!params.requireCompletePath) {
      const directDistance =
        distance(routeStart, params.start) + distance(routeEnd, params.end)
      const swappedDistance =
        distance(routeStart, params.end) + distance(routeEnd, params.start)
      return Math.min(directDistance, swappedDistance) <=
        MAX_TERMINAL_STITCH_GAP_DISTANCE_3
    }
    if (!stitchSolver.solved) return false

    const matchesTerminal = (
      point: Point3,
      portId: string | undefined,
      terminal: Point3 & { pcb_port_id?: string },
    ): boolean =>
      point.z === terminal.z &&
      distance(point, terminal) <= 1e-6 &&
      (!this.preserveTerminalPcbPortIds || !terminal.pcb_port_id ||
        portId === terminal.pcb_port_id)
    const merged = stitchSolver.mergedHdRoute
    const reachesTerminals =
      (matchesTerminal(routeStart, merged.startPcbPortId, params.start) &&
        matchesTerminal(routeEnd, merged.endPcbPortId, params.end)) ||
      (matchesTerminal(routeStart, merged.startPcbPortId, params.end) &&
        matchesTerminal(routeEnd, merged.endPcbPortId, params.start))

    // Single can report solved after dropping an unbridgeable remainder.
    return reachesTerminals && params.hdRoutes.every((route) =>
      route.route.every((point, index) => {
        const previousPoint = route.route[Math.max(0, index - 1)]
        return merged.route.some((mergedPoint, mergedIndex) => {
          if (mergedPoint.z !== point.z || distance(mergedPoint, point) > 1e-6)
            return false
          if (index === 0 || (previousPoint.z === point.z &&
            distance(previousPoint, point) <= 1e-6)) return true
          return [merged.route[mergedIndex - 1], merged.route[mergedIndex + 1]]
            .some((neighbor) => neighbor && neighbor.z === previousPoint.z &&
              distance(neighbor, previousPoint) <= 1e-6)
        })
      }),
    )
  }

  private getSharedRootPathRoutes(params: {
    connectionName: string
    rootConnectionName?: string
    hdRoutes: HighDensityIntraNodeRoute[]
    allHdRoutes: HighDensityIntraNodeRoute[]
    start: Point3
    end: Point3
  }) {
    const rootConnectionName = params.rootConnectionName
    if (!rootConnectionName) return null

    const currentRouteSet = new Set(params.hdRoutes)
    const sameRootRoutes = params.allHdRoutes.filter(
      (route) =>
        (route.rootConnectionName ?? route.connectionName) ===
        rootConnectionName,
    )

    if (sameRootRoutes.every((route) => currentRouteSet.has(route))) {
      return null
    }

    const pathRoutes = selectRoutesAlongEndpointPath({
      connectionName: params.connectionName,
      hdRoutes: sameRootRoutes,
      start: params.start,
      end: params.end,
      endpointIndex: this.endpointIndex,
      preserveTerminalPcbPortIds: this.preserveTerminalPcbPortIds,
      canStitchBetweenTerminals: (selection) =>
        this.canStitchBetweenTerminals({
          ...selection,
          requireCompletePath: this.preserveTerminalPcbPortIds,
        }),
    })

    const includesSharedRootBridge = pathRoutes.some(
      (route) => !currentRouteSet.has(route),
    )
    // The endpoint path helper returns all candidate routes as a fallback when
    // no path is found, so only accept a strict same-root subset.
    if (!includesSharedRootBridge || pathRoutes.length >= sameRootRoutes.length)
      return null

    return pathRoutes
  }

  constructor(params: {
    connections: SimpleRouteConnection[]
    hdRoutes: HighDensityIntraNodeRoute[]
    colorMap?: Record<string, string>
    layerCount: number
    defaultViaDiameter?: number
    allowedLayerTransitionPointKeys?: Set<string>
    preserveTerminalPcbPortIds?: boolean
    preferSameLayerTerminalEndpoints?: boolean
  }) {
    super()
    this.endpointIndex = new EndpointClusterIndex(
      params.preferSameLayerTerminalEndpoints,
    )
    this.colorMap = params.colorMap ?? {}
    this.allowedLayerTransitionPointKeys =
      params.allowedLayerTransitionPointKeys
    this.preserveTerminalPcbPortIds = params.preserveTerminalPcbPortIds ?? false

    const canonicalHdRoutes = [...params.hdRoutes].sort(compareRoutes)
    this.clearanceValidator = new RouteStitchClearanceValidator({
      hdRoutes: canonicalHdRoutes,
    })

    const firstRoute = canonicalHdRoutes[0]
    this.defaultTraceThickness = firstRoute?.traceThickness ?? 0.15
    this.defaultViaDiameter =
      firstRoute?.viaDiameter ?? params.defaultViaDiameter ?? 0.3

    const routeIslandConnectivityMap = new ConnectivityMap({})
    const routeIslandConnections: Array<string[]> = []
    const pointHashCounts = new Map<string, number>()

    for (let i = 0; i < canonicalHdRoutes.length; i++) {
      const hdRoute = canonicalHdRoutes[i]
      const start = hdRoute.route[0]
      const end = hdRoute.route[hdRoute.route.length - 1]
      routeIslandConnections.push([
        `route_island_${i}`,
        this.endpointIndex.getEndpointKey(hdRoute.connectionName, start),
        this.endpointIndex.getEndpointKey(hdRoute.connectionName, end),
      ])
    }
    routeIslandConnectivityMap.addConnections(routeIslandConnections)
    for (const routeIslandConnection of routeIslandConnections) {
      for (const pointHash of routeIslandConnection.slice(1)) {
        pointHashCounts.set(
          pointHash,
          (pointHashCounts.get(pointHash) ?? 0) + 1,
        )
      }
    }

    this.unsolvedRoutes = []

    const uniqueNets = Array.from(
      new Set(Object.values(routeIslandConnectivityMap.idToNetMap)),
    )

    for (const netName of uniqueNets) {
      const netMembers =
        routeIslandConnectivityMap.getIdsConnectedToNet(netName)

      const hdRoutes = canonicalHdRoutes.filter((r, i) =>
        netMembers.includes(`route_island_${i}`),
      )
      if (hdRoutes.length === 0) continue

      const connection = params.connections.find(
        (c) => c.name === hdRoutes[0].connectionName,
      )!

      const possibleEndpoints1 = hdRoutes.flatMap((r) => [
        r.route[0],
        r.route[r.route.length - 1],
      ])

      const possibleEndpointsByHash = new Map<
        string,
        { x: number; y: number; z: number }
      >()
      const possibleEndpoints2 = []
      for (const possibleEndpoint1 of possibleEndpoints1) {
        const pointHash = this.endpointIndex.getEndpointKey(
          hdRoutes[0].connectionName,
          possibleEndpoint1,
        )
        if (!possibleEndpointsByHash.has(pointHash)) {
          possibleEndpointsByHash.set(pointHash, possibleEndpoint1)
        }
        if (pointHashCounts.get(pointHash) === 1) {
          possibleEndpoints2.push(possibleEndpoint1)
        }
      }

      const candidateEndpoints =
        possibleEndpoints2.length > 0
          ? possibleEndpoints2
          : [...possibleEndpointsByHash.values()]

      if (candidateEndpoints.length === 0) {
        continue
      }

      let start: Point3
      let end: Point3

      if (candidateEndpoints.length >= 2) {
        const globalStart = {
          ...connection.pointsToConnect[0],
          z: mapLayerNameToZ(
            getConnectionPointLayer(connection.pointsToConnect[0]),
            params.layerCount,
          ),
        }
        const globalEnd = {
          ...connection.pointsToConnect[1],
          z: mapLayerNameToZ(
            getConnectionPointLayer(connection.pointsToConnect[1]),
            params.layerCount,
          ),
        }
        ;({ start, end } = selectIslandEndpoints({
          possibleEndpoints: candidateEndpoints,
          globalStart,
          globalEnd,
        }))

        if (
          distance(start, connection.pointsToConnect[1]) <
          distance(end, connection.pointsToConnect[0])
        ) {
          ;[start, end] = [end, start]
        }

        start = snapIslandEndpointToNearestTerminal({
          islandEndpoint: start,
          terminals: [globalStart, globalEnd],
        })
        end = snapIslandEndpointToNearestTerminal({
          islandEndpoint: end,
          terminals: [globalStart, globalEnd],
        })
      } else {
        start = {
          ...connection.pointsToConnect[0],
          z: mapLayerNameToZ(
            getConnectionPointLayer(connection.pointsToConnect[0]),
            params.layerCount,
          ),
        }
        end = {
          ...connection.pointsToConnect[1],
          z: mapLayerNameToZ(
            getConnectionPointLayer(connection.pointsToConnect[1]),
            params.layerCount,
          ),
        }
      }

      const selectedHdRoutes = selectRoutesAlongEndpointPath({
        connectionName: hdRoutes[0].connectionName,
        hdRoutes,
        start,
        end,
        endpointIndex: this.endpointIndex,
        preserveTerminalPcbPortIds: this.preserveTerminalPcbPortIds,
        canStitchBetweenTerminals: (selection) =>
          this.canStitchBetweenTerminals({
            ...selection,
            requireCompletePath: this.preserveTerminalPcbPortIds,
          }),
      })

      this.unsolvedRoutes.push({
        connectionName: hdRoutes[0].connectionName,
        hdRoutes: selectedHdRoutes,
        start,
        end,
      })
    }

    const unsolvedRoutesByConnection = new Map<string, UnsolvedRoute3[]>()
    for (const unsolvedRoute of this.unsolvedRoutes) {
      const routes = unsolvedRoutesByConnection.get(
        unsolvedRoute.connectionName,
      )
      if (routes) {
        routes.push(unsolvedRoute)
      } else {
        unsolvedRoutesByConnection.set(unsolvedRoute.connectionName, [
          unsolvedRoute,
        ])
      }
    }

    this.unsolvedRoutes = Array.from(
      unsolvedRoutesByConnection.entries(),
    ).flatMap(([connectionName, unsolvedRoutes]) => {
      const connection = params.connections.find(
        (c) => c.name === connectionName,
      )
      const hasDegenerateRoute = unsolvedRoutes.some((unsolvedRoute) =>
        unsolvedRoute.hdRoutes.some((hdRoute) => hdRoute.route.length < 2),
      )
      const hasStitchableGap =
        unsolvedRoutes.length > 1 &&
        hasStitchableGapBetweenUnsolvedRoutes(unsolvedRoutes)

      if (!connection) return unsolvedRoutes

      const start = {
        ...connection.pointsToConnect[0],
        z: mapLayerNameToZ(
          getConnectionPointLayer(connection.pointsToConnect[0]),
          params.layerCount,
        ),
      }
      const end = {
        ...connection.pointsToConnect[1],
        z: mapLayerNameToZ(
          getConnectionPointLayer(connection.pointsToConnect[1]),
          params.layerCount,
        ),
      }

      const hdRoutes = unsolvedRoutes.flatMap(
        (unsolvedRoute) => unsolvedRoute.hdRoutes,
      )
      const sharedRootPathRoutes =
        unsolvedRoutes.length > 1
          ? this.getSharedRootPathRoutes({
              connectionName,
              rootConnectionName:
                connection.__rootConnectionNames?.[0] ??
                hdRoutes[0]?.rootConnectionName,
              hdRoutes,
              allHdRoutes: canonicalHdRoutes,
              start,
              end,
            })
          : null

      if (!hasDegenerateRoute && !hasStitchableGap && !sharedRootPathRoutes) {
        return unsolvedRoutes
      }

      return [
        {
          connectionName,
          hdRoutes:
            sharedRootPathRoutes ??
            selectRoutesAlongEndpointPath({
              connectionName,
              hdRoutes,
              start,
              end,
              endpointIndex: this.endpointIndex,
              preserveTerminalPcbPortIds: this.preserveTerminalPcbPortIds,
              canStitchBetweenTerminals: (selection) =>
                this.canStitchBetweenTerminals({
                  ...selection,
                  requireCompletePath: this.preserveTerminalPcbPortIds,
                }),
            }),
          start,
          end,
        },
      ]
    })

    // Shared-root bridges above are selected from the full canonical input.
    // Only remove secondary islands after all requested paths retain coverage.
    const plannedRoutes = this.unsolvedRoutes
    const completePathsByConnection = new Map<string, UnsolvedRoute3 | null>()
    const completeCoverageByConnection = new Map<string, boolean>()
    this.unsolvedRoutes = plannedRoutes.filter((plannedRoute) => {
      const siblings = plannedRoutes.filter(
        (route) => route.connectionName === plannedRoute.connectionName,
      )
      if (siblings.length < 2) return true

      const connection = params.connections.find(
        (connection) => connection.name === plannedRoute.connectionName,
      )!
      const terminals = connection.pointsToConnect.map((point) => ({
        ...point,
        z: mapLayerNameToZ(getConnectionPointLayer(point), params.layerCount),
      }))
      if (!completePathsByConnection.has(connection.name)) {
        completePathsByConnection.set(connection.name, siblings.find((route) =>
          this.canStitchBetweenTerminals({
            ...route,
            start: terminals[0],
            end: terminals[1],
            requireCompletePath: true,
          }),
        ) ?? null)
      }
      const completePath = completePathsByConnection.get(connection.name)
      if (!completePath || completePath === plannedRoute) return true

      const rootConnectionName = connection.__rootConnectionNames?.[0] ??
        plannedRoute.hdRoutes[0]?.rootConnectionName
      const otherConnections = params.connections.filter((other) =>
        other.name !== connection.name && rootConnectionName &&
        (other.__rootConnectionNames?.[0] ?? canonicalHdRoutes.find(
          (route) => route.connectionName === other.name,
        )?.rootConnectionName) === rootConnectionName,
      )
      return !otherConnections.every((other) => {
        if (completeCoverageByConnection.has(other.name))
          return completeCoverageByConnection.get(other.name)!
        const otherRoutes = plannedRoutes.filter(
          (route) => route.connectionName === other.name,
        )
        if (otherRoutes.length !== 1) return false
        const otherTerminals = other.pointsToConnect.map((point) => ({
          ...point,
          z: mapLayerNameToZ(getConnectionPointLayer(point), params.layerCount),
        }))
        const complete = this.canStitchBetweenTerminals({
          ...otherRoutes[0],
          start: otherTerminals[0],
          end: otherTerminals[1],
          requireCompletePath: true,
        })
        completeCoverageByConnection.set(other.name, complete)
        return complete
      })
    })

    this.MAX_ITERATIONS = 100e3
  }

  _step() {
    if (this.activeSolver) {
      this.activeSolver.step()
      if (this.activeSolver.solved) {
        if (this.activeSolver instanceof SingleHighDensityRouteStitchSolver3) {
          this.clearanceValidator.addRoute(this.activeSolver.mergedHdRoute)
          this.mergedHdRoutes.push(this.activeSolver.mergedHdRoute)
        }
        this.activeSolver = null
      } else if (this.activeSolver.failed) {
        this.failed = true
        this.error = this.activeSolver.error
      }
      return
    }

    const unsolvedRoute = this.unsolvedRoutes.pop()

    if (!unsolvedRoute) {
      this.solved = true
      return
    }

    this.activeSolver = new SingleHighDensityRouteStitchSolver3({
      connectionName: unsolvedRoute.connectionName,
      hdRoutes: unsolvedRoute.hdRoutes,
      start: unsolvedRoute.start,
      end: unsolvedRoute.end,
      colorMap: this.colorMap,
      defaultTraceThickness: this.defaultTraceThickness,
      defaultViaDiameter: this.defaultViaDiameter,
      allowedLayerTransitionPointKeys: this.allowedLayerTransitionPointKeys,
      preserveTerminalPcbPortIds: this.preserveTerminalPcbPortIds,
      isStitchSegmentClear: (stitchSegment) =>
        this.clearanceValidator.isSegmentClear(stitchSegment),
      stitchClearanceMode: "prefer_clear",
    })
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      points: [],
      lines: [],
      circles: [],
      rects: [],
      title: "Multiple High Density Route Stitch Solver 3",
    }

    if (this.activeSolver) {
      const activeSolverGraphics = this.activeSolver.visualize()
      if (activeSolverGraphics.points?.length) {
        graphics.points?.push(...activeSolverGraphics.points)
      }
      if (activeSolverGraphics.lines?.length) {
        graphics.lines?.push(...activeSolverGraphics.lines)
      }
      if (activeSolverGraphics.circles?.length) {
        graphics.circles?.push(...activeSolverGraphics.circles)
      }
      if (activeSolverGraphics.rects?.length) {
        if (!graphics.rects) graphics.rects = []
        graphics.rects.push(...activeSolverGraphics.rects)
      }
    }

    for (const [i, mergedRoute] of this.mergedHdRoutes.entries()) {
      const solvedColor =
        this.colorMap[mergedRoute.connectionName] ??
        `hsl(120, 100%, ${40 + ((i * 10) % 40)}%)`

      for (let j = 0; j < mergedRoute.route.length - 1; j++) {
        const p1 = mergedRoute.route[j]
        const p2 = mergedRoute.route[j + 1]
        const segmentColor =
          p1.z !== 0 ? safeTransparentize(solvedColor, 0.5) : solvedColor

        graphics.lines?.push({
          points: [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p2.y },
          ],
          strokeColor: segmentColor,
          strokeWidth: mergedRoute.traceThickness,
        })
      }

      for (const point of mergedRoute.route) {
        const pointColor =
          point.z !== 0 ? safeTransparentize(solvedColor, 0.5) : solvedColor
        graphics.points?.push({
          x: point.x,
          y: point.y,
          color: pointColor,
        })
      }

      for (const via of mergedRoute.vias) {
        graphics.circles?.push({
          center: { x: via.x, y: via.y },
          radius: mergedRoute.viaDiameter / 2,
          fill: solvedColor,
        })
      }

      if (mergedRoute.jumpers && mergedRoute.jumpers.length > 0) {
        const jumperGraphics = getJumpersGraphics(mergedRoute.jumpers, {
          color: solvedColor,
          label: mergedRoute.connectionName,
        })
        graphics.rects!.push(...(jumperGraphics.rects ?? []))
        graphics.lines!.push(...(jumperGraphics.lines ?? []))
      }
    }

    return graphics
  }
}
