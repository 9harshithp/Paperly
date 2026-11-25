"""Render deterministic low-poly landscape paintings for the chapter carousel."""
import colorsys
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUTPUT = Path(__file__).resolve().parents[1] / "dist" / "art"
OUTPUT.mkdir(exist_ok=True)
# Zenith, west/east horizon, far and near ridges, terrain shadow/sun, trees, sun.
SCENES = {
    "icy-dunes": ("snow", "51416E BCA0C1 FFC3A2 D6AFBD A88DA9 5F5B83 EAC8D6 302F48 FFE5B3", 2),
    "ociano": ("sea", "4282A6 B6DBD9 FFD5B8 B8C8C5 709BA6 337C8D 80CAD0 365B61 FFF2D5", 42),
    "candy-land": ("candy", "9784C9 F3C7CA FFE5C9 E8B2CD C987B1 B780B5 F4C5C6 885E94 FFF1BE", 68),
    "islanders": ("isle", "587F99 ABD7CF FFDCB5 B4C4AE 7E9D8B 347C82 93C5A7 345C57 FFE6B1", 34),
    "stoneage": ("stone", "99826F DEB391 FFE0B3 C3A291 937B7E 8E796F D3B585 635E61 FFE4B7", 22),
    "night": ("night", "182443 756D96 C99FAB 9382A5 59597E 353C5F 756D8C 252D46 F9DFA9", 9),
    "desertious": ("desert", "B88385 F1B591 FFE4AB E5B296 C09191 B57875 EEC597 795F64 FFF1BD", 49),
    "villageous": ("village", "8A98A3 D7C5A9 FFE6BC C3B5A4 919F94 687E74 BCBC91 455C56 FFE8BA", 27),
    "frost": ("ice", "6D7FA9 B0C7DB E9D5CE B4C3D3 839DB9 738EAD C4D5E0 495F7B FFE7D5", 5),
    "spring": ("flowers", "8CA9B1 C3D5CA FFDAC8 B2C5B6 94AF9A 749679 BED399 536D69 FFECC2", 57),
    "forestry": ("forest", "687F82 AEC4AC EAD3AA B1B7A0 7D9586 647B73 B1B597 344E4D FFE7B2", 65),
    "snowy": ("snow", "8193A6 CDDAE0 FBE4CD C0CBD3 899DB4 8193AD E5E3E7 465E74 FFF0CA", 31),
    "heatish": ("lava", "724E62 CE8D83 F8C19D BD8780 8B6874 685766 AB806E 514754 FFD59C", 28),
    "return": ("meadow", "766C94 CBA7B4 F6CCAC C2A3B3 978BA2 6E7980 B4B6A0 45575D FFE9B7", 13),
    "cloudy": ("cloud", "7391AD C4C8D6 F7D6C5 B7B8CD 9197B1 8794B3 D7D5DF 646B8A FFF1C6", 15),
}

def rgb(s):
    return tuple(bytes.fromhex(s))

def mix(a,b,t):
    return tuple(int(max(0,min(255,x+(y-x)*t))) for x,y in zip(a,b))

def shade(a,t):
    return mix(a, (255,238,218) if t>0 else (36,36,65), abs(t))

