(function(){
  "use strict";

  var DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  var SECTION_LABEL = {
    morning:'🌅 Morning Questline', missions:"☀️ Today's Missions", baby:'👶 Baby Board',
    weather:'🌦 Weather Bonus', side:'⚔️ Side Quests', evening:'🌙 Evening Questline'
  };
  var SECTION_ORDER = ['morning','baby','missions','weather','side','evening'];
  var SIDE_QUEST_CAP = 3;
  var BOSS_FEATURE_INTERVAL = 10; // days between a boss battle being re-featured

  var CAT_COLORS = {
    'Family':          {bg:'#b93131'},
    'Food':            {bg:'#b97031'},
    'Home':            {bg:'#b9ae31', ink:'#241627'},
    'Growth':          {bg:'#85b931', ink:'#241627'},
    'Pets':            {bg:'#46b931', ink:'#241627'},
    'Finance':         {bg:'#31b95b'},
    'Weather dependent':{bg:'#31b999', ink:'#241627'},
    'Errands':         {bg:'#3199b9'},
    'Baby Care':       {bg:'#315bb9'},
    'Social':          {bg:'#4631b9'},
    'Personal Care':   {bg:'#8531b9'},
    'Relationship':    {bg:'#b931ae'},
    'Fun':             {bg:'#b93170'}
  };

  var state = { person: null, date: new Date(), weather: 'any', view: 'today' };
  state.date.setHours(0,0,0,0);

  var TASKS = [];

  function isoDate(d){ return d.toISOString().slice(0,10); }
  function loadJSON(key, fallback){ try{ var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
  function saveJSON(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }

  var completions = loadJSON('qb_completions', {});
  var delegations = loadJSON('qb_delegations', {});
  var lastShown   = loadJSON('qb_lastshown', {});
  var extras      = loadJSON('qb_extras', {});
  var bossShown   = loadJSON('qb_bossshown', {});     // date -> boss task id featured that day
  var bossDone    = loadJSON('qb_bossdone', {});       // taskId -> isoDate last completed/skipped (for rotation)

  function persistAll(){
    saveJSON('qb_completions', completions);
    saveJSON('qb_delegations', delegations);
    saveJSON('qb_lastshown', lastShown);
    saveJSON('qb_extras', extras);
    saveJSON('qb_bossshown', bossShown);
    saveJSON('qb_bossdone', bossDone);
  }

  function dayMatches(when, date){
    if(!when) return true;
    var w = when.toLowerCase().trim();
    var dow = date.getDay();
    if(w === 'every day' || w === 'weather dependent') return true;
    if(w === 'weekdays') return dow>=1 && dow<=5;
    if(w === 'weekends') return dow===0 || dow===6;
    if(w.indexOf('first ') === 0){
      for(var i=0;i<7;i++){ if(w.indexOf(DAY_NAMES[i])!==-1) return dow===i && date.getDate()<=7; }
      return false;
    }
    for(var j=0;j<7;j++){ if(w.indexOf(DAY_NAMES[j])!==-1) return dow===j; }
    return null;
  }

  function weatherMatches(taskWeather, current){
    if(!taskWeather) return true;
    var t = taskWeather.toLowerCase();
    if(t === 'any') return true;
    if(current === 'any') return false;
    if(t.indexOf('hot') !== -1) return current === 'hot';
    if(t.indexOf('cold') !== -1) return current === 'cold';
    if(t.indexOf('rain') !== -1) return current === 'rainy';
    if(t.indexOf('snow') !== -1) return current === 'snowy';
    return true;
  }

  function intervalDays(task){
    var w = (task.when||'').toLowerCase(), f = (task.freq||'').toLowerCase();
    var m = w.match(/every (\d+) day/); if(m) return parseInt(m[1],10);
    if(f.indexOf('daily')!==-1) return 1;
    if(f.indexOf('every 2 weeks')!==-1) return 14;
    if(f.indexOf('every x weeks')!==-1) return 14;
    if(f.indexOf('weekly')!==-1) return 7;
    if(f.indexOf('every x months')!==-1) return 60;
    if(f.indexOf('monthly')!==-1) return 30;
    if(f.indexOf('yearly')!==-1) return 365;
    return 7;
  }

  function ownerVisible(task, person){
    return task.owner === 'Both' || task.owner.toLowerCase() === person;
  }

  function delegationKey(task){ return isoDate(state.date) + '|' + task.id; }
  function delegatedTo(task){ return delegations[delegationKey(task)] || null; }
  function otherPerson(p){ return p === 'sarah' ? 'aaron' : 'sarah'; }
  function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

  function effectiveOwner(task){
    var d = delegatedTo(task);
    if(d) return d;
    return task.owner === 'Both' ? 'both' : task.owner.toLowerCase();
  }

  // ---- build today's task list for the current viewer ----
  function buildToday(){
    var dISO = isoDate(state.date);
    var person = state.person;
    var buckets = {}; SECTION_ORDER.forEach(function(s){ buckets[s] = []; });
    var rotationCandidates = [];

    TASKS.forEach(function(task){
      if(task.section === 'boss') return; // handled separately (featured card + task bank)
      var homeIsMineOrShared = task.owner === 'Both' || task.owner.toLowerCase() === person;
      var eff = effectiveOwner(task);
      var visibleToMe = homeIsMineOrShared || eff === person;
      if(!visibleToMe) return;

      var dm = dayMatches(task.when, state.date);
      var wOk = weatherMatches(task.weather, state.weather);

      if(task.section === 'weather'){
        if(!wOk) return;
        buckets.weather.push(task);
        return;
      }
      if(!wOk) return;

      if(dm === true){
        buckets[task.section] && buckets[task.section].push(task);
      } else if(dm === null){
        if(task.section === 'side' || /every \d+ day/.test((task.when||'').toLowerCase())){
          rotationCandidates.push(task);
        }
      }
    });

    var bySection = {};
    rotationCandidates.forEach(function(t){ (bySection[t.section] = bySection[t.section]||[]).push(t); });
    Object.keys(bySection).forEach(function(sec){
      var capN = sec === 'side' ? SIDE_QUEST_CAP : 99;
      var list = bySection[sec].map(function(t){
        var last = lastShown[t.id];
        var wait = last ? (state.date - new Date(last)) / 86400000 : Infinity;
        var due = wait === Infinity || wait >= intervalDays(t);
        return {t:t, wait:wait, due:due};
      }).filter(function(x){ return x.due; })
        .sort(function(a,b){ return b.wait - a.wait; })
        .slice(0, capN);
      list.forEach(function(x){
        buckets[sec].push(x.t);
        lastShown[x.t.id] = dISO;
      });
    });

    return buckets;
  }

  // ---- grouping ----
  var GROUPS = [
    { key:'pumpkit',  section:'baby',    owner:'aaron', match:['Sterilise bottles','Wash bottles','Wash pump parts','Sterilise pump parts'], label:'Sterilise & wash feeding kit' },
    { key:'amteeth',  section:'morning', owner:'sarah', match:['Brush teeth','Floss','Mouthwash'], label:'Teeth routine' },
    { key:'amskin',   section:'morning', owner:'sarah', match:['Cleanse face','Moisturise face','Apply SPF'], label:'Morning skincare' },
    { key:'pmteeth',  section:'evening', owner:'sarah', match:['Brush teeth','Floss teeth'], label:'Teeth routine' },
    { key:'pmskin',   section:'evening', owner:'sarah', match:['Remove makeup','Cleanse face','Apply night moisturiser'], label:'Evening skincare' },
    { key:'pumping',  section:'evening', owner:'sarah', match:['Pump before bed','Prepare pump equipment'], label:'Pumping' }
  ];

  function applyGroups(list, section, person){
    var used = {};
    var out = [];
    GROUPS.filter(function(g){ return g.section===section && g.owner===person; }).forEach(function(g){
      var members = list.filter(function(t){ return g.match.indexOf(t.name)!==-1; });
      if(members.length === g.match.length){
        members.forEach(function(m){ used[m.id]=true; });
        out.push({ isGroup:true, id:'g-'+g.key, label:g.label, steps:members });
      }
    });
    list.forEach(function(t){ if(!used[t.id]) out.push(t); });

    // dynamic group: fold an active Weather Bonus list into one collapsible card
    if(section === 'weather' && out.length > 1){
      var label = '🌦 ' + cap(state.weather) + ' Day Checklist';
      return [{ isGroup:true, id:'g-weather-'+state.weather, label:label, steps: out }];
    }
    return out;
  }

  // ---- rendering helpers ----
  function iconCheck(){ return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path d="M4 8 L7 11 L12 5" stroke="var(--green-deep)" stroke-width="2.4" fill="none" stroke-linecap="square"/></svg>'; }
  function iconSwap(){ return '<svg viewBox="0 0 16 16"><path d="M2 5h9M8 2l3 3-3 3M14 11H5M8 8l-3 3 3 3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

  function catShort(cat){ return (cat||'').replace(' dependent','').trim(); }
  function catPillStyle(cat){
    var c = CAT_COLORS[cat] || {bg:'#5b5b6b'};
    var ink = c.ink || '#ffffff';
    return 'background:'+c.bg+';color:'+ink+';border-color:rgba(0,0,0,.25)';
  }

  function taskDone(task){ return !!completions[isoDate(state.date)+'|'+task.id]; }
  function toggleDone(taskId){
    var k = isoDate(state.date)+'|'+taskId;
    completions[k] = !completions[k];
    persistAll(); render();
  }

  function renderItem(task){
    var person = state.person;
    var eff = effectiveOwner(task);
    var homeIsMineOrShared = task.owner === 'Both' || task.owner.toLowerCase() === person;
    var awayHere = homeIsMineOrShared && eff !== person && eff !== 'both';
    var normalHere = (eff === person || eff === 'both');
    var incoming = normalHere && delegatedTo(task) === person;
    var canDelegate = normalHere;
    var done = taskDone(task);

    var flags = '';
    if(awayHere){ flags += '<span class="flag ' + (done?'ok':'') + '">&rarr; ' + cap(eff) + (done?' &#10003;':'') + '</span>'; }
    if(incoming){ flags += '<span class="pill from">assigned to you</span>'; }

    var delegBtn = canDelegate ? '<button class="deleg-btn'+(task.owner==='Both'?' blueish':'')+'" data-delegate="'+task.id+'" title="Hand off to '+cap(otherPerson(person))+' for today">'+iconSwap()+'</button>' : '';

    return '' +
      '<div class="item '+(done?'done ':'')+(awayHere?'away ':'')+'">' +
        '<button class="box" data-toggle="'+task.id+'" '+(awayHere?'disabled':'')+'>' + (done ? iconCheck() : '') + '</button>' +
        '<div class="mid">' +
          '<div class="txt">' + task.name + '</div>' +
          '<div class="tagsrow"><span class="pill" style="'+catPillStyle(task.cat)+'">' + catShort(task.cat) + '</span>' + flags + '</div>' +
        '</div>' +
        '<div class="item-actions">' + delegBtn + '</div>' +
      '</div>';
  }

  function renderGroup(g){
    var doneCount = g.steps.filter(taskDone).length;
    var allDone = doneCount === g.steps.length;
    var stepsHtml = g.steps.map(function(t){ return renderItem(t); }).join('');
    return '' +
      '<div class="item '+(allDone?'done ':'')+'">' +
        '<button class="box" data-togglegroup="'+g.id+'">' + (allDone ? iconCheck() : '') + '</button>' +
        '<div class="mid">' +
          '<div class="txt">' + g.label + '</div>' +
          '<div class="tagsrow"><span class="pill" style="background:#5b5b6b;color:#fff">' + doneCount + '/' + g.steps.length + ' steps</span></div>' +
          '<div class="group-steps" data-group-steps="'+g.id+'" style="display:none">' + stepsHtml + '</div>' +
        '</div>' +
        '<div class="item-actions"><button class="deleg-btn blueish" data-expand="'+g.id+'">&#8942;</button></div>' +
      '</div>';
  }

  window._groupOpen = {};

  function countLeaf(entry){ return entry.isGroup ? entry.steps.length : 1; }
  function countDone(entry){ return entry.isGroup ? entry.steps.filter(taskDone).length : (taskDone(entry)?1:0); }
  function isAwayEntry(entry, person){
    if(entry.isGroup) return false;
    var eff = effectiveOwner(entry);
    var homeIsMineOrShared = entry.owner === 'Both' || entry.owner.toLowerCase() === person;
    return homeIsMineOrShared && eff !== person && eff !== 'both';
  }

  function renderSection(sectionKey, tasksRaw){
    window._groupOpen[sectionKey] = window._groupOpen[sectionKey] || false;
    var entries = applyGroups(tasksRaw, sectionKey, state.person);
    var person = state.person;
    var countableEntries = entries.filter(function(e){ return !isAwayEntry(e, person); });
    var total = countableEntries.reduce(function(a,e){ return a+countLeaf(e); },0);
    var done = countableEntries.reduce(function(a,e){ return a+countDone(e); },0);
    var pct = total ? Math.round(done/total*100) : 0;

    var isOpen = window._groupOpen[sectionKey];
    var itemsHtml = entries.map(function(e){ return e.isGroup ? renderGroup(e) : renderItem(e); }).join('');

    return '' +
      '<div class="section '+(isOpen?'open ':'')+(entries.length?'':'empty')+'" data-section="'+sectionKey+'">' +
        '<div class="section-head" data-sectiontoggle="'+sectionKey+'">' +
          '<span class="chev">&#9656;</span>' +
          '<h2>' + SECTION_LABEL[sectionKey] + '</h2>' +
          '<span class="frac">' + done + '/' + total + '</span>' +
        '</div>' +
        '<div class="section-bar"><div class="bar-outer"><div class="bar-inner" style="width:'+pct+'%"></div></div></div>' +
        '<div class="section-items">' + (entries.length ? itemsHtml : '<p style="font-family:VT323;color:var(--chrome);font-size:1rem;padding:.4rem 0">Nothing here today.</p>') + '</div>' +
      '</div>';
  }

  // ---- featured boss battle ----
  function pickFeaturedBoss(){
    var dISO = isoDate(state.date);
    if(bossShown[dISO]) {
      var t = TASKS.filter(function(t){ return t.id === bossShown[dISO]; })[0];
      if(t) return t;
    }
    var person = state.person;
    var candidates = TASKS.filter(function(t){ return t.section==='boss' && ownerVisible(t, person); });
    candidates = candidates.map(function(t){
      var last = bossDone[t.id];
      var wait = last ? (state.date - new Date(last)) / 86400000 : Infinity;
      return {t:t, wait:wait};
    }).sort(function(a,b){ return b.wait - a.wait; });
    var chosen = candidates.length ? candidates[0].t : null;
    if(chosen) bossShown[dISO] = chosen.id;
    return chosen;
  }

  function renderBossCard(){
    var boss = pickFeaturedBoss();
    if(!boss) return '';
    return '' +
      '<div class="boss-card">' +
        '<div class="eyebrow">&#9876;&#65039; FEATURED BOSS BATTLE</div>' +
        '<div class="name">' + boss.name + '</div>' +
        '<div class="row">' +
          '<button class="fight" data-bossfight="'+boss.id+'">FIGHT TODAY</button>' +
          '<button class="skip" data-bossskip="'+boss.id+'">SKIP</button>' +
        '</div>' +
      '</div>';
  }

  function render(){
    if(!state.person) return;
    document.getElementById('whoLabel').textContent = cap(state.person);
    document.getElementById('dayName').textContent = DAY_NAMES[state.date.getDay()].toUpperCase();
    document.getElementById('dateStr').textContent = state.date.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    document.getElementById('weatherSelect').value = state.weather;

    var buckets = buildToday();
    var html = SECTION_ORDER.map(function(sec){ return renderSection(sec, buckets[sec]); }).join('');
    document.getElementById('view-today').innerHTML = html + renderExtras() + renderBossCard();

    var totalAll=0, doneAll=0;
    SECTION_ORDER.forEach(function(sec){
      var entries = applyGroups(buckets[sec], sec, state.person).filter(function(e){ return !isAwayEntry(e, state.person); });
      entries.forEach(function(e){ totalAll += countLeaf(e); doneAll += countDone(e); });
    });
    var extraList = extras[isoDate(state.date)] || [];
    extraList.forEach(function(ex){ totalAll+=1; if(ex.done) doneAll+=1; });

    document.getElementById('xpText').textContent = doneAll + ' / ' + totalAll;
    document.getElementById('xpBar').style.width = (totalAll? Math.round(doneAll/totalAll*100):0) + '%';

    persistAll();
    renderBank();
  }

  function renderExtras(){
    var dISO = isoDate(state.date);
    var list = extras[dISO] || [];
    var rows = list.map(function(ex, idx){
      return '<div class="item '+(ex.done?'done':'')+'">' +
        '<button class="box" data-toggleextra="'+idx+'">' + (ex.done?iconCheck():'') + '</button>' +
        '<div class="mid"><div class="txt">' + ex.name + '</div><div class="tagsrow"><span class="pill" style="background:#5b5b6b;color:#fff">Extras</span></div></div>' +
      '</div>';
    }).join('');
    return '' +
      '<div class="section open" data-section="extras">' +
        '<div class="section-head"><span class="chev" style="transform:rotate(90deg)">&#9656;</span><h2>&#9998; Today\'s Extras</h2><span class="frac">'+list.filter(function(e){return e.done;}).length+'/'+list.length+'</span></div>' +
        '<div class="section-items" style="display:block">' +
          (rows || '<p style="font-family:VT323;color:var(--chrome);font-size:1rem;padding:.4rem 0 .6rem">Nothing added yet.</p>') +
          '<div class="bank-row"><input id="oneOffInput" placeholder="Add a one-off task for today..." /><button id="oneOffAdd">ADD</button></div>' +
        '</div>' +
      '</div>';
  }

  function renderBank(){
    var person = state.person;
    var boss = TASKS.filter(function(t){ return t.section==='boss' && ownerVisible(t, person); });
    var asNeeded = TASKS.filter(function(t){
      if(t.section==='boss') return false;
      if(!ownerVisible(t, person)) return false;
      return dayMatches(t.when, state.date) === null && t.section !== 'side' && !/every \d+ day/.test((t.when||'').toLowerCase());
    });
    function rows(list){
      return list.map(function(t){
        return '<div class="pull-row"><span class="txt">' + t.name + ' <span style="opacity:.6">('+catShort(t.cat)+')</span></span>' +
          '<button data-pull="'+t.id+'">+ ADD TODAY</button></div>';
      }).join('');
    }
    document.getElementById('view-bank').innerHTML =
      '<div class="section open"><div class="section-head"><span class="chev" style="transform:rotate(90deg)">&#9656;</span><h2>&#9876;&#65039; Boss Battles</h2><span class="frac">'+boss.length+'</span></div>' +
      '<div class="section-items" style="display:block"><p style="font-family:VT323;color:var(--chrome);font-size:1rem;margin:.2rem 0 .5rem">Big one-off projects. One gets featured on Today automatically every so often &mdash; or browse and pull one in yourself.</p>' + rows(boss) + '</div></div>' +
      '<div class="section open"><div class="section-head"><span class="chev" style="transform:rotate(90deg)">&#9656;</span><h2>&#128188; As-needed Tasks</h2><span class="frac">'+asNeeded.length+'</span></div>' +
      '<div class="section-items" style="display:block"><p style="font-family:VT323;color:var(--chrome);font-size:1rem;margin:.2rem 0 .5rem">Things with no fixed day &mdash; pull one into today\'s Extras when it\'s actually needed.</p>' + rows(asNeeded) + '</div></div>';
  }

  // ---- events ----
  function init(){
    document.querySelectorAll('.pick-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        state.person = btn.dataset.person;
        document.getElementById('splash').style.display='none';
        document.getElementById('board').classList.add('active');
        render();
      });
    });

    document.getElementById('swapBtn').addEventListener('click', function(){
      document.getElementById('board').classList.remove('active');
      document.getElementById('splash').style.display='flex';
      state.person = null;
    });

    document.getElementById('weatherSelect').addEventListener('change', function(e){
      state.weather = e.target.value; render();
    });

    document.getElementById('nextDayBtn').addEventListener('click', function(){
      state.date = new Date(state.date.getTime() + 86400000);
      render();
    });

    document.querySelectorAll('.navitem').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.navitem').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
        document.getElementById('view-'+btn.dataset.view).classList.add('active');
      });
    });

    document.getElementById('view-today').addEventListener('click', function(e){
      var t = e.target.closest('[data-toggle]');
      if(t){ toggleDone(parseInt(t.dataset.toggle,10)); return; }

      var g = e.target.closest('[data-togglegroup]');
      if(g){
        var gid = g.dataset.togglegroup;
        var stepsEl = document.querySelector('[data-group-steps="'+gid+'"]');
        var ids = Array.prototype.map.call(stepsEl.querySelectorAll('[data-toggle]'), function(b){ return parseInt(b.dataset.toggle,10); });
        var allDone = ids.every(function(id){ return !!completions[isoDate(state.date)+'|'+id]; });
        ids.forEach(function(id){ completions[isoDate(state.date)+'|'+id] = !allDone; });
        persistAll(); render(); return;
      }

      var ex = e.target.closest('[data-expand]');
      if(ex){
        var id = ex.dataset.expand;
        var el = document.querySelector('[data-group-steps="'+id+'"]');
        el.style.display = el.style.display==='none' ? 'block' : 'none';
        return;
      }

      var d = e.target.closest('[data-delegate]');
      if(d){
        var taskId = parseInt(d.dataset.delegate,10);
        var task = TASKS.filter(function(t){ return t.id===taskId; })[0];
        delegations[delegationKey(task)] = otherPerson(state.person);
        persistAll(); render(); return;
      }

      var sh = e.target.closest('[data-sectiontoggle]');
      if(sh){
        var key = sh.dataset.sectiontoggle;
        window._groupOpen[key] = !window._groupOpen[key];
        render(); return;
      }

      var te = e.target.closest('[data-toggleextra]');
      if(te){
        var idx = parseInt(te.dataset.toggleextra,10);
        var dISO = isoDate(state.date);
        extras[dISO][idx].done = !extras[dISO][idx].done;
        persistAll(); render(); return;
      }

      var bf = e.target.closest('[data-bossfight]');
      if(bf){
        var bid = parseInt(bf.dataset.bossfight,10);
        var btask = TASKS.filter(function(t){ return t.id===bid; })[0];
        var d2 = isoDate(state.date);
        extras[d2] = extras[d2] || [];
        extras[d2].push({ name: btask.name, done:false });
        bossDone[bid] = d2;
        persistAll(); render(); return;
      }
      var bs = e.target.closest('[data-bossskip]');
      if(bs){
        var bid2 = parseInt(bs.dataset.bossskip,10);
        bossDone[bid2] = isoDate(state.date);
        delete bossShown[isoDate(state.date)];
        persistAll(); render(); return;
      }

      var addBtn = e.target.closest('#oneOffAdd');
      if(addBtn){
        var input = document.getElementById('oneOffInput');
        var val = input.value.trim();
        if(!val) return;
        var dISO2 = isoDate(state.date);
        extras[dISO2] = extras[dISO2] || [];
        extras[dISO2].push({ name: val, done:false });
        persistAll(); render();
      }
    });

    document.getElementById('view-bank').addEventListener('click', function(e){
      var p = e.target.closest('[data-pull]');
      if(!p) return;
      var id = parseInt(p.dataset.pull,10);
      var task = TASKS.filter(function(t){ return t.id===id; })[0];
      var dISO = isoDate(state.date);
      extras[dISO] = extras[dISO] || [];
      extras[dISO].push({ name: task.name, done:false });
      persistAll();
      document.querySelector('.navitem[data-view="today"]').click();
      render();
    });
  }

  fetch('tasks.json').then(function(r){ return r.json(); }).then(function(data){
    TASKS = data;
    init();
  });
})();
