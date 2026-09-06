// Run Pipeline 7 on a SimpleRouteJson and report the minimum copper clearance after each stage.
// usage: bun run stagecheck.ts <phase-0.input.simple-route.json> [rule=0.15]
import { readFileSync, writeFileSync } from "node:fs"
import { AutoroutingPipelineSolver7_MultiGraph } from "../../dist/index.js"

const srj = JSON.parse(readFileSync(process.argv[2]!, "utf8"))
const rule = Number(process.argv[3] ?? 0.15)
if (process.argv[4]) srj.defaultObstacleMargin = Number(process.argv[4])
const solver = new AutoroutingPipelineSolver7_MultiGraph(srj, {
  enforceConfiguredClearance: true,
})
const t0 = Date.now()
let lastProgressAt = t0
while (!solver.solved && !solver.failed) {
  solver.step()
  if (Date.now() - lastProgressAt >= 15000) {
    console.log(`routing: ${solver.getCurrentPhase()} elapsed=${Date.now() - t0}ms`)
    lastProgressAt = Date.now()
  }
}
console.log(`solved=${solver.solved} failed=${solver.failed} ${solver.error ?? ""} in ${Date.now() - t0}ms`)
if (!solver.solved || solver.failed) throw new Error(`fixture routing failed: ${solver.error}`)

type Pt = { x: number; y: number; z: number }
const d2 = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const segDist = (p: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
const rectDist = (p: Pt, o: any) => {
  const dx = Math.max(o.center.x - o.width / 2 - p.x, 0, p.x - (o.center.x + o.width / 2))
  const dy = Math.max(o.center.y - o.height / 2 - p.y, 0, p.y - (o.center.y + o.height / 2))
  return Math.hypot(dx, dy)
}
const layerZ: Record<string, number> = { top: 0, bottom: srj.layerCount - 1, inner1: 1, inner2: 2 }
const connMap = (solver as any).connMap
const sameNet = (a: string, b: string) => a === b || connMap?.areIdsConnected?.(a, b)

function check(label: string, routes: any[] | undefined, subset?: any[]) {
  if (!routes) { console.log(`${label}: (no routes)`); return }
  let worst = Infinity, worstDesc = "", below = 0
  const samples: Array<{ p: Pt; r: any }> = []
  for (const r of subset ?? routes) {
    const pts = r.route as Pt[]
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, b = pts[i + 1]!
      if (a.z !== b.z) continue
      const n = Math.max(1, Math.ceil(d2(a, b) / 0.05))
      for (let k = 0; k <= n; k++) samples.push({ p: { x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n, z: a.z }, r })
    }
  }
  for (const { p, r } of samples) {
    const name = r.rootConnectionName ?? r.connectionName
    const hw = (r.traceThickness ?? srj.minTraceWidth) / 2
    for (const o of srj.obstacles) {
      if ((o.connectedTo ?? []).some((id: string) => sameNet(name, id))) continue
      if (o.layers && !o.layers.some((l: string) => layerZ[l] === p.z)) continue
      const gap = rectDist(p, o) - hw
      if (gap < worst) { worst = gap; worstDesc = `${name} vs obstacle ${(o.connectedTo ?? [])[0] ?? "?"} @${p.x.toFixed(2)},${p.y.toFixed(2)} z${p.z}` }
      if (gap < rule) below++
    }
    for (const o of routes) {
      const oname = o.rootConnectionName ?? o.connectionName
      if (sameNet(name, oname)) continue
      const ohw = (o.traceThickness ?? srj.minTraceWidth) / 2
      const opts = o.route as Pt[]
      for (let i = 0; i < opts.length - 1; i++) {
        const a = opts[i]!, b = opts[i + 1]!
        if (a.z !== b.z || a.z !== p.z) continue
        const gap = segDist(p, a, b) - hw - ohw
        if (gap < worst) { worst = gap; worstDesc = `${name} vs trace ${oname} @${p.x.toFixed(2)},${p.y.toFixed(2)} z${p.z}` }
        if (gap < rule) below++
      }
      for (const v of o.vias ?? []) {
        const gap = d2(p, { ...v, z: p.z }) - hw - (o.viaDiameter ?? srj.minViaDiameter) / 2
        if (gap < worst) { worst = gap; worstDesc = `${name} vs via of ${oname} @${p.x.toFixed(2)},${p.y.toFixed(2)}` }
        if (gap < rule) below++
      }
    }
  }
  console.log(`${label}: routes=${routes.length} min gap=${worst.toFixed(3)} (${worstDesc}) samples below ${rule}: ${below}`)
  return { minimumGap: worst, belowRuleSamples: below, sampleCount: samples.length }
}