def draw_scene(name, spec):
    kind, palette, seed = spec
    zen,west,east,far,near,shadow,lit,tree,sun = map(rgb,palette.split())
    w,h = (1920,1080) if name=="icy-dunes" else (1440,810)
    rnd = random.Random(seed)
    horizon = .535
    sun_x = .765 if name=="icy-dunes" else rnd.uniform(.58,.83)
    sun_y = .239 if name=="icy-dunes" else rnd.uniform(.20,.35)
    y,x = np.ogrid[:h,:w]
    sx,sy = x/w,y/h
    radial = np.sqrt(((sx-sun_x)*1.78)**2+(sy-sun_y)**2)
    sky_weight = np.clip((sy/.60)**.88,0,1)
    warm_weight = np.clip(sx**1.7+.26*np.exp(-radial*4),0,1)
    sky = (np.array(west)*(1-warm_weight[:,:,None])+np.array(east)*warm_weight[:,:,None])
    pix = np.array(zen)*(1-sky_weight[:,:,None])+sky*sky_weight[:,:,None]
    halo = np.exp(-radial*5.3)*(.27 if kind=="night" else .64)
    pix = pix*(1-halo[:,:,None])+np.array(east)*halo[:,:,None]
    grain = np.random.default_rng(seed).normal(0,.65,(h,w,1))
    img = Image.fromarray(np.uint8(np.clip(pix+grain,0,255)))
    d = ImageDraw.Draw(img)
    def polygon(points,color):
        d.polygon([(int(a*w),int(b*h)) for a,b in points],fill=color)
    def circle(cx,cy,r,col):
        d.ellipse(((cx-r*h/w)*w,(cy-r)*h,(cx+r*h/w)*w,(cy+r)*h),fill=col)
    def at(x,y):
        return img.getpixel((min(w-1,max(0,int(x*w))),min(h-1,max(0,int(y*h)))))
    if kind in ("snow","night","cloud","ice"):
        for _ in range(330 if kind=="night" else 120):
            cx,cy = rnd.random(),rnd.random()*.39
            r=rnd.uniform(.00048,.0011)
            circle(cx,cy,r,mix(at(cx,cy),(255,243,222),rnd.uniform(.17,.55)))
    # A solid print-like sun against a broad atmospheric halo.
    circle(sun_x,sun_y,.055 if kind!="night" else .040,sun)
    if kind=="night":
        circle(sun_x+.012,sun_y-.012,.035,at(sun_x+.05,sun_y))
    # Wisps have feathered outer slices and faceted warm inner shelves.
    for _ in range(32 if kind=="cloud" else 17):
        cx,cy = rnd.uniform(-.03,1.03),rnd.uniform(.07,.40)
        length,depth = rnd.uniform(.028,.112),rnd.uniform(.002,.009)
        base = at(cx,cy)
        color = mix(base,east,rnd.uniform(.20,.55))
        polygon([(cx-length,cy+.001),(cx-length*.48,cy-depth*.1),(cx-length*.16,cy-depth),(cx+length*.13,cy-depth*1.06),(cx+length*.38,cy-depth*.51),(cx+length*.8,cy-depth*.45),(cx+length,cy),(cx+length*.14,cy+.0015)],color)
    # Angular layered ridges. Internal folds diverge downslope from a broken crest.
    def ridge(depth,crest,valley,amp,base,soft):
        peaks=[]
        for i in range(54 if depth==0 else 43):
            xx=-.15+i*(1.30/(53 if depth==0 else 42))
            if name=="icy-dunes":
                summits=[(.07,.046,.078),(.23,.051,.062),(.363,.057,.08),(.606,.071,.105),(.68,.047,.070),(.907,.061,.064),(1.04,.043,.067)]
            else:
                summits=[(-.06+.17*j+.025*math.sin(j*seed),.046+.015*math.sin(j*4),amp*(.73+.27*math.cos(j*seed))) for j in range(8)]
            offset= .034*depth
            highest=max(height*max(0,1-abs(xx-c-offset)/(width*(1.65 if depth==0 else 1.30))) for c,width,height in summits)
            if kind in ("desert","stone"):
                highest=min(highest*1.45,amp*(.44+.18*math.sin(i*.40)))
            elif kind in ("meadow","flowers","village","candy","forest","cloud"):
                highest*=.55
            elif kind=="sea":
                highest*=.22
            elif kind=="lava":
                highest=amp*(2.9*max(0,1-abs(xx-.615-depth*.015)/.20)+.42*math.cos(xx*20))
            xx += rnd.uniform(-.01,.01)
            yy=crest-highest*(.86 if depth==0 else 1.16)+.012*math.sin(xx*39+seed)+rnd.uniform(-.009,.009)
            if kind=="lava" and .59<xx<.64: yy=max(yy,crest-amp*2.31)
            if kind in ("desert","stone") and highest>amp*.47:
                yy=crest-amp*(.51 if depth==0 else .68)+.002*math.sin(xx*40)
            peaks.append((xx,yy))
        rows=[peaks]
        for t in (.29,.64,1):
            row=[]
            for xx,yy in peaks:
                drift=.036*math.sin(xx*26+depth)*t
                row.append((xx+drift+rnd.uniform(-.008,.008),yy+(valley-yy)*t+rnd.uniform(-.007,.007)))
            rows.append(row)
        for k in range(3):
            for i in range(len(peaks)-1):
                a,b=rows[k][i],rows[k][i+1]
                c,e=rows[k+1][i],rows[k+1][i+1]
                slope=np.clip((peaks[i+1][1]-peaks[i][1])/(.012+peaks[i+1][0]-peaks[i][0]),-1.2,1.2)
                val=slope*soft+rnd.uniform(-.065,.067)+.05*math.sin(i*2.2)-k*.014
                tone=mix(base,east, .09+k*.06)
                polygon([a,b,e],shade(tone,val))
                polygon([a,c,e],shade(tone,val+rnd.uniform(-.08,.08)))
    if kind=="lava":
        for i in range(9):
            cx=.613+.016*i+.009*math.sin(i)
            cy=.174-i*.013
            length=.012+i*.006
            polygon([(cx-length,cy),(cx-length*.67,cy-.009),(cx-length*.13,cy-.015),(cx+length*.62,cy-.012),(cx+length,cy-.006),(cx+length*.50,cy+.008),(cx-length*.50,cy+.009)],mix(at(cx,cy),near,.35-i*.025))
    if kind in ("sea","isle"):
        ridge(0,.484,.60,.070,far,.10)
        ridge(1,.525,.63,.048,near,.13)
    else:
        ridge(0,.437,.62,.10,far,.13)
        ridge(1,.486,.69,.14,near,.23)

    f=.79*w
    camera=24
    def center(z):
        return 14*math.sin(z*.018+1.9)+28*math.sin(z*.007+.7)
    def altitude(x,z):
        if kind in ("sea","isle"):
            arch=0
            for i in (range(3,12,3) if kind=="sea" else range(1,12)):
                iz=46+i*20
                ix=(-1 if i%2 else 1)*(17+((seed*i)%45))
                arch+=max(0, 1-((x-ix)/(16+i*1.24))**2-((z-iz)/(20+i))**2)**1.45*(9+i*.8)
            return max(0,arch)
        if kind=="cloud":
            return 2*math.sin(x*.032+z*.035)+1.4*math.cos(z*.043)
        route = x-center(z)
        bank=1-math.exp(-abs(route/75)**1.7)
        height=2.65*math.sin(z*.058+x*.018+.58)+1.8*math.sin(z*.113-x*.04)
        hill=bank*(7+9*math.sin(z*.017+.7+x*.009)+4*math.cos(z*.047+x*.02))
        if kind=="stone": hill*=1.19
        return height+hill+3.0*math.sin(x*.046-z*.02)
    def project(x,y,z):
        return .5+x*f/(z*w), horizon+(camera-y)*f/(z*h)
    def ground_color(xx,zz,up):
        if kind in ("sea","isle") and up<1.3:
            return mix(shadow,lit,.29+.17*math.sin(zz*.024))
        if kind in ("sea","isle"):
            return mix((160,145,112),(154,177,126),min(1,up/4))
        return mix(shadow,lit,.58)
    # Depth rows are spaced logarithmically for near detail and distant simplification.
    depths=np.geomspace(10,770,28)
    rows=[]
    for j,z in enumerate(depths):
        row=[]
        for i in range(24):
            xx=(-.76+i*.067)*z
            if i not in (0,23): xx += rnd.uniform(-.025,.025)*z
            zz=z*(1+rnd.uniform(-.030,.030))
            alt=altitude(xx,zz)
            row.append(np.array([xx,alt,zz]))
        rows.append(row)
    shapes=[]
    for j in range(len(rows)-1):
        for i in range(len(rows[j])-1):
            a,b=rows[j][i:i+2]
            c,e=rows[j+1][i:i+2]
            triangles=((a,c,e),(a,e,b)) if (i+j)%3 else ((a,c,b),(b,c,e))
            for tri in triangles:
                p,q,r=tri
                normal=np.cross(q-p,r-p)
                normal /= np.linalg.norm(normal)
                if normal[1]<0: normal*=-1
                xx,up,zz=(p+q+r)/3
                illum=.58+.95*normal[0]+.59*normal[2]+.12*math.sin(xx*.028+zz*.009)
                tone = ground_color(xx,zz,up) if kind in ("sea","isle") else mix(shadow,lit,max(0,min(1,illum)))
                if kind=="lava":
                    lava_path=5+11*math.sin(zz*.023)+.12*zz
                    if abs(xx-lava_path)<5.5+abs(3*math.sin(zz*.050)):
                        tone=mix((180,78,61),(255,172,75),rnd.random())
                if kind=="cloud":
                    tone=mix((221,216,224),(146,151,180),.32+.14*math.sin(zz*.03))
                tone=shade(tone,rnd.uniform(-.033,.040))
                if kind in ("sea","isle") and up<.8: tone=shade(tone,rnd.uniform(-.025,.19))
                haze=.53*(1-math.exp(-zz/250))
                tone=mix(tone,far,haze)
                shapes.append((zz,[project(*p) for p in tri],tone))
    ground_shapes=shapes
    shapes=[]
    # Use reciprocal depth interpolation to clip scenery cleanly at hill crests.
    zbuffer=np.full((h,w),1e5,dtype=np.float32)
    for z,coords,tone in sorted(ground_shapes,key=lambda entry:-entry[0]):
        polygon(coords,tone)
    # Populate the depth buffer from the same continuous ground mesh.
    for j in range(len(rows)-1):
        for i in range(len(rows[j])-1):
            a,b=rows[j][i:i+2]
            c,e=rows[j+1][i:i+2]
            triangles=((a,c,e),(a,e,b)) if (i+j)%3 else ((a,c,b),(b,c,e))
            for tri in triangles:
                v=np.array([project(*p) for p in tri]) * (w,h)
                left,top=np.maximum(np.floor(v.min(0)).astype(int),0)
                right,bottom=np.minimum(np.ceil(v.max(0)).astype(int)+1,(w,h))
                if right<=left or bottom<=top: continue
                yi,xi=np.ogrid[top:bottom,left:right]
                v0,v1,v2=v
                det=(v1[1]-v2[1])*(v0[0]-v2[0])+(v2[0]-v1[0])*(v0[1]-v2[1])
                if abs(det)<.001: continue
                b0=((v1[1]-v2[1])*(xi-v2[0])+(v2[0]-v1[0])*(yi-v2[1]))/det
                b1=((v2[1]-v0[1])*(xi-v2[0])+(v0[0]-v2[0])*(yi-v2[1]))/det
                b2=1-b0-b1
                mask=(b0>=0)&(b1>=0)&(b2>=0)
                depth=1/(b0/tri[0][2]+b1/tri[1][2]+b2/tri[2][2]+1e-12)
                zbuffer[top:bottom,left:right][mask]=np.minimum(zbuffer[top:bottom,left:right][mask],depth[mask])
    # Small foliage, rocks and built objects share the terrain's perspective.
    def addprop(x,z,typ,scale):
        ax=altitude(x,z)
        px,py=project(x,ax,z)
        ht=scale*f/(z*h)
        aspect=h/w
        if py+ht<0 or (px<-.12 or px>1.12): return
        haze=.63*(1-math.exp(-z/265))
        col=mix(tree,far,haze)
        def shape(coords,color):
            shapes.append((z-.3,[(px+u*ht*aspect,py+v*ht) for u,v in coords],color))
        # Reject fully hidden props; partial silhouettes are depth clipped below.
        ix,iy=int(px*w),int((py-ht)*h)
        if 0<=ix<w and 0<=iy<h and zbuffer[iy,ix]<z*.94: return
        # Directional shadow anchors each object to the slope.
        shape([(-.10,0),(.095,.009),(-.38,.048),(-.78,.057),(-.49,.025)],mix(shadow,near,.36+haze*.45))
        if typ=="lollipop":
            shape([(-.027,0),(.025,0),(.030,-.76),(-.015,-.76)],mix((249,223,212),far,haze))
            c=rnd.choice([(235,131,167),(126,196,187),(237,186,144),(182,155,219)])
            c=mix(c,far,haze)
            pts=[(.33*math.cos(i*math.pi/4),-.82+.33*math.sin(i*math.pi/4)) for i in range(8)]
            shape(pts,c)
            for i in (0,2,4,6):
                a,b=pts[i],pts[(i+1)%8]
                shape([a,b,(b[0]*.44-.028,b[1]*.46-.42),(.007,-.82),(a[0]*.65,a[1]*.62-.35)],shade(c,.46))
        elif typ=="crystal":
            bright=mix((182,224,236),far,haze)
            shadecol=mix((91,140,182),far,haze)
            for ox,oy,hh,wid in [(-.15,.01,.55,.16),(.18,0,.72,.20),(0,-.025,1,.20)]:
                coords=[(ox-wid*.55,oy),(ox-wid*.59,oy-.78*hh),(ox+.027,oy-hh),(ox+wid*.55,oy-.78*hh),(ox+wid*.64,oy-.07*hh),(ox+.026,oy+.014)]
                shape(coords,bright)
                shape([coords[2],coords[3],coords[4],coords[5],(ox+.020,oy-hh*.73)],shadecol)
                shape([coords[2],(ox+.020,oy-hh*.73),coords[1]],shade(bright,.40))
        elif typ=="dolmen":
            stone=mix((154,137,128),far,haze)
            for ox in (-.34,.31):
                shape([(ox-.125,0),(ox-.047,-.78),(ox+.13,-.75),(ox+.18,-.02)],stone)
                shape([(ox+.016,-.75),(ox+.13,-.75),(ox+.18,-.02),(ox+.09,0)],shade(stone,-.30))
            shape([(-.61,-.72),(-.54,-.93),(.13,-1),(.60,-.90),(.64,-.73),(.18,-.66)],shade(stone,.09))
            shape([(-.54,-.93),(.13,-1),(.60,-.90),(.34,-.83),(-.61,-.72)],shade(stone,.32))
        elif typ=="cloudbank":
            c=mix((235,229,232),far,haze*.5)
            for ox,dy,sc in [(-.63,-.15,.36),(-.35,-.23,.54),(.05,-.34,.68),(.43,-.20,.48),(.71,-.16,.36)]:
                tab=[(ox+sc*math.cos(i*math.pi/4),dy+sc*.58*math.sin(i*math.pi/4)) for i in range(8)]
                shape(tab,c)
                shape([tab[0],tab[1],tab[2],tab[3],(ox-.12,dy+.09)],shade(c,-.16))
        elif typ=="pine":
            shape([(-.032,0),(.035,0),(.022,-.42),(-.025,-.45)],shade(col,-.22))
            lean=rnd.uniform(-.06,.06)
            cap=(kind in ("snow","ice","night","cloud"))
            for ix,(top,base,rad) in enumerate([(-.72,-.092,.215),(-.87,-.31,.173),(-1,-.53,.125)]):
                a=(lean*-top,top)
                poly=[a,(rad*.85+lean*.4,base-.035),(rad*.30,base+.009),(-rad*.3,base+.026),(-rad,base-.028)]
                shape(poly,shade(col,.085+ix*.030))
                shape([a,(rad*.30,base+.009),(rad*.85+lean*.4,base-.035)],shade(col,.23+ix*.025))
                shape([a,(-rad,base-.028),(-rad*.33,base+.026)],shade(col,-.14))
                if cap:
                    bright=mix(lit,far,.25+haze*.45)
                    t=.55 if ix==2 else .38
                    midx=a[0]+(rad*.85-a[0])*t
                    mid=(midx,top+(base-top)*t)
                    shape([a,mid,(midx*.05,mid[1]+.019),(-rad*t+a[0]*.5,mid[1]-.011)],bright)
        elif typ=="palm":
            shape([(-.06,0),(.026,0),(.12,-.48),(.07,-.86),(.029,-.89),(.039,-.55)],shade(col,-.05))
            for dx,dy in [(-.44,-.16),(-.39,.02),(-.27,.11),(.15,-.19),(.42,-.12),(.32,.09)]:
                shape([(.05,-.83),(dx*.64,-.86+dy*.55),(dx,-.80+dy),(dx*.45,-.78+dy*.45)],shade(col,rnd.uniform(.02,.24)))
        elif typ=="rock":
            shape([(-.51,0),(-.43,-.43),(-.10,-.92),(.18,-1),(.42,-.48),(.48,-.1),(.21,0)],mix(col,near,.52))
            shape([(-.43,-.43),(-.10,-.92),(.18,-1),(-.05,-.39),(-.23,-.02),(-.51,0)],shade(col,.22))
            shape([(.18,-1),(.42,-.48),(.48,-.10),(-.05,-.39)],shade(col,.42))
        elif typ=="cactus":
            shape([(-.074,0),(.067,0),(.065,-.94),(.002,-1),(-.065,-.95)],col)
            shape([(-.05,-.44),(-.28,-.53),(-.28,-.76),(-.22,-.80),(-.19,-.60),(-.05,-.57)],col)
            shape([(.05,-.32),(.24,-.44),(.26,-.64),(.19,-.66),(.17,-.47),(.05,-.45)],shade(col,.16))
        elif typ=="house":
            wall=mix(lit,(236,202,159),.47)
            shape([(-.59,-.52),(.09,-.65),(.52,-.49),(.52,-.035),(.04,0),(-.59,-.12)],wall)
            shape([(.05,-.56),(.52,-.49),(.52,-.035),(.04,0)],shade(wall,-.19))
            shape([(-.66,-.50),(-.28,-.96),(.20,-1),(.59,-.51),(.045,-.42)],shade(col,.23))
            shape([(-.28,-.96),(.20,-1),(.59,-.51),(.045,-.42)],mix((163,110,104),far,haze))
        else:
            shape([(-.042,0),(.04,0),(.018,-.72),(-.021,-.72)],col)
            crown=(174,140,170) if typ=="candy" else rnd.choice([(224,174,186),(237,193,185),(164,184,123)]) if kind=="flowers" else mix(col,lit,.44)
            crown=mix(crown,far,haze)
            shape([(-.32,-.41),(-.35,-.72),(-.18,-.95),(.11,-1),(.31,-.82),(.35,-.54),(.15,-.37),(-.09,-.33)],crown)
            shape([(-.18,-.95),(.11,-1),(.31,-.82),(.06,-.72),(-.2,-.75)],shade(crown,.25))
            shape([(.06,-.72),(.31,-.82),(.35,-.54),(.15,-.37)],shade(crown,.11))
            shape([(-.32,-.41),(-.35,-.72),(-.20,-.75),(-.08,-.55),(-.09,-.33)],shade(crown,-.13))

    for i in range(2080):
        z=rnd.uniform(29,420)
        x=rnd.uniform(-.80,.8)*z
        cx=abs(x-center(z))
        if cx < 17+5*math.sin(z*.04): continue
        cluster=math.sin(x*.12)+math.sin(z*.12)*.75+math.cos((x+z)*.045)
        if cluster<.18 and rnd.random()<.91: continue
        if z<65 and abs(project(x,0,z)[0]-.5)<.41: continue
        typ="pine"
        if kind in ("sea","isle"):
            if altitude(x,z)<2.8: continue
            typ="palm"
        elif kind in ("stone","ice","lava"):
            if rnd.random()<.70: continue
            typ="rock"
        elif kind=="desert":
            if rnd.random()<.82: continue
            typ="cactus" if rnd.random()<.69 else "rock"
        elif kind=="village":
            typ="house" if rnd.random()<.085 else "broadleaf"
        elif kind=="candy": typ="lollipop" if rnd.random()<.88 else "candy"
        elif kind in ("flowers","meadow"): typ="broadleaf"
        if kind=="cloud":
            if rnd.random()<.78: continue
            typ="cloudbank"
        if kind=="ice": typ="crystal"
        if kind=="stone" and rnd.random()<.15: typ="dolmen"
        s=rnd.uniform(3.5,9.2)*(1.30 if typ=="rock" else 1.0)
        if typ in ("cloudbank","dolmen"): s*=1.75
        if z<85: s*=1.18
        addprop(x,z,typ,s)
    for featured,positions in {
        "ice":[("crystal",.14,55,14),("crystal",.96,53,16)],
        "stone":[("dolmen",.80,59,16),("dolmen",.11,88,14)],
        "candy":[("lollipop",.82,51,12),("lollipop",.11,63,11)],
        "village":[("house",.77,59,10),("house",.82,67,8),("house",.20,57,8)],
        "isle":[("palm",.13,67,14),("palm",.86,69,13)],
    }.items():
        if kind==featured:
            for typ,pos,z,scale in positions:
                px=(pos-.5)*z/.79
                if kind=="isle" and altitude(px,z)<2: continue
                addprop(px,z,typ,scale)
    # Foreground silhouettes frame the mountain opening, with breathing room between groups.
    if kind in ("snow","forest","night","meadow","village"):
        for pos,z,scale in [(-.032,40,11),(.011,46,9),(.07,68,8),(.97,44,11),(1.015,39,15),(.85,65,7.7),(.916,59,9)]:
            addprop((pos-.5)*z/.79,z,"pine",scale)
    shapes.sort(key=lambda entry:-entry[0])
    # Composite a prop at a time so every facet has consistent occlusion.
    arr=np.array(img)
    from itertools import groupby
    for depth, group in groupby(shapes,key=lambda item:item[0]):
        group=list(group)
        pixels=[[(int(x*w),int(y*h)) for x,y in pts] for _,pts,col in group]
        bounds=np.array([v for poly in pixels for v in poly])
        left,top=np.maximum(bounds.min(0),0)
        right,bottom=np.minimum(bounds.max(0)+1,(w,h))
        if right<=left or bottom<=top: continue
        bg=arr[top:bottom,left:right].copy()
        patch=Image.fromarray(bg)
        brush=ImageDraw.Draw(patch)
        for points,(_,_,col) in zip(pixels,group):
            brush.polygon([(x-left,y-top) for x,y in points],fill=col)
        clear=zbuffer[top:bottom,left:right]>depth*.955
        arr[top:bottom,left:right][clear]=np.array(patch)[clear]
    img=Image.fromarray(arr)
    if name=="icy-dunes":
        # Warm rim light from the sunset and cool shadows near the viewer.
        layer=np.asarray(img,dtype=float)
        yy,xx=np.ogrid[:h,:w]
        near_factor=np.maximum(0,(yy/h-.53)/.47)
        vignette=np.clip((.065+near_factor*.11)*((xx/w-.52)**2*3+.20)+near_factor*.03,0,.19)
        layer=layer*(1-vignette[:,:,None])+np.array((49,42,70))*vignette[:,:,None]
        img=Image.fromarray(layer.astype("uint8"))
    # Light film grain unifies the flat facets at full-screen size.
    arr=np.array(img,dtype=float)
    noise=np.random.default_rng(seed+5).normal(0,.95,(h,w,1))
    img=Image.fromarray(np.uint8(np.clip(arr+noise,0,255)))
    img.save(OUTPUT/(name+".webp"),"WEBP",quality=89,method=5)

if __name__=="__main__":
    import sys
    for name in sys.argv[1:] or SCENES:
        draw_scene(name,SCENES[name])
