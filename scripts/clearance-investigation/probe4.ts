import { readFileSync } from "node:fs"
import { AutoroutingPipelineSolver7_MultiGraph } from "../../dist/index.js"
const srj = JSON.parse(readFileSync(process.argv[2]!, "utf8"))
const solver: any = new AutoroutingPipelineSolver7_MultiGraph(srj, {})
while (!solver.solved && !solver.failed) solver.step()
const hd = solver.highDensityRouteSolver
console.log("hd cacheHit", hd.cacheHit, "cacheKey", String(hd.cacheKey).slice(0, 40), "opts.cacheProvider", solver.opts?.cacheProvider ? "set" : "none", "stats", JSON.stringify(hd.stats).slice(0, 200))
