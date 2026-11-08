/* The devlog's shared pieces: videos that load when seen, the before/after slider, the loupe. */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce)document.querySelectorAll('.posthero video').forEach(function(v){v.removeAttribute('autoplay');v.pause()});

  // The sidebar: one link per section heading of the post, the one in view marked.
  var hs=[].slice.call(document.querySelectorAll('article h2[id]'));
  if(hs.length>2){var t=document.createElement('nav');t.className='toc';t.setAttribute('aria-label','In this post');
    t.innerHTML='<p>In this post</p><ol>'+hs.map(function(h){return '<li><a href="#'+h.id+'">'+h.textContent+'</a></li>'}).join('')+'</ol>';
    document.body.appendChild(t);var ls=[].slice.call(t.querySelectorAll('a'));
    var hero=document.querySelector('.posthero');
    var onScroll=function(){var y=innerHeight*.35,k=-1;hs.forEach(function(h,i){if(h.getBoundingClientRect().top<y)k=i});ls.forEach(function(a,i){a.classList.toggle('on',i===k)});
      t.classList.toggle('shown',!hero||hero.getBoundingClientRect().bottom<innerHeight*.3)};
    addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);onScroll()}

  // Videos with data-src load and play only on screen.
  var vs=[].slice.call(document.querySelectorAll('video[data-src]'));
  function load(v){if(!v.getAttribute('src')){v.setAttribute('src',v.dataset.src);v.load()}}
  if(!('IntersectionObserver' in window)){if(!reduce)vs.forEach(function(v){load(v);v.play().catch(function(){})})}
  else{var io=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;
    if(e.isIntersecting){if(!reduce){load(v);v.play().catch(function(){})}}else{v.pause()}})},{rootMargin:'200px 0px',threshold:.1});
    vs.forEach(function(v){io.observe(v)})}

  // The slider. A video figure holds both halves stacked (data-src, data-poster): top on the left, bottom on the right.
  // An image figure holds two <img> in .imgs: .a on the left, .b on the right.
  document.querySelectorAll('.cmp').forEach(function(f){
    var r=f.querySelector('input'),h=f.querySelector('.handle'),split=.5,c=f.querySelector('canvas'),v=f.querySelector('video');
    var draw=function(){},frame=function(){};
    if(c&&v){
      var x=c.getContext('2d'),poster=new Image(),live=false;
      draw=function(src,w,hh){var W=c.width,H=c.height,s=Math.round(W*split),sw=Math.round(w*split);
        try{if(s>0)x.drawImage(src,0,0,sw,hh,0,0,s,H);if(s<W)x.drawImage(src,sw,hh,w-sw,hh,s,0,W-s,H)}catch(e){}};
      frame=function(){if(v.readyState>=2){live=true;draw(v,v.videoWidth,v.videoHeight/2)}else if(poster.complete&&poster.naturalWidth)draw(poster,poster.naturalWidth,poster.naturalHeight/2)};
      poster.onload=function(){if(!live)draw(poster,poster.naturalWidth,poster.naturalHeight/2)};poster.src=f.dataset.poster;
      var loop=function(){frame();if(!v.paused){if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(loop);else requestAnimationFrame(loop)}};
      v.addEventListener('play',loop);v.addEventListener('loadeddata',frame);v.addEventListener('seeked',frame);
      var started=false;
      var go=function(){if(!started){started=true;v.src=f.dataset.src;v.load()}if(!reduce)v.play().catch(function(){})};
      if('IntersectionObserver' in window){new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)go();else v.pause()})},{threshold:.2}).observe(f)}else go();
    }
    function set(p){split=Math.max(0,Math.min(1,p));f.style.setProperty('--s',split);h.style.left=(split*100)+'%';r.value=Math.round(split*100);frame()}
    function fromX(e){var b=f.getBoundingClientRect();set((e.clientX-b.left)/b.width)}
    var drag=false;
    f.addEventListener('pointerdown',function(e){drag=true;try{f.setPointerCapture(e.pointerId)}catch(_){}fromX(e)});
    f.addEventListener('pointermove',function(e){if(drag||e.pointerType==='mouse')fromX(e)});
    f.addEventListener('pointerup',function(){drag=false});f.addEventListener('pointercancel',function(){drag=false});
    r.addEventListener('input',function(){set(r.value/100)});
    set(.5);
  });

  // The loupe: a round lens that shows the picture under it at 3x, pixel for pixel.
  document.querySelectorAll('.loupe').forEach(function(box){
    var img=box.querySelector('img'),lens=box.querySelector('.lens'),Z=3;
    function show(e){var b=img.getBoundingClientRect(),px=e.clientX-b.left,py=e.clientY-b.top;
      if(px<0||py<0||px>b.width||py>b.height){lens.style.display='none';return}
      var sx=img.naturalWidth/b.width,lw=lens.offsetWidth||170;
      lens.style.display='block';lens.style.left=(px-lw/2)+'px';lens.style.top=(py-lw/2-(e.pointerType==='touch'?90:0))+'px';
      lens.style.backgroundImage='url("'+img.currentSrc+'")';
      lens.style.backgroundSize=(img.naturalWidth*Z)+'px '+(img.naturalHeight*Z)+'px';
      lens.style.backgroundPosition=(-(px*sx*Z-lw/2))+'px '+(-(py*sx*Z-lw/2))+'px'}
    box.addEventListener('pointermove',show);box.addEventListener('pointerdown',show);
    box.addEventListener('pointerleave',function(){lens.style.display='none'});
    box.addEventListener('pointerup',function(e){if(e.pointerType==='touch')lens.style.display='none'});
  });
})();
