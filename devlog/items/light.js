/* Try it: one item lit live from its own depth and materials, with the arithmetic of the shipped pass
   (Brutal Diablo's material and depth step): a diffuse term relative to a flat face, eased where it brightens and
   floored where it darkens, the grooves darkened, one highlight per material tinted toward the surface's own colour,
   the whole picture held to 96% of the unlit picture's brightness, then, if asked, each pixel snapped to the run of
   shades the shipped pixel was locked to. The item is drawn with one picture pixel at most two device pixels.
   The light starts at the shipped light, the upper right at the shipped strength; the reset puts it back there. */
/* Translated text: bdT/bdN come from the page's head; without it they return the English. */
window.bdT=window.bdT||function(s,v){return v?s.replace(/\{(\w+)\}/g,function(m,k){return v[k]!=null?v[k]:m}):s};window.bdN=window.bdN||function(n,a,b,v){var o={n:n};for(var k in v)o[k]=v[k];return window.bdT(n===1?a:b,o)};
(function(){
  var root=document.getElementById('light'),D=window.LIGHT_DATA;
  if(!root||!D)return;
  var cv=root.querySelector('canvas'),ctx=cv.getContext('2d'),strength=root.querySelector('input[type=range]'),
      sval=root.querySelector('.sval'),lockB=root.querySelector('[data-act=lock]'),resetB=root.querySelector('[data-act=reset]'),
      msg=root.querySelector('.lmsg'),hdl=root.querySelector('.lhandle'),CHECK=/[?&]check(&|$)/.test(location.search);
  var W=D.w,H=D.h,CW=D.slots[0]*D.cell,CH=D.slots[1]*D.cell,M=110,Y0=4*D.slots[1];
  cv.width=CW+2*M;cv.height=CH+2*M;
  // HOME: the shipped light, where the widget starts and the reset returns
  var HOME=[0.55,0.55],hx=HOME[0],hy=HOME[1],lock=true,K=(Math.max(CW,CH)/2+M*0.5)/(0.55*Math.SQRT2);   // light handle: centre + h*K px; at either it sits just off the cells' corner
  var cx=M+CW/2,cy=M+CH/2;
  var N=W*H,base,nx,ny,nz,cav,ks,pp,tint,ramp,alpha,ready=0,slotsImg=new Image(),out=ctx.createImageData(W,H),item=document.createElement('canvas');
  item.width=W;item.height=H;var ictx=item.getContext('2d');
  // the ramps in CIELAB (D65, sRGB), as the lock compares colours
  function lin(c){return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)}
  function f3(t){return t>0.008856?Math.cbrt(t):7.787*t+16/116}
  function lab(r,g,b,o,i){r=lin(r);g=lin(g);b=lin(b);
    var X=(0.412453*r+0.357580*g+0.180423*b)/0.950456,Y=0.212671*r+0.715160*g+0.072169*b,Z=(0.019334*r+0.119193*g+0.950227*b)/1.088754;
    var fx=f3(X),fy=f3(Y),fz=f3(Z);o[i]=116*fy-16;o[i+1]=500*(fx-fy);o[i+2]=200*(fy-fz)}
  var RL=D.ramps.map(function(r){var a=new Float32Array(r.length*3);r.forEach(function(c,k){lab(c[0]/255,c[1]/255,c[2]/255,a,k*3)});return a});
  function read(src,cb){var im=new Image();im.onload=function(){var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');x.drawImage(im,0,0);cb(x.getImageData(0,0,W,H).data);};im.src=src}
  // every data picture is opaque RGB, so the browser hands its bytes back untouched
  read(D.base,function(d){base=new Float32Array(N*3);for(var i=0;i<N;i++){base[i*3]=d[i*4]/255;base[i*3+1]=d[i*4+1]/255;base[i*3+2]=d[i*4+2]/255}go()});
  read(D.nrm,function(d){nx=new Float32Array(N);ny=new Float32Array(N);nz=new Float32Array(N);
    for(var i=0;i<N;i++){nx[i]=d[i*4]/127.5-1;ny[i]=d[i*4+1]/127.5-1;nz[i]=d[i*4+2]/127.5-1}go()});
  read(D.mat,function(d){ks=new Float32Array(N);pp=new Float32Array(N);tint=new Float32Array(N);
    for(var i=0;i<N;i++){ks[i]=d[i*4]/255;pp[i]=d[i*4+1];tint[i]=d[i*4+2]/255}go()});
  read(D.aux,function(d){cav=new Float32Array(N);ramp=new Uint8Array(N);alpha=new Uint8Array(N);
    for(var i=0;i<N;i++){cav[i]=d[i*4]/255;ramp[i]=d[i*4+1];alpha[i]=d[i*4+2]}go()});
  slotsImg.onload=go;slotsImg.src=D.slotsimg;
  function go(){if(++ready===5){shade();draw();root.classList.add('ready')}}

  var lit=new Float32Array(0),px=new Float32Array(3);
  function shade(){
    var s=+strength.value,L=[hx,hy,0.63],n=Math.hypot(L[0],L[1],L[2]);L=[L[0]/n,L[1]/n,L[2]/n];
    var Hv=[L[0],L[1],L[2]+1],hn=Math.hypot(Hv[0],Hv[1],Hv[2]);Hv=[Hv[0]/hn,Hv[1]/hn,Hv[2]/hn];
    var cap=0.2*s,floor=1-0.3*s,m0=0,m1=0,cnt=0;
    if(lit.length!==N*3)lit=new Float32Array(N*3);
    for(var i=0;i<N;i++){if(alpha[i]!==255)continue;
      var r=base[i*3],g=base[i*3+1],b=base[i*3+2];
      var rel=Math.max(nx[i]*L[0]+ny[i]*L[1]+nz[i]*L[2],0)/L[2],f=1+s*(rel-1);
      if(f>1&&cap>0)f=1+cap*Math.tanh((f-1)/cap);
      var gg=Math.max(f*(1-s*0.3*cav[i]),floor);
      var nh=Math.max(nx[i]*Hv[0]+ny[i]*Hv[1]+nz[i]*Hv[2],0),p=pp[i];
      var sp=Math.max(Math.pow(nh,p)-Math.pow(Hv[2],p),0)*ks[i]*s*0.6,t=tint[i];
      var R=r*gg+sp*((1-t)+t*Math.min(r*1.6,1)),G=g*gg+sp*((1-t)+t*Math.min(g*1.6,1)),B=b*gg+sp*((1-t)+t*Math.min(b*1.6,1));
      lit[i*3]=R;lit[i*3+1]=G;lit[i*3+2]=B;
      m0+=0.299*r+0.587*g+0.114*b;m1+=0.299*Math.min(Math.max(R,0),1)+0.587*Math.min(Math.max(G,0),1)+0.114*Math.min(Math.max(B,0),1);cnt++}
    var k=(1-0.1*s)*m0/Math.max(m1,1e-6),o=out.data;
    for(i=0;i<N;i++){var a=alpha[i],j=i*4;
      if(a===0){o[j+3]=0;continue}
      if(a===128){o[j]=D.black[0];o[j+1]=D.black[1];o[j+2]=D.black[2];o[j+3]=255;continue}
      var R2=Math.min(Math.max(lit[i*3]*k,0),1),G2=Math.min(Math.max(lit[i*3+1]*k,0),1),B2=Math.min(Math.max(lit[i*3+2]*k,0),1);
      var rr=ramp[i];
      if(lock&&rr!==255){lab(R2,G2,B2,px,0);var cols=D.ramps[rr],la=RL[rr],best=1e9,bi=0;
        for(var c=0;c<cols.length;c++){var dl=px[0]-la[c*3],da=px[1]-la[c*3+1],db=px[2]-la[c*3+2],dd=dl*dl+da*da+db*db;if(dd<best){best=dd;bi=c}}
        o[j]=cols[bi][0];o[j+1]=cols[bi][1];o[j+2]=cols[bi][2]}
      else{o[j]=Math.round(R2*255);o[j+1]=Math.round(G2*255);o[j+2]=Math.round(B2*255)}
      o[j+3]=255}
    ictx.putImageData(out,0,0)}

  function draw(){
    ctx.fillStyle='#0c0908';ctx.fillRect(0,0,cv.width,cv.height);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(slotsImg,M,M);ctx.drawImage(item,M,M+Y0);
    // the light: a line from the item's middle and a small sun where it comes from
    var lx=cx+hx*K,ly=cy-hy*K;
    ctx.strokeStyle='rgba(229,139,58,.55)';ctx.lineWidth=2;ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(lx,ly);ctx.stroke();ctx.setLineDash([]);
    var hr=Math.hypot(HOME[0],HOME[1])*K;ctx.strokeStyle='rgba(232,220,196,.12)';ctx.beginPath();ctx.arc(cx,cy,hr,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#e58b3a';ctx.beginPath();ctx.arc(lx,ly,13,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#e58b3a';ctx.lineWidth=3;for(var a=0;a<8;a++){var an=a*Math.PI/4;ctx.beginPath();ctx.moveTo(lx+Math.cos(an)*18,ly+Math.sin(an)*18);ctx.lineTo(lx+Math.cos(an)*25,ly+Math.sin(an)*25);ctx.stroke()}
    var deg=Math.round(Math.atan2(hx,hy)*180/Math.PI),side=Math.abs(deg)<8?bdT('straight up'):Math.abs(deg)>172?bdT('straight down'):deg>0?bdT('{deg}° right of up',{deg:Math.abs(deg)}):bdT('{deg}° left of up',{deg:Math.abs(deg)});
    var home=Math.abs(hx-HOME[0])<1e-6&&Math.abs(hy-HOME[1])<1e-6;
    msg.textContent=(home?bdT('Light: {side}, as shipped.',{side:side}):bdT('Light: {side}.',{side:side}))+' '+(lock?bdT('Snapped to the game’s colours.'):bdT('Free colours, not snapped to the game’s.'));
    sval.textContent=(+strength.value).toFixed(2)+(Math.abs(strength.value-D.strength)<1e-6?' ('+bdT('shipped')+')':'');
    cv.setAttribute('aria-valuenow',deg);cv.setAttribute('aria-valuetext',home?bdT('{side}, as shipped',{side:side}):side);
    fit()}
  var pend=false;function update(){if(pend||ready<5)return;pend=true;requestAnimationFrame(function(){pend=false;shade();draw()})}
  function setH(x,y){var ax=(cx-24)/K,ay=(cy-24)/K;hx=Math.max(-ax,Math.min(ax,x));hy=Math.max(-ay,Math.min(ay,y));update()}   // the sun stays on the canvas
  // the size: one picture pixel at most two device pixels, smaller only when the column is narrower
  function fit(){var dpr=window.devicePixelRatio||1,avail=root.clientWidth-2;var w=Math.min(cv.width*2/dpr,avail);cv.style.width=w+'px';
    // the touch handle sits over the sun
    var sc=w/cv.width,st=hdl.parentNode,hr=24;   // kept inside the stage, so it never widens the page
    hdl.style.left=Math.min(Math.max(cv.offsetLeft+1+(cx+hx*K)*sc,hr),st.clientWidth-hr)+'px';hdl.style.top=(cv.offsetTop+1+(cy-hy*K)*sc)+'px';
    if(CHECK)window.__lightScale={devicePxPerItemPx:+(w/cv.width*dpr).toFixed(4),cssWidth:w,dpr:dpr}}
  // again when the pixel ratio changes without a resize (a window moved to another screen)
  function onDpr(fn){var mq=matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)');
    mq.addEventListener('change',function(){fn();onDpr(fn)},{once:true})}
  addEventListener('resize',fit);onDpr(fit);
  function fromE(e){var b=cv.getBoundingClientRect(),sx=cv.width/b.width;setH(((e.clientX-b.left)*sx-cx)/K,-((e.clientY-b.top)*sx-cy)/K)}
  // a mouse or pen drags anywhere on the canvas; a finger drags the sun's handle, and elsewhere scrolls the page
  var drag=false;
  function grab(el,e){drag=true;try{el.setPointerCapture(e.pointerId)}catch(_){}fromE(e);e.preventDefault()}
  cv.addEventListener('pointerdown',function(e){if(e.pointerType!=='touch')grab(cv,e)});
  hdl.addEventListener('pointerdown',function(e){grab(hdl,e)});
  [cv,hdl].forEach(function(el){el.addEventListener('pointermove',function(e){if(drag)fromE(e)});
    el.addEventListener('pointerup',function(){drag=false});el.addEventListener('pointercancel',function(){drag=false})});
  cv.addEventListener('keydown',function(e){var d=0.08,m={ArrowLeft:[-d,0],ArrowRight:[d,0],ArrowUp:[0,d],ArrowDown:[0,-d]}[e.key];
    if(m){setH(hx+m[0],hy+m[1]);e.preventDefault()}else if(e.key==='Home'){reset();e.preventDefault()}});
  strength.addEventListener('input',update);
  lockB.addEventListener('click',function(){lock=!lock;lockB.setAttribute('aria-pressed',lock);update()});
  function reset(){hx=HOME[0];hy=HOME[1];strength.value=D.strength;lock=true;lockB.setAttribute('aria-pressed',true);update()}
  resetB.addEventListener('click',reset);
  if(CHECK)window.__light={set:function(x,y){setH(x,y)},reset:reset,state:function(){return {hx:hx,hy:hy,lock:lock,s:+strength.value,ready:ready}},
    itemPixels:function(){return item.toDataURL('image/png')}};
})();
