import { readFileSync } from "node:fs"
import { AutoroutingPipelineSolver7_MultiGraph } from "../../dist/index.js"
const srj = JSON.parse(readFileSync(process.argv[2]!, "utf8"))
const solver: any = new AutoroutingPipelineSolver7_MultiGraph(srj, {})
while (!solver.solved && !solver.failed) solver.step()
const hd = solver.highDensityRouteSolver
const meta = hd.nodeSolveMetadataById
const m = (id: string) => (meta instanceof Map ? meta.get(id) : meta?.[id])
const connMap = solver.connMap
const same = (a: string, b: string) => a === b || connMap?.areIdsConnected?.(a, b)
type P = { x: number; y: number; z: number }
const segDist = (p: P, a: P, b: P) => { const dx = b.x - a.x, dy = b.y - a.y; const l2 = dx * dx + dy * dy; let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) }
const worst: any[] = []
for (const r of hd.routes) {
  const rn = r.rootConnectionName ?? r.connectionName
  for (const o of hd.routes) {
    const on = o.rootConnectionName ?? o.connectionName
    if (same(rn, on)) continue
    for (const v of o.vias ?? []) {
      for (let i = 0; i < r.route.length - 1; i++) {
        const a = r.route[i], b = r.route[i + 1]
        if (a.z !== b.z) continue
        const gap = segDist({ ...v, z: a.z }, a, b) - r.traceThickness / 2 - o.viaDiameter / 2
        if (gap < 0.05) worst.push({ gap: +gap.toFixed(3), trace: rn, traceNode: r.regionId, traceSolver: m(r.regionId)?.solverType, via: on, viaNode: o.regionId, viaSolver: m(o.regionId)?.solverType, viaAt: `${v.x.toFixed(2)},${v.y.toFixed(2)}`, seg: `${a.x.toFixed(2)},${a.y.toFixed(2)}->${b.x.toFixed(2)},${b.y.toFixed(2)} z${a.z}` })
      }
    }
  }
}
worst.sort((x, y) => x.gap - y.gap)
for (const w of worst.slice(0, 8)) console.log(JSON.stringify(w))
const node = (id: string) => m(id)?.node
for (const w of worst.slice(0, 3)) { const n1 = node(w.traceNode), n2 = node(w.viaNode); console.log(w.traceNode, n1 && `${n1.center.x.toFixed(2)},${n1.center.y.toFixed(2)} ${n1.width.toFixed(2)}x${n1.height.toFixed(2)}`, "|", w.viaNode, n2 && `${n2.center.x.toFixed(2)},${n2.center.y.toFixed(2)} ${n2.width.toFixed(2)}x${n2.height.toFixed(2)}`) }
