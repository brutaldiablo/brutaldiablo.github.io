/* The cut pictures. A figure.cutpair holds, in its .pair, two pictures of the same size: the cut (img.cut, or a
   stepper's .stack of them: the frame with the pixels we cut in magenta) and the frame as drawn (img.drawn, the painted
   shadow black). A click, a tap, Enter or Space swaps them; aria-pressed says the magenta is hidden. A small hint
   ("Tap to hide the magenta"; "Tap to take the painted shadow off" on a figure with data-swap="painted") shows on each picture until the reader has used one, then never again on this browser.
   The pair is a button, which hides its pictures from screen readers, so a hidden line beside it (aria-describedby)
   holds the alt text of the picture showing, kept up to date on a swap and by the stepper (p.bdDescribe).
   Without the script the cut picture shows and nothing reacts. */
/* Translated text: bdT comes from the page's head; without it it returns the English. */
window.bdT=window.bdT||function(s,v){return v?s.replace(/\{(\w+)\}/g,function(m,k){return v[k]!=null?v[k]:m}):s};
(function(){try{
  var KEY='bd-cutpair-used',used=false;
  try{used=localStorage.getItem(KEY)==='1'}catch(e){}
  var touch=matchMedia('(hover: none)').matches;
  var pairs=[].slice.call(document.querySelectorAll('.cutpair .pair'));
  function hintsGone(){pairs.forEach(function(p){var h=p.querySelector('.hint');if(h)h.classList.add('gone')})}
  var n=0;
  function shown(p){if(p.classList.contains('is-drawn'))return p.querySelector('img.drawn');
    return p.querySelector('.stack img.on')||p.querySelector('img.cut')}
  pairs.forEach(function(p){
    var d=document.createElement('span');d.className='vh';d.id='bd-pic-'+(++n);p.parentNode.insertBefore(d,p.nextSibling);
    p.bdDescribe=function(){var im=shown(p);d.textContent=im?im.alt:''};
    p.setAttribute('aria-describedby',d.id);p.bdDescribe();
    p.setAttribute('role','button');p.tabIndex=0;p.setAttribute('aria-pressed','false');
    // a figure with data-swap="painted" is not the magenta's: its pair takes the painted shadow off
    var painted=(p.closest('figure')||p).getAttribute('data-swap')==='painted';
    p.setAttribute('aria-label',painted?bdT('Take the painted shadow off'):bdT('Hide the magenta'));
    if(!used){var h=document.createElement('span');h.className='hint';h.setAttribute('aria-hidden','true');
      h.textContent=touch?(painted?bdT('Tap to take the painted shadow off'):bdT('Tap to hide the magenta'))
        :(painted?bdT('Click to take the painted shadow off'):bdT('Click to hide the magenta'));p.appendChild(h)}
    function swap(){var on=p.getAttribute('aria-pressed')!=='true';p.setAttribute('aria-pressed',on);p.classList.toggle('is-drawn',on);p.bdDescribe();
      if(!used){used=true;try{localStorage.setItem(KEY,'1')}catch(e){}hintsGone()}}
    p.addEventListener('click',swap);
    p.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '||e.key==='Spacebar'){e.preventDefault();swap()}});
  });
}catch(e){}})();

/* The painted-shadows post's widgets, on top of devlog.js and the cut pictures' toggle (toggle.js, before this in the
   post's shadows.js): the step-by-step stepper with its counter, and the projection toy. */
