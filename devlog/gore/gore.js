/* The blood post's own pieces: the colour tables and the run of sixteen. Colours read from the game's palettes. */
(function(){
  var D={"red":["#ffbdbd","#f49696","#e87d7d","#e06c6c","#d85b5b","#cf4949","#c73838","#bf2727","#a92222","#931e1e","#7c1919","#661515","#4f1111","#390d0d","#230909","#0c0505"],
    "b48":{"l1_1":["#a35959","#9c4f4f","#954545","#8d3a3a","#863030","#7f2626","#771c1c","#701111","#680707","#5b0606","#4d0505","#3f0404"],"l2_1":["#878775","#7d7d6c","#737364","#6a6a5b","#606052","#565649","#4c4c41","#424238","#3b3b31","#33332a","#2c2c24","#25251d"],"l3_1":["#663f38","#603b34","#593730","#53332d","#4d2e29","#462a25","#402621","#3a221e","#331d1a","#2d1916","#271512","#20110f"],"l4_1":["#78666b","#715f64","#6a585e","#635157","#5c4a50","#554349","#4e3c43","#47353c","#3f2e35","#38282f","#312228","#2a1c22"]},
    "mon":{"Zombie":["#ffbdbd","#f49696","#e87d7d","#e06c6c","#d85b5b","#cf4949","#c73838","#bf2727","#a92222","#931e1e","#7c1919","#661515","#4f1111","#390d0d","#230909","#0c0505"],
      "Ghoul":["#ff9f9f","#ff9f9f","#ff5757","#ff5757","#fe2424","#fe2424","#f00000","#f00000","#bd0000","#bd0000","#910000","#910000","#5a0000","#5a0000","#230000","#230000"],
      "Skeleton":["#f3f3f3","#dedede","#cccccc","#b8b8b8","#a3a3a3","#949494","#858585","#737373","#666666","#595959","#4c4c4c","#3d3d3d","#2e2e2e","#1e1e1e","#111111","#ffffff"],
      "Horror":["#666666","#666666","#595959","#595959","#4c4c4c","#4c4c4c","#3d3d3d","#3d3d3d","#2e2e2e","#2e2e2e","#1e1e1e","#1e1e1e","#111111","#111111","#ffffff","#ffffff"],
      "Dark One":["#c8cdea","#b2b7d7","#9fa5c6","#9399b9","#878dac","#797fa0","#667099","#58638d","#4e587d","#434c6f","#39415f","#2f3650","#252b41","#191e2d","#0d111b","#05070c"]}};
  function fill(el,cols){el.style.setProperty('--n',cols.length);el.innerHTML=cols.map(function(c){return '<span style="background:'+c+'"></span>'}).join('')}
  function chips(row,names,cur,on){row.querySelectorAll('.chip').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.v===cur);b.onclick=function(){on(b.dataset.v)}})}

  // 1. The colour tables: the game's red through each monster's table, and the red no table touches, on each level.
  var t=document.getElementById('trn');
  if(t){var mon='Skeleton',lvl='l1_1';
    function drawT(){fill(t.querySelector('.r224'),D.mon[mon]);fill(t.querySelector('.r48'),D.b48[lvl]);
      t.querySelector('.mname').textContent=mon;
      chips(t.querySelector('.mons'),null,mon,function(v){mon=v;drawT()});chips(t.querySelector('.lvls'),null,lvl,function(v){lvl=v;drawT()})}
    drawT()}

  // 2. The run of sixteen: darkness moves a colour down its run, and off the end it is black.
  var L=document.getElementById('run');
  if(L){var inp=L.querySelector('input'),kept=8,rej=12;
    function drawL(){var s=+inp.value;fill(L.querySelector('.ramp'),D.red);
      var sp=L.querySelectorAll('.ramp span');sp.forEach(function(e,i){e.classList.toggle('on',i===kept+s||i===rej+s)});
      function at(i){return i+s>15?'#000000':D.red[i+s]}
      L.querySelector('.kept').style.background=at(kept);L.querySelector('.rej').style.background=at(rej);
      L.querySelector('.sval').textContent=s===0?'none':s+' step'+(s>1?'s':'');
      L.querySelector('.rejn').textContent=rej+s>15?'black':'still red'}
    inp.addEventListener('input',drawL);drawL()}

})();
