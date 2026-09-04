// Run Pipeline 7 on a SimpleRouteJson and report the minimum copper clearance after each stage.
// usage: bun run stagecheck.ts <phase-0.input.simple-route.json> [rule=0.15]
import { readFileSync } from "node:fs"
import { AutoroutingPipelineSolver7_MultiGraph } from "../../dist/index.js"

const srj = JSON.parse(readFileSync(process.argv[2]!, "utf8"))
const rule = Number(process.argv[3] ?? 0.15)
if (process.argv[4]) srj.defaultObstacleMargin = Number(process.argv[4])
const solver = new AutoroutingPipelineSolver7_MultiGraph(srj, {})
const t0 = Date.now()
while (!solver.solved && !solver.failed) solver.step()
console.log(`solved=${solver.solved} failed=${solver.failed} ${solver.error ?? ""} in ${Date.now() - t0}ms`)

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
for (const [label, get] of stages) {
  try { check(label, get()) } catch (e) { console.log(`${label}: error ${(e as Error).message}`) }
}
for (const k of ["globalDrcForceImproveSolver", "exactGeometryDrcForceImproveSolver", "highDensityRepairSolver", "highDensityForceImproveSolver"]) {
  const o = s[k]
  if (o) console.log(k, "methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(o)).filter((m) => /get|routes|Routes/.test(m)).join(", "))
}