/* Translated text: bdT comes from the page's head, or the English fallback the toggle defines. Each widget is guarded on
   its own, so one that fails leaves the others working. */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The stepper. data-labels and data-captions (the names the site's translation tool reads), data-cuts and data-lefts:
  // one per picture of the stack, in order; a range and one button per step move through them. The picture's toggle
  // shows the frame as drawn; a step shows the cut again, so the change is seen.
  try{document.querySelectorAll('.stepper[data-labels]').forEach(function(w){
    var L=JSON.parse(w.dataset.labels),C=JSON.parse(w.dataset.captions),X=JSON.parse(w.dataset.cuts),Y=JSON.parse(w.dataset.lefts);
    var steps=L.map(function(l,k){return {label:l,caption:C[k],cut:X[k],left:Y[k]}}),cur=0,pair=w.querySelector('.pair');
    var imgs=[].slice.call(w.querySelectorAll('.stack img')),r=w.querySelector('input[type=range]');
    var chips=[].slice.call(w.querySelectorAll('.chip[data-i]'));
    var num=w.querySelector('.num'),lab=w.querySelector('.label'),cap=w.querySelector('.cap');
    var cCut=w.querySelector('.c-cut'),cLeft=w.querySelector('.c-left'),say=w.querySelector('.say'),sayT=0;
    // the other pictures load once the stepper comes near the screen
    var go=function(){imgs.forEach(function(im){im.loading='eager'})};
    if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting})){go();io.disconnect()}},{rootMargin:'600px 0px'});io.observe(w)}else go();
    function set(i){
      cur=Math.max(0,Math.min(steps.length-1,i));var s=steps[cur],want=imgs[cur];
      var swap=function(){if(imgs[cur]!==want)return;imgs.forEach(function(im){var on=im===want;im.classList.toggle('on',on);
        if(on)im.removeAttribute('aria-hidden');else im.setAttribute('aria-hidden','true')});if(pair&&pair.bdDescribe)pair.bdDescribe()};
      // a picture that fails to load still takes its turn, so the caption and counter never describe another one
      if(want.complete&&want.naturalWidth)swap();else{want.loading='eager';want.addEventListener('load',swap,{once:true});want.addEventListener('error',swap,{once:true})}
      if(pair&&pair.classList.contains('is-drawn')){pair.classList.remove('is-drawn');pair.setAttribute('aria-pressed','false');if(pair.bdDescribe)pair.bdDescribe()}
      r.value=cur;r.setAttribute('aria-valuetext',s.label);
      chips.forEach(function(b,k){b.setAttribute('aria-pressed',k===cur)});
      num.textContent=cur;lab.textContent=s.label;cap.textContent=s.caption;
      cCut.querySelector('b').textContent=s.cut;cLeft.querySelector('b').textContent=s.left;
      cCut.classList.toggle('zero',s.cut===0);cLeft.classList.toggle('zero',s.left===0);
      // screen readers hear the step it settles on, not every step a drag passes
      if(say&&w.dataset.live){clearTimeout(sayT);sayT=setTimeout(function(){say.textContent=bdT('Step {n}:',{n:cur})+' '+s.label+'. '+s.caption+' '+
        s.cut+' '+bdT('character cut')+', '+s.left+' '+bdT('shadow left')+'.'},400)}
    }
    r.addEventListener('input',function(){if(+r.value!==cur)set(+r.value)});
    chips.forEach(function(b){b.addEventListener('click',function(){set(+b.dataset.i)})});
    set(0);w.dataset.live='1';
  })}catch(e){}

  // The projection toy: the knight's figure (1x pixels, runs [y, x0, x1)) slides down and flattens onto the floor by the
  // shadow map, x' = x + 1 - 0.26 (yf - y) + tx, y' = yf - 1.75 - (yf - y) / 3 + ty, landing on his painted shadow.
  // The picture under it is the 1996 frame with each pixel an s x s block (d.s), the canvas the same size; each figure
  // pixel is such a block, a third as tall once it lands, its edges rounded to whole canvas pixels so nothing is
  // smoothed. "Show our prediction" lays the predicted shadow over the painted one. The poster (the landed state)
  // shows without the script; under reduced motion the toy stays landed.
  var BONE='232,220,196',TORCH='229,139,58';
  var T_IN=300,T_HOLD0=900,T_MOVE=2000,T_HOLD1=1500,T_OUT=500,T_ALL=T_HOLD0+T_MOVE+T_HOLD1+T_OUT;
  try{document.querySelectorAll('.project [data-project]').forEach(function(w){
    var d=JSON.parse(w.dataset.project),poster=w.querySelector('img.poster'),pic=poster.parentNode;
    var S=d.s,CW=d.w*S,CH=d.h*S,bg=new Image(),c=document.createElement('canvas'),x=c.getContext('2d');
    c.width=CW;c.height=CH;c.setAttribute('role','img');c.setAttribute('aria-label',poster.alt);
    var layer=document.createElement('canvas');layer.width=CW;layer.height=CH;var lx=layer.getContext('2d');
    x.imageSmoothingEnabled=false;lx.imageSmoothingEnabled=false;
    var predOn=false,playing=!reduce,t0=null,seen=false,raf=0,elapsed=reduce?T_HOLD0+T_MOVE:0,last=null;
    var bPred=w.querySelector('.chip.pred'),bPlay=w.querySelector('.chip.play');
    function px(runs){var o=[];runs.forEach(function(r){for(var X=r[1];X<r[2];X++)o.push([X,r[0]])});return o}
    var fig=px(d.fig),edge=px(d.edge),pred=px(d.pred);
    function ease(u){return u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2}
    function blocks(ctx,list,u,col){ctx.fillStyle='rgb('+col+')';ctx.beginPath();
      list.forEach(function(p){var X=p[0],Y=p[1],dy=d.yf-Y,tx=X+1-.26*dy+d.tx,ty=d.yf-1.75-dy/3+d.ty;
        var cx=X+(tx-X)*u,cy=Y+(ty-Y)*u,hh=1-u*2/3,cyy=cy+(1-hh)/2;
        var l=Math.round(S*(cx-d.x0)),t=Math.round(S*(cyy-d.y0)),b=Math.round(S*(cyy+hh-d.y0));
        if(b>t)ctx.rect(l,t,S,b-t)});ctx.fill()}
    function draw(){
      var t=elapsed%T_ALL,u,a;
      if(t<T_HOLD0){u=0;a=Math.min(1,t/T_IN)}else if(t<T_HOLD0+T_MOVE){u=ease((t-T_HOLD0)/T_MOVE);a=1}
      else if(t<T_HOLD0+T_MOVE+T_HOLD1){u=1;a=1}else{u=1;a=1-(t-T_HOLD0-T_MOVE-T_HOLD1)/T_OUT}
      x.clearRect(0,0,CW,CH);if(bg.complete&&bg.naturalWidth)x.drawImage(bg,0,0);
      if(predOn){x.globalAlpha=.6;x.fillStyle='rgb('+TORCH+')';x.beginPath();pred.forEach(function(p){x.rect(S*(p[0]-d.x0),S*(p[1]-d.y0),S,S)});x.fill();x.globalAlpha=1}
      lx.clearRect(0,0,CW,CH);blocks(lx,fig,u,BONE);x.globalAlpha=.32*a;x.drawImage(layer,0,0);
      lx.clearRect(0,0,CW,CH);blocks(lx,edge,u,BONE);x.globalAlpha=.95*a;x.drawImage(layer,0,0);x.globalAlpha=1}
    function tick(now){raf=0;if(last!=null)elapsed+=now-last;last=now;draw();if(playing&&seen)raf=requestAnimationFrame(tick);else last=null}
    function run(){if(!raf&&playing&&seen){last=null;raf=requestAnimationFrame(tick)}else draw()}
    bg.onload=function(){pic.replaceChild(c,poster);run()};bg.src=poster.dataset.bg;
    bPred.addEventListener('click',function(){predOn=!predOn;bPred.setAttribute('aria-pressed',predOn);draw()});
    function setPlay(on){playing=on;bPlay.textContent=on?bdT('Pause'):bdT('Play');
      if(!on&&raf){cancelAnimationFrame(raf);raf=0;last=null}run()}
    bPlay.addEventListener('click',function(){setPlay(!playing)});
    if(reduce)setPlay(false);
    if('IntersectionObserver' in window){new IntersectionObserver(function(es){es.forEach(function(e){seen=e.isIntersecting;run()})},{threshold:.1}).observe(w)}
    else{seen=true;run()}
  })}catch(e){}
})();


