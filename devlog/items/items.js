/* The items post's own pieces: the stepped sequences (chips, a slider or an H key over a set of pictures), and the
   size cap every picture of the game's art keeps (one picture pixel at most two device pixels). */
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
  // again when the pixel ratio changes without a resize (a window moved to another screen)
  function onDpr(fn){var mq=matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)');
    mq.addEventListener('change',function(){fn();onDpr(fn)},{once:true})}
  capAll();addEventListener('resize',capAll);onDpr(capAll);

  // Stepped sequences. data-state holds the current values; img[data-src] are patterns ({key} filled in);
  // chips with data-key/data-v set a value, a chip with data-toggle flips between two, a range with data-values steps.
  document.querySelectorAll('.stepper').forEach(function(w){
    var st=JSON.parse(w.dataset.state);
    var imgs=[].slice.call(w.querySelectorAll('img[data-src]'));
    function fill(p){return p.replace(/\{(\w+)\}/g,function(_,k){return st[k]})}
    function render(){
      imgs.forEach(function(im){var s=fill(im.dataset.src);if(im.getAttribute('src')!==s)im.setAttribute('src',s)});
      w.querySelectorAll('.chip[data-key]').forEach(function(b){
        if(b.dataset.toggle){var v=JSON.parse(b.dataset.toggle);b.setAttribute('aria-pressed',st[b.dataset.key]===v[1])}
        else b.setAttribute('aria-pressed',st[b.dataset.key]===b.dataset.v)});
      w.querySelectorAll('input[data-key]').forEach(function(r){var v=JSON.parse(r.dataset.values),i=v.indexOf(st[r.dataset.key]);if(i>=0)r.value=i;
        var lab=r.dataset.labels?JSON.parse(r.dataset.labels)[i]:st[r.dataset.key];r.setAttribute('aria-valuetext',lab);
        w.querySelectorAll('[data-label="'+r.dataset.key+'"]').forEach(function(e){e.textContent=lab})});
      w.querySelectorAll('[data-captions]').forEach(function(e){var m=JSON.parse(e.dataset.captions),k=st[e.dataset.captionKey];if(m[k]!=null)e.textContent=m[k]});
      w.querySelectorAll('[data-labels-for]').forEach(function(e){var m=JSON.parse(e.dataset.labelsMap);e.textContent=m[st[e.dataset.labelsFor]]||''});
    }
    w.querySelectorAll('.chip[data-key]').forEach(function(b){b.addEventListener('click',function(){
      if(b.dataset.toggle){var v=JSON.parse(b.dataset.toggle);st[b.dataset.key]=st[b.dataset.key]===v[0]?v[1]:v[0]}
      else st[b.dataset.key]=b.dataset.v;render()})});
    w.querySelectorAll('input[data-key]').forEach(function(r){r.addEventListener('input',function(){st[r.dataset.key]=JSON.parse(r.dataset.values)[+r.value];render()})});
    render();
  });
  // the H key flips the stepper that is on screen and has an H chip, as in the game; a held key flips once
  addEventListener('keydown',function(e){if((e.key!=='h'&&e.key!=='H')||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
    var t=e.target;if(t&&(t.tagName==='INPUT'&&t.type!=='range'||t.tagName==='TEXTAREA'))return;
    var best=null,mid=innerHeight/2,bd=1e9;
    document.querySelectorAll('.stepper .chip[data-h]').forEach(function(b){var r=b.closest('.stepper').getBoundingClientRect();
      if(r.bottom<0||r.top>innerHeight)return;var d=Math.abs((r.top+r.bottom)/2-mid);if(d<bd){bd=d;best=b}});
    if(best)best.click()});
})();
