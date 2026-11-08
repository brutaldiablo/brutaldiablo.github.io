/* Strike the monster, watch the blood: the game's blood code (blood.js) on a patch of the Cathedral's floor, a Zombie
   on it. Simulated at the game's 20 ticks a second, drawn every frame between ticks; asleep off screen. */
(function(){
  var root=document.getElementById('strike');if(!root||!window.BloodPort)return;
  var cv=root.querySelector('canvas'),msg=root.querySelector('.n-msg');
  var reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!BloodPort.supported){if(msg)msg.textContent='This browser cannot unpack the floor; try a current one.';return}
  var w=null,acc=0,last=0,running=false,visible=false,dirty=true,started=false,fatal=false,lastAway=6;
  var nAir=root.querySelector('.n-air'),nBlock=root.querySelector('.n-block');
  function readout(){if(nAir)nAir.textContent=w.particles();if(nBlock)nBlock.textContent=w.block()}
  function step(now){
    if(!visible){running=false;return}
    var dt=Math.min(now-last,250);last=now;acc+=dt;var ticked=false;
    while(acc>=50){w.Tick();acc-=50;ticked=true}
    if(w.updateTiles())dirty=true;
    if(w.particles()||w.animating()||dirty){w.compose(Math.floor(acc/50*128));dirty=false}
    if(ticked)readout();
    if(w.busy()||w.pending()||w.animating())requestAnimationFrame(step);else{running=false;w.compose(0);readout()}}
  function wake(){if(running||!visible||!w)return;running=true;last=performance.now();acc=0;requestAnimationFrame(step)}

  // ---- controls ----
  // Hit and Kill strike from the side last clicked (at first, from the left); a click on the floor hits from there.
  // A dead Zombie gets up again for the next blow; the blood stays where it fell.
  var hint=root.querySelector('.hint'),stage=root.querySelector('.stage');
  function used(){if(hint)hint.classList.add('gone')}
  function strike(away,kill){if(!w)return;if(w.isDead())w.raise();lastAway=away;w.Burst(away,!!kill);dirty=true;readout();
    if(visible)wake();else{for(var i=0;i<40;i++)w.Tick();w.updateTiles(true);w.compose(0)}}
  function mark(x,y){if(!stage)return;var r=stage.getBoundingClientRect(),m=document.createElement('span');m.className='slash';
    m.style.left=(x-r.left)+'px';m.style.top=(y-r.top)+'px';stage.appendChild(m);setTimeout(function(){m.remove()},600)}
  root.querySelector('[data-act=hit]').addEventListener('click',function(){used();strike(lastAway,false)});
  root.querySelector('[data-act=kill]').addEventListener('click',function(){used();strike(lastAway,true)});
  root.querySelector('[data-act=wash]').addEventListener('click',function(){if(!w)return;w.wash();w.updateTiles(true);w.compose(0);readout()});
  // A click on the floor: a hit from that side, so the blood flies the opposite way.
  cv.addEventListener('click',function(ev){if(!w)return;used();mark(ev.clientX,ev.clientY);strike((w.facingAt(ev.clientX,ev.clientY)+4)%8,false)});

  // ---- start: a kill already on the floor, one blow when it first comes into view ----
  BloodPort.load().then(function(data){
    // At the size the game draws it: a game pixel to a CSS pixel or more, the view tight round the Zombie, lit by the
    // hero's lantern (radius 10) from the tile the blows come from.
    w=BloodPort.World(data,cv,{monster:true,marks:true,bleeds:true,perCss:1,minW:100,aspect:.72,minH:100,ground:.74,
      light:{x:data.G/2-1,y:data.G/2+1,radius:10}});
    // Twenty seconds ago a Zombie died here, struck from the right; another stands on its pool.
    w.Burst(2,true);for(var i=0;i<400;i++)w.Tick();w.raise();
    w.updateTiles(true);w.compose(0);readout();
    if('IntersectionObserver' in window){new IntersectionObserver(function(es){visible=es[0].isIntersecting;
        if(visible&&!started){started=true;if(!reduced)setTimeout(function(){strike(6,false)},450)}
        if(visible)wake()},{threshold:.15}).observe(cv)}
    else{visible=true;wake()}
    var rw=0;window.addEventListener('resize',function(){clearTimeout(rw);rw=setTimeout(function(){w.layout();w.updateTiles(true);w.compose(0)},200)})
  }).catch(function(){if(msg)msg.textContent='The floor did not load.'});
})();
