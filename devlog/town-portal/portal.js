/* The town portal post's own pieces: the stepped sequences (chips or a slider over a set of pictures, a stack for
   animated ones), the size cap every picture of the game's art keeps (one picture pixel at most two device pixels),
   the layers toy and the scene buttons of "Press H". Started from the items post's items.js. */
(function(){
  // The cap: an image or a slider marked .cap2 is never drawn larger than twice its pixels in device pixels. The CSS
  // holds it from the width in the markup (--w) before this runs; this makes it exact for the screen's pixel ratio
  // and follows a stepper's picture when it changes to one of another size.
  function imgOf(el){return el.tagName==='IMG'?el:el.querySelector('img')}
  function cap(el){var img=imgOf(el);if(!img)return;
    var w=img.naturalWidth||+img.getAttribute('width');if(!w)return;
    el.style.maxWidth=(w*2/(window.devicePixelRatio||1))+'px'}
  function capAll(){document.querySelectorAll('.cap2').forEach(function(el){cap(el);var img=imgOf(el);
    if(img&&!img._capped){img._capped=true;img.addEventListener('load',function(){cap(el)})}})}
  // again when the pixel ratio changes (a window moved to another screen, a zoom)
  function onDpr(fn){var mq=matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)');
    var once=function(){if(mq.removeEventListener)mq.removeEventListener('change',once);else if(mq.removeListener)mq.removeListener(once);fn();onDpr(fn)};
    if(mq.addEventListener)mq.addEventListener('change',once);else if(mq.addListener)mq.addListener(once)}
  capAll();try{onDpr(capAll)}catch(e){}

  // Stepped sequences. data-state holds the current values; img[data-src] are patterns ({key} filled in);
  // chips with data-key/data-v set a value, a range with data-values (and data-labels) steps through them.
  document.querySelectorAll('.stepper').forEach(function(w){
    var st=JSON.parse(w.dataset.state);
    function labelsFor(key){var m={};
      w.querySelectorAll('input[data-key="'+key+'"]').forEach(function(r){var v=JSON.parse(r.dataset.values),l=r.dataset.labels?JSON.parse(r.dataset.labels):v;
        v.forEach(function(x,i){m[x]=l[i]})});
      w.querySelectorAll('.chip[data-key="'+key+'"][data-v]').forEach(function(c){if(!(c.dataset.v in m))m[c.dataset.v]=c.textContent});
      return m}
    // ticks: each label under its stop (the thumb is 18 px, so the stops run from 9 px to the width less 9 px)
    w.querySelectorAll('.ticks').forEach(function(t){var sp=t.querySelectorAll('span'),n=sp.length;
      sp.forEach(function(s,i){s.style.left=(n>1?i/(n-1)*100:0)+'%'})});
    // a stack (.pic.stack): one <img> per value, the current one shown, so a step switches at once instead of
    // waiting for the next picture to load and start. The others load once the stepper comes near the screen; a step
    // to one still loading keeps the last picture up until it is ready.
    var later=[];
    w.querySelectorAll('.pic.stack img[data-src]').forEach(function(im){
      var key=(im.dataset.src.match(/\{(\w+)\}/)||[])[1];if(!key)return;
      var labs=labelsFor(key),box=im.parentNode,pat=im.dataset.src,base=im.alt;
      im.dataset.stackKey=key;im.dataset.stackV=st[key];im.removeAttribute('data-src');im.classList.add('on');
      Object.keys(labs).forEach(function(v){if(v===st[key])return;var c=im.cloneNode();
        c.removeAttribute('src');c.removeAttribute('loading');c.dataset.later=pat.replace('{'+key+'}',v);
        c.dataset.stackV=v;c.classList.remove('on');c.alt=base+': '+labs[v];c.setAttribute('aria-hidden','true');
        box.appendChild(c);later.push(c)});
      im.alt=base+': '+labs[st[key]];box.classList.add('ready');
    });
    if(later.length){var go=function(){later.forEach(function(c){if(!c.getAttribute('src'))c.src=c.dataset.later})};
      if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting})){go();io.disconnect()}},{rootMargin:'600px 0px'});io.observe(w)}
      else go()}
    var imgs=[].slice.call(w.querySelectorAll('img[data-src]'));
    w.querySelectorAll('[data-captions]').forEach(function(e){e.setAttribute('aria-live','polite')});
    function fill(p){return p.replace(/\{(\w+)\}/g,function(_,k){return st[k]})}
    function show(box,key){var want=null;
      box.querySelectorAll('img[data-stack-key]').forEach(function(im){if(im.dataset.stackV===st[key])want=im});
      if(!want)return;
      var swap=function(){if(want.dataset.stackV!==st[key])return;
        box.querySelectorAll('img[data-stack-key]').forEach(function(im){var on=im===want;im.classList.toggle('on',on);
          if(on)im.removeAttribute('aria-hidden');else im.setAttribute('aria-hidden','true')})};
      if(!want.getAttribute('src'))want.src=want.dataset.later;
      if(want.complete&&want.naturalWidth)swap();else want.addEventListener('load',swap,{once:true})}
    function render(){
      imgs.forEach(function(im){var s=fill(im.dataset.src);if(im.getAttribute('src')!==s)im.setAttribute('src',s)});
      w.querySelectorAll('.pic.stack').forEach(function(box){var im=box.querySelector('img[data-stack-key]');if(im)show(box,im.dataset.stackKey)});
      w.querySelectorAll('.chip[data-key]').forEach(function(b){b.setAttribute('aria-pressed',st[b.dataset.key]===b.dataset.v)});
      w.querySelectorAll('input[data-key]').forEach(function(r){var v=JSON.parse(r.dataset.values),i=v.indexOf(st[r.dataset.key]);if(i<0)return;r.value=i;
        var lab=r.dataset.labels?JSON.parse(r.dataset.labels)[i]:st[r.dataset.key];r.setAttribute('aria-valuetext',lab);
        w.querySelectorAll('[data-label="'+r.dataset.key+'"]').forEach(function(e){e.textContent=lab})});
      w.querySelectorAll('[data-captions]').forEach(function(e){var m=JSON.parse(e.dataset.captions),k=st[e.dataset.captionKey];if(m[k]!=null&&e.textContent!==m[k])e.textContent=m[k]});
    }
    w.querySelectorAll('.chip[data-key]').forEach(function(b){b.addEventListener('click',function(){st[b.dataset.key]=b.dataset.v;render()})});
    w.querySelectorAll('input[data-key]').forEach(function(r){r.addEventListener('input',function(){st[r.dataset.key]=JSON.parse(r.dataset.values)[+r.value];render()})});
    render();
  });
})();

