/* The game's blood code at render scale 4, ported from DevilutionX's gore.cpp, gore_floor_blood.cpp and gore_draw.cpp:
   the drops (DrawDrop), the splash and the mark a landing drop leaves (SplashAt, AddMark, MarkDiscs), the pools drawn
   as one field over each tile's 3x3 neighbourhood and shaded from the floor under each pixel (GatherStainBlobs,
   DrawStainsAtScale, FloorShade, TintShade), the cap on a block of tiles (StainAt), the pool a corpse bleeds
   (AddBleed) and the drying (AgeShift); simulated at the game's 20 ticks a second in its own 16.16 fixed point. The
   floor is the Cathedral's 4x tiles, lit by one light through the game's light tables in sixteenths of a level,
   dithered (the smooth falloff), then presented as the game presents it with its lighting on: the palette through
   the Brightness setting's tone curve (80, as in our captures), drained toward a cold grey with the dark, multiplied
   by the light's colour (the hero's lantern over the cold ambient). Data: strike-data.bin (palette, tiles, the
   Zombie's stand, hit and gib death), built by make_data.py. Used by strike.js and stains.js. */
window.BloodPort=(function(){
  // ---- the engine's numbers (gore.cpp, gore_internal.hpp: look 1, "original") ----
  var S=4,One=65536,Fp=16,Gravity=(One*9/10)|0,GroundRow=15;
  var MaxStain=150,StainCap=540,StainRX=18,StainRY=9;
  var HitBurstMin=12,HitBurstMax=30,KillBurstMin=70,KillBurstMax=150,HitSpeedMax=4,KillSpeedMax=6,HitLiftMax=4,KillLiftMax=6;
  var FleshLandStain=5,StainingSpeckOneIn=3,HitStainMax=18,KillStain=28,ChunkOneIn=3,GoreRampSize=5;
  var BleedSeconds=15,BleedRadiusMin=13,BleedRadiusMax=30,BleedRadiusCap=34,BleedAmount=110,MaxBleeds=512;
  var MaxParticles=4096,MaxMarks=6000,MaxStainBlobs=36;
  var L={speckRadius:1.8,speckRadiusVar:.4,chunkRadius:3,stretch:1.4,coreK:8,rimK:10,highlightK:3,rimWidth:.8,
    streakTicks:.5,streakMinSpeed:2,streakTail:.25,streakK:9,splashMin:2,splashMax:4,splashSpeed:1.3,splashLift:.6,
    splashLife:5,splashForward:.75,markOneIn:1,markRadius:2.8,markKind:3,markK:8,stainThreshold:34,stainThick:110,
    stainNoise:26,stainWarp:6,stainMottle:.35,stainFringe:.35,stainRadiusScale:1.05,tintThinGain:.6,tintThinBias:4.5,
    tintThickGain:.35,tintThickBias:7,tintIsland:7};
  // The shared blood ramp: 48-59's twelve steps as drawn on the red run 224-239 (BloodRemapTarget).
  var RAMP=[226,227,228,229,231,232,233,234,234,234,235,236];
  // A Zombie: 4-7 hit points (monstdat.tsv); this one has 6, and a hit does 6 damage.
  var MonsterHP=6,HitDamage=6;
  var DIRS=[[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0]];
  // The present (palette.cpp's ApplyGlobalBrightness, colour_light.cpp, light_grade.cpp): the Brightness setting,
  // the hero's lantern and the ambient, the drain's shape and tint, the bright colours it spares.
  var Brightness=80,HeroColour=[255,228,190],Ambient=[150,166,214],FullColourAt=2/3;
  var Drain={strength:1,from:.30,to:.75,tint:[.80,.96,1.32],keepFrom:80,keepTo:160};
  var BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];

  // ---- hashes, noise ----
  function Mix(h){h>>>=0;h^=h>>>15;h=Math.imul(h,0x2545F491)>>>0;h^=h>>>13;return h>>>0}
  function TileHash(x,y){return Mix((Math.imul(x,0x27D4EB2F)+Math.imul(y,0x9E3779B9))>>>0)}
  function lround(v){return v<0?-Math.round(-v):Math.round(v)}
  function clamp(v,a,b){return v<a?a:v>b?b:v}
  function Smoothstep(e0,e1,x){var t=clamp((x-e0)/Math.max(e1-e0,1e-6),0,1);return t*t*(3-2*t)}
  var SMOOTH=new Uint8Array(128*128),WHITE=new Uint8Array(128*128);
  (function(){
    function lattice(x,y,period,salt){var n=128/period;x=((x%n)+n)%n;y=((y%n)+n)%n;
      return (Mix((Math.imul(x,0x27D4EB2F)+Math.imul(y,0x165667B1)+salt)>>>0)&255)/255}
    function octave(x,y,p,salt){var gx=(x/p)|0,gy=(y/p)|0,fx=(x%p)/p,fy=(y%p)/p;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
      var a=lattice(gx,gy,p,salt),b=lattice(gx+1,gy,p,salt),c=lattice(gx,gy+1,p,salt),d=lattice(gx+1,gy+1,p,salt);
      return (a+(b-a)*fx)+((c+(d-c)*fx)-(a+(b-a)*fx))*fy}
    for(var y=0;y<128;y++)for(var x=0;x<128;x++){
      var n=.55*octave(x,y,32,0x51ED270B)+.30*octave(x,y,8,0x2C1B3C6D)+.15*octave(x,y,4,0x6B43A9B5);
      SMOOTH[y*128+x]=clamp(n*255,0,255)|0;
      WHITE[y*128+x]=Mix((Math.imul(x,0x85EBCA6B)+Math.imul(y,0xC2B2AE35)+0x9E3779B9)>>>0)>>>24}})();
  function SmoothNoise(wx,wv){return SMOOTH[((wv&127)*128)+(wx&127)]/255}
  function WhiteNoise(wx,wv){return WHITE[((wv&127)*128)+(wx&127)]/256}

  // ---- light tables (MakeLightTable) and the runs of shades they move a colour along ----
  var RUNS=[16,16,16,16,16,16,16,16,8,8,8,8,16,16,16,16,16,16];
  var RSTEP=new Uint8Array(256),RLEN=new Uint8Array(256),LT=[];
  (function(){var i=0;RUNS.forEach(function(n){for(var s=0;s<n;s++,i++){RSTEP[i]=s;RLEN[i]=n}});
    for(var shade=0;shade<16;shade++){var t=new Uint8Array(256),ci=0;
      if(shade<15)RUNS.forEach(function(steps){var sh=(shade*steps/16)|0,st=ci,end=st+steps-1;
        for(var s=0;s<steps;s++){if(ci===0){t[ci++]=0;continue}var c=st+s+sh;if(c>end||c===255)c=0;t[ci++]=c}});
      LT.push(t)}})();
  function FloorShade(floor,level){if(floor===0)return -1;var len=RLEN[floor];
    var unlit=Math.max(0,RSTEP[floor]-((level*len/16)|0));return (unlit*16/len)|0}
  function TintShade(floorShade,depth,dither){if(floorShade<0)return -1;
    var island=L.tintIsland*Math.max(0,1-depth*2),gain=L.tintThinGain+(L.tintThickGain-L.tintThinGain)*depth,
      bias=L.tintThinBias+(L.tintThickBias-L.tintThinBias)*depth;
    if(floorShade<island)return -1;return clamp((gain*floorShade+bias+dither)|0,0,11)}
  function AgeStepOf(age){return Math.min(7,(age*8)|0)}
  function AgeAfter(sec){return Smoothstep(5,90,sec)}
  function AgeShift(age){return age<.2?-1:age<.5?0:age<.8?1:2}
  function screenToMissile(dx,dy){var xn=2*dy+dx,yn=2*dy-dx;return [Math.trunc((xn+(xn>=0?32:-32))/64),Math.trunc((yn+(yn>=0?32:-32))/64)]}
  function normalScreen(d){var w=DIRS[d],rx=w[0]-w[1],ry=w[0]+w[1],m=Math.hypot(rx,ry);return [Math.trunc(rx*65536/m),Math.trunc(Math.trunc(ry*65536/m)/2)]}
  /* The colour a palette index is presented in at a light of `q` sixteenths of a level (0 lit, 240 black): its colour
     through the brightness curve, drained by the dark, then multiplied by the light's colour (ShaderLight's compose). */
  function presentTables(pal){
    var a=-(Brightness/100)*2,tm=new Float32Array(768),out=new Uint32Array(241*256);
    for(var i=0;i<768;i++){var x=pal[i]/255;tm[i]=Math.round(clamp(a*x*x+(1-a)*x,0,1)*255)}
    var tl=.299*Drain.tint[0]+.587*Drain.tint[1]+.114*Drain.tint[2];
    for(var q=0;q<=240;q++){var level=q/16,bright=(15-level)/15,s=Math.min(1,bright/FullColourAt),
        dark=q/240,amount=Drain.strength*Smoothstep(0,1,(dark-Drain.from)/(Drain.to-Drain.from));
      var lc=[0,1,2].map(function(c){return Math.round(Ambient[c]+(HeroColour[c]-Ambient[c])*s)/255});
      for(i=0;i<256;i++){var r=tm[i*3],g=tm[i*3+1],b=tm[i*3+2],luma=.299*r+.587*g+.114*b,
          am=amount*(1-Smoothstep(0,1,(luma-Drain.keepFrom)/(Drain.keepTo-Drain.keepFrom))),o=[r,g,b];
        for(var c=0;c<3;c++){var t=luma*Drain.tint[c]/tl;o[c]=clamp(Math.round(clamp(Math.round(o[c]+(t-o[c])*am),0,255)*lc[c]),0,255)}
        out[q*256+i]=(255<<24|o[2]<<16|o[1]<<8|o[0])>>>0}}
    return out}
  function owns(x,v){var dx=(x-32)/32,dv=(v-15.5)/16,a=dx+dv,b=dx-dv;return a>=-1&&a<1&&b>=-1&&b<1}

  // ---- the data: one fetch for every widget on the page ----
  function parse(buf){var b=new Uint8Array(buf),dv=new DataView(buf),o=5;
    if(String.fromCharCode(b[0],b[1],b[2],b[3])!=='STRK'||b[4]!==2)throw new Error('strike-data');
    var pal=b.subarray(o,o+768);o+=768;var i;
    var gw=dv.getUint16(o,true);o+=4;var grid=new Uint16Array(gw*gw*2);for(i=0;i<grid.length;i++,o+=2)grid[i]=dv.getUint16(o,true);
    var nm=dv.getUint16(o,true);o+=2;var micros=[];for(i=0;i<nm;i++){micros.push({side:b[o],px:b.subarray(o+1,o+1+8192)});o+=8193}
    function sprite(){var w=dv.getUint16(o,true),h=dv.getUint16(o+2,true),ax=dv.getInt16(o+4,true),ay=dv.getInt16(o+6,true);o+=8;
      var s={w:w,h:h,ax:ax,ay:ay,px:b.subarray(o,o+w*h)};o+=w*h;return s}
    function list(){var n=dv.getUint16(o,true),l=[];o+=2;for(var k=0;k<n;k++)l.push(sprite());return l}
    var st=list(),hit=list(),death=list();
    return {G:gw,grid:grid,micros:micros,stand:st[0],hit:hit,death:death,present:presentTables(pal)}}
  var script=document.currentScript,base=script&&script.src?script.src.replace(/[^\/]*$/,''):'/devlog/gore/',loading=null;
  var supported='DecompressionStream' in window;
  function load(){return loading||(loading=fetch(base+'strike-data.bin').then(function(r){if(!r.ok)throw new Error(r.status);
    return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()}).then(parse))}

  /* A patch of floor with blood on it, drawn on `cv`. opt: light {x, y, radius} in world tiles; centre [x, y], the
     tile drawn at the view's `ground` fraction down; monster (draw the Zombie); marks (draw the drops' marks);
     bleeds (a kill's body bleeds a pool); gather 'neighbours' (the engine's: a tile paints its diamond from its 3x3
     neighbourhood's splashes) or 'alone' (each tile from its own splashes only, clipped to its own diamond). */
  function World(data,cv,opt){
    var ctx=cv.getContext('2d',{alpha:false}),G=data.G,PRES=data.present;
    var MX=G>>1,MY=G>>1,CX=opt.centre?opt.centre[0]:MX,CY=opt.centre?opt.centre[1]:MY,gather=opt.gather||'neighbours';
    var rng=0x9E3779B9;
    function NextRandom(){rng^=rng<<13;rng>>>=0;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;return rng}
    function RandomInt(n){return ((NextRandom()>>>8)%n)}

    // ---- the clock and age (GoreClock, AgeAfter, AgeShift) ----
    var GoreClock=0,AgeSpeed=1;
    function GoreSeconds(born){return (GoreClock-born)*AgeSpeed/20}
    function AgeStep(born){return AgeStepOf(AgeAfter(GoreSeconds(born)))}
    function SteppedAge(born){return AgeStep(born)/7}

    // ---- the world: screen offset of tile (x,y) is ((x-y)*32, (x+y)*16) ----
    var dBlood=new Uint8Array(G*G),StainOrder=new Uint32Array(G*G),StainTime=new Uint32Array(G*G),StainClock=0,
      BleedAt=new Uint16Array(G*G),Bleeds=[],Marks=[],NextMark=0,MarksAt={},P=[];
    // The Zombie's animation: one frame a tick (monstdat's rates for its hit and death are 1), the death's last
    // frame held as the corpse.
    var anim='stand',animFrame=0;
    function Animate(){if(anim==='hit'&&++animFrame>=data.hit.length){anim='stand';animFrame=0}
      else if(anim==='death'&&animFrame<data.death.length-1)animFrame++}
    function inGrid(x,y){return x>=0&&y>=0&&x<G&&y<G}
    function gi(x,y){return x*G+y}

    function StainInBlock(cx,cy){var s=0;for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++)if(inGrid(cx+dx,cy+dy))s+=dBlood[gi(cx+dx,cy+dy)];return s}
    function ReplaceOldest(cx,cy,fx,fy,excess){
      while(excess>0){var ox=-1,oy=-1,oo=4294967295;
        for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){var x=cx+dx,y=cy+dy;
          if(!inGrid(x,y)||(x===fx&&y===fy)||dBlood[gi(x,y)]===0)continue;
          if(StainOrder[gi(x,y)]<oo){oo=StainOrder[gi(x,y)];ox=x;oy=y}}
        if(ox<0)return;var i=gi(ox,oy),taken=Math.min(dBlood[i],excess);dBlood[i]-=taken;excess-=taken}}
    function StainAt(x,y,strength){if(!inGrid(x,y))return;var i=gi(x,y);
      dBlood[i]=Math.min(MaxStain,dBlood[i]+strength);StainOrder[i]=++StainClock;StainTime[i]=GoreClock;
      for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){var cx=x+dx,cy=y+dy;if(!inGrid(cx,cy))continue;
        var ex=StainInBlock(cx,cy)-StainCap;if(ex>0)ReplaceOldest(cx,cy,x,y,ex)}}

    function BleedFlow(b){var s=Math.floor(GoreSeconds(b.born)*4)/4,t=Math.min(1,s/BleedSeconds);return 1-(1-t)*(1-t)}
    function BleedRadius4(b){return 2*lround((b.from+(b.to-b.from)*BleedFlow(b))*2)}
    function BleedAgeStep(b){return AgeStepOf(AgeAfter(Math.max(0,GoreSeconds(b.born)-BleedSeconds)))}
    function AddBleed(x,y,maxHP){if(!inGrid(x,y))return;
      var size=clamp(Math.sqrt(Math.max(1,maxHP))/12,0,1),radius=BleedRadiusMin+(BleedRadiusMax-BleedRadiusMin)*size,at=BleedAt[gi(x,y)];
      if(at){var b=Bleeds[at-1],now=BleedRadius4(b)/4;b.from=now;
        b.to=Math.min(BleedRadiusCap,Math.max(now,Math.sqrt(b.to*b.to+.6*radius*radius)));b.born=GoreClock;return}
      if(Bleeds.length>=MaxBleeds)return;
      var ox=RandomInt(9)-4,ov=RandomInt(5)-2;
      Bleeds.push({x:x,y:y,ox:ox,ov:ov,born:GoreClock,from:radius*.35,to:radius});BleedAt[gi(x,y)]=Bleeds.length}

    function AddMark(tx,ty,w16x,w16y,trx,try_,radius,kind){if(!inGrid(tx,ty))return;
      var slot=NextMark;NextMark=(NextMark+1)%MaxMarks;var old=Marks[slot];
      if(old){var a=MarksAt[gi(old.tx,old.ty)];if(a){var k=a.indexOf(slot);if(k>=0)a.splice(k,1)}}
      var len=Math.hypot(trx,try_);
      Marks[slot]={tx:tx,ty:ty,x16:clamp(w16x,-2000,2000),v16:clamp(w16y,-2000,2000),
        dirX:len>0?lround(64*trx/len):0,dirY:len>0?lround(64*try_/len):0,
        radius4:clamp(lround(radius*4),1,255),kind:kind,seed:NextRandom(),born:GoreClock};
      (MarksAt[gi(tx,ty)]||(MarksAt[gi(tx,ty)]=[])).push(slot)}

    // ---- particles (AddGoreBurst, ProcessGore, SplashAt) ----
    function groundTile(p){var t=screenToMissile(p.tx>>Fp,p.ty>>Fp);return [p.sx+t[0],p.sy+t[1]]}
    function Burst(away,fatal,bx,by){if(bx===undefined){bx=MX;by=MY}
      var hp=Math.max(1,HitDamage),specks=fatal?clamp(KillBurstMin+(MonsterHP/2|0),KillBurstMin,KillBurstMax):clamp(hp*3,HitBurstMin,HitBurstMax);
      StainAt(bx,by,fatal?KillStain:clamp(hp*5,8,HitStainMax));
      if(fatal&&opt.bleeds!==false)AddBleed(bx,by,MonsterHP);
      // MonsterDeath throws the burst and starts the death on the same tick; a hit starts the hit frames.
      if(opt.monster&&bx===MX&&by===MY){anim=fatal?'death':'hit';animFrame=0}
      var height=(fatal?26:16)+GroundRow;
      for(var i=0;i<specks;i++){if(P.length>=MaxParticles)return;
        var d=away;switch(RandomInt(8)){case 0:d=(d+7)%8;break;case 1:d=(d+1)%8;break;case 2:d=(d+6)%8;break;case 3:d=(d+2)%8;break}
        var u=normalScreen(d),speed=2+RandomInt(fatal?KillSpeedMax:HitSpeedMax);
        var p={sx:bx,sy:by,tx:(RandomInt(17)-8)<<Fp,ty:(RandomInt(13)-6)<<Fp,vx:u[0]*speed,vy:u[1]*speed};
        var g=groundTile(p);p.x=g[0];p.y=g[1];
        p.z=(height+RandomInt(10))<<Fp;p.vz=(3+RandomInt(fatal?KillLiftMax:HitLiftMax))<<Fp;
        p.shade=RandomInt(GoreRampSize);p.life=60+RandomInt(40);p.size=RandomInt(ChunkOneIn)===0?2:1;
        p.stains=RandomInt(StainingSpeckOneIn)===0;p.splash=false;P.push(p)}}

    function SplashAt(p){
      var px=p.tx>>Fp,py=p.ty>>Fp,t=screenToMissile(px,py),wsx=(t[1]-t[0])*32,wsy=(t[1]+t[0])*-16;
      var w16x=32*16+((p.tx+wsx*One)>>(Fp-4)),w16y=(GroundRow*16+8)-((p.ty+wsy*One)>>(Fp-4));
      var trx=p.vx>>8,try_=p.vy>>8;
      if(p.splash){if(RandomInt(2)===0)AddMark(p.x,p.y,w16x,w16y,trx,try_,L.markRadius*.4,0);return}
      if(RandomInt(L.markOneIn)===0)AddMark(p.x,p.y,w16x,w16y,trx,try_,L.markRadius*(p.size>=2?1.5:1),L.markKind);
      var sp=Math.hypot(p.vx,p.vy),inX=sp>0?p.vx/sp:0,inY=sp>0?p.vy/sp:0;
      var n=L.splashMin+RandomInt(L.splashMax-L.splashMin+1)+(p.size>=2?2:0);
      for(var i=0;i<n;i++){if(P.length>=MaxParticles-MaxParticles/4)return;
        var ang=RandomInt(1024)*(6.2832/1024),dx=Math.cos(ang)*(1-L.splashForward)+inX*L.splashForward,dy=Math.sin(ang)*(1-L.splashForward)+inY*L.splashForward;
        var nm=Math.max(.001,Math.hypot(dx,dy)),s=L.splashSpeed*(.4+RandomInt(256)/256);dx=dx/nm*s;dy=dy/nm*s*.5;
        var q={sx:p.sx,sy:p.sy,tx:p.tx,ty:p.ty,x:p.x,y:p.y,vx:Math.trunc(dx*One),vy:Math.trunc(dy*One),z:One/2,
          vz:Math.trunc(L.splashLift*(.5+RandomInt(256)/256)*One),life:L.splashLife+RandomInt(3),size:0,stains:false,splash:true};
        q.shade=2+RandomInt(3);P.push(q)}}

    function Tick(){
      GoreClock++;if(opt.monster)Animate();
      for(var i=0;i<P.length;){var p=P[i],fin=false;
        if(p.vx!==0||p.vy!==0){var ox=p.tx,oy=p.ty;p.tx+=p.vx;p.ty+=p.vy;var g=groundTile(p);
          if((g[0]!==p.x||g[1]!==p.y)&&!inGrid(g[0],g[1])){p.tx=ox;p.ty=oy;p.vx=0;p.vy=0}else{p.x=g[0];p.y=g[1]}}
        p.z+=p.vz;p.vz-=Gravity;
        if(p.z<=0){p.z=0;SplashAt(p);if(p.stains)StainAt(p.x,p.y,FleshLandStain);fin=true}
        if(p.life===0||--p.life===0)fin=true;
        if(fin){P[i]=P[P.length-1];P.pop()}else i++}}

    // ---- the view ----
    var light=opt.light||{x:MX-1,y:MY+1,radius:15};
    var VW,VH,W,H,OX,OY,floorLit,lightAt,lightQ,blood,frame,img,u32,tiles=[],keys={},stale={},frameNo=0,BudgetMs=6;
    function dpOf(x,y){return [OX+(x-y)*32,OY+(x+y)*16]}
    function layout(){
      var css=cv.parentNode.clientWidth||640;
      // `perCss` game pixels (4x art) to a CSS pixel of the column.
      VW=clamp(Math.floor(css/(4*(opt.perCss||.8))/4)*4,opt.minW||100,320);VH=Math.max(opt.minH||0,Math.round(VW*(opt.aspect||.7)/4)*4);
      W=VW*S;H=VH*S;cv.width=W;cv.height=H;
      // The centre tile drawn so its ground point sits `ground` of the way down.
      var md=[VW/2-32,Math.round(VH*(opt.ground||.66))+15];OX=md[0]-(CX-CY)*32;OY=md[1]-(CX+CY)*16;
      floorLit=new Uint8Array(W*H);lightAt=new Uint8Array(W*H);lightQ=new Uint8Array(W*H);blood=new Uint8Array(W*H);frame=new Uint8Array(W*H);
      img=ctx.createImageData(W,H);u32=new Uint32Array(img.data.buffer);
      // The light with the smooth falloff: per 1x pixel, in sixteenths of a level, from its continuous distance in
      // world tiles to the light (LightFalloffs' line); each 4x pixel of the block draws a level through the 4x4
      // ordered dither (LightDitherLevel).
      var maxD=(light.radius+1)*8;
      for(var sy=0;sy<H;sy++){var ly=(sy>>2)+.5,w=(ly-(OY-14.5))/16;
        for(var sx=0;sx<W;sx++){var u=(((sx>>2)+.5)-(OX+32))/32,wx=(u+w)/2,wy=(w-u)/2,d=Math.hypot(wx-light.x,wy-light.y)*8,
            q=d>=maxD?240:Math.min(240,Math.round(d/maxD*240)),o=sy*W+sx;
          lightQ[o]=q;lightAt[o]=Math.min(15,(q+BAYER[sy&3][sx&3])>>4)}}
      // The floor: each tile's two micros, their triangles' 4x pixels, then lit.
      var fl=new Uint8Array(W*H);tiles=[];
      for(var x=0;x<G;x++)for(var y=0;y<G;y++){var dp=dpOf(x,y);
        if(dp[0]+64<0||dp[0]>VW||dp[1]<0||dp[1]-31>VH)continue;tiles.push([x,y]);
        for(var k=0;k<2;k++){var m=data.micros[data.grid[(x*G+y)*2+k]],c0=(dp[0]+32*k)*S,r0=(dp[1]-31)*S,n=0;
          for(var Y=0;Y<128;Y++){var r=31-(Y>>2);if(r>=31)continue;var wd=r<=15?2*(r+1):2*(31-r),from=m.side===0?32-wd:0,sy2=r0+Y;
            for(var X=from*4;X<(from+wd)*4;X++,n++){var sx2=c0+X;if(sy2>=0&&sy2<H&&sx2>=0&&sx2<W)fl[sy2*W+sx2]=m.px[n]}}}}
      for(var i=0;i<W*H;i++)floorLit[i]=LT[lightAt[i]][fl[i]];
      blood.set(floorLit);keys={};stale={};
    }

    // ---- a tile's pools at the scale (GatherStainBlobs, DrawStainsAtScale) ----
    function splashes(out,x,y,ox,oy){var amount=dBlood[gi(x,y)];if(amount===0)return;
      var seed=TileHash(x,y),spl=amount>90?3:amount>45?2:1;
      for(var k=0;k<spl&&out.length<MaxStainBlobs;k++){var h=Mix((seed+Math.imul(k,0x9E3779B9))>>>0),spread=k===0?16:34,
          sc=9+((h>>>9)&7),shrink=k===0?12:22;
        out.push({cx:ox+32+(h&31)-(spread>>1),cr:GroundRow-oy+((h>>>5)&15)-(spread>>2),
          rx:Math.max(4,(StainRX*sc/shrink)|0),ry:Math.max(2,(StainRY*sc/shrink)|0),amount:k===0?amount:(amount*3/4)|0,age:SteppedAge(StainTime[gi(x,y)])})}}
    function gatherBlobs(tx,ty){var out=[];
      // Each tile alone: its own splashes only, so what reaches past its diamond is cut off at the edge.
      if(gather==='alone'){splashes(out,tx,ty,0,0);return out}
      for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){var x=tx+dx,y=ty+dy;if(!inGrid(x,y))continue;
        var ox=(dx-dy)*32,oy=(dx+dy)*16,at=BleedAt[gi(x,y)];
        if(at&&out.length<MaxStainBlobs){var b=Bleeds[at-1],r=BleedRadius4(b)/4;
          out.push({cx:ox+32+b.ox,cr:GroundRow-oy+b.ov,rx:r,ry:r/2,amount:BleedAmount,age:BleedAgeStep(b)/7})}
        splashes(out,x,y,ox,oy)}
      return out}
    var FA=new Float32Array(34*65),FG=new Float32Array(34*65);
    function drawStains(tx,ty,dp){
      var blobs=gatherBlobs(tx,ty);if(!blobs.length)return;
      var total=0;blobs.forEach(function(b){total+=b.amount});
      if(total*(1+L.stainMottle)+L.stainNoise*.5<L.stainThreshold*.45)return;
      var ready=blobs.map(function(b){var rx=b.rx*L.stainRadiusScale,ry=b.ry*L.stainRadiusScale,cx=b.cx+.5,cv_=b.cr+.5;
        return {cx:cx,cv:cv_,irx:1/rx,iry:1/ry,amount:b.amount,vLow:cv_-ry-L.stainWarp*.5,vHigh:cv_+ry+L.stainWarp*.5,xLow:cx-rx-L.stainWarp,xHigh:cx+rx+L.stainWarp,age:b.age}});
      var wdx=(tx-ty)*32,wdy=(tx+ty)*16,peak=0,open=function(x,y){return inGrid(x,y)};
      var oXp=open(tx+1,ty),oXm=open(tx-1,ty),oYp=open(tx,ty+1),oYm=open(tx,ty-1),walled=!(oXp&&oXm&&oYp&&oYm);
      for(var j=0;j<34;j++){var v=j-1,act=[],lo=1e9,hi=-1e9;
        for(var b=0;b<ready.length;b++){var r=ready[b];if(v<r.vLow||v>r.vHigh)continue;act.push(r);lo=Math.min(lo,r.xLow);hi=Math.max(hi,r.xHigh)}
        for(var i=0;i<65;i++){var x=i,o=j*65+i;FA[o]=0;FG[o]=0;if(x<lo||x>hi)continue;
          var ux=(x-32)/32,uv=(v-15.5)/16;if(Math.abs(ux+uv)>1.1||Math.abs(ux-uv)>1.1)continue;
          var wx=(wdx+i)*S,wv=((j-1)-wdy)*S;
          var px=x+(SmoothNoise(wx+41,wv+83)-.5)*2*L.stainWarp,pv=v+(SmoothNoise(wx+97,wv+13)-.5)*L.stainWarp;
          var f=0,aged=0;
          for(var n=0;n<act.length;n++){var a=act[n],ddv=(pv-a.cv)*a.iry,ddx=(px-a.cx)*a.irx,d2=ddx*ddx+ddv*ddv;
            if(d2<1){var share=a.amount*(1-d2);f+=share;aged+=share*a.age}}
          FG[o]=f>0?aged/f:0;if(f<=0)continue;
          f*=1-L.stainMottle+2*L.stainMottle*SmoothNoise(wx+211,wv+157);
          if(walled){var A=ux+uv,B=ux-uv,fd=function(dd){var t=clamp(dd/.35,0,1);return t*t*(3-2*t)};
            if(!oXp)f*=fd(1-B);if(!oXm)f*=fd(1+B);if(!oYp)f*=fd(1+A);if(!oYm)f*=fd(1-A)}
          FA[o]=f;if(f>peak)peak=f}}
      var fringeFrom=L.stainThreshold*.45,noiseReach=L.stainNoise*.5,lowest=Math.min(L.stainThreshold,fringeFrom)-noiseReach;
      if(peak+noiseReach<Math.min(L.stainThreshold,fringeFrom))return;
      var span=Math.max(1,L.stainThick-L.stainThreshold),inv=1/S;
      for(j=0;j<33;j++)for(var bb=0;bb<S;bb++){
        var sy=(dp[1]-(j-1))*S+bb;if(sy<0||sy>=H)continue;
        var fv=1-(bb+.5)*inv,vv=(j-1)+fv,uvv=(vv-15.5)/16,half=1-Math.abs(uvv);if(half<=0)continue;
        var iFrom=Math.max(0,Math.floor(32-half*32)),iTo=Math.min(63,Math.ceil(32+half*32));
        var wvv=(OY+1)*S-sy-1,sRow=(wvv&127)*128,fRow=((((wvv>>1)*7+2)&127)*128),row=sy*W;
        for(i=iFrom;i<=iTo;i++){var f00=FA[j*65+i],f10=FA[j*65+i+1],f01=FA[(j+1)*65+i],f11=FA[(j+1)*65+i+1];
          if(Math.max(f00,f10,f01,f11)<lowest)continue;
          var left=f00+(f01-f00)*fv,right=f10+(f11-f10)*fv;
          var a00=FG[j*65+i]*f00,a10=FG[j*65+i+1]*f10,a01=FG[(j+1)*65+i]*f01,a11=FG[(j+1)*65+i+1]*f11;
          var aL=a00+(a01-a00)*fv,aR=a10+(a11-a10)*fv,sxB=(dp[0]+i)*S;
          for(var aa=0;aa<S;aa++){var sx=sxB+aa;if(sx<0||sx>=W)continue;var fx=(aa+.5)*inv;if(!owns(i+fx,vv))continue;
            var wxx=sx-OX*S,plain=left+(right-left)*fx,ff=plain+(SMOOTH[sRow+(wxx&127)]/255-.5)*L.stainNoise;
            var age=plain>0?clamp((aL+(aR-aL)*fx)/plain,0,1):0,shift=AgeShift(age),depth=.5;
            if(ff<L.stainThreshold){if(ff<fringeFrom)continue;var near=(ff-fringeFrom)/(L.stainThreshold-fringeFrom);
              if(WHITE[fRow+((((wxx>>1)*3+5))&127)]/256>=near*near*L.stainFringe)continue}
            else depth=Math.min(1,(ff-L.stainThreshold)/span);
            var o2=row+sx,lv=lightAt[o2],k=TintShade(FloorShade(blood[o2],lv),depth,WHITE[sRow+(wxx&127)]/256);
            if(k<0)continue;k=clamp(k+shift,0,11);blood[o2]=LT[lv][RAMP[k]]}}}
    }

    // ---- marks (MarkDiscs, DrawFloorDisc, DrawMarksAtScale) ----
    function markDiscs(m,x,v){
      var r=m.radius4/4/S,ux=m.dirX/64,uv=-m.dirY/64;if(ux===0&&uv===0)ux=1;var h=m.seed,out=[];
      function next(){h=Mix((h+0x9E3779B9)>>>0);return (h&0xFFFF)/65535}
      var age=AgeShift(SteppedAge(m.born));
      if(m.kind===0){out.push([x,v,r,r*.5,1,0,.5]);var sat=(next()*3)|0;
        for(var i=0;i<sat;i++){var an=next()*6.2832,dist=r*(1.7+next()),rs=r*(.3+.2*next());out.push([x+Math.cos(an)*dist,v+Math.sin(an)*dist*.5,rs,rs*.5,1,0,.5])}}
      else{var nm=Math.hypot(ux,uv),dx=ux/nm,dv=uv/nm,len=r*(3.5+5*next());out.push([x,v,r*.85,r*.55,dx,dv,.5]);
        var along=Math.max(r*.55,len/5*.7);
        for(i=1;i<=5;i++){var t=i/5,w=r*(.45-.33*t);out.push([x+dx*len*t,v+dv*len*t,along,w,dx,dv,.5])}
        if(next()<.45){var ah=len*(1.25+.4*next()),rs2=r*(.22+.12*next());out.push([x+dx*ah,v+dv*ah,rs2,rs2*.6,dx,dv,.5])}}
      return {discs:out,age:age}}
    function drawDisc(dp,d,age){
      var reach=Math.max(d[2],d[3]*2)+.5;
      var col=function(x){return Math.floor((dp[0]+x)*S)},rowf=function(v){return Math.floor((dp[1]+1-v)*S)};
      var sx0=Math.max(col(d[0]-reach),col(0),0),sx1=Math.min(col(d[0]+reach),col(64),W-1),sy0=Math.max(rowf(d[1]+reach),rowf(32),0),sy1=Math.min(rowf(d[1]-reach),rowf(-1),H-1);
      for(var sy=sy0;sy<=sy1;sy++){var v=dp[1]+1-(sy+.5)/S,wv=(OY+1)*S-sy-1;
        for(var sx=sx0;sx<=sx1;sx++){var x=(sx+.5)/S-dp[0];if(!owns(x,v))continue;
          var dx=x-d[0],dv=v-d[1],a=(dx*d[4]+dv*d[5])/d[2],c=(-dx*d[5]+dv*d[4])/d[3],d2=a*a+c*c,wx=sx-OX*S;
          if(d2+(SmoothNoise(wx,wv)-.5)*d[6]>=1)continue;
          var o=sy*W+sx,lv=lightAt[o],k=TintShade(FloorShade(blood[o],lv),.5+.5*(1-d2),WhiteNoise(wx,wv));if(k<0)continue;
          k=clamp(k+age,0,11);blood[o]=LT[lv][RAMP[k]]}}}
    function drawMarks(tx,ty,dp){
      for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){var x=tx+dx,y=ty+dy;if(!inGrid(x,y))continue;var a=MarksAt[gi(x,y)];if(!a)continue;
        var ox=(dx-dy)*32,oy=(dx+dy)*16;
        for(var n=0;n<a.length;n++){var m=Marks[a[n]],mx=ox+m.x16/16,mv=-oy+m.v16/16,reach=m.radius4/(4*S)*(m.kind===3?15:4.2)+.5;
          if(mx+reach<0||mx-reach>64||mv+reach<-1||mv-reach>32)continue;
          var ux=(mx-32)/32,uv=(mv-15.5)/16,mg=reach/16;if(Math.abs(ux+uv)>1+mg*1.5||Math.abs(ux-uv)>1+mg*1.5)continue;
          var md=markDiscs(m,mx,mv);for(var i=0;i<md.discs.length;i++)drawDisc(dp,md.discs[i],md.age)}}}

    // What a tile's blood is made of (FloorKey, plus the marks on it): drawn again only when it changes.
    function tileKey(tx,ty){var h=0x811C9DC5,any=false;
      function add(v){h=Math.imul(h^(v>>>0),16777619)>>>0}
      for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){var x=tx+dx,y=ty+dy;if(!inGrid(x,y))continue;var i=gi(x,y);
        if(dBlood[i]){any=true;add(i*7+dBlood[i]*131072);add(AgeStep(StainTime[i]))}
        if(BleedAt[i]){any=true;var b=Bleeds[BleedAt[i]-1];add(BleedRadius4(b)+1000*BleedAgeStep(b)+65536*i)}
        var a=opt.marks!==false&&MarksAt[i];if(a&&a.length){any=true;for(var n=0;n<a.length;n++)add(a[n]*8+AgeStep(Marks[a[n]].born))}}
      return any?h:0}
    // As the engine keeps a budget for working tiles out again (TakeRebuild), a frame redraws tiles for a few
    // milliseconds at most, those waiting longest first; one that waits shows its previous pixels meanwhile.
    function redrawTile(x,y,k){var dp=dpOf(x,y);
      // Back to the bare floor over the tile's own diamond, then its pools, then the marks on it.
      for(var sy=Math.max(0,(dp[1]-31)*S);sy<Math.min(H,(dp[1]+1)*S);sy++){var v=dp[1]+1-(sy+.5)/S;
        for(var sx=Math.max(0,dp[0]*S);sx<Math.min(W,(dp[0]+64)*S);sx++)if(owns((sx+.5)/S-dp[0],v))blood[sy*W+sx]=floorLit[sy*W+sx]}
      if(k){drawStains(x,y,dp);if(opt.marks!==false)drawMarks(x,y,dp)}}
    function updateTiles(all){var todo=[],t0=performance.now(),done=0;frameNo++;
      for(var t=0;t<tiles.length;t++){var x=tiles[t][0],y=tiles[t][1],k=tileKey(x,y),id=gi(x,y);
        if((keys[id]||0)===k){delete stale[id];continue}
        if(!stale[id])stale[id]=frameNo;todo.push([stale[id],x,y,k,id])}
      todo.sort(function(a,b){return a[0]-b[0]});
      for(var i=0;i<todo.length;i++){if(!all&&done&&performance.now()-t0>BudgetMs)break;
        var e=todo[i];redrawTile(e[1],e[2],e[3]);keys[e[4]]=e[3];delete stale[e[4]];done++}
      return done>0}
    function pending(){for(var id in stale)return true;return false}

    // ---- drops in the air (DrawDrop) ----
    function drawDrop(hx,hy,r,vx,vy,coreK){
      var speed=Math.hypot(vx,vy),ux=1,uy=0;if(speed>.01){ux=vx/speed;uy=vy/speed}
      var len=speed>=L.streakMinSpeed?(speed-L.streakMinSpeed*.5)*L.streakTicks*S:0,stretch=1+(L.stretch-1)*Math.min(1,speed/3),along=r*stretch,reach=Math.max(along,r)+1;
      var tx=hx-ux*len,ty=hy-uy*len,x0=Math.max(0,Math.floor(Math.min(hx,tx)-reach)),x1=Math.min(W-1,Math.ceil(Math.max(hx,tx)+reach)),
        y0=Math.max(0,Math.floor(Math.min(hy,ty)-reach)),y1=Math.min(H-1,Math.ceil(Math.max(hy,ty)+reach));
      var hlx=hx-r*.38,hly=hy-r*.38,hlr2=(r*.42)*(r*.42);
      for(var y=y0;y<=y1;y++){var py=y+.5;for(var x=x0;x<=x1;x++){var px=x+.5,rx=px-hx,ry=py-hy,a=rx*ux+ry*uy,c=-rx*uy+ry*ux,
          dh=Math.sqrt((a/along)*(a/along)+(c/r)*(c/r)),k;
        if(dh<1){k=(1-dh)*r<L.rimWidth?L.rimK:coreK;if(((px-hlx)*(px-hlx))+((py-hly)*(py-hly))<hlr2)k=L.highlightK}
        else if(len>0&&a<0&&a>-len){var t=-a/len,rt=r*(1-t*(1-L.streakTail)),ac=Math.abs(c);if(ac>=rt)continue;
          k=(rt-ac)<L.rimWidth*.7?L.rimK:L.streakK+((t*2)|0)}
        else continue;
        var o=y*W+x;frame[o]=LT[lightAt[o]][RAMP[clamp(k,0,11)]]}}}
    function drawParticles(progress,front){
      for(var i=0;i<P.length;i++){var p=P[i];
        var fx=p.tx+Math.trunc(p.vx*progress/128),fy=p.ty+Math.trunc(p.vy*progress/128),fz=Math.max(0,p.z+Math.trunc(p.vz*progress/128));
        var t=screenToMissile(fx>>Fp,fy>>Fp),rxT=p.sx+t[0],ryT=p.sy+t[1];
        // Painter's order: a drop over a tile drawn after the monster's is drawn over it.
        var key=(rxT+ryT)*64+(rxT-ryT),mk=(MX+MY)*64+(MX-MY);if((key>=mk)!==front)continue;
        var dp=dpOf(p.sx,p.sy),bx=dp[0]+32+fx/One,by=dp[1]-GroundRow+(fy-fz)/One,shade=p.shade-2;
        var r=p.size>=2?L.chunkRadius:L.speckRadius;if(p.splash)r=L.speckRadius*.55;r=Math.max(.6,r+L.speckRadiusVar*shade*.5);
        drawDrop((bx+.5)*S,(by+.5)*S,r,p.vx/One,(p.vy-(fz>0?p.vz:0))/One,L.coreK+Math.trunc(shade/2))}}
    // A death variant's blood is drawn on the shared blood ramp (the remap after its TRN): 48-59 to 226-236.
    var DeathRemap=new Uint8Array(256);for(var ri=0;ri<256;ri++)DeathRemap[ri]=ri>=48&&ri<=59?RAMP[ri-48]:ri;
    function drawMonster(){if(!opt.monster)return;
      var sp=anim==='hit'?data.hit[animFrame]:anim==='death'?data.death[animFrame]:data.stand,remap=anim==='death';
      var dp=dpOf(MX,MY),x0=dp[0]*S-sp.ax,y0=dp[1]*S-sp.ay;
      var g=clamp(((dp[1]-GroundRow)*S)|0,0,H-1)*W+clamp((dp[0]+32)*S,0,W-1),tab=LT[Math.min(15,(lightQ[g]+8)>>4)];
      for(var y=0;y<sp.h;y++){var sy=y0+y;if(sy<0||sy>=H)continue;
        for(var x=0;x<sp.w;x++){var v=sp.px[y*sp.w+x];if(v===255)continue;var sx=x0+x;if(sx<0||sx>=W)continue;frame[sy*W+sx]=tab[remap?DeathRemap[v]:v]}}}
    function compose(progress){
      frame.set(blood);drawParticles(progress,false);drawMonster();drawParticles(progress,true);
      for(var i=0;i<frame.length;i++)u32[i]=PRES[(lightQ[i]<<8)|frame[i]];ctx.putImageData(img,0,0)}

    function busy(){if(P.length)return true;
      for(var i=0;i<Bleeds.length;i++)if(GoreSeconds(Bleeds[i].born)<BleedSeconds+95)return true;
      for(i=0;i<G*G;i++)if(dBlood[i]&&GoreSeconds(StainTime[i])<95)return true;
      for(i=0;i<Marks.length;i++)if(Marks[i]&&GoreSeconds(Marks[i].born)<95)return true;return false}
    function wash(){P=[];dBlood.fill(0);StainOrder.fill(0);StainTime.fill(0);BleedAt.fill(0);Bleeds=[];Marks=[];NextMark=0;MarksAt={};anim='stand';animFrame=0}
    // The clock runs on as it was: what has dried stays dry, what is fresh dries the faster.
    function setAgeSpeed(s){if(s===AgeSpeed)return;var f=AgeSpeed/s;
      for(var i=0;i<G*G;i++)if(dBlood[i])StainTime[i]=Math.round(GoreClock-(GoreClock-StainTime[i])*f);
      Bleeds.forEach(function(q){q.born=Math.round(GoreClock-(GoreClock-q.born)*f)});
      Marks.forEach(function(m){if(m)m.born=Math.round(GoreClock-(GoreClock-m.born)*f)});AgeSpeed=s}
    // The facing whose screen direction is nearest a point on the canvas (client coordinates), from the monster's body.
    function facingAt(clientX,clientY){var r=cv.getBoundingClientRect(),
        lx=(clientX-r.left)*(W/r.width)/S,ly=(clientY-r.top)*(H/r.height)/S,dp=dpOf(MX,MY),
        dx=lx-(dp[0]+32),dy=ly-(dp[1]-GroundRow-20),best=0,bd=-Infinity;
      for(var i=0;i<8;i++){var w=DIRS[i],sx=(w[0]-w[1])*32,sy=(w[0]+w[1])*16,n=Math.hypot(sx,sy),dot=(dx*sx+dy*sy)/n;if(dot>bd){bd=dot;best=i}}
      return best}
    function setGather(g){gather=g;keys={};stale={}}

    layout();
    return {MX:MX,MY:MY,layout:layout,Burst:Burst,Tick:Tick,updateTiles:updateTiles,pending:pending,compose:compose,busy:busy,
      wash:wash,setAgeSpeed:setAgeSpeed,facingAt:facingAt,setGather:setGather,
      particles:function(){return P.length},block:function(){return StainInBlock(MX,MY)},
      isDead:function(){return anim==='death'},raise:function(){anim='stand';animFrame=0},
      animating:function(){return anim==='hit'||(anim==='death'&&animFrame<data.death.length-1)}};
  }
  return {load:load,World:World,supported:supported};
})();