const s: any = solver
// attribute HD-stage violations to the node solver that produced each route
{
  const hd = s.highDensityRouteSolver
  const meta = hd?.nodeSolveMetadataById
  const typeOf = (r: any) => (meta instanceof Map ? meta.get(r.regionId) : meta?.[r.regionId])?.solverType ?? "?"
  const groups: Record<string, any[]> = {}
  for (const r of hd?.routes ?? []) (groups[typeOf(r)] ??= []).push(r)
  for (const [t, rs] of Object.entries(groups)) check(`  HD by solver [${t}]`, hd.routes, rs)
}
const stages: Array<[string, () => any]> = [
  ["highDensityRouteSolver.routes", () => s.highDensityRouteSolver?.routes],
  ["highDensityForceImproveSolver", () => s.highDensityForceImproveSolver?.getOutput?.()],
  ["highDensityRepairSolver", () => s.highDensityRepairSolver?.getOutput?.()],
  ["highDensityStitchSolver.mergedHdRoutes", () => s.highDensityStitchSolver?.mergedHdRoutes],
  ["traceSimplificationSolver.simplifiedHdRoutes", () => s.traceSimplificationSolver?.simplifiedHdRoutes],
  ["traceWidthSolver", () => s.traceWidthSolver?.getHdRoutesWithWidths?.()],
  ["globalDrcForceImproveSolver", () => s.globalDrcForceImproveSolver?.getOutput?.() ?? s.globalDrcForceImproveSolver?.getOutputHdRoutes?.()],
  ["exactGeometryDrcForceImproveSolver", () => s.exactGeometryDrcForceImproveSolver?.getOutput?.() ?? s.exactGeometryDrcForceImproveSolver?.getOutputHdRoutes?.()],
  ["_getOutputHdRoutes (final)", () => s._getOutputHdRoutes?.()],
]
let finalClearance: ReturnType<typeof check>
for (const [label, get] of stages) {
  try {
    const result = check(label, get())
    if (label === "_getOutputHdRoutes (final)") finalClearance = result
  } catch (e) { console.log(`${label}: error ${(e as Error).message}`) }
}
if (
  !finalClearance ||
  finalClearance.sampleCount === 0 ||
  !Number.isFinite(finalClearance.minimumGap) ||
  finalClearance.minimumGap < rule ||
  finalClearance.belowRuleSamples !== 0
) throw new Error("fixture final clearance validation failed")
for (const k of ["globalDrcForceImproveSolver", "exactGeometryDrcForceImproveSolver", "highDensityRepairSolver", "highDensityForceImproveSolver"]) {
  const o = s[k]
  if (o) console.log(k, "methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(o)).filter((m) => /get|routes|Routes/.test(m)).join(", "))
}

const finalRoutes = s._getOutputHdRoutes?.() ?? []
const pairedConnections = s.netToPointPairsSolver?.newConnections ?? []
const outputTraces = solver.getOutputSimplifiedPcbTraces()
if (process.env.STAGECHECK_OUTPUT) {
  writeFileSync(
    process.env.STAGECHECK_OUTPUT,
    JSON.stringify({ pairedConnections, finalRoutes, outputTraces }, null, 2),
  )
}
const routeByConnectionName = new Map(finalRoutes.map((route: any) => [route.connectionName, route]))
const structuralErrors: string[] = []
const tolerance = 1e-6
const getPointZ = (point: any) => point.layer === "top" ? 0 : point.layer === "bottom" ? srj.layerCount - 1 : undefined
const samePoint = (actual: any, expected: any) => {
  const expectedZ = getPointZ(expected)
  const platedHoleSupportsLayer = expected.pcb_port_id && srj.obstacles.some(
    (obstacle: any) =>
      obstacle.connectedTo.includes(expected.pcb_port_id) &&
      obstacle.layers.length > 1 &&
      Math.abs(obstacle.center.x - expected.x) <= tolerance &&
      Math.abs(obstacle.center.y - expected.y) <= tolerance &&
      obstacle.layers.some((layer: string) => layerZ[layer] === actual.z),
  )
  return (
    Math.abs(actual.x - expected.x) <= tolerance &&
    Math.abs(actual.y - expected.y) <= tolerance &&
    (expectedZ === undefined || actual.z === expectedZ || platedHoleSupportsLayer)
  )
}

if (finalRoutes.length === 0) structuralErrors.push("final output has no routes")
if (finalRoutes.length !== pairedConnections.length) {
  structuralErrors.push(`expected ${pairedConnections.length} paired routes, received ${finalRoutes.length}`)
}
if (outputTraces.length !== pairedConnections.length) {
  structuralErrors.push(`expected ${pairedConnections.length} output traces, received ${outputTraces.length}`)
}

for (const connection of pairedConnections) {
  if (connection.pointsToConnect.length !== 2) {
    structuralErrors.push(`${connection.name} has ${connection.pointsToConnect.length} endpoints`)
    continue
  }
  const route: any = routeByConnectionName.get(connection.name)
  if (!route) {
    structuralErrors.push(`${connection.name} has no final route`)
    continue
  }
  if (route.route.length < 2) {
    structuralErrors.push(`${connection.name} has fewer than two route points`)
    continue
  }
  if (!Number.isFinite(route.traceThickness) || route.traceThickness < srj.minTraceWidth) {
    structuralErrors.push(`${connection.name} has invalid trace thickness ${route.traceThickness}`)
  }
  if (Math.abs(route.viaDiameter - srj.minViaPadDiameter) > tolerance) {
    structuralErrors.push(`${connection.name} has via diameter ${route.viaDiameter}`)
  }

  const expectedStart = connection.pointsToConnect[0]
  const expectedEnd = connection.pointsToConnect[1]
  const actualStart = route.route[0]
  const actualEnd = route.route.at(-1)
  const forwardEndpoints = samePoint(actualStart, expectedStart) && samePoint(actualEnd, expectedEnd)
  const reverseEndpoints = samePoint(actualStart, expectedEnd) && samePoint(actualEnd, expectedStart)
  if (!forwardEndpoints && !reverseEndpoints) {
    structuralErrors.push(`${connection.name} endpoint coordinates or layers do not match`)
  }

  const expectedPortIds = connection.pointsToConnect
    .map((point: any) => point.pcb_port_id)
    .filter(Boolean)
    .sort()
  const actualPortIds = [
    route.startPcbPortId ?? actualStart.pcb_port_id,
    route.endPcbPortId ?? actualEnd.pcb_port_id,
  ].filter(Boolean).sort()
  if (expectedPortIds.join("\0") !== actualPortIds.join("\0")) {
    structuralErrors.push(`${connection.name} terminal identities do not match`)
  }

  for (let i = 1; i < route.route.length; i++) {
    const previous = route.route[i - 1]
    const current = route.route[i]
    if (!Number.isInteger(current.z) || current.z < 0 || current.z >= srj.layerCount) {
      structuralErrors.push(`${connection.name} has invalid layer index ${current.z}`)
    }
    if (previous.z === current.z) continue
    const coincident =
      Math.abs(previous.x - current.x) <= tolerance &&
      Math.abs(previous.y - current.y) <= tolerance
    const hasVia = route.vias.some(
      (via: any) =>
        Math.abs(via.x - current.x) <= tolerance &&
        Math.abs(via.y - current.y) <= tolerance,
    )
    if (!coincident || (!hasVia && previous.toNextSegmentType !== "through_obstacle")) {
      structuralErrors.push(`${connection.name} has an invalid transition at route point ${i}`)
    }
  }

  const trace = outputTraces.find((candidate: any) => candidate.pcb_trace_id === `${connection.name}_0`)
  if (!trace) {
    structuralErrors.push(`${connection.name} has no converted output trace`)
    continue
  }
  const expectedPointIds = connection.pointsToConnect.map((point: any) => point.pointId).filter(Boolean).sort()
  if (expectedPointIds.join("\0") !== [...(trace.connectsTo ?? [])].sort().join("\0")) {
    structuralErrors.push(`${connection.name} converted terminal identities do not match`)
  }
  for (const point of trace.route) {
    if (point.route_type !== "via") continue
    if (
      point.via_diameter === undefined ||
      point.via_hole_diameter === undefined ||
      Math.abs(point.via_diameter - srj.minViaPadDiameter) > tolerance ||
      Math.abs(point.via_hole_diameter - srj.minViaHoleDiameter) > tolerance
    ) {
      structuralErrors.push(`${connection.name} has invalid converted via dimensions`)
    }
  }
}

if (structuralErrors.length > 0) {
  throw new Error(`fixture structure validation failed:\n${structuralErrors.slice(0, 20).join("\n")}`)
}
console.log(
  `structure: paired connections=${pairedConnections.length} final routes=${finalRoutes.length} output traces=${outputTraces.length} terminals/layers/transitions/copper=valid`,
)
