import { PriorityQueue } from "../../lib/data-structures/PriorityQueue"
import { getConnectivityMapFromSimpleRouteJson } from "../../lib/utils/getConnectivityMapFromSimpleRouteJson"
import { createPipeline7AutoroutingDrcEvaluator } from "../../lib/autorouter-pipelines/AutoroutingPipeline7_MultiGraph/create-pipeline7-autorouting-drc-evaluator"

const input = await Bun.file("/tmp/esp-router-result.json").json()
const srj = { ...input.srj, traces: [] }
let routes = input.routes
const paired = await Bun.file("/tmp/esp-router-pairs.json").json()
const connections = paired.connections
if(process.argv[2]==="fresh") {
  routes=connections.map((c:any)=>({connectionName:c.name,rootConnectionName:c.__rootConnectionNames?.[0]??c.name,traceThickness:srj.minTraceWidth,viaDiameter:srj.minViaPadDiameter,vias:[],pending:true,route:c.pointsToConnect.map((p:any)=>({...p,z:(p.layer??p.layers?.[0])==="top"?0:1}))}))
}
for (const connection of connections) {
  const matching=routes.filter((r:any)=>r.connectionName===connection.name)
  if(matching.length>1) {
    const points=connection.pointsToConnect.map((p:any)=>({...p,z:p.layer==="top"?0:1}))
    routes=routes.filter((r:any)=>r.connectionName!==connection.name)
    routes.push({...matching[0],route:points,vias:[]})
  }
}
const connMap = getConnectivityMapFromSimpleRouteJson(paired)
const same = (a: string, b: string) => a === b || connMap.areIdsConnected(a,b)
const evaluate = createPipeline7AutoroutingDrcEvaluator({ connections, originalConnections: srj.connections,
  layerCount: 2, obstacles: srj.obstacles, defaultViaHoleDiameter: srj.minViaHoleDiameter,
  connMap, srjWithPointPairs: paired, originalSrj: srj })
