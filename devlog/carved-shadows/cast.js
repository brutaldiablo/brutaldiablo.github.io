/* The carved-shadows post's casting widgets: the toy. Every shadow is cast
   live from the data in data/, made from the game's 4x art by the carving tools:
   - <key>_sprites.png: the frames at 2x (rows: the eight drawings, columns: the frames), cropped to crop = [x, y, w, h];
   - <key>.json: meta (C: the camera's angle above the floor, anchor: the ground point under the figure's axis, 1x),
     runs: per frame the carved body's columns as int16 [x, z, y0, y1] (x and z on the floor, y0..y1 the column's
     height);
   - <key>_painted.png (the toy's Diablo (1996) mode): the frames of the one drawing the toy shows, at 2x, with the
     shadow painted into the 4x art kept, cropped to the toy's pc = [x, y, w, h].
   A light is a direction round the figure (alpha, 0 = on the camera's side, turning to the screen's right) and a height
   above the floor (phi). Each figure is seen as drawing `dir`: the game's camera stands at 45 dir degrees round it.
   The geometry is the showcase page's (build_anim.py, script_v3.js), the light's height free instead of four steps. */
/* Translated text: bdT comes from the page's head, or the English fallback devlog.js defines. Each widget is guarded on
   its own, so one that fails leaves the others working. */
