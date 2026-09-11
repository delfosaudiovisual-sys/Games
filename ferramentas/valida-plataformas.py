import math
CELL, COLS, ROWS = 64, 13, 9
def psd(px,py,ax,ay,bx,by):
    dx,dy=bx-ax,by-ay; L=dx*dx+dy*dy
    if L==0: return math.hypot(px-ax,py-ay)
    t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/L))
    return math.hypot(px-(ax+t*dx), py-(ay+t*dy))

MAPS = {
 'margem': dict(  # ex-Jardim
   wp=[(-1,4),(2,4),(2,1),(5,1),(5,6),(8,6),(8,2),(11,2),(11,7)],
   decor=[(0,0),(6,0),(12,0),(0,8),(6,8),(9,4)],
   pads=[(1,3),(1,5),(3,2),(3,4),(4,0),(4,3),(6,1),(6,3),(6,5),(7,4),(7,7),(9,1),(9,3),(9,5),(10,4),(12,2),(12,4)]),
 'pagina': dict(  # ex-Obsidiana
   wp=[(-1,1),(3,1),(3,4),(1,4),(1,7),(6,7),(6,3),(9,3),(9,7),(11,7)],
   decor=[(0,0),(6,0),(12,0),(0,8),(4,5),(8,5)],
   pads=[(1,0),(3,0),(2,2),(4,2),(4,4),(0,5),(2,5),(0,7),(3,6),(5,6),(5,3),(7,2),(8,4),(8,6),(10,4)]),
 'tinteiro': dict(  # ex-Cume
   wp=[(-1,7),(2,7),(2,4),(5,4),(5,7),(8,7),(8,3),(6,3),(6,1),(11,1),(11,6)],
   decor=[(0,0),(3,0),(0,8),(3,8),(9,8),(9,4)],
   pads=[(1,4),(1,6),(3,3),(3,6),(4,5),(4,7),(5,2),(6,6),(7,2),(7,5),(8,0),(9,2),(9,5),(10,3),(12,1),(12,3)]),
}

ok_all=True
for name,m in MAPS.items():
    pts=[(c*CELL+CELL/2, r*CELL+CELL/2) for c,r in m['wp']]
    path=set(); 
    for c in range(COLS):
        for r in range(ROWS):
            cx,cy=c*CELL+CELL/2, r*CELL+CELL/2
            if any(psd(cx,cy,*pts[i-1],*pts[i])<CELL*0.7 for i in range(1,len(pts))):
                path.add((c,r))
    blocked=set(path)|set(m['decor'])
    core=m['wp'][-1]
    for dc in(-1,0,1):
        for dr in(-1,0,1): blocked.add((core[0]+dc,core[1]+dr))
    pads=m['pads']; errs=[]
    if len(pads)!=len(set(pads)): errs.append('plataformas duplicadas')
    for p in pads:
        c,r=p
        if not(0<=c<COLS and 0<=r<ROWS): errs.append(f'{p} fora da grade')
        elif p in path: errs.append(f'{p} está na estrada')
        elif p in blocked: errs.append(f'{p} em célula bloqueada (decor/núcleo)')
        elif not any((c+dx,r+dy) in path for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):
            errs.append(f'{p} não encosta na estrada (posição sem uso)')
    for i,a in enumerate(pads):
        for b in pads[i+1:]:
            if abs(a[0]-b[0])+abs(a[1]-b[1])==1: errs.append(f'{a} e {b} coladas')
    free=sum(1 for c in range(COLS) for r in range(ROWS) if (c,r) not in blocked)
    status='OK' if not errs else 'FALHOU'
    print(f"[{status}] {name}: {len(pads)} plataformas (antes: {free} células livres)")
    for e in errs: print('   -',e); 
    if errs: ok_all=False
print('\nTODOS VALIDADOS' if ok_all else '\nCORRIGIR ACIMA')