/* The layers toy: one video holds every state in a grid (data-cols columns of data-w x data-h panels, in the chips'
   order), so every state plays from the same moment; the canvas draws the chosen panel, and a chip switches it at
   once. Until the video has a frame (or under reduced motion, where it stays still) the poster, the same grid, draws
   the chosen panel. Without the script, the <noscript> shows the whole grid. */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.layers').forEach(function(w){
    var c=w.querySelector('canvas'),v=w.querySelector('video'),x=c.getContext('2d'),poster=new Image();
    var cols=+w.dataset.cols,pw=+w.dataset.w,ph=+w.dataset.h,cur=+w.dataset.start||0;
    var chips=[].slice.call(w.querySelectorAll('.chip[data-i]')),cap=w.querySelector('.cap'),caps=JSON.parse(cap.dataset.captions);
    function draw(src){var sx=(cur%cols)*pw,sy=Math.floor(cur/cols)*ph;try{x.drawImage(src,sx,sy,pw,ph,0,0,c.width,c.height)}catch(e){}}
    function frame(){if(v.readyState>=2)draw(v);else if(poster.complete&&poster.naturalWidth)draw(poster)}
    function set(i){cur=i;chips.forEach(function(b,k){b.setAttribute('aria-pressed',k===i)});
      if(caps[i]!=null)cap.textContent=caps[i];c.setAttribute('aria-label',chips[i].dataset.alt||chips[i].textContent);frame()}
    poster.onload=frame;poster.src=w.dataset.poster;
    // one draw loop at a time: a pause ends it, a play starts it only if none is running
    var running=false,loop=function(){frame();if(v.paused){running=false;return}if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(loop);else requestAnimationFrame(loop)};
    v.addEventListener('play',function(){if(!running){running=true;loop()}});v.addEventListener('loadeddata',frame);v.addEventListener('seeked',frame);
    var started=false,go=function(){if(!started){started=true;v.src=w.dataset.src;v.load()}if(!reduce)v.play().catch(function(){})};
    if('IntersectionObserver' in window){new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)go();else v.pause()})},{threshold:.2}).observe(w)}else go();
    chips.forEach(function(b,k){b.addEventListener('click',function(){set(k)})});
    set(cur);
  });
})();

/* "Press H": one slider, a button per scene. A button points the slider at its pair (data-src, data-poster) and
   tells devlog.js ('cmpsource'), which shows the new poster until the new video has a frame; it also swaps the
   slider's label and the caption. */
(function(){
  document.querySelectorAll('.scenes').forEach(function(f){
    var data=JSON.parse(f.dataset.scenes),cmp=f.querySelector('.cmp'),cap=f.querySelector('figcaption');
    var chips=[].slice.call(f.querySelectorAll('.chip[data-scene]'));
    chips.forEach(function(b){b.addEventListener('click',function(){var d=data[b.dataset.scene];if(!d||cmp.dataset.src===d.src)return;
      chips.forEach(function(x){x.setAttribute('aria-pressed',x===b)});
      cmp.dataset.src=d.src;cmp.dataset.poster=d.poster;cmp.setAttribute('aria-label',d.aria);cap.textContent=d.cap;
      cmp.dispatchEvent(new Event('cmpsource'))})});
  });
})();