window.bdT=window.bdT||function(s,v){return v?s.replace(/\{(\w+)\}/g,function(m,k){return v[k]!=null?v[k]:m}):s};
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,FPS=12,DARK=.72;
  var rad=function(d){return d*Math.PI/180},dot=function(x,y){return x[0]*y[0]+x[1]*y[1]+x[2]*y[2]};
  function basis(psi,phi){var p=rad(psi),st=Math.sin(rad(phi)),ct=Math.cos(rad(phi)),sp=Math.sin(p),cp=Math.cos(p);
    return {r:[cp,0,-sp],u:[-st*sp,ct,-st*cp],f:[-ct*sp,-st,-ct*cp]}}

  // loading: one fetch per file, shared by the widgets
  var cache={};
  function image(src){return new Promise(function(ok,no){var i=new Image();i.onload=function(){ok(i)};i.onerror=function(){no(new Error(src))};i.src=src})}
  function decodeRuns(b64){var bin=atob(b64),u8=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return new Int16Array(u8.buffer)}
  function loadClip(base,key){
    if(!cache[key])cache[key]=Promise.all([fetch(base+key+'.json').then(function(r){if(!r.ok)throw new Error(key);return r.json()}),
      image(base+key+'_sprites.png')]).then(function(a){
        return {key:key,meta:a[0],spr:a[1],runs:a[0].runs.map(decodeRuns),base:base}});
    return cache[key]}

  // the light in screen terms: a = the light's right axis on the screen, b = one unit of height laid on the floor away
  // from the light (the stretch st over cos C per unit, phi = atan(1 / (st cos C))), syl = cos C / cos phi
  function geom(meta,dir,alpha,phi){var C=meta.C,psi=((alpha+45*dir)%360+360)%360,st=1/(Math.tan(rad(phi))*Math.cos(rad(C)));
    var cam=basis(45*dir,C),L=basis(psi,phi),aw=[L.f[0],0,L.f[2]],n=Math.hypot(aw[0],aw[2]);aw=[aw[0]/n,0,aw[2]/n];
    var a=[dot(L.r,cam.r),-dot(L.r,cam.u)],b=[st*dot(aw,cam.r),-st*dot(aw,cam.u)],sy=Math.cos(rad(C))/Math.cos(rad(phi)),r=L.r,u=L.u;
    return {alpha:alpha,psi:psi,phi:phi,st:st,a:a,b:b,
      mx:[r[0]*a[0]+u[0]*sy*b[0],r[0]*a[1]+u[0]*sy*b[1]],my:[r[1]*a[0]+u[1]*sy*b[0],r[1]*a[1]+u[1]*sy*b[1]],mz:[r[2]*a[0]+u[2]*sy*b[0],r[2]*a[1]+u[2]*sy*b[1]]}}
  // the carved body: each column falls on the floor as one line along the light
  function carvedPath(g,clip,frame,G,O,K){var R=clip.runs[frame],step=4;g.beginPath();
    for(var i=0;i<R.length;i+=step){var x=R[i],z=R[i+1],y0=R[i+2]-.5,y1=R[i+3]+.5;
      var bx=O[0]+x*G.mx[0]+z*G.mz[0],by=O[1]+x*G.mx[1]+z*G.mz[1];
      g.moveTo(K*(bx+y0*G.my[0]),K*(by+y0*G.my[1]));g.lineTo(K*(bx+y1*G.my[0]),K*(by+y1*G.my[1]))}}
  function drawCarved(g,clip,frame,G,O,K){carvedPath(g,clip,frame,G,O,K);g.lineWidth=1.25*K;g.lineCap='round';g.strokeStyle='#000';g.stroke()}
  // the figure itself, from the 2x frames; S = canvas pixels per 1x pixel
  function drawSprite(g,clip,frame,d,O,S){var m=clip.meta,c=m.crop;
    g.drawImage(clip.spr,frame*c[2]*2,d*c[3]*2,c[2]*2,c[3]*2,(O[0]+c[0]-m.anchor[0])*S,(O[1]+c[1]-m.anchor[1])*S,c[2]*S,c[3]*S)}
  function layer(w,h){var c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c}
  function clear(c){var g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,c.width,c.height);return g}
  var grain=(function(){var c=layer(96,96),g=c.getContext('2d'),id=g.createImageData(96,96),s=7;
    for(var i=0;i<id.data.length;i+=4){s=(s*1664525+1013904223)>>>0;var v=s/4294967296;id.data[i]=id.data[i+1]=id.data[i+2]=v<.5?0:255;id.data[i+3]=Math.round(Math.abs(v-.5)*22)}
    g.putImageData(id,0,0);return c})();
  // a shadow layer softened: Chrome blurs it, elsewhere the smooth scaling up does the softening
  function drawShadow(g,src,W,H,alpha,blur){g.save();g.imageSmoothingEnabled=true;g.globalAlpha=alpha;if(blur&&'filter' in g)g.filter='blur('+blur+'px)';
    g.drawImage(src,0,0,W,H);g.restore()}
  // a widget runs its loop only while on screen
  function onScreen(el,fn){if(!('IntersectionObserver' in window)){fn(true);return}
    new IntersectionObserver(function(es){es.forEach(function(e){fn(e.isIntersecting)})},{threshold:.05}).observe(el)}
  function whenNear(el,fn){if(!('IntersectionObserver' in window)){fn();return}
    var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting})){io.disconnect();fn()}},{rootMargin:'500px 0px'});io.observe(el)}
  function drag(el,fn){var on=false;
    el.addEventListener('pointerdown',function(e){on=true;try{el.setPointerCapture(e.pointerId)}catch(_){}fn(e);e.preventDefault()});
    el.addEventListener('pointermove',function(e){if(on)fn(e)});el.addEventListener('pointerup',function(){on=false});el.addEventListener('pointercancel',function(){on=false})}
  
  // The toy: three characters on a floor round a brazier. In Brutal Diablo mode each casts its carved body's shadow
  // from the brazier's flame (on a post), fading with the distance; in Diablo (1996) mode each is drawn with the shadow
  // painted into its art, which stays put wherever the brazier goes. The brazier moves by pointer or by the arrow keys on
  // the floor.
  try{(function(){
    var w=document.getElementById('toy');if(!w)return;
    var base=w.closest('figure').dataset.base,status=w.querySelector('.status'),cvBox=w.querySelector('.cv'),poster=cvBox.querySelector('img.poster');
    var modes=[].slice.call(w.querySelectorAll('.mode'));
    var WW=320,HH=190,POST=40,REACH=250,BX=[16,WW-16],BY=[54,HH-8];
    var CAST=[{who:'knight',key:'knight_attack',dir:7,pc:[0,5,160,123],at:[92,112],f:0},{who:'succubus',key:'succubus_attack',dir:6,pc:[16,30,103,91],at:[236,104],f:5},
      {who:'warrior',key:'warrior_attack',dir:0,pc:[0,21,86,106],at:[170,166],f:9}];
    var on={knight:true,succubus:true,warrior:true},mode='carved',bx=0,by=0,playing=!reduce,seen=false,cv=null,floor=null,ready=false,tick0=0,lay=layer(WW,HH);
    bx=BX[0]+(BX[1]-BX[0])*.22;by=BY[0]+(BY[1]-BY[0])*.7;
    // the floor: diamond flagstones in the Cathedral's 2:1 grid, each its own shade of stone, with grain
    function makeFloor(P){var c=layer(WW*P,HH*P),g=c.getContext('2d'),s=11;function rnd(){s=(s*1664525+1013904223)>>>0;return s/4294967296}
      g.fillStyle='#4a3f35';g.fillRect(0,0,c.width,c.height);var tw=32,th=16;
      for(var j=-1;j<HH/th*2+2;j++)for(var i=-1;i<WW/tw+2;i++){var cx=(i*tw+(j%2?tw/2:0))*P,cy=j*th/2*P,v=rnd(),k=84+v*18,wa=rnd()*8;
        g.fillStyle='rgb('+Math.round(k+12+wa)+','+Math.round(k+3+wa*.6)+','+Math.round(k-8)+')';
        g.beginPath();g.moveTo(cx,cy-th/2*P+P*.35);g.lineTo(cx+tw/2*P-P*.6,cy);g.lineTo(cx,cy+th/2*P-P*.35);g.lineTo(cx-tw/2*P+P*.6,cy);g.closePath();g.fill();
        if(rnd()<.5){g.strokeStyle='rgba(40,32,26,.35)';g.lineWidth=P*.6;g.beginPath();g.moveTo(cx-tw/4*P,cy-th/4*P);g.lineTo(cx+tw/4*P,cy+th/4*P);g.stroke()}}
      g.fillStyle=g.createPattern(grain,'repeat');g.fillRect(0,0,c.width,c.height);g.fillRect(0,0,c.width,c.height);return c}
    var P=1;
    function size(){var dpr=window.devicePixelRatio||1,cw=cvBox.clientWidth||WW,S=Math.min(2,cw/WW);P=S*dpr;
      if(cv){cv.width=Math.round(WW*P);cv.height=Math.round(HH*P);floor=makeFloor(P)}}
    function render(){if(!ready||!cv)return;var g=cv.getContext('2d'),Wc=cv.width,Hc=cv.height,sC=Math.sin(rad(25)),flameH=POST*Math.cos(rad(25));
      g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.drawImage(floor,0,0);
      var list=CAST.filter(function(c){return on[c.who]});
      list.forEach(function(c){var m=c.clip.meta,dx=bx-c.at[0],dz=(by-c.at[1])/Math.sin(rad(m.C)),D=Math.hypot(dx,dz),alpha=(Math.atan2(dx,dz)*180/Math.PI+360)%360;
        var phi=Math.max(10,Math.min(85,Math.atan(POST/Math.max(D,1))*180/Math.PI)),G=geom(m,c.dir,alpha,phi),I=Math.max(0,1-D/REACH),fr=(c.f+tick0)%m.frames;
        if(mode!=='carved')return;
        var lg=clear(lay);drawCarved(lg,c.clip,fr,G,c.at,1);
        drawShadow(g,lay,Wc,Hc,DARK*Math.pow(I,.7),1.2*P/2)});
      // what stands on the floor, back to front: the characters and the brazier
      var items=list.map(function(c){return {y:c.at[1],draw:function(){var fr=(c.f+tick0)%c.clip.meta.frames;
        if(mode==='carved')drawSprite(g,c.clip,fr,c.dir,c.at,P);else drawPainted(g,c,fr,P)}}});
      items.push({y:by,draw:function(){g.fillStyle='#1b1512';g.strokeStyle='#5a4a3c';g.lineWidth=P*.8;
        g.beginPath();g.ellipse(bx*P,by*P,6*P,6*P*sC,0,0,7);g.fill();g.stroke();
        g.fillStyle='#2a221c';g.fillRect((bx-1.2)*P,(by-flameH+4)*P,2.4*P,(flameH-4)*P);
        g.beginPath();g.moveTo((bx-7)*P,(by-flameH+2)*P);g.lineTo((bx+7)*P,(by-flameH+2)*P);g.lineTo((bx+4)*P,(by-flameH+7)*P);g.lineTo((bx-4)*P,(by-flameH+7)*P);g.closePath();g.fill();g.stroke()}});
      items.sort(function(a,b){return a.y-b.y}).forEach(function(it){it.draw()});
      // the dark beyond the brazier's reach, then its flame
      g.save();g.translate(bx*P,(by-flameH*.3)*P);g.scale(1,.62);var rg=g.createRadialGradient(0,0,0,0,0,REACH*P*.95);
      rg.addColorStop(0,'rgba(255,170,80,.10)');rg.addColorStop(.3,'rgba(12,9,8,0)');rg.addColorStop(1,'rgba(12,9,8,.82)');g.fillStyle=rg;g.fillRect(-Wc*3,-Hc*4,Wc*6,Hc*8);g.restore();
      var fy=by-flameH,gl=g.createRadialGradient(bx*P,(fy-2)*P,0,bx*P,(fy-2)*P,18*P);gl.addColorStop(0,'rgba(255,230,170,1)');gl.addColorStop(.2,'rgba(255,170,70,.75)');gl.addColorStop(1,'rgba(255,120,40,0)');
      g.fillStyle=gl;g.beginPath();g.arc(bx*P,(fy-2)*P,18*P,0,7);g.fill()}
    // the 1996 figure: the frame with its painted shadow, from the one-row atlas
    function drawPainted(g,c,fr,P){var m=c.clip.meta,q=c.pc;
      g.drawImage(c.painted,fr*q[2]*2,0,q[2]*2,q[3]*2,(c.at[0]+q[0]-m.anchor[0])*P,(c.at[1]+q[1]-m.anchor[1])*P,q[2]*P,q[3]*P)}
    function setBrazier(x,y){bx=Math.max(BX[0],Math.min(BX[1],x));by=Math.max(BY[0],Math.min(BY[1],y));render()}
    cvBox.addEventListener('keydown',function(e){var d=6,k=e.key;if(k==='ArrowLeft')setBrazier(bx-d,by);else if(k==='ArrowRight')setBrazier(bx+d,by);
      else if(k==='ArrowUp')setBrazier(bx,by-d);else if(k==='ArrowDown')setBrazier(bx,by+d);else return;e.preventDefault()});
    function label(){if(cv)cv.setAttribute('aria-label',mode==='carved'?bdT('A Blood Knight, a Succubus and the Warrior round a brazier, each casting the shadow of its carved body away from the fire'):bdT('A Blood Knight, a Succubus and the Warrior round a brazier, each with the shadow painted into its picture in 1996, which stays put wherever the brazier goes'))}
    modes.forEach(function(b){b.addEventListener('click',function(){mode=b.dataset.mode;modes.forEach(function(x){x.setAttribute('aria-pressed',x===b)});label();render()})});
    var raf=0,last=0;
    function tick(t){raf=0;if(!playing||!seen)return;if(t-last>1000/FPS){last=t;tick0++;render()}raf=requestAnimationFrame(tick)}
    function loop(){if(ready&&playing&&seen&&!raf)raf=requestAnimationFrame(tick)}
    onScreen(w,function(v){seen=v;loop()});
    whenNear(w,function(){status.textContent=bdT('Loading the characters…');
      Promise.all(CAST.map(function(c){return Promise.all([loadClip(base,c.key),image(base+c.key+'_painted.png')]).then(function(a){c.clip=a[0];c.painted=a[1]})})).then(function(){
        cv=document.createElement('canvas');cv.setAttribute('role','img');cv.setAttribute('aria-label',poster.alt);cvBox.replaceChild(cv,poster);
        ready=true;size();label();render();status.textContent='';w.dataset.ready='1';loop();
        drag(cv,function(ev){var b=cv.getBoundingClientRect();setBrazier((ev.clientX-b.left)/b.width*WW,(ev.clientY-b.top)/b.height*HH+POST*Math.cos(rad(25))*.5)});
        var sz='';addEventListener('resize',function(){var k=cvBox.clientWidth+'/'+(window.devicePixelRatio||1);if(k===sz)return;sz=k;size();render()})}).catch(function(){status.textContent=bdT('The characters could not load. Try reloading the page.')})});
  })()}catch(e){}
})();
