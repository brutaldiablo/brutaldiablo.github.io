/* The carved-shadows post's small widgets, on top of devlog.js: the size cap on the game's captures, the
   turnable bodies and the slices. The casting widgets are in cast.js.
   Each widget is guarded on its own, so one that fails leaves the others working. */
/* Translated text: bdT/bdN come from the page's head; without it they return the English. */
window.bdT=window.bdT||function(s,v){return v?s.replace(/\{(\w+)\}/g,function(m,k){return v[k]!=null?v[k]:m}):s};window.bdN=window.bdN||function(n,a,b,v){var o={n:n};for(var k in v)o[k]=v[k];return window.bdT(n===1?a:b,o)};
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function onDpr(fn){var mq=matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)');
    var once=function(){if(mq.removeEventListener)mq.removeEventListener('change',once);else if(mq.removeListener)mq.removeListener(once);fn();onDpr(fn)};
    if(mq.addEventListener)mq.addEventListener('change',once);else if(mq.addListener)mq.addListener(once)}
  function whenNear(el,fn,margin){if(!('IntersectionObserver' in window)){fn();return}
    var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting})){io.disconnect();fn()}},{rootMargin:(margin||400)+'px 0px'});io.observe(el)}

  // The cap: a picture or a slider marked .cap2 is never drawn larger than twice its pixels in device pixels.
  try{(function(){
    function imgOf(el){return el.tagName==='IMG'?el:el.querySelector('img')}
    function cap(el){var w=+el.style.getPropertyValue('--w');var img=imgOf(el);if(img&&img.naturalWidth)w=img.naturalWidth;
      if(!w){var v=el.querySelector('video');if(v)w=+v.getAttribute('width')}
      if(w)el.style.maxWidth=(w*2/(window.devicePixelRatio||1))+'px'}
    function capAll(){document.querySelectorAll('.cap2').forEach(function(el){cap(el);var img=imgOf(el);
      if(img&&!img._capped){img._capped=true;img.addEventListener('load',function(){cap(el)})}})}
    capAll();try{onDpr(capAll)}catch(e){}
  })()}catch(e){}

  // The bodies and their shadows: a few monsters' carved bodies, one pose of each (data/bodies.json: per body its runs
  // as 4 bytes, x and z int8, y0 and y1 uint8, in the body's own frame, y up from the ground under its axis), on a floor
  // with a fire circling them. Only the voxels with an open side are drawn, each as a square splat into a depth buffer,
  // shaded by a normal taken from which of their neighbours are empty and lit from the fire. Every run throws its stripe
  // on the floor away from the fire; the stripes are rasterised into a floor grid, softened, and darken the fire's
  // light there. A few of the stripes are drawn on top in orange. The view is the game's: yaw psi round the body, the
  // camera theta above the floor (the game's 25 degrees at first). The fire circles on its own, coming nearer and going
  // further twice a turn; a drag across turns the view, a drag up and down tilts it. With reduced motion the fire stays
  // put until a drag across or the left and right keys move it round.
  try{(function(){
    var w=document.getElementById('bodies');if(!w)return;
    var base=w.closest('figure').dataset.base,box=w.querySelector('.cv'),poster=box.querySelector('img'),status=w.querySelector('.status');
    var chips=[].slice.call(w.querySelectorAll('.chip[data-body]')),data=null,cur=null,cv=null,g=null,W=0,H=0,dpr=1;
    var bc=null,bg=null,bimg=null,zb=null,fc=null,fg=null,fimg=null,FW=0,FH=0;
    var psi=20,theta=25,la=215,auto=!reduce,seen=false,raf=0,last=0,cache={};
    var BG=[29,23,19];
    function body(b){if(cache[b.key])return cache[b.key];
      var bin=atob(b.runs),u=new Uint8Array(bin.length),i,x,z,y;for(i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
      var R=[],x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,y1=0;
      for(i=0;i<u.length;i+=4){x=u[i]<128?u[i]:u[i]-256;z=u[i+1]<128?u[i+1]:u[i+1]-256;R.push(x,z,u[i+2],u[i+3]);
        if(x<x0)x0=x;if(x>x1)x1=x;if(z<z0)z0=z;if(z>z1)z1=z;if(u[i+3]>y1)y1=u[i+3]}
      var NX=x1-x0+5,NZ=z1-z0+5,NY=y1+5,occ=new Uint8Array(NX*NY*NZ),at=function(x,y,z){return ((x-x0+2)*NZ+(z-z0+2))*NY+(y+2)};
      for(i=0;i<R.length;i+=4)for(y=R[i+2];y<=R[i+3];y++)occ[at(R[i],y,R[i+1])]=1;
      var P=[],N=[],rh=0,dx,dy,dz;
      for(i=0;i<R.length;i+=4)for(y=R[i+2];y<=R[i+3];y++){x=R[i];z=R[i+1];
        if(occ[at(x+1,y,z)]&&occ[at(x-1,y,z)]&&occ[at(x,y+1,z)]&&occ[at(x,y-1,z)]&&occ[at(x,y,z+1)]&&occ[at(x,y,z-1)])continue;
        var nx=0,ny=0,nz=0;for(dx=-2;dx<=2;dx++)for(dy=-2;dy<=2;dy++)for(dz=-2;dz<=2;dz++)if(!occ[at(x+dx,y+dy,z+dz)]){nx+=dx;ny+=dy;nz+=dz}
        var l=Math.hypot(nx,ny,nz)||1,q=Math.hypot(x,z);P.push(x,y,z);N.push(nx/l,ny/l,nz/l);if(q>rh)rh=q}
      return cache[b.key]={P:new Float32Array(P),N:new Float32Array(N),R:new Int16Array(R),rh:rh+1,hy:y1+1}}
    function size(){dpr=window.devicePixelRatio||1;var cw=box.clientWidth||480;W=Math.round(cw*dpr);H=Math.round(cw*.8*dpr);
      cv.width=W;cv.height=H;bc.width=W;bc.height=H;bimg=bg.createImageData(W,H);zb=new Float32Array(W*H);
      FW=Math.max(160,Math.round(cw/2));FH=Math.round(FW*.8);fc.width=FW;fc.height=FH;fimg=fg.createImageData(FW,FH)}
    // the floor grid the stripes fall into, in body units; GC cells a unit
    var GC=1,GN=0,grid=null,tmp=null;
    function stamp(gx,gz){var i=gx|0,j=gz|0;if(i<1||j<1||i>=GN-1||j>=GN-1)return;var o=j*GN+i;grid[o]=1;grid[o+1]=1;grid[o+GN]=1;grid[o+GN+1]=1}
    function blur(r){for(var pass=0;pass<2;pass++){var a=grid,b=tmp,i,j,s,n=2*r+1;
      for(j=0;j<GN;j++){var o=j*GN;s=0;for(i=-r;i<=r;i++)s+=a[o+Math.max(0,Math.min(GN-1,i))];
        for(i=0;i<GN;i++){b[o+i]=s/n;s+=a[o+Math.min(GN-1,i+r+1)]-a[o+Math.max(0,i-r)]}}
      for(i=0;i<GN;i++){s=0;for(j=-r;j<=r;j++)s+=b[Math.max(0,Math.min(GN-1,j))*GN+i];
        for(j=0;j<GN;j++){a[j*GN+i]=s/n;s+=b[Math.min(GN-1,j+r+1)*GN+i]-b[Math.max(0,j-r)*GN+i]}}}}
    function render(){if(!cur||!cv)return;var B=cur,hy=B.hy,p=psi*Math.PI/180,t=theta*Math.PI/180,sp=Math.sin(p),cp=Math.cos(p),st=Math.sin(t),ct=Math.cos(t);
      var r=[cp,0,-sp],u=[-st*sp,ct,-st*cp],f=[-ct*sp,-st,-ct*cp];
      var S=Math.min(W/(2.7*hy),H*.44/hy,W/(5.2*B.rh)),cx=W/2,cy=H*.5+hy*S*ct*.44,k=Math.max(1,Math.ceil(S*1.05)),h=k>>1;
      // the fire: round the body at la, nearer and further twice a turn, above the body's head
      var a=la*Math.PI/180,D=hy*(1.05+.4*Math.sin(2*a)),Lx=D*Math.sin(a),Lz=D*Math.cos(a),Ly=hy*1.3;
      function sx(x,y,z){return cx+(x*r[0]+z*r[2])*S}function sy(x,y,z){return cy-(x*u[0]+y*u[1]+z*u[2])*S}
      // the stripes into the floor grid
      var Rf=W/(2*S)*1.05;GN=Math.ceil(2*Rf/GC)+4;if(!grid||grid.length!==GN*GN){grid=new Float32Array(GN*GN);tmp=new Float32Array(GN*GN)}else grid.fill(0);
      var R=B.R,G0=GN/2,i,j;
      for(i=0;i<R.length;i+=4){var x=R[i],z=R[i+1],ya=R[i+2]-.5,yb=Math.min(R[i+3]+.5,Ly-1);if(ya>=yb)continue;
        var ta=Ly/(Ly-ya),tb=Ly/(Ly-yb),qax=Lx+(x-Lx)*ta,qaz=Lz+(z-Lz)*ta,qbx=Lx+(x-Lx)*tb,qbz=Lz+(z-Lz)*tb;
        var len=Math.hypot(qbx-qax,qbz-qaz)/GC,n=Math.min(400,Math.ceil(len*2)+1);
        for(j=0;j<=n;j++){var s=j/n;stamp(G0+(qax+(qbx-qax)*s)/GC,G0+(qaz+(qbz-qaz)*s)/GC)}}
      blur(Math.max(1,Math.round(hy/45)));
      // the floor: flagstones lit by the fire, its light cut where the grid is dark, fading out at the edge
      var fd=fimg.data,T=hy/4,det=-st,fx=W/FW,fy=H/FH;
      for(j=0;j<FH;j++){var ay=(cy-(j+.5)*fy)/S;for(i=0;i<FW;i++){var ax=((i+.5)*fx-cx)/S;
        var X=(ax*u[2]-r[2]*ay)/det,Z=(r[0]*ay-u[0]*ax)/det,o=4*(j*FW+i),rr=Math.hypot(X,Z)/Rf;
        if(rr>=1){fd[o]=BG[0];fd[o+1]=BG[1];fd[o+2]=BG[2];fd[o+3]=255;continue}
        var gi=G0+X/GC,gj=G0+Z/GC,m=0;if(gi>=0&&gj>=0&&gi<GN-1&&gj<GN-1){var i0=gi|0,j0=gj|0,ex=gi-i0,ez=gj-j0,q=j0*GN+i0;
          m=1.8*((grid[q]*(1-ex)+grid[q+1]*ex)*(1-ez)+(grid[q+GN]*(1-ex)+grid[q+GN+1]*ex)*ez);if(m>1)m=1}
        m*=1-.45*Math.min(1,Math.hypot(X,Z)/(1.6*hy));
        var dx2=X-Lx,dz2=Z-Lz,c=Ly/Math.sqrt(dx2*dx2+dz2*dz2+Ly*Ly),L=.12+1.15*c*c*c*(1-.9*m);
        var tx=Math.floor(X/T),tz=Math.floor(Z/T),hsh=((tx*73856093)^(tz*19349663))>>>0,shade=.86+(hsh%1000)/1000*.2,ux=X/T-tx,uz=Z/T-tz;
        if(ux<.05||uz<.05)shade*=.72;var e=rr>.72?Math.max(0,(1-rr)/.28):1,v=L*shade;
        fd[o]=BG[0]+(Math.min(255,128*v+18*c)-BG[0])*e;fd[o+1]=BG[1]+(Math.min(255,110*v+8*c)-BG[1])*e;fd[o+2]=BG[2]+(Math.min(255,88*v)-BG[2])*e;fd[o+3]=255}}
      fg.putImageData(fimg,0,0);g.setTransform(1,0,0,1,0,0);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(fc,0,0,W,H);
      // a few of the stripes, in orange
      g.beginPath();var every=Math.max(4,Math.round(R.length/4/110))*4;
      for(i=0;i<R.length;i+=every){var x3=R[i],z3=R[i+1],y3a=R[i+2]-.5,y3b=Math.min(R[i+3]+.5,Ly-1);if(y3a>=y3b)continue;
        var t3a=Ly/(Ly-y3a),t3b=Ly/(Ly-y3b),pax=Lx+(x3-Lx)*t3a,paz=Lz+(z3-Lz)*t3a,pbx=Lx+(x3-Lx)*t3b,pbz=Lz+(z3-Lz)*t3b;
        if(Math.hypot(pbx,pbz)>Rf*.8)continue;g.moveTo(sx(pax,0,paz),sy(pax,0,paz));g.lineTo(sx(pbx,0,pbz),sy(pbx,0,pbz))}
      g.lineWidth=Math.max(1,.4*dpr);g.lineCap='round';g.strokeStyle='rgba(240,160,80,.42)';g.stroke();
      // the fire on its post
      var lamp=function(){var bx=sx(Lx,0,Lz),by=sy(Lx,0,Lz),tx2=sx(Lx,Ly,Lz),ty2=sy(Lx,Ly,Lz),rg=Math.max(10,hy*S*.16);
        g.strokeStyle='rgba(232,220,196,.45)';g.lineWidth=Math.max(1,.8*dpr);g.beginPath();g.moveTo(bx,by);g.lineTo(tx2,ty2);g.stroke();
        var gl=g.createRadialGradient(tx2,ty2,0,tx2,ty2,rg);gl.addColorStop(0,'rgba(255,220,150,1)');gl.addColorStop(.22,'rgba(255,170,70,.6)');gl.addColorStop(1,'rgba(255,170,70,0)');
        g.fillStyle=gl;g.beginPath();g.arc(tx2,ty2,rg,0,7);g.fill()};
      var behind=(Lx*f[0]+Ly*f[1]+Lz*f[2])>(hy*.5*f[1]);
      if(behind)lamp();
      // the body, lit from the fire
      var d=new Uint32Array(bimg.data.buffer);d.fill(0);zb.fill(1e9);
      var Lv=[Lx,Ly-hy*.5,Lz],ll=Math.hypot(Lv[0],Lv[1],Lv[2]);Lv=[Lv[0]/ll,Lv[1]/ll,Lv[2]/ll];
      var P=B.P,N=B.N,np=P.length/3;
      for(i=0;i<np;i++){var x4=P[3*i],y4=P[3*i+1],z4=P[3*i+2];
        var px=Math.round(cx+(x4*r[0]+z4*r[2])*S)-h,py=Math.round(cy-(x4*u[0]+y4*u[1]+z4*u[2])*S)-h,dep=x4*f[0]+y4*f[1]+z4*f[2];
        var nl=N[3*i]*Lv[0]+N[3*i+1]*Lv[1]+N[3*i+2]*Lv[2],fl=-(N[3*i]*r[0]+N[3*i+2]*r[2])*.5+N[3*i+1]*.2,sh=Math.max(0,nl);sh=sh*sh*.35+sh*.75+Math.max(0,fl)*.16;
        if(sh>1.1)sh=1.1;var Rc=Math.min(255,46+200*sh)|0,Gc=Math.min(255,34+150*sh)|0,Bc=Math.min(255,26+96*sh)|0,col=0xff000000|(Bc<<16)|(Gc<<8)|Rc;
        for(var yy=py;yy<py+k;yy++){if(yy<0||yy>=H)continue;var o2=yy*W;for(var xx=px;xx<px+k;xx++){if(xx<0||xx>=W)continue;if(dep<zb[o2+xx]){zb[o2+xx]=dep;d[o2+xx]=col}}}}
      bg.putImageData(bimg,0,0);g.drawImage(bc,0,0);
      if(!behind)lamp();
    }
    function pick(key){var b=data.bodies.filter(function(x){return x.key===key})[0];if(!b)return;cur=body(b);var name=key;
      chips.forEach(function(c){c.setAttribute('aria-pressed',c.dataset.body===key);if(c.dataset.body===key)name=c.textContent});
      if(cv)cv.setAttribute('aria-label',bdT('The carved body of {m} on a stone floor, a fire circling it and casting its shadow',{m:name}));render()}
    // a pick made while the bodies load is kept: the load picks whichever chip is pressed
    chips.forEach(function(c){c.addEventListener('click',function(){if(data)pick(c.dataset.body);else chips.forEach(function(x){x.setAttribute('aria-pressed',x===c)})})});
    function tick(t){raf=0;if(!auto||!seen)return;if(t-last>33){var dt=last?Math.min(100,t-last):33;last=t;la=(la+dt*.045)%360;render()}raf=requestAnimationFrame(tick)}
    function loop(){if(cur&&auto&&seen&&!raf){last=0;raf=requestAnimationFrame(tick)}}
    if('IntersectionObserver' in window)new IntersectionObserver(function(es){es.forEach(function(e){seen=e.isIntersecting});loop()},{threshold:.05}).observe(w);else seen=true;
    var x0=null,y0=null,p0=0,t0=0,l0=0;
    box.addEventListener('pointerdown',function(e){if(!cv)return;x0=e.clientX;y0=e.clientY;p0=psi;t0=theta;l0=la;try{box.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()});
    var dirty=0;function later(){if(!dirty)dirty=requestAnimationFrame(function(){dirty=0;render()})}
    box.addEventListener('pointermove',function(e){if(x0==null)return;var b=box.getBoundingClientRect(),dx=(e.clientX-x0)/b.width*360;
      if(reduce)la=((l0+dx)%360+360)%360;else psi=p0-dx;theta=Math.max(10,Math.min(80,t0+(e.clientY-y0)/b.height*120));later()});
    box.addEventListener('pointerup',function(){x0=null});box.addEventListener('pointercancel',function(){x0=null});
    box.addEventListener('keydown',function(e){var k=e.key;if(reduce&&k==='ArrowLeft')la=(la+350)%360;else if(reduce&&k==='ArrowRight')la=(la+10)%360;else if(k==='ArrowLeft')psi+=10;else if(k==='ArrowRight')psi-=10;else if(k==='ArrowUp')theta=Math.min(80,theta+5);else if(k==='ArrowDown')theta=Math.max(10,theta-5);else return;
      render();e.preventDefault()});
    var sz='';window.addEventListener('resize',function(){if(!cv)return;var k=box.clientWidth+'/'+(window.devicePixelRatio||1);if(k===sz)return;sz=k;size();render()});
    whenNear(w,function(){if(status)status.textContent=bdT('Loading the bodies…');
      fetch(base+'bodies.json').then(function(x){if(!x.ok)throw 0;return x.json()}).then(function(j){data=j;
        cv=document.createElement('canvas');cv.setAttribute('role','img');cv.setAttribute('aria-label',poster.alt);box.replaceChild(cv,poster);g=cv.getContext('2d');
        bc=document.createElement('canvas');bg=bc.getContext('2d');fc=document.createElement('canvas');fg=fc.getContext('2d');
        size();var on=chips.filter(function(c){return c.getAttribute('aria-pressed')==='true'})[0];pick(on?on.dataset.body:'knight');
        if(status)status.textContent='';w.dataset.ready='1';loop()}).catch(function(){if(status)status.textContent=bdT('The bodies could not load. Try reloading the page.')})},300);
  })()}catch(e){}

  // The slices: the knight's carved body (the attack's frame 4) as the columns it is stored as. Each column stands on
  // one floor cell (x, z) and keeps where it starts and stops (y0, y1), several runs where the body has gaps. The game's
  // camera looks along x - z, so a slice is the cells with z - x = k (k grows towards the camera). The body is drawn in
  // 3D, cut at the slider's slice: what lies in front of the cut is lifted away (a faint ghost of it stays), and the
  // cut face shows the slice's columns in orange, every other column a shade darker. Voxels are square splats into a
  // depth buffer, shaded by a normal from which of their neighbours are empty, as in the bodies above.
  try{(function(){
    var w=document.getElementById('slices');if(!w)return;
    var base=w.closest('figure').dataset.base,r=w.querySelector('input[type=range]'),note=w.querySelector('.h'),auto=!reduce,seen=false;
    var box=w.querySelector('.stage .cv'),cv=null,g=null,img=null,zb=null,W=0,H=0,timer=0,D=null;
    var PSI=-12,THETA=24;
    function prep(R){var x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,y1=0,i,x,z,y;
      for(i=0;i<R.length;i+=4){x=R[i];z=R[i+1];if(x<x0)x0=x;if(x>x1)x1=x;if(z<z0)z0=z;if(z>z1)z1=z;if(R[i+3]>y1)y1=R[i+3]}
      var NX=x1-x0+5,NZ=z1-z0+5,NY=y1+5,occ=new Uint8Array(NX*NY*NZ),at=function(x,y,z){return ((x-x0+2)*NZ+(z-z0+2))*NY+(y+2)};
      for(i=0;i<R.length;i+=4)for(y=R[i+2];y<=R[i+3];y++)occ[at(R[i],y,R[i+1])]=1;
      // every voxel: position, its slice k, whether it has an open side, its normal
      var P=[],K=[],O=[],N=[],per={},k0=1e9,k1=-1e9,rh=0,dx,dy,dz;
      for(i=0;i<R.length;i+=4)for(y=R[i+2];y<=R[i+3];y++){x=R[i];z=R[i+1];var k=z-x;
        var open=!(occ[at(x+1,y,z)]&&occ[at(x-1,y,z)]&&occ[at(x,y+1,z)]&&occ[at(x,y-1,z)]&&occ[at(x,y,z+1)]&&occ[at(x,y,z-1)]);
        var nx=0,ny=0,nz=0;if(open){for(dx=-2;dx<=2;dx++)for(dy=-2;dy<=2;dy++)for(dz=-2;dz<=2;dz++)if(!occ[at(x+dx,y+dy,z+dz)]){nx+=dx;ny+=dy;nz+=dz}}
        var l=Math.hypot(nx,ny,nz)||1;P.push(x,y,z);K.push(k);O.push(open?1:0);N.push(nx/l,ny/l,nz/l);
        if(k<k0)k0=k;if(k>k1)k1=k;var q=Math.hypot(x,z);if(q>rh)rh=q}
      var cols={};for(i=0;i<R.length;i+=4){var kk=R[i+1]-R[i],key=kk+','+(R[i]+R[i+1]);if(!cols[key]){cols[key]=1;per[kk]=(per[kk]||0)+1}}
      var best=k0;for(var kb in per)if(per[kb]>(per[best]||0))best=+kb;
      // the slider runs over the slices that hold some of him (a lone sword tip at either end left out)
      var a0=1e9,a1=-1e9;for(var ka in per)if(per[ka]>=3){if(+ka<a0)a0=+ka;if(+ka>a1)a1=+ka}if(a0<=a1){k0=a0;k1=a1}
      // the view's bounds, for the fixed camera
      var p=PSI*Math.PI/180,t=THETA*Math.PI/180,sp=Math.sin(p),cp=Math.cos(p),st=Math.sin(t),ct=Math.cos(t),bx0=1e9,bx1=-1e9,by0=1e9,by1=-1e9;
      for(i=0;i<P.length;i+=3){var X=P[i]*cp-P[i+2]*sp,Y=-P[i]*st*sp+P[i+1]*ct-P[i+2]*st*cp;if(X<bx0)bx0=X;if(X>bx1)bx1=X;if(Y<by0)by0=Y;if(Y>by1)by1=Y}
      return {P:new Float32Array(P),K:new Int16Array(K),O:new Uint8Array(O),N:new Float32Array(N),per:per,k0:k0,k1:k1,best:best,bb:[bx0-1,bx1+1,by0-1,by1+1]}}
    function size(){var dpr=window.devicePixelRatio||1,cw=box.clientWidth||480;W=Math.round(cw*dpr);H=Math.round(cw*.8*dpr);
      cv.width=W;cv.height=H;img=g.createImageData(W,H);zb=new Float32Array(W*H)}
    function draw(){if(!D||!cv)return;var Kc=+r.value,p=PSI*Math.PI/180,t=THETA*Math.PI/180,sp=Math.sin(p),cp=Math.cos(p),st=Math.sin(t),ct=Math.cos(t);
      var rr=[cp,0,-sp],u=[-st*sp,ct,-st*cp],f=[-ct*sp,-st,-ct*cp];
      var B=D.bb,S=Math.min(W*.92/(B[1]-B[0]),H*.92/(B[3]-B[2])),cx=W/2-(B[0]+B[1])/2*S,cy=H/2+(B[2]+B[3])/2*S,k=Math.max(1,Math.ceil(S*1.05)),h=k>>1;
      var L=[-.5,.75,.45],ll=Math.hypot(L[0],L[1],L[2]);L=[L[0]/ll,L[1]/ll,L[2]/ll];
      var d=new Uint32Array(img.data.buffer);d.fill(0xff13171d);zb.fill(1e9);
      var P=D.P,KK=D.K,O=D.O,N=D.N,n=KK.length,i,front=[];
      for(i=0;i<n;i++){var kv=KK[i];if(kv>Kc){if(O[i])front.push(i);continue}if(kv<Kc&&!O[i])continue;
        var x=P[3*i],y=P[3*i+1],z=P[3*i+2],col;
        if(kv===Kc){var band=((x+z)>>1)&1;col=band?0xff2f7fd9:0xff3a96ee}   // the cut face: the slice's columns, every other a shade darker
        else{var nl=N[3*i]*L[0]+N[3*i+1]*L[1]+N[3*i+2]*L[2],sh=Math.max(0,nl);sh=sh*.8+.12;
          var R2=Math.min(255,40+120*sh)|0,G2=Math.min(255,33+100*sh)|0,B2=Math.min(255,28+80*sh)|0;col=0xff000000|(B2<<16)|(G2<<8)|R2}
        var sx=Math.round(cx+(x*rr[0]+z*rr[2])*S)-h,sy=Math.round(cy-(x*u[0]+y*u[1]+z*u[2])*S)-h,dep=x*f[0]+y*f[1]+z*f[2];
        for(var yy=sy;yy<sy+k;yy++){if(yy<0||yy>=H)continue;var o=yy*W;for(var xx=sx;xx<sx+k;xx++){if(xx<0||xx>=W)continue;if(dep<zb[o+xx]){zb[o+xx]=dep;d[o+xx]=col}}}}
      // a faint ghost of what was lifted away
      var px8=img.data,ghost=new Uint8Array(W*H);
      for(var j=0;j<front.length;j++){i=front[j];var gx=Math.round(cx+(P[3*i]*rr[0]+P[3*i+2]*rr[2])*S)-h,gy=Math.round(cy-(P[3*i]*u[0]+P[3*i+1]*u[1]+P[3*i+2]*u[2])*S)-h;
        for(var y2=gy;y2<gy+k;y2++){if(y2<0||y2>=H)continue;for(var x2=gx;x2<gx+k;x2++){if(x2<0||x2>=W)continue;ghost[y2*W+x2]=1}}}
      for(i=0;i<W*H;i++)if(ghost[i]){var q=4*i;px8[q]+=(150-px8[q])*.13;px8[q+1]+=(132-px8[q+1])*.13;px8[q+2]+=(112-px8[q+2])*.13}
      g.putImageData(img,0,0);
      var nc=D.per[Kc]||0,pos=(Kc-D.k0)/(D.k1-D.k0);
      note.textContent=nc?bdN(nc,'This slice: {n} column, stored as where the body starts and stops.','This slice: {n} columns, each stored as where the body starts and stops.'):bdT('Nothing of him in this slice.');
      r.setAttribute('aria-valuetext',bdT('{p} percent of the way from his back to his front',{p:Math.round(pos*100)}))}
    // until the reader takes the slider, the slice sweeps from his back to his front and starts again
    // the note is read out only once the reader moves the slider, not while it sweeps
    note.setAttribute('aria-live','off');
    r.addEventListener('input',function(){auto=false;note.setAttribute('aria-live','polite');draw()});r.addEventListener('pointerdown',function(){auto=false});
    function sweep(){if(!auto||!D)return;if(seen){var v=+r.value+1;r.value=v>D.k1?D.k0:v;draw()}timer=setTimeout(sweep,110)}
    if('IntersectionObserver' in window)new IntersectionObserver(function(es){es.forEach(function(e){seen=e.isIntersecting})},{threshold:.05}).observe(w);else seen=true;
    var sz='';window.addEventListener('resize',function(){if(!cv)return;var k=box.clientWidth+'/'+(window.devicePixelRatio||1);if(k===sz)return;sz=k;size();draw()});
    whenNear(w,function(){fetch(base+'knight_attack.json').then(function(x){if(!x.ok)throw 0;return x.json()}).then(function(j){
      var bin=atob(j.runs[4]),u8=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
      D=prep(new Int16Array(u8.buffer));r.min=D.k0;r.max=D.k1;r.value=D.best;
      var poster=box.querySelector('img');cv=document.createElement('canvas');cv.setAttribute('role','img');cv.setAttribute('aria-label',poster.alt);
      box.replaceChild(cv,poster);g=cv.getContext('2d');size();
      draw();w.dataset.ready='1';sweep()}).catch(function(){note.textContent=bdT('The slices could not load. Try reloading the page.')})},300);
  })()}catch(e){}
})();
