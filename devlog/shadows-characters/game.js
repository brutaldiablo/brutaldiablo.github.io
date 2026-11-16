/* "Your turn": the reader paints the painted shadow out of a raw frame of Diablo (1996); paint lands on any pixel of
   the frame, black or coloured, never on the empty floor. Check shows the shadow found, the character cut (any painted
   pixel that is not shadow) and the shadow left, against the answer a person checked pixel by pixel. A frame is scored
   on both counts, the shadow found and the character cut, so painting everything does not win.
   The figure.game holds a static picture for readers without the script; this replaces it with the game. Data:
   <base>data/<normal|nightmare|hell>.json (build_game.py), loaded when the game first comes near the screen. A pool's
   first round opens on its `first` frame; every round holds at least two frames with black of the character's own
   where the pool has them. Nothing is stored and nothing is sent anywhere. */
/* Translated text: bdT/bdN come from the page's head; without it they return the English. */
window.bdT=window.bdT||function(s,v){return v?s.replace(/\{(\w+)\}/g,function(m,k){return v[k]!=null?v[k]:m}):s};window.bdN=window.bdN||function(n,a,b,v){var o={n:n};for(var k in v)o[k]=v[k];return window.bdT(n===1?a:b,o)};
(function(){
  var ROUND=5,WITH_CHAR=2,MAGENTA=[0xe0,0x24,0x9a],FLOOR=[128,128,128];
  var OK=[46,150,78],CUT=[235,48,36],LEFT=[250,204,40];
  var me=document.currentScript;
  var POOLS=['normal','nightmare','hell'];
  var NAMES={normal:'Normal',nightmare:'Nightmare',hell:'Hell'};   // the difficulties keep the game's English names in every language
  var ABOUT={normal:bdT('Monsters. Most of their black is shadow.'),
    nightmare:bdT('Heroes. Their black is mixed: outlines, armour and shadow.'),
    hell:bdT('Blood Knights and Succubi, standing on their own shadows.')};
  // the line under the levels while Normal's opener shows
  var ABOUT_FIRST=bdT('Monsters. Most of their black is shadow. Yes, Diablo is the easy one.');
  var DISCORD='https://discord.gg/NsG8gnhnJH';
  // the picture: whole device pixels per art pixel, at most MAX_SCALE, as wide as the stage and at most the window's
  // height less ROOM (the game's own lines around it), never less than MIN_H nor more than MAX_H CSS pixels tall
  var MAX_SCALE=10,ROOM=260,MIN_H=240,MAX_H=760;
  // the icons (inline SVG, drawn for the game)
  var SVG='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">';
  var EYE=SVG+'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var UNDO=SVG+'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  // the brush: a 3 by 3 block of pixels, the ones it paints filled
  function BRUSH(n){var o=SVG;for(var y=0;y<3;y++)for(var x=0;x<3;x++){var on=n>=3||(x===1&&y===1);
    o+='<rect class="'+(on?'on':'off')+'" x="'+(3.5+x*6)+'" y="'+(3.5+y*6)+'" width="5" height="5" rx=".6"/>'}return o+'</svg>'}
  // the frames' titles, written by build_game.py from the data, so the site's translation tool collects them
  /*titles*/var TITLES={'Blink, dying':bdT('Blink, dying'),'Blink, hit':bdT('Blink, hit'),'Blood Knight, attacking':bdT('Blood Knight, attacking'),'Blood Knight, hit':bdT('Blood Knight, hit'),'Blood Knight, standing':bdT('Blood Knight, standing'),'Blood Knight, walking':bdT('Blood Knight, walking'),'Burning Dead archer, dying':bdT('Burning Dead archer, dying'),'Burning Dead, walking':bdT('Burning Dead, walking'),'Counselor, hit':bdT('Counselor, hit'),'Diablo, walking':bdT('Diablo, walking'),'Flesh Clan archer, dying':bdT('Flesh Clan archer, dying'),'Flesh Clan, attacking':bdT('Flesh Clan, attacking'),'Horned Demon, hit':bdT('Horned Demon, hit'),'Overlord, standing':bdT('Overlord, standing'),'Rogue, attacking':bdT('Rogue, attacking'),'Rogue, blocking':bdT('Rogue, blocking'),'Rogue, casting':bdT('Rogue, casting'),'Rogue, casting fire':bdT('Rogue, casting fire'),'Rogue, casting lightning':bdT('Rogue, casting lightning'),'Rogue, dying':bdT('Rogue, dying'),'Scavenger, dying':bdT('Scavenger, dying'),'Scavenger, walking':bdT('Scavenger, walking'),'Sorcerer, casting':bdT('Sorcerer, casting'),'Sorcerer, casting fire':bdT('Sorcerer, casting fire'),'Sorcerer, casting lightning':bdT('Sorcerer, casting lightning'),'Sorcerer, dying':bdT('Sorcerer, dying'),'Sorcerer, hit':bdT('Sorcerer, hit'),'Sorcerer, walking':bdT('Sorcerer, walking'),'Succubus, attacking':bdT('Succubus, attacking'),'Succubus, dying':bdT('Succubus, dying'),'Succubus, hit':bdT('Succubus, hit'),'Succubus, standing':bdT('Succubus, standing'),'Succubus, walking':bdT('Succubus, walking'),'The Butcher, dying':bdT('The Butcher, dying'),'Warrior, attacking':bdT('Warrior, attacking'),'Warrior, casting':bdT('Warrior, casting'),'Warrior, casting lightning':bdT('Warrior, casting lightning'),'Warrior, hit':bdT('Warrior, hit'),'Warrior, standing in town':bdT('Warrior, standing in town'),'Warrior, walking in town':bdT('Warrior, walking in town'),'Zombie, dying':bdT('Zombie, dying')};/*/titles*/

  function bytes(b64){var s=atob(b64),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
  function bit(a,i){return (a[i>>3]>>(7-(i&7)))&1}
  function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
  function btn(cls,text){var b=el('button',cls,text);b.type='button';return b}
  // a tool: its icon over its name
  function ico(svg,label){var b=btn('sg-ico');b.innerHTML=svg;b.appendChild(el('span','',label));return b}
  function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
  // a share in percent: whole on a frame, one decimal on a round; never 100 while a pixel is missing
  function pct(v,all,dec){if(!all)return 100;var k=dec?10:1,q=Math.floor(v/all*100*k)/k;return v<all&&q>=100?(dec?99.9:99):q}

  // a frame from its data: the RGBA as drawn on the grey floor, which pixels are the frame's own (they take paint),
  // the answer (shadow: always pure black)
  function decode(d,pals){
    var n=d.w*d.h,clear=bytes(d.clear),pix=bytes(d.pix),ans=bytes(d.ans),pal=pals[d.pal];
    var rgba=new Uint8ClampedArray(n*4),opq=new Uint8Array(n),key=new Uint8Array(n),k=0,no=0,ns=0;
    for(var i=0;i<n;i++){var c=FLOOR;
      if(!bit(clear,i)){var q=pix[k++];c=[pal[q*3],pal[q*3+1],pal[q*3+2]];opq[i]=1;no++;if(q===0&&bit(ans,i)){key[i]=1;ns++}}
      rgba[i*4]=c[0];rgba[i*4+1]=c[1];rgba[i*4+2]=c[2];rgba[i*4+3]=255}
    return {id:d.id,title:TITLES[d.t]||d.t,w:d.w,h:d.h,rgba:rgba,opq:opq,key:key,no:no,ns:ns}
  }

  function Game(fig){
    var base=fig.getAttribute('data-base')||(me&&me.src?me.src.replace(/[^\/]*$/,''):'');
    var box=fig.querySelector('.sg')||fig;
    var cache={},pool='normal',round=[],at=0,fr=null,paint=null,undo=[],brush=1,brushChosen=false,raw=false,phase='load',scores=[],token=0;

    // the markup: the levels, the line about the level, the frame's title and number, the picture, one line under it
    // (the hint, or the frame's result), then the tools (each an icon with its name) and the one action
    var ui=el('div','sg-ui');
    var rowD=el('div','sg-diff');
    rowD.setAttribute('role','group');rowD.setAttribute('aria-label',bdT('Difficulty'));
    var chipsD={};POOLS.forEach(function(p){var b=btn('sg-lvl',NAMES[p]);b.setAttribute('aria-pressed','false');b.dataset.pool=p;chipsD[p]=b;rowD.appendChild(b)});
    var about=el('p','sg-about');
    var head=el('div','wlab sg-head'),where=el('b'),count=el('span');head.appendChild(where);head.appendChild(count);
    head.tabIndex=-1;
    // what a screen reader hears when a frame arrives or a round ends (the heading is only a place for the focus); quiet
    // until the reader has done something in the game, so the game starting by itself as it scrolls in says nothing
    var live=el('p','sg-live');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');
    var stage=el('div','sg-stage'),wrap=el('div','sg-wrap'),cv=el('canvas'),cur=el('div','sg-cur');
    cv.setAttribute('role','img');cur.setAttribute('aria-hidden','true');wrap.hidden=true;wrap.appendChild(cv);wrap.appendChild(cur);stage.appendChild(wrap);
    var msg=el('p','sg-msg');msg.tabIndex=-1;stage.appendChild(msg);
    var spoken=false;function say(t){if(spoken)live.textContent=t}
    function acted(){if(!spoken){spoken=true;msg.setAttribute('aria-live','polite')}}
    var sum=el('div','sg-sum');sum.hidden=true;stage.appendChild(sum);
    var status=el('div','sg-status');
    var hint=el('p','sg-hint',bdT('Paint the shadow. Start on magenta to erase.'));
    var res=el('div','sg-res');res.setAttribute('aria-live','polite');
    status.appendChild(hint);status.appendChild(res);
    var rowA=el('div','sg-acts'),tools=el('div','sg-tools');tools.setAttribute('role','group');tools.setAttribute('aria-label',bdT('Tools'));
    // "Show original": the eye; a press held down shows the frame while held, a short press or a key switches it
    var bRaw=ico(EYE,bdT('Original'));bRaw.setAttribute('aria-label',bdT('Show original'));bRaw.setAttribute('aria-pressed','false');bRaw.classList.add('sg-eye');
    var bUndo=ico(UNDO,bdT('Undo'));
    // the brush: one button that switches between 1 px and 3 px; its name says the size in use
    var bBrush=btn('sg-ico sg-brush');
    function brushIcon(){bBrush.innerHTML=BRUSH(brush);bBrush.appendChild(el('span','',bdT('Brush {n} px',{n:brush})))}
    tools.appendChild(bRaw);tools.appendChild(bUndo);tools.appendChild(bBrush);
    var bGo=btn('btn primary',bdT('Check'));
    rowA.appendChild(status);rowA.appendChild(tools);rowA.appendChild(bGo);
    [rowD,about,head,live,stage,rowA].forEach(function(e){ui.appendChild(e)});
    var x=cv.getContext('2d'),img=null;

    function setPressed(){POOLS.forEach(function(p){chipsD[p].setAttribute('aria-pressed',p===pool)});bRaw.setAttribute('aria-pressed',raw)}
    function state(){box.dataset.phase=phase;box.dataset.pool=pool;box.dataset.frame=fr?fr.id:'';box.dataset.brush=brush;
      var n=0;if(paint)for(var i=0;i<paint.length;i++)n+=paint[i];box.dataset.painted=n;
      bUndo.disabled=!(phase==='paint'&&undo.length);bBrush.disabled=phase!=='paint';bGo.disabled=phase==='load';
      bRaw.disabled=!fr||phase==='summary'||phase==='load';
      rowA.hidden=phase==='summary';status.style.visibility=phase==='load'?'hidden':''}

    // drawing: the frame as drawn, the reader's paint over it, or after Check the shadow found, the character cut and
    // the shadow left coloured
    function draw(){if(!fr)return;var d=img.data;d.set(fr.rgba);
      if(!raw)for(var i=0;i<fr.opq.length;i++){if(!paint[i]&&!fr.key[i])continue;var c=null;
        if(phase==='checked')c=paint[i]?(fr.key[i]?OK:CUT):LEFT;else if(paint[i])c=MAGENTA;
        if(c){d[i*4]=c[0];d[i*4+1]=c[1];d[i*4+2]=c[2]}}
      x.putImageData(img,0,0)}

    // the size: as wide as the stage allows, as tall as the window allows, whole device pixels per art pixel
    function scale(){var dpr=window.devicePixelRatio||1,cs=getComputedStyle(stage);
      var aw=stage.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
      var ah=Math.max(MIN_H,Math.min(innerHeight-ROOM,MAX_H));
      var s=Math.min(aw/fr.w,ah/fr.h,MAX_SCALE);
      return Math.max(1,Math.floor(s*dpr))/dpr}
    var S=1;
    function layout(){if(!fr)return;S=scale();cv.style.width=(fr.w*S)+'px';cv.style.height=(fr.h*S)+'px';
      wrap.style.width=(fr.w*S)+'px';wrap.style.height=(fr.h*S)+'px';moveCur()}

    function show(i){settle();at=i;var d=round[i];fr=d;paint=new Uint8Array(fr.w*fr.h);undo=[];raw=false;phase='paint';
      cv.width=fr.w;cv.height=fr.h;img=x.createImageData(fr.w,fr.h);
      wrap.hidden=false;sum.hidden=true;msg.textContent='';
      where.textContent=fr.title;about.textContent=wink&&i===0?ABOUT_FIRST:ABOUT[pool];count.textContent=bdT('Frame {n} of {m}',{n:i+1,m:round.length});
      stage.classList.remove('done');say(fr.title+'. '+count.textContent);if(refocus){refocus=false;head.focus({preventScroll:true})}
      cv.setAttribute('aria-label',bdT('{title}: a raw frame of Diablo (1996), enlarged, on a grey floor. Paint its shadow.',{title:fr.title}));
      res.textContent='';hint.hidden=false;bGo.textContent=bdT('Check');
      layout();draw();setPressed();state()}

    // a level: its frames are fetched once (one quiet retry, then a message and a Try again button)
    // the brush: 3 px on Normal (its black is nearly all shadow) and on touch (a fingertip), 1 px with a mouse on
    // Nightmare and Hell, where outlines touch the shadow, until the reader picks a size; then their pick stays
    function start(p){pool=p;refocus=false;stage.classList.remove('done');about.textContent=ABOUT[p];if(!brushChosen)brush=p==='normal'||coarse?3:1;brushIcon();setPressed();var my=++token;
      if(cache[p]){go();return}
      phase='load';fr=null;wrap.hidden=true;sum.hidden=true;msg.textContent=bdT('Loading the frames…');res.textContent='';state();
      var load=function(left){
        fetch(base+'data/'+p+'.json').then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(j){
          var pals={};for(var k in j.pals)pals[k]=bytes(j.pals[k]);
          cache[p]={frames:j.frames,pals:pals,first:j.first||null,played:false};if(my===token)go()
        }).catch(function(){if(my!==token)return;if(left>0){setTimeout(function(){if(my===token)load(left-1)},1500);return}
          refocus=false;msg.textContent=bdT('The frames did not load. Check your connection and try again.')+' ';
          var inGame=box.contains(document.activeElement);
          var again=btn('btn',bdT('Try again'));again.addEventListener('click',function(){start(p);keepFocus()});msg.appendChild(again);
          if(inGame)again.focus({preventScroll:true})})};
      load(1);
      function go(){if(my!==token)return;var c=cache[p];var r=pick(c);wink=r.opener&&p==='normal';
        round=r.frames.map(function(d){return decode(d,c.pals)});scores=[];show(0)}}
    // a round: the pool's opener first the first time; at least WITH_CHAR frames where some black is the character's
    // (nb, ns: the frame's black and shadow pixels, from the data); one frame per title where the pool has enough
    // titles. Only the round's frames are decoded.
    var wink=false,coarse=matchMedia('(pointer: coarse)').matches;
    function hasChar(d){return d.nb>d.ns}
    function pick(c){var fs=shuffle(c.frames),out=[],seen={};
      var take=function(d){out.push(d);seen[d.t]=1;fs.splice(fs.indexOf(d),1)};
      var opener=false;
      if(!c.played&&c.first){var f0=fs.filter(function(d){return d.id===c.first})[0];if(f0){take(f0);opener=true}}
      c.played=true;
      var fresh=function(d){return !seen[d.t]};
      while(out.length<ROUND&&out.filter(hasChar).length<WITH_CHAR){
        var d=fs.filter(hasChar).filter(fresh)[0]||fs.filter(hasChar)[0];if(!d)break;take(d)}
      while(out.length<ROUND&&fs.length){take(fs.filter(fresh)[0]||fs[0])}
      var lead=opener?out.slice(0,1):[];
      return {frames:lead.concat(shuffle(out.slice(lead.length))),opener:opener}}

    // painting: a drag paints, or erases when it starts on a magenta pixel; every pixel of the frame takes paint, the
    // empty floor none
    var pts={},stroke=null,two=false;
    function at_(e){var r=cv.getBoundingClientRect();return [Math.floor((e.clientX-r.left)/r.width*fr.w),Math.floor((e.clientY-r.top)/r.height*fr.h)]}
    function dab(px,py,v){var h=brush>>1;
      for(var y=py-h;y<=py+h;y++)for(var xx=px-h;xx<=px+h;xx++){if(xx<0||y<0||xx>=fr.w||y>=fr.h)continue;var i=y*fr.w+xx;
        if(fr.opq[i])paint[i]=v}}
    function line(a,b,v){var x0=a[0],y0=a[1],x1=b[0],y1=b[1],dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,er=dx+dy;
      for(;;){dab(x0,y0,v);if(x0===x1&&y0===y1)break;var e2=2*er;if(e2>=dy){er+=dy;x0+=sx}if(e2<=dx){er+=dx;y0+=sy}}}
    // a stroke kept leaves its undo step only if it changed something; a stroke cancelled (a second finger) is undone
    function endStroke(keep){if(!stroke)return;var s_=stroke;stroke=null;
      if(s_.fr===fr&&s_.phase===phase){if(!keep)paint.set(s_.before);if(!keep||same(s_.before,paint))undo.pop();draw()}state()}
    // before Undo, Check, Next or another frame: the stroke in progress ends where it is, the fingers are forgotten
    function settle(){endStroke(true);pts={};two=false}
    cv.addEventListener('pointerdown',function(e){if(!fr||phase!=='paint'||e.button!==0)return;e.preventDefault();  // the main button only
      pts[e.pointerId]=1;
      if(Object.keys(pts).length>=2){endStroke(false);two=true;return}
      try{cv.setPointerCapture(e.pointerId)}catch(_){}
      if(raw){raw=false;setPressed()}
      var p=at_(e),i=p[1]*fr.w+p[0],inside=p[0]>=0&&p[1]>=0&&p[0]<fr.w&&p[1]<fr.h;
      var v=inside&&paint[i]?0:1;
      var before=paint.slice();undo.push(before);if(undo.length>60)undo.shift();   // one copy: the undo step is the stroke's start
      stroke={v:v,last:p,before:before,id:e.pointerId,fr:fr,phase:phase};
      dab(p[0],p[1],v);draw();state()});
    cv.addEventListener('pointermove',function(e){if(e.pointerType==='mouse')hover(e);
      if(!(e.pointerId in pts)||two)return;
      if(!stroke||stroke.id!==e.pointerId||stroke.fr!==fr||phase!=='paint')return;
      var ev=e.getCoalescedEvents?e.getCoalescedEvents():[e];if(!ev.length)ev=[e];
      ev.forEach(function(c){var p=at_(c);if(p[0]===stroke.last[0]&&p[1]===stroke.last[1])return;
        line(stroke.last,p,stroke.v);stroke.last=p});
      draw();state()});
    function same(a,b){for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true}
    function up(e){if(!(e.pointerId in pts))return;delete pts[e.pointerId];
      if(two){if(!Object.keys(pts).length)two=false;return}
      if(stroke&&stroke.id===e.pointerId)endStroke(e.type!=='pointercancel'&&stroke.fr===fr&&phase==='paint')}
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
    cv.addEventListener('contextmenu',function(e){e.preventDefault()});
    // the brush's outline under a mouse
    var last=null;
    function hover(e){last=e;moveCur()}
    function moveCur(){if(!fr||!last||phase!=='paint'){cur.style.display='none';return}var p=at_(last),h=brush>>1;
      if(p[0]<0||p[1]<0||p[0]>=fr.w||p[1]>=fr.h){cur.style.display='none';return}
      cur.style.display='block';cur.style.left=((p[0]-h)*S)+'px';cur.style.top=((p[1]-h)*S)+'px';cur.style.width=cur.style.height=(brush*S)+'px'}
    cv.addEventListener('pointerleave',function(){last=null;cur.style.display='none'});

    // Check, then Next; after the last frame the round's total
    function check(){settle();phase='checked';raw=false;var cut=0,left=0,found=0;
      for(var i=0;i<fr.opq.length;i++){if(paint[i]){if(fr.key[i])found++;else cut++}else if(fr.key[i])left++}
      scores.push({title:fr.title,found:found,ns:fr.ns,cut:cut,nc:fr.no-fr.ns});
      res.innerHTML='';
      // one line: the share of the shadow found, the character's pixels cut; under it the colours
      var a=el('p','sg-score');
      a.appendChild(el('span','sg-found',bdT('Shadow found: {p}%',{p:pct(found,fr.ns)})));
      a.appendChild(el('span','sg-cutline',bdN(cut,'Character cut: {n} pixel','Character cut: {n} pixels')));
      var b=el('p','sg-key');
      b.appendChild(el('span','sg-k ok',bdT('shadow found')));
      b.appendChild(el('span','sg-k cut',bdT('character cut')));
      b.appendChild(el('span','sg-k left',bdT('shadow left')));
      res.appendChild(a);res.appendChild(b);
      msg.textContent='';hint.hidden=true;
      bGo.textContent=at+1<round.length?bdT('Next frame'):bdT('See the round');
      box.dataset.cut=cut;box.dataset.left=left;box.dataset.found=found;
      cur.style.display='none';draw();setPressed();state()}
    function summary(){phase='summary';fr=null;wrap.hidden=true;res.textContent='';
      // judged on the share of the shadow found, the share of the character kept (all its pixels) and the share of the
      // paint that landed on shadow
      var F=0,S=0,C=0,K=0;scores.forEach(function(s){F+=s.found;S+=s.ns;C+=s.cut;K+=s.nc});
      var fp=S?F/S:1,kp=K?(K-C)/K:1,pp=F+C?F/(F+C):1;
      sum.innerHTML='';sum.hidden=false;
      var t1=el('p','sg-total',bdT('Shadow found: {p}%',{p:pct(F,S,true)}));
      var t2=el('p','sg-total sg-cutline',bdN(C,'Character cut: {n} pixel','Character cut: {n} pixels'));
      sum.appendChild(t1);sum.appendChild(t2);
      var ol=el('ol','sg-list');scores.forEach(function(s){var li=el('li');li.appendChild(el('span','',s.title));
        li.appendChild(el('i'));
        li.appendChild(el('b','',bdT('{p}% found, {cut} cut',{p:pct(s.found,s.ns),cut:s.cut})));ol.appendChild(li)});
      sum.appendChild(ol);
      var line_=F===S&&C===0?bdT('Every pixel. It took us sixteen versions of the method to get there.'):
        fp>=.95&&kp<.5?bdT('All the shadow, and most of the character with it. Nice try.'):
        fp>=.97&&pp>=.99?bdT('Sharp eyes. The last few pixels are the hard ones, ask us.'):
        fp>=.95&&C>0?bdT('All the shadow, and pieces of the character with it. Brutal Diablo\'s old cut did that too.'):
        fp>=.85&&pp>=.85?bdT('Not bad at all. Black is black, until it isn\'t.'):
        bdT('Black armour, black outlines, black shadow. Now you know why this was hard.');
      sum.appendChild(el('p','sg-line',line_));
      if(pool==='hell'){var dp=el('p','sg-discord'),da=el('a','',bdT('Post your Hell score on our Discord.'));da.href=DISCORD;dp.appendChild(da);sum.appendChild(dp)}
      var acts=el('div','sg-again'),again=btn('btn primary',bdT('Play again'));acts.appendChild(again);
      again.addEventListener('click',function(){start(pool);keepFocus()});
      if(pool!=='hell'){var h=btn('btn',bdT('Try Hell'));acts.appendChild(h);h.addEventListener('click',function(){start('hell');keepFocus()})}
      sum.appendChild(acts);count.textContent=bdT('Round done');where.textContent=NAMES[pool];about.textContent=ABOUT[pool];wink=false;
      stage.classList.add('done');say(bdT('Round done')+'. '+t1.textContent+'. '+t2.textContent);
      state();setPressed();again.focus({preventScroll:true})}
    // a button that goes away when pressed (Try again, Play again, Try Hell) leaves the focus on the loading line, then
    // on the frame's heading once the frame arrives (the hidden live region reads the frame out)
    var refocus=false;
    function keepFocus(){if(phase==='load'){refocus=true;msg.focus({preventScroll:true})}else head.focus({preventScroll:true})}
    bGo.addEventListener('click',function(){if(phase==='paint')check();else if(phase==='checked'){if(at+1<round.length)show(at+1);else summary()}});

    // the tools
    POOLS.forEach(function(p){chipsD[p].addEventListener('click',function(){start(p)})});
    function doUndo(){settle();if(phase!=='paint'||!undo.length)return;paint=undo.pop();draw();state()}
    bUndo.addEventListener('click',doUndo);
    bBrush.addEventListener('click',function(){brush=brush===1?3:1;brushChosen=true;brushIcon();moveCur();state()});
    var held=null;
    bRaw.addEventListener('pointerdown',function(e){if(bRaw.disabled)return;try{bRaw.setPointerCapture(e.pointerId)}catch(_){}
      held={t:Date.now(),was:raw};raw=true;draw();setPressed()});
    function release(){if(!held)return;var h=held;held=null;if(Date.now()-h.t>350)raw=h.was;else raw=!h.was;draw();setPressed()}
    bRaw.addEventListener('pointerup',release);bRaw.addEventListener('pointercancel',release);
    bRaw.addEventListener('pointerleave',function(){if(held&&Date.now()-held.t>350)release()});
    bRaw.addEventListener('click',function(e){if(e.detail!==0)return;raw=!raw;draw();setPressed()});
    // the Z key: by the letter it types (QWERTY, QWERTZ, AZERTY), or by its place when it types no Latin letter
    // (a Cyrillic layout)
    function isZ(e){var k=e.key||'';if(k.length!==1)return false;if(k==='z'||k==='Z')return true;
      // a character beyond Latin (Latin and Latin Extended end at U+024F; Cyrillic, Greek, Hebrew, Arabic, Thai...):
      // the key in Z's place
      return k.charCodeAt(0)>0x24F&&e.code==='KeyZ'}
    // Ctrl/Cmd+Z undoes while a frame is being painted and the game is on screen (not while typing somewhere else)
    var inView=false;
    if('IntersectionObserver' in window)new IntersectionObserver(function(es){inView=es[es.length-1].isIntersecting},{threshold:.15}).observe(box);
    else inView=true;
    document.addEventListener('keydown',function(e){if(!(e.ctrlKey||e.metaKey)||e.shiftKey||e.altKey||!isZ(e))return;
      var t=document.activeElement;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable)&&t.type!=='range')return;
      if(phase==='paint'&&inView&&(undo.length||stroke)){e.preventDefault();doUndo()}});
    var rt=null;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(layout,80)});

    box.addEventListener('pointerdown',acted,true);box.addEventListener('keydown',acted,true);
    box.innerHTML='';box.appendChild(ui);box.classList.add('on');brushIcon();setPressed();state();
    about.textContent=ABOUT[pool];
    var begun=false,begin=function(){if(!begun){begun=true;start(pool)}};
    if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting})){io.disconnect();begin()}},{rootMargin:'400px 0px'});io.observe(fig)}
    else begin();
  }

  function boot(){
    var figs=document.querySelectorAll('figure.game');if(!figs.length)return;
    var base=figs[0].getAttribute('data-base')||(me&&me.src?me.src.replace(/[^\/]*$/,''):'');
    var css=base+'game.css',have=[].some.call(document.querySelectorAll('link[rel=stylesheet]'),function(l){return l.href===new URL(css,location.href).href});
    var run=function(){[].forEach.call(figs,function(f){Game(f)})};
    if(have){run();return}
    var l=document.createElement('link');l.rel='stylesheet';l.href=css;var done=false,once=function(){if(!done){done=true;run()}};
    l.onload=once;l.onerror=once;setTimeout(once,2500);document.head.appendChild(l);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
