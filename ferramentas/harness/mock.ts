import { CELL, COLS, ROWS, TOWERS } from '../build/game/content'
import type { Enemy, EnemyDef, MapDef, Tower, TowerStats } from '../build/game/types'

const key = (c: number, r: number) => `${c},${r}`
function psd(px:number,py:number,ax:number,ay:number,bx:number,by:number){
  const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy
  if(len===0)return Math.hypot(px-ax,py-ay)
  let t=((px-ax)*dx+(py-ay)*dy)/len; t=Math.max(0,Math.min(1,t))
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy))
}
let uid = 1
export class MockEngine {
  map: MapDef; time = 3.1; shake = 0; wave = 0
  towers: Tower[] = []; enemies: Enemy[] = []; projectiles: never[] = []
  beams: never[] = []; particles: never[] = []; texts: never[] = []
  synergyLinks: Array<[number,number,number,number,string]> = []
  selectedTowerUid: number | null = null
  lives = 17; maxLives = 20; mods = { rangeMul: 1 }
  blocked = new Set<string>(); pathCells = new Set<string>(); padCells = new Set<string>()
  path: Array<{x:number;y:number}> = []; cum: number[] = []; totalLen = 0
  core = {x:0,y:0}; coreCell: [number,number] = [0,0]
  entrance = {x:0,y:0}; entranceAngle = 0
  flyFrom = {x:0,y:0}; flyTo = {x:0,y:0}; flyLen = 0

  constructor(map: MapDef) {
    this.map = map
    const pts = map.waypoints.map(([c,r]) => ({ x: c*CELL+CELL/2, y: r*CELL+CELL/2 }))
    this.path = pts; this.cum = [0]
    let total = 0
    for (let i=1;i<pts.length;i++){ total += Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y); this.cum.push(total) }
    this.totalLen = total
    this.core = pts[pts.length-1]
    this.coreCell = map.waypoints[map.waypoints.length-1]
    this.flyFrom = {...pts[0]}; this.flyTo = this.core
    this.flyLen = Math.hypot(this.flyTo.x-this.flyFrom.x, this.flyTo.y-this.flyFrom.y)
    const a = this.posAt(0,false), b = this.posAt(CELL,false)
    this.entrance = b; this.entranceAngle = Math.atan2(b.y-a.y, b.x-a.x)
    for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
      const cx=c*CELL+CELL/2, cy=r*CELL+CELL/2
      let near=false
      for(let i=1;i<pts.length;i++) if(psd(cx,cy,pts[i-1].x,pts[i-1].y,pts[i].x,pts[i].y)<CELL*0.7){near=true;break}
      if(near){ this.pathCells.add(key(c,r)); this.blocked.add(key(c,r)) }
    }
    for(const [c,r] of map.decor) this.blocked.add(key(c,r))
    const [cc,cr]=this.coreCell
    for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++) this.blocked.add(key(cc+dc,cr+dr))
    for(const [c,r] of map.pads) if(!this.blocked.has(key(c,r))) this.padCells.add(key(c,r))
  }
  posAt(d:number, flying:boolean){
    if(flying){ const t=Math.max(0,Math.min(1,d/this.flyLen))
      return { x:this.flyFrom.x+(this.flyTo.x-this.flyFrom.x)*t, y:this.flyFrom.y+(this.flyTo.y-this.flyFrom.y)*t } }
    if(d<=0)return this.path[0]
    if(d>=this.totalLen)return this.path[this.path.length-1]
    let i=1; while(i<this.cum.length && this.cum[i]<d) i++
    const a=this.path[i-1], b=this.path[i]
    const seg=this.cum[i]-this.cum[i-1], t=seg===0?0:(d-this.cum[i-1])/seg
    return { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t }
  }
  isBuildable(c:number,r:number){ if(c<0||r<0||c>=COLS||r>=ROWS)return false
    if(!this.padCells.has(key(c,r)))return false
    return !this.towers.some(t=>t.col===c&&t.row===r) }
  isPath(c:number,r:number){ return this.pathCells.has(key(c,r)) }
  towerAt(c:number,r:number){ return this.towers.find(t=>t.col===c&&t.row===r) ?? null }
  rawStats(def:{id:string}){ return (TOWERS as never as Record<string,{base:TowerStats}>)[def.id].base }
  statsOf(t:Tower){ return this.rawStats(t.def) }
  addTower(id:string,col:number,row:number,level=3,angle=-Math.PI/2){
    const t = { uid: uid++, def:(TOWERS as never as Record<string,unknown>)[id], col,row,
      x:col*CELL+CELL/2, y:row*CELL+CELL/2, level, branch:null, angle, cooldown:0, spent:0,
      kills:0, damage:0, recoil:0, bob:Math.random()*Math.PI*2, targetUid:1, charge:0 } as unknown as Tower
    this.towers.push(t); return t
  }
  addEnemy(def:EnemyDef, dist:number, o:{hp?:number;shield?:number;maxShield?:number;slow?:boolean;stun?:boolean;poison?:boolean}={}){
    const pos=this.posAt(dist,def.flying), prev=this.posAt(Math.max(0,dist-6),def.flying)
    const e = { uid: uid++, def, hp:o.hp??0.7, maxHp:1, armor:0, shield:o.shield??0,
      maxShield:o.maxShield??0, shieldCooldown:0, dist, x:pos.x, y:pos.y,
      angle:Math.atan2(pos.y-prev.y,pos.x-prev.x), speed:60, phase:Math.random()*Math.PI*2, scale:1,
      fx:{slowFactor:1, slowUntil:o.slow?99:0, stunUntil:o.stun?99:0, dotDps:0, dotUntil:o.poison?99:0, shred:0, markUntil:0},
      healTimer:0, dead:false, leaked:false, spawnFlash:0, hitFlash:0, generation:0 } as unknown as Enemy
    this.enemies.push(e); return e
  }
}
