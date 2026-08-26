/**
 * Controles de tamanho/proporção da moldura, sliders genéricos, UI de frases (stickers) e UI do giz.
 */

  // ---------------- frame size / aspect ----------------
  const frameWSlider = document.getElementById('frameW');
  const frameHSlider = document.getElementById('frameH');
  function updateFrameFromSliders(){
    frame.w = parseInt(frameWSlider.value);
    frame.h = parseInt(frameHSlider.value);
    document.getElementById('frameWVal').textContent = frame.w;
    document.getElementById('frameHVal').textContent = frame.h;
    reprocessCutoutPhotosOfSheet(currentSheet());
    renderMain();
  }
  frameWSlider.addEventListener('input', updateFrameFromSliders);
  frameHSlider.addEventListener('input', updateFrameFromSliders);
  frameWSlider.addEventListener('change', ()=>{ reprocessAllCutoutPhotos(); renderAll(); });
  frameHSlider.addEventListener('change', ()=>{ reprocessAllCutoutPhotos(); renderAll(); });

  document.querySelectorAll('.presetBtn[data-ratio]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.presetBtn[data-ratio]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const ratio = parseFloat(btn.dataset.ratio);
      const w = frame.w;
      const h = Math.round(w/ratio);
      frameWSlider.value = w;
      frameHSlider.value = Math.max(200, Math.min(800, h));
      updateFrameFromSliders();
      reprocessAllCutoutPhotos();
      renderAll();
    });
  });

  document.getElementById('cutRotation').addEventListener('input', (e)=>{
    if(!activePhoto || activePhoto.kind!=='cutout') return;
    activePhoto.rotation = parseFloat(e.target.value);
    document.getElementById('rotVal').textContent = activePhoto.rotation + '°';
    renderMain();
    if(muralMode) renderMural();
  });
  document.getElementById('cutScale').addEventListener('input', (e)=>{
    if(!activePhoto || activePhoto.kind!=='cutout') return;
    activePhoto.scale = parseFloat(e.target.value)/100;
    document.getElementById('scaleVal').textContent = e.target.value + '%';
    renderMain();
    if(muralMode) renderMural();
  });

  // ---------------- generic sliders ----------------
  function bindSlider(id, labelId, settingKey, transform, afterInput, afterChange){
    const el = document.getElementById(id);
    const lab = document.getElementById(labelId);
    el.addEventListener('input', ()=>{
      const raw = parseFloat(el.value);
      const val = transform ? transform(raw) : raw;
      if(settingKey) settings[settingKey] = val;
      lab.textContent = labelFormat(id, raw, val);
      if(afterInput) afterInput();
    });
    el.addEventListener('change', ()=>{ if(afterChange) afterChange(); });
  }
  function labelFormat(id, raw, val){
    if(id==='contrast') return (val).toFixed(2);
    if(id==='cutRotation') return raw + '°';
    if(id==='cutScale') return raw + '%';
    if(id==='stickerRot') return raw + '°';
    return String(raw);
  }

  bindSlider('hatchSpacing','hatchVal','hatchSpacing', v=>v,
    ()=>{ reprocessCutoutPhotosOfSheet(currentSheet()); reprocessAllContinuousGroups(); renderMain(); },
    ()=>{ reprocessAllCutoutPhotos(); renderAll(); });
  bindSlider('contrast','contrastVal','contrast', v=>v/100,
    ()=>{ reprocessCutoutPhotosOfSheet(currentSheet()); reprocessAllContinuousGroups(); renderMain(); },
    ()=>{ reprocessAllCutoutPhotos(); renderAll(); });
  bindSlider('brightness','brightVal','brightness', v=>v,
    ()=>{ reprocessCutoutPhotosOfSheet(currentSheet()); reprocessAllContinuousGroups(); renderMain(); },
    ()=>{ reprocessAllCutoutPhotos(); renderAll(); });
  bindSlider('grain','grainVal','grain', v=>v,
    ()=>{ reprocessCutoutPhotosOfSheet(currentSheet()); reprocessAllContinuousGroups(); renderMain(); },
    ()=>{ reprocessAllCutoutPhotos(); renderAll(); });
  bindSlider('fringe','fringeVal','fringe', v=>v,
    ()=>{ reprocessCutoutPhotosOfSheet(currentSheet()); reprocessAllContinuousGroups(); renderMain(); },
    ()=>{ reprocessAllCutoutPhotos(); renderAll(); });
  bindSlider('jag','jagVal','jag', v=>v,
    ()=>{ reprocessCutoutPhotosOfSheet(currentSheet()); renderMain(); },
    ()=>{ reprocessAllCutoutPhotos(); renderAll(); });
  bindSlider('bgIntensity','bgIntensityVal','bgIntensity', v=>v,
    ()=>{ regenerateBackgroundFor(currentSheet(), false); renderMain(); },
    ()=>{ regenerateAllBackgrounds(); renderAll(); });
  bindSlider('bgGrain','bgGrainVal','bgGrain', v=>v,
    ()=>{ regenerateBackgroundFor(currentSheet(), false); renderMain(); },
    ()=>{ regenerateAllBackgrounds(); renderAll(); });

  // ---------------- stickers UI ----------------
  const stickerListEl = document.getElementById('stickerList');
  const stickerRotSlider = document.getElementById('stickerRot');
  const stickerRotRow = document.getElementById('rotRowSticker');
  const stickerTextArea = document.getElementById('stickerText');
  const addStickerBtn = document.getElementById('addStickerBtn');
  const newStickerBtn = document.getElementById('newStickerBtn');
  const stickerBoxInput = document.getElementById('stickerBox');
  const stickerAlignSelect = document.getElementById('stickerAlign');

  function refreshStickerList(){
    stickerListEl.innerHTML = '';
    currentSheet().stickers.forEach(s=>{
      const row = document.createElement('div');
      row.className = 'stickerRow' + (s===selectedSticker ? ' selected' : '');
      const span = document.createElement('span');
      span.textContent = s.text.replace(/\n/g, ' / ');
      const del = document.createElement('button');
      del.textContent = '✕';
      del.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const sheet = currentSheet();
        sheet.stickers = sheet.stickers.filter(x=>x!==s);
        if(selectedSticker===s) selectSticker(null);
        refreshStickerList(); renderMain();
      });
      row.appendChild(span); row.appendChild(del);
      row.addEventListener('click', ()=>{
        selectSticker(selectedSticker===s ? null : s);
      });
      stickerListEl.appendChild(row);
    });
  }
  function syncStickerSidebarSelection(){ refreshStickerList(); }
  function selectSticker(s){
    selectedSticker = s;
    refreshStickerList();
    if(s){
      stickerRotRow.style.display='flex';
      stickerRotSlider.style.display='block';
      stickerRotSlider.value = s.rot;
      document.getElementById('stickerRotVal').textContent = Math.round(s.rot)+'°';
      currentStickerColor = s.colorIdx;
      if(s.colorIdx === -1){
        currentStickerCustomColor = s.customBg;
        stickerColorCustomInput.value = s.customBg;
        [...colorPicks.children].forEach(x=>x.classList.remove('active'));
      } else {
        [...colorPicks.children].forEach((x,i)=>x.classList.toggle('active', i===s.colorIdx));
      }
      currentFontId = s.fontId; fontSelect.value = s.fontId;
      currentUppercase = s.uppercase; document.getElementById('stickerUppercase').checked = s.uppercase;
      stickerBoxInput.checked = s.box !== false;
      stickerAlignSelect.value = s.align || 'left';
      stickerTextArea.value = s.text;
      addStickerBtn.textContent = '✓ salvar alterações';
      newStickerBtn.style.display = 'block';
    } else {
      stickerRotRow.style.display='none';
      stickerRotSlider.style.display='none';
      stickerTextArea.value = '';
      stickerBoxInput.checked = true;
      stickerAlignSelect.value = 'left';
      addStickerBtn.textContent = '+ adicionar frase';
      newStickerBtn.style.display = 'none';
    }
    renderMain();
  }
  stickerRotSlider.addEventListener('input', (e)=>{
    if(!selectedSticker) return;
    selectedSticker.rot = parseFloat(e.target.value);
    document.getElementById('stickerRotVal').textContent = e.target.value+'°';
    renderMain();
  });
  stickerBoxInput.addEventListener('change', (e)=>{
    if(!selectedSticker) return;
    selectedSticker.box = e.target.checked;
    renderMain();
  });
  stickerAlignSelect.addEventListener('change', (e)=>{
    if(!selectedSticker) return;
    selectedSticker.align = e.target.value;
    renderMain();
  });
  newStickerBtn.addEventListener('click', ()=>{ selectSticker(null); stickerTextArea.focus(); });

  addStickerBtn.addEventListener('click', ()=>{
    const text = stickerTextArea.value.replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').replace(/[ \t]+$/gm,'').trim();
    if(!text) return;
    if(selectedSticker){
      selectedSticker.text = text;
      refreshStickerList();
      renderMain();
      return;
    }
    const sheet = currentSheet();
    const rng = mulberry32(Date.now() % 100000);
    const s = {
      id: stickerIdCounter++,
      text,
      x: W*0.28 + (rng()-0.5)*120,
      y: H*0.16 + (sheet.stickers.length%5)*70,
      rot: (rng()-0.5)*10,
      colorIdx: currentStickerColor,
      customBg: currentStickerColor === -1 ? currentStickerCustomColor : undefined,
      customFg: currentStickerColor === -1 ? (luminance(currentStickerCustomColor) > 140 ? '#161311' : '#faf4e2') : undefined,
      fontId: currentFontId,
      uppercase: currentUppercase,
      box: stickerBoxInput.checked,
      align: stickerAlignSelect.value
    };
    sheet.stickers.push(s);
    selectSticker(s);
    refreshStickerList();
    renderMain();
  });

  // ---------------- giz UI ----------------
  const scribbleColors = [
    { name:'branco', hex:'#fdf9ee' },
    { name:'preto', hex:'#161311' },
    { name:'laranja', hex:'#ff5a1f' },
    { name:'ciano', hex:'#1fb8b0' },
    { name:'mostarda', hex:'#e7b84b' },
  ];
  const scribbleColorPicksEl = document.getElementById('scribbleColorPicks');
  const scribbleColorCustom = document.getElementById('scribbleColorCustom');
  scribbleColors.forEach((c,i)=>{
    const el = document.createElement('div');
    el.className = 'colorpick' + (i===0 ? ' active' : '');
    el.style.background = c.hex;
    el.title = c.name;
    el.addEventListener('click', ()=>{
      scribbleColor = c.hex;
      scribbleColorCustom.value = c.hex;
      [...scribbleColorPicksEl.children].forEach(x=>x.classList.remove('active'));
      el.classList.add('active');
    });
    scribbleColorPicksEl.appendChild(el);
  });
  scribbleColorCustom.addEventListener('input', (e)=>{
    scribbleColor = e.target.value;
    [...scribbleColorPicksEl.children].forEach(x=>x.classList.remove('active'));
  });
  document.getElementById('scribbleThick').addEventListener('input', (e)=>{
    scribbleThick = parseFloat(e.target.value);
    document.getElementById('scribbleThickVal').textContent = e.target.value;
  });
  const drawModeBtn = document.getElementById('drawModeBtn');
  drawModeBtn.addEventListener('click', ()=>{
    drawMode = !drawMode;
    drawModeBtn.classList.toggle('active', drawMode);
    drawModeBtn.textContent = drawMode ? '✎ giz ativado' : '✎ ativar giz';
    finalCanvas.classList.toggle('drawModeOn', drawMode);
    if(drawMode) selectSticker(null);
  });
  document.getElementById('undoScribbleBtn').addEventListener('click', undoScribble);
  document.getElementById('redoScribbleBtn').addEventListener('click', redoScribble);
  document.getElementById('clearScribbleBtn').addEventListener('click', ()=>{
    const sheet = currentSheet();
    sheet.scribbles = [];
    sheet.scribbleRedoStack = [];
    renderMain();
  });
  window.addEventListener('keydown', (e)=>{
    if(!(e.ctrlKey || e.metaKey)) return;
    const tag = (e.target && e.target.tagName) || '';
    if(tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT') return;
    const key = e.key.toLowerCase();
    if(key === 'z'){
      e.preventDefault();
      undoScribble();
    } else if(key === 'y'){
      e.preventDefault();
      redoScribble();
    }
  });

