/* Stains drawn two ways: the game's stain code (blood.js) on the Cathedral's floor after a fixed fight, each tile
   painting its diamond from its own splashes alone (the lattice), or from its 3x3 neighbourhood's (the game's way).
   A still: the same fight every load. */
/* Translated text: bdT/bdN come from the page's head; without it they return the English. */
window.bdT=window.bdT||function(s,v){return v?s.replace(/\{(\w+)\}/g,function(m,k){return v[k]!=null?v[k]:m}):s};window.bdN=window.bdN||function(n,a,b,v){var o={n:n};for(var k in v)o[k]=v[k];return window.bdT(n===1?a:b,o)};
(function(){
  var root=document.getElementById('stains');if(!root||!window.BloodPort)return;
  var cv=root.querySelector('canvas'),msg=root.querySelector('.n-msg'),mode='alone',w=null;
  if(!BloodPort.supported){if(msg)msg.textContent=bdT('This browser cannot unpack the floor; try a current one.');return}
  var chips=root.querySelectorAll('[data-v]');
  function show(){chips.forEach(function(c){c.setAttribute('aria-pressed',String(c.dataset.v===mode))});
    if(!w)return;w.setGather(mode);w.updateTiles(true);w.compose(0)}
  chips.forEach(function(c){c.addEventListener('click',function(){mode=c.dataset.v;show()})});
  show();
  BloodPort.load().then(function(data){
    var c=data.G>>1;
    w=BloodPort.World(data,cv,{centre:[c,c+1],ground:.5,aspect:.6,perCss:.8,minW:180,light:{x:c,y:c+2,radius:15},monster:false,marks:false,bleeds:false});
    // The fight: four Zombies killed where they stood, two tiles apart, four times over, each blow from another side;
    // the spots soak to the most a tile holds and the cap shares out the rest. Then forty seconds' rest.
    var spots=[[-1,-1],[1,0],[-1,1],[1,2]];
    for(var i=0;i<16;i++){var p=spots[i&3];w.Burst((i*3)%8,false,c+p[0],c+p[1]);for(var t=0;t<10;t++)w.Tick();
      w.Burst((i*5+2)%8,true,c+p[0],c+p[1]);for(t=0;t<15;t++)w.Tick()}
    for(t=0;t<420;t++)w.Tick();
    show();
    var rw=0;window.addEventListener('resize',function(){clearTimeout(rw);rw=setTimeout(function(){w.layout();show()},200)})
  }).catch(function(){if(msg)msg.textContent=bdT('The floor did not load.')});
})();
