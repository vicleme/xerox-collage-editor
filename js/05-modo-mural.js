/**
 * Modo mural: folhas lado a lado com rolagem contínua e arraste de fotos entre folhas.
 */

  // ---------------- modo mural ----------------
  let muralMode = false;
  let muralActiveGroupId = null;
  let muralScale = 0.3;
  let muralDragState = null;

  const muralModeBtn = document.getElementById('muralModeBtn');
  const normalStageEl = document.getElementById('normalStage');
  const muralStageEl = document.getElementById('muralStage');
  const muralUploadRowEl = document.getElementById('muralUploadRow');
  const muralGroupControlsEl = document.getElementById('muralGroupControls');
  const muralStripEl = document.getElementById('muralStrip');
  const muralFileInput = document.getElementById('muralFileInput');
  const muralUploadTriggerBtn = document.getElementById('muralUploadTrigger');

  function ensureSheetsCount(uptoIdx){
    while(sheets.length <= uptoIdx){
      const s = newSheet();
      regenerateBackgroundFor(s, false);
      sheets.push(s);
    }
  }

  function currentMuralGroupStart(group){
    const first = group.members.find(m=>m.groupIndex===0) || group.members[0];
    const idx = sheets.findIndex(s=>s.photos.includes(first));
    return idx<0 ? 0 : idx;
  }

  function rebuildMuralGroupMembers(groupId, newStart, newCount){
    const group = photoGroups[groupId];
    if(!group) return false;
    newStart = Math.max(0, newStart);
    newCount = Math.max(2, Math.min(8, newCount));
    ensureSheetsCount(newStart + newCount - 1);
    for(let i=0;i<newCount;i++){
      const foreign = sheets[newStart+i].photos.find(p=>p.kind==='continuous' && p.groupId!==groupId);
      if(foreign){
        alert('Já tem outra foto de carrossel contínuo numa das folhas desse trecho. Escolhe outra posição.');
        return false;
      }
    }
    sheets.forEach(s=>{ s.photos = s.photos.filter(p=>p.groupId!==groupId); });
    group.members = [];
    for(let i=0;i<newCount;i++){
      const mem = { id: photoIdCounter++, kind:'continuous', groupId, groupIndex:i, groupCount:newCount, photoCanvas:null };
      sheets[newStart+i].photos.push(mem);
      group.members.push(mem);
    }
    group.count = newCount;
    if(activePhoto && activePhoto.groupId===groupId) activePhoto = group.members[0];
    reprocessGroup(group);
    return true;
  }

  function createMuralGroupFromImage(img){
    const startIdx = Math.max(0, currentSheetIndex);
    const groupId = 'g' + (groupIdCounter++);
    const group = {
      sourceImg: img, count:2, zoom:1, offsetX:0, offsetY:0, members:[],
      style:'full', bandFrac:0.55, bandSeed: Math.floor(Math.random()*999999)
    };
    photoGroups[groupId] = group;
    const ok = rebuildMuralGroupMembers(groupId, startIdx, 2);
    if(!ok){ delete photoGroups[groupId]; return; }
    muralActiveGroupId = groupId;
    currentSheetIndex = startIdx;
    updateMuralControlsUI();
    renderAll();
    renderMural();
  }

  function shiftMuralGroup(dir){
    const group = photoGroups[muralActiveGroupId];
    if(!group) return;
    const start = currentMuralGroupStart(group);
    const newStart = start + dir;
    if(newStart < 0) return;
    const ok = rebuildMuralGroupMembers(muralActiveGroupId, newStart, group.count);
    if(ok) currentSheetIndex = Math.min(newStart, sheets.length-1);
    renderAll();
    renderMural();
  }
  function changeMuralSpanBy(delta){
    const group = photoGroups[muralActiveGroupId];
    if(!group) return;
    const start = currentMuralGroupStart(group);
    const newCount = Math.max(2, Math.min(8, group.count + delta));
    if(newCount === group.count) return;
    rebuildMuralGroupMembers(muralActiveGroupId, start, newCount);
    renderAll();
    renderMural();
  }

  function updateMuralControlsUI(){
    const group = muralActiveGroupId ? photoGroups[muralActiveGroupId] : null;
    if(!muralMode || !group){
      muralGroupControlsEl.style.display = 'none';
      return;
    }
    muralGroupControlsEl.style.display = 'block';
    document.getElementById('muralSpanVal').textContent = group.count;
    document.getElementById('muralZoom').value = Math.round(group.zoom*100);
    document.getElementById('muralZoomVal').textContent = Math.round(group.zoom*100)+'%';
    const isOverlay = group.style === 'overlay';
    document.getElementById('muralStyleFullBtn').classList.toggle('active', !isOverlay);
    document.getElementById('muralStyleOverlayBtn').classList.toggle('active', isOverlay);
    document.getElementById('muralBandHeightRow').style.display = isOverlay ? 'block' : 'none';
    document.getElementById('muralBandHeight').value = Math.round((group.bandFrac||0.55)*100);
    document.getElementById('muralBandHeightVal').textContent = Math.round((group.bandFrac||0.55)*100)+'%';
  }

  function muralDisplayDims(){
    const targetH = 420;
    muralScale = targetH / H;
    return { tw: Math.round(W*muralScale), th: Math.round(H*muralScale) };
  }

  function renderMural(){
    if(muralActiveGroupId && !photoGroups[muralActiveGroupId]) muralActiveGroupId = null;
    if(!muralMode) return;
    const { tw, th } = muralDisplayDims();
    muralStripEl.innerHTML = '';
    sheets.forEach((sheet, idx)=>{
      const tile = document.createElement('div');
      tile.className = 'muralTile';
      const contP = sheet.photos.find(p=>p.kind==='continuous');
      const inActive = !!(contP && contP.groupId === muralActiveGroupId);
      if(inActive) tile.classList.add('inMuralGroup');
      if(inActive && contP.groupIndex === 0) tile.classList.add('muralGroupStart');
      if(inActive && contP.groupIndex === contP.groupCount-1) tile.classList.add('muralGroupEnd');
      const cnv = document.createElement('canvas');
      cnv.width = tw; cnv.height = th;
      const tctx = cnv.getContext('2d');
      tctx.setTransform(muralScale, 0, 0, muralScale, 0, 0);
      paintSheetInto(sheet, tctx);
      tctx.setTransform(1,0,0,1,0,0);
      tile.appendChild(cnv);
      const label = document.createElement('span');
      label.className = 'muralTileLabel';
      label.textContent = String(idx+1);
      tile.appendChild(label);
      muralStripEl.appendChild(tile);
    });
    const addTile = document.createElement('div');
    addTile.className = 'muralAddTile';
    addTile.style.height = th+'px';
    addTile.style.width = Math.round(tw*0.4)+'px';
    addTile.textContent = '+';
    addTile.title = 'nova folha no fim do mural';
    addTile.addEventListener('click', ()=>{
      const s = newSheet();
      regenerateBackgroundFor(s, false);
      sheets.push(s);
      renderAll();
      renderMural();
    });
    muralStripEl.appendChild(addTile);
  }

  function setMuralMode(on){
    muralMode = on;
    muralModeBtn.classList.toggle('active', on);
    muralModeBtn.textContent = on ? '🖼 modo mural ativado' : '🖼 ativar modo mural';
    normalStageEl.style.display = on ? 'none' : 'flex';
    muralStageEl.style.display = on ? 'flex' : 'none';
    muralUploadRowEl.style.display = on ? 'block' : 'none';
    if(on) renderMural();
    updateMuralControlsUI();
  }
  muralModeBtn.addEventListener('click', ()=> setMuralMode(!muralMode));

  function muralPoint(e){
    const rect = muralStripEl.getBoundingClientRect();
    const cx = (e.clientX !== undefined ? e.clientX : e.touches[0].clientX);
    const cy = (e.clientY !== undefined ? e.clientY : e.touches[0].clientY);
    return {
      x: (cx - rect.left + muralStripEl.scrollLeft) / muralScale,
      y: (cy - rect.top) / muralScale
    };
  }

  muralStripEl.addEventListener('pointerdown', (e)=>{
    const p = muralPoint(e);
    dragTarget = null;

    const cutouts = getAllCutoutPhotos();
    for(let i=cutouts.length-1; i>=0; i--){
      const ph = cutouts[i];
      const w = ph.baseW * ph.scale, h = ph.baseH * ph.scale;
      if(inRotatedBox(p.x, p.y, ph.x, ph.y, w, h, ph.rotation)){
        selectPhoto(ph);
        if(moveMode === 'frame'){
          dragTarget = { kind: 'cutoutMuralFrame', p: ph };
          dragOffset = { x: p.x - ph.x, y: p.y - ph.y };
        } else {
          dragTarget = { kind: 'photoContent', p: ph };
          dragStart = { x: p.x, y: p.y, offX: ph.imgOffsetX, offY: ph.imgOffsetY };
        }
        muralStripEl.classList.add('dragging');
        return;
      }
    }

    const sheetIdx = Math.max(0, Math.min(sheets.length-1, Math.floor(p.x / W)));
    const sheet = sheets[sheetIdx];
    if(!sheet) return;
    const contP = sheet.photos.find(ph=>ph.kind==='continuous');
    if(!contP) return;
    if(contP.groupId !== muralActiveGroupId){
      muralActiveGroupId = contP.groupId;
      updateMuralControlsUI();
      renderMural();
    }
    const group = photoGroups[muralActiveGroupId];
    if(!group) return;
    muralDragState = { group, startPX: p.x, startPY: p.y, startOffX: group.offsetX, startOffY: group.offsetY };
    muralStripEl.classList.add('dragging');
  });

  window.addEventListener('pointermove', (e)=>{
    if(dragTarget && dragTarget.kind === 'cutoutMuralFrame'){
      const p = muralPoint(e);
      dragTarget.p.x = p.x - dragOffset.x;
      dragTarget.p.y = p.y - dragOffset.y;
      renderMural();
      return;
    }

    if(!muralDragState) return;
    const p = muralPoint(e);
    const ddx = p.x - muralDragState.startPX, ddy = p.y - muralDragState.startPY;
    muralDragState.group.offsetX = muralDragState.startOffX + ddx;
    muralDragState.group.offsetY = muralDragState.startOffY + ddy;
    muralDragState.group.members.forEach(m=>{ m.previewCanvas = buildQuickContinuousPreview(m); });
    renderMural();
  });

  window.addEventListener('pointerup', ()=>{
    if(dragTarget && dragTarget.kind === 'cutoutMuralFrame'){
      dragTarget = null;
      muralStripEl.classList.remove('dragging');
      renderAll();
      renderMural();
      return;
    }

    if(!muralDragState) return;
    const group = muralDragState.group;
    muralDragState = null;
    muralStripEl.classList.remove('dragging');
    reprocessGroup(group);
    renderAll();
    renderMural();
  });

  function setMuralUploadBusy(busy, label){
    muralUploadTriggerBtn.disabled = busy;
    muralUploadTriggerBtn.textContent = busy ? (label || 'convertendo...') : '+ soltar foto de fundo no mural';
  }
  muralUploadTriggerBtn.addEventListener('click', ()=> muralFileInput.click());
  muralFileInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    if(isHeicFile(file)){
      setMuralUploadBusy(true, 'convertendo HEIC...');
      ensureHeic2any()
        .then(()=> window.heic2any({ blob:file, toType:'image/jpeg', quality:0.92 }))
        .then(result=> loadImageFromBlob(Array.isArray(result) ? result[0] : result))
        .then(img=>{ setMuralUploadBusy(false); createMuralGroupFromImage(img); })
        .catch(err=>{
          setMuralUploadBusy(false);
          alert('Não consegui converter essa foto HEIC. Tenta exportar como JPEG antes de enviar.');
          console.error(err);
        });
      muralFileInput.value = '';
      return;
    }
    loadImageFromBlob(file).then(createMuralGroupFromImage).catch(err=>{
      alert('Não consegui abrir essa imagem.');
      console.error(err);
    });
    muralFileInput.value = '';
  });

  document.getElementById('muralSpanMinus').addEventListener('click', ()=> changeMuralSpanBy(-1));
  document.getElementById('muralSpanPlus').addEventListener('click', ()=> changeMuralSpanBy(1));
  document.getElementById('muralShiftLeft').addEventListener('click', ()=> shiftMuralGroup(-1));
  document.getElementById('muralShiftRight').addEventListener('click', ()=> shiftMuralGroup(1));
  document.getElementById('muralStyleFullBtn').addEventListener('click', ()=>{
    const group = photoGroups[muralActiveGroupId]; if(!group) return;
    group.style = 'full';
    reprocessGroup(group); updateMuralControlsUI(); renderAll(); renderMural();
  });
  document.getElementById('muralStyleOverlayBtn').addEventListener('click', ()=>{
    const group = photoGroups[muralActiveGroupId]; if(!group) return;
    group.style = 'overlay';
    reprocessGroup(group); updateMuralControlsUI(); renderAll(); renderMural();
  });
  document.getElementById('muralZoom').addEventListener('input', (e)=>{
    const group = photoGroups[muralActiveGroupId]; if(!group) return;
    group.zoom = parseInt(e.target.value)/100;
    document.getElementById('muralZoomVal').textContent = e.target.value+'%';
    group.members.forEach(m=>{ m.previewCanvas = buildQuickContinuousPreview(m); });
    renderMural();
  });
  document.getElementById('muralZoom').addEventListener('change', ()=>{
    const group = photoGroups[muralActiveGroupId]; if(!group) return;
    reprocessGroup(group); renderAll(); renderMural();
  });
  document.getElementById('muralBandHeight').addEventListener('input', (e)=>{
    const group = photoGroups[muralActiveGroupId]; if(!group) return;
    group.bandFrac = parseInt(e.target.value)/100;
    document.getElementById('muralBandHeightVal').textContent = e.target.value+'%';
    group.members.forEach(m=>{ m.previewCanvas = buildQuickContinuousPreview(m); });
    renderMural();
  });
  document.getElementById('muralBandHeight').addEventListener('change', ()=>{
    const group = photoGroups[muralActiveGroupId]; if(!group) return;
    reprocessGroup(group); renderAll(); renderMural();
  });
  document.getElementById('muralCenterBtn').addEventListener('click', ()=>{
    const group = photoGroups[muralActiveGroupId]; if(!group) return;
    group.offsetX = 0; group.offsetY = 0;
    reprocessGroup(group); renderAll(); renderMural();
  });
  document.getElementById('muralRemoveBtn').addEventListener('click', ()=>{
    if(!muralActiveGroupId) return;
    const gid = muralActiveGroupId;
    sheets.forEach(s=>{ s.photos = s.photos.filter(p=>p.groupId!==gid); });
    delete photoGroups[gid];
    muralActiveGroupId = null;
    updateMuralControlsUI();
    renderAll(); renderMural();
  });

