import { readFileSync } from "node:fs"
import { AutoroutingPipelineSolver7_MultiGraph } from "../../dist/index.js"
const srj = JSON.parse(readFileSync(process.argv[2]!, "utf8"))
const solver: any = new AutoroutingPipelineSolver7_MultiGraph(srj, {})
while (!solver.solved && !solver.failed) solver.step()
const hd = solver.highDensityRouteSolver
console.log("hd keys", Object.keys(hd).filter(k => !k.startsWith("_")).join(", "))
console.log("route keys", Object.keys(hd.routes[0]).join(", "))
console.log("useGrowShrink", hd.useGrowShrinkHighDensityIntraNodeSolver, "obstacleMargin", hd.obstacleMargin, "traceWidth", hd.traceWidth, "viaDiameter", hd.viaDiameter)
const names: Record<string, number> = {}
for (const r of hd.routes) { const n = r.solverName ?? r.solvedBy ?? "?"; names[n] = (names[n] ?? 0) + 1 }
console.log("route solver names", names)
console.log("solvedRoutes?", hd.solvedRoutes?.length, "failedSolvers?", hd.failedSolvers?.length, "stats", JSON.stringify(hd.cacheStats ?? hd.stats ?? {}).slice(0, 300))