const cell = 0.05, clearance = 0.15, radius = srj.minTraceWidth / 2, viaRadius = srj.minViaPadDiameter / 2
const xmin = srj.bounds.minX + srj.minBoardEdgeClearance + radius
const ymin = srj.bounds.minY + srj.minBoardEdgeClearance + radius
const nx = Math.floor((srj.bounds.maxX - srj.minBoardEdgeClearance - radius - xmin) / cell) + 1
const ny = Math.floor((srj.bounds.maxY - srj.minBoardEdgeClearance - radius - ymin) / cell) + 1
const plane = nx * ny
const position = (id: number) => ({ x: xmin + (id % nx) * cell, y: ymin + Math.floor((id % plane) / nx) * cell, z: Math.floor(id / plane) })
const pointId = (p: any) => Math.round((p.x-xmin)/cell) + Math.round((p.y-ymin)/cell)*nx + p.z*plane
const segmentDistance = (x: number, y: number, a: any, b: any) => {
  const dx=b.x-a.x,dy=b.y-a.y
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy || 1)))
  return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)
}
function reroute(index: number): any {
  const route = routes[index]
  const original = connections.find((c:any)=>c.name===route.connectionName)
  const terminal=(p:any)=>({...p,z:(p.layer??p.layers?.[0])==="top"?0:1})
  const start=terminal(original.pointsToConnect[0]),end=terminal(original.pointsToConnect.at(-1))
  const key=(p:any)=>`${p.x.toFixed(6)},${p.y.toFixed(6)}`
  const connectedPoints=new Set([key(end)])
  const goalRoutes=new Set<number>()
  for(let changed=false;changed;) {
    changed=false
    for(let i=0;i<routes.length;i++) {
      if(i===index||routes[i].pending||goalRoutes.has(i)||!same(route.rootConnectionName,routes[i].rootConnectionName))continue
      const c=connections.find((c:any)=>c.name===routes[i].connectionName)
      if(c.pointsToConnect.some((p:any)=>connectedPoints.has(key(p)))) {
        goalRoutes.add(i);for(const p of c.pointsToConnect)connectedPoints.add(key(p));changed=true
      }
    }
  }
  const blocked = new Uint8Array(plane * 2), viaBlocked = new Uint8Array(plane)
  const raster = (bounds: any, z: number[], distance: (x:number,y:number)=>number, traceR:number, viaR:number) => {
    const r = Math.max(traceR,viaR) + Math.SQRT2*cell/2
    for(let y=Math.max(0,Math.floor((bounds.minY-r-ymin)/cell));y<=Math.min(ny-1,Math.ceil((bounds.maxY+r-ymin)/cell));y++) {
      for(let x=Math.max(0,Math.floor((bounds.minX-r-xmin)/cell));x<=Math.min(nx-1,Math.ceil((bounds.maxX+r-xmin)/cell));x++) {
        const d=distance(xmin+x*cell,ymin+y*cell)-Math.SQRT2*cell/2
        const id=x+y*nx
        if(d<traceR)for(const layer of z)blocked[id+layer*plane]=1
        if(d<viaR)viaBlocked[id]=1
      }
    }
  }
  for(const o of srj.obstacles) {
    const connected=o.connectedTo.some((id:string)=>same(route.rootConnectionName ?? route.connectionName,id))
    const bounds={minX:o.center.x-o.width/2,maxX:o.center.x+o.width/2,minY:o.center.y-o.height/2,maxY:o.center.y+o.height/2}
    raster(bounds,o.layers.map((l:string)=>l==="top"?0:1),(x,y)=>Math.hypot(Math.max(bounds.minX-x,0,x-bounds.maxX),Math.max(bounds.minY-y,0,y-bounds.maxY)),connected?-Infinity:radius+clearance,viaRadius+clearance)
  }
  for(let otherIndex=0;otherIndex<routes.length;otherIndex++) {
    const other=routes[otherIndex]
    if(other.pending || index===otherIndex || same(route.rootConnectionName ?? route.connectionName,other.rootConnectionName ?? other.connectionName))continue
    for(let k=1;k<other.route.length;k++) {
      const a=other.route[k-1],b=other.route[k]
      if(a.z!==b.z)continue
      const hw=(a.traceThickness??other.traceThickness)/2
      raster({minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)},[a.z],(x,y)=>segmentDistance(x,y,a,b),radius+hw+clearance,viaRadius+hw+clearance)
    }
    for(const v of other.vias)raster({minX:v.x,maxX:v.x,minY:v.y,maxY:v.y},[0,1],(x,y)=>Math.hypot(x-v.x,y-v.y),radius+other.viaDiameter/2+clearance,viaRadius+other.viaDiameter/2+clearance)
  }
  const a=pointId(start),b=pointId(end)
  const goal=new Uint8Array(plane*2)
  goal[b]=1
  let goalMinX=end.x,goalMaxX=end.x,goalMinY=end.y,goalMaxY=end.y
  for(const index of goalRoutes) {
    const path=routes[index].route
    for(let k=1;k<path.length;k++) {
      const a=path[k-1],b=path[k]
      goalMinX=Math.min(goalMinX,a.x,b.x);goalMaxX=Math.max(goalMaxX,a.x,b.x)
      goalMinY=Math.min(goalMinY,a.y,b.y);goalMaxY=Math.max(goalMaxY,a.y,b.y)
      if(a.z!==b.z)continue
      const n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/(cell/2))
      for(let t=0;t<=n;t++)goal[pointId({x:a.x+(b.x-a.x)*t/(n||1),y:a.y+(b.y-a.y)*t/(n||1),z:a.z})]=1
    }
  }
  if(blocked[a] || (!goalRoutes.size && blocked[b]))return null
  const cost=new Float64Array(plane*2).fill(Infinity),parent=new Int32Array(plane*2).fill(-1)
  const queue=new PriorityQueue<{id:number,g:number,f:number}>([],Infinity)
  const heuristic=(id:number)=>{const p=position(id);return Math.hypot(Math.max(goalMinX-p.x,0,p.x-goalMaxX),Math.max(goalMinY-p.y,0,p.y-goalMaxY))}
  cost[a]=0;queue.enqueue({id:a,g:0,f:heuristic(a)})
  let visited=0
  while(!queue.isEmpty()) {
    const current=queue.dequeue()!,id=current.id
    if(current.g!==cost[id])continue
    if(goal[id]) {
      const path:any[]=[]
      for(let k=id;k!==-1;k=parent[k])path.push(position(k))
      path.reverse();path.unshift(start);if(id===b)path.push(end)
      const compact=path.filter((p,i)=>i===0 || p.x!==path[i-1].x || p.y!==path[i-1].y || p.z!==path[i-1].z)
      const simplified=compact.filter((p,i)=> {
        if(i===0 || i===compact.length-1)return true
        const prev=compact[i-1],next=compact[i+1]
        return prev.z!==p.z || p.z!==next.z || Math.abs((p.x-prev.x)*(next.y-p.y)-(p.y-prev.y)*(next.x-p.x))>1e-8
      })
      return {...route,pending:false,traceThickness:srj.minTraceWidth,route:simplified,vias:simplified.filter((p,i)=>i>0 && p.z!==simplified[i-1].z).map(({x,y})=>({x,y}))}
    }
    visited++
    const xy=id%plane,x=xy%nx,y=Math.floor(xy/nx),z=Math.floor(id/plane)
    const offer=(next:number,step:number)=> {
      const g=current.g+step
      if(blocked[next] || g>=cost[next])return
      cost[next]=g;parent[next]=id;queue.enqueue({id:next,g,f:g+heuristic(next)})
    }
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      if((dx===0&&dy===0)||x+dx<0||x+dx>=nx||y+dy<0||y+dy>=ny)continue
      if(dx&&dy&&(blocked[id+dx]||blocked[id+dy*nx]))continue
      offer(id+dx+dy*nx,Math.hypot(dx,dy)*cell)
    }
    const edge=viaRadius-radius
    if(!viaBlocked[xy] && x*cell>=edge && y*cell>=edge && (nx-1-x)*cell>=edge && (ny-1-y)*cell>=edge)offer(xy+(1-z)*plane,1)
  }
  return null
}
if(process.argv[2]==="fresh" || process.argv[2]==="batch") {
  const issues=JSON.stringify((evaluate({traces:[],routes}) as any).errors)
  let order=routes.map((r:any,i:number)=>i).filter((i:number)=>process.argv[2]==="fresh" || issues.includes(routes[i].connectionName+"_") || routes[i].route.some((p:any,k:number)=>{if(!k)return false;const q=routes[i].route[k-1];return Math.min(p.x,q.x)<4.7&&Math.max(p.x,q.x)>-2&&Math.min(p.y,q.y)<4.4&&Math.max(p.y,q.y)>.5})).sort((a:number,b:number)=> {
    const length=(r:any)=>Math.hypot(r.route[0].x-r.route.at(-1).x,r.route[0].y-r.route.at(-1).y)
    return length(routes[a])-length(routes[b])
  })
  for(let pass=0;pass<10;pass++) {
    for(const i of order)routes[i].pending=true
    const failures:number[]=[]
    for(const index of order) {
      const result=reroute(index)
      if(result){routes[index]=result}
      else {failures.push(index);console.log("failed",pass,index,routes[index].connectionName)}
    }
    console.log("fresh failures",failures.length)
    await Bun.write("/tmp/esp-maze-fresh.json",JSON.stringify(routes))
    if(!failures.length)break
    order=[...failures,...order.filter((i:number)=>!failures.includes(i))]
  }
  const result:any=evaluate({traces:[],routes:routes.filter((r:any)=>!r.pending)})
  console.log("fresh drc",result.errors.length)
} else for(let pass=0;pass<5;pass++) {
  const initial:any=evaluate({traces:[],routes})
  console.log("pass",pass,"issues",initial.errors.length)
  if(!initial.errors.length)break
  let improvements=0
  const counts=new Map<number,number>()
  for(const error of initial.errors)for(let i=0;i<routes.length;i++) {
    if(JSON.stringify(error).includes(routes[i].connectionName+"_"))counts.set(i,(counts.get(i)??0)+1)
  }
  for(const [index,count] of [...counts].sort((a,b)=>b[1]-a[1])) {
    const result=reroute(index)
    if(!result){console.log("blocked",routes[index].connectionName,count);continue}
    const before:any=evaluate({traces:[],routes})
    const candidate=routes.map((r:any,i:number)=>i===index?result:r)
    const after:any=evaluate({traces:[],routes:candidate})
    if(after.errors.length<before.errors.length){routes=candidate;improvements++;console.log("repaired",result.connectionName,before.errors.length,after.errors.length)}
    else console.log("rejected",result.connectionName,before.errors.length,after.errors.length)
    await Bun.write("/tmp/esp-maze-routes.json",JSON.stringify(routes))
  }
  if(!improvements)break
}
