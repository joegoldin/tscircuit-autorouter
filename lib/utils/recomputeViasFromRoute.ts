import type { HighDensityRoute } from "lib/types/high-density-types"

type RoutePoint = HighDensityRoute["route"][number]

export const recomputeViasFromRoute = (
  route: ReadonlyArray<RoutePoint>,
  errorContext: string,
): HighDensityRoute["vias"] => {
  const vias: HighDensityRoute["vias"] = []
  const seenLocations = new Set<string>()
  for (let index = 1; index < route.length; index++) {
    const previousPoint = route[index - 1]
    const point = route[index]
    if (previousPoint.z === point.z) continue
    if (previousPoint.toNextSegmentType === "through_obstacle") continue
    if (previousPoint.x !== point.x || previousPoint.y !== point.y) {
      throw new Error(
        `${errorContext} found a layer transition without a via at route point ${index}`,
      )
    }

    const key = `${point.x}:${point.y}`
    if (seenLocations.has(key)) continue
    seenLocations.add(key)
    vias.push({ x: point.x, y: point.y })
  }
  return vias
}
