/**
 * UI das abas de folha (carrossel), lista de fotos, upload de imagens e extensão em carrossel contínuo.
 */

  // ---------------- sheet tabs UI ----------------
  const sheetTabsWrap = document.getElementById('sheetTabsWrap');
  function refreshSheetTabs(){
    sheetTabsWrap.innerHTML = '';
    const tw = 54, th = Math.max(1, Math.round(54 * H / W));
    sheets.forEach((sheet, idx)=>{
      const tab = document.createElement('div');
      const contP = sheet.photos.find(p=>p.kind==='continuous');
      const isLinked = !!contP;
      const prevContP = idx>0 ? sheets[idx-1].photos.find(p=>p.kind==='continuous') : null;
      const nextContP = idx<sheets.length-1 ? sheets[idx+1].photos.find(p=>p.kind==='continuous') : null;
      const chainPrev = !!(contP && prevContP && prevContP.groupId === contP.groupId);
      const chainNext = !!(contP && nextContP && nextContP.groupId === contP.groupId);
      tab.className = 'sheetTab' + (idx===currentSheetIndex ? ' active' : '') + (isLinked ? ' linked' : '')
        + (chainNext ? ' chainNext' : '') + (chainPrev ? ' chainPrev' : '');
      const thumb = document.createElement('canvas');
      thumb.width = tw; thumb.height = th;
      const tctx = thumb.getContext('2d');
      tctx.setTransform(tw/W, 0, 0, th/H, 0, 0);
      paintSheetInto(sheet, tctx);
      tctx.setTransform(1,0,0,1,0,0);
      tab.appendChild(thumb);
      const label = document.createElement('span');
      label.textContent = String(idx+1);
      tab.appendChild(label);
      tab.addEventListener('click', ()=>switchSheet(idx));
      if(sheets.length > 1){
        const del = document.createElement('button');
        del.className = 'sheetTabDel';
        del.textContent = '✕';
        del.title = 'excluir esta folha';
        del.addEventListener('click', (ev)=>{ ev.stopPropagation(); deleteSheet(idx); });
        tab.appendChild(del);
      }
      sheetTabsWrap.appendChild(tab);
    });
    const addTab = document.createElement('button');
    addTab.className = 'sheetTabAdd';
    addTab.textContent = '+';
    addTab.title = 'nova folha';
    addTab.addEventListener('click', ()=>addBlankSheetAfterCurrent());
    sheetTabsWrap.appendChild(addTab);
  }

  function switchSheet(idx){
    currentSheetIndex = idx;
    activePhoto = null;
    selectedSticker = null;
    syncStickerSidebarSelection();
    renderAll();
  }
  function addBlankSheetAfterCurrent(){
    const s = newSheet();
    regenerateBackgroundFor(s, false);
    const insertAt = sheets.length ? currentSheetIndex + 1 : 0;
    sheets.splice(insertAt, 0, s);
    switchSheet(insertAt);
  }
  function deleteSheet(idx){
    if(sheets.length <= 1) return;
    if(!confirm('Excluir esta folha? Essa ação não pode ser desfeita.')) return;
    const [removed] = sheets.splice(idx, 1);
    removed.photos.forEach(p=>{
      if(p.kind==='continuous'){
        const g = photoGroups[p.groupId];
        if(g){ g.members = g.members.filter(m=>m!==p); if(g.members.length===0) delete photoGroups[p.groupId]; }
      }
    });
    if(currentSheetIndex >= sheets.length) currentSheetIndex = sheets.length - 1;
    else if(idx < currentSheetIndex) currentSheetIndex--;
    switchSheet(currentSheetIndex);
  }
  document.getElementById('addSheetBtn').addEventListener('click', addBlankSheetAfterCurrent);
  document.getElementById('deleteSheetBtn').addEventListener('click', ()=>deleteSheet(currentSheetIndex));

  // ---------------- photo list UI ----------------
  const photoListEl = document.getElementById('photoList');
  const cutoutControlsEl = document.getElementById('cutoutControls');
  const continuousControlsEl = document.getElementById('continuousControls');
  const bandHeightRow = document.getElementById('bandHeightRow');
  const bandHeightSlider = document.getElementById('bandHeight');

  function refreshPhotoList(){
    photoListEl.innerHTML = '';
    const allCutouts = getAllCutoutPhotos();
    allCutouts.forEach((p, i)=>{
      const row = document.createElement('div');
      row.className = 'stickerRow' + (p===activePhoto ? ' selected' : '');
      const span = document.createElement('span');
      span.textContent = `Foto Recortada ${i+1}`;
      const del = document.createElement('button');
      del.textContent = '✕';
      del.addEventListener('click', (ev)=>{ ev.stopPropagation(); removePhoto(p); });
      row.appendChild(span); row.appendChild(del);
      row.addEventListener('click', ()=>selectPhoto(p));
      photoListEl.appendChild(row);
    });
    currentSheet().photos.filter(p=>p.kind==='continuous').forEach((p)=>{
      const row = document.createElement('div');
      row.className = 'stickerRow' + (p===activePhoto ? ' selected' : '');
      const span = document.createElement('span');
      const gForLabel = photoGroups[p.groupId];
      span.textContent = `Fundo Contínuo — folha ${p.groupIndex+1}/${p.groupCount}`;
      const del = document.createElement('button');
      del.textContent = '✕';
      del.addEventListener('click', (ev)=>{ ev.stopPropagation(); removePhoto(p); });
      row.appendChild(span); row.appendChild(del);
      row.addEventListener('click', ()=>selectPhoto(p));
      photoListEl.appendChild(row);
    });
  }

  function selectPhoto(p){
    activePhoto = p;
    refreshPhotoList();
    updatePhotoControlsUI();
    renderMain();
  }
  function removePhoto(p){
    sheets.forEach(sheet => {
      sheet.photos = sheet.photos.filter(x=>x!==p);
    });
    if(p.kind==='continuous'){
      const g = photoGroups[p.groupId];
      if(g){ g.members = g.members.filter(m=>m!==p); if(g.members.length===0) delete photoGroups[p.groupId]; }
    }
    if(activePhoto===p) activePhoto = null;
    renderAll();
  }

  function updatePhotoControlsUI(){
    const p = activePhoto;
    if(!p){
      cutoutControlsEl.style.display = 'none';
      continuousControlsEl.style.display = 'none';
      return;
    }
    if(p.kind === 'cutout'){
      cutoutControlsEl.style.display = 'block';
      continuousControlsEl.style.display = 'none';
      document.getElementById('imgZoom').value = Math.round(p.imgZoom*100);
      document.getElementById('imgZoomVal').textContent = Math.round(p.imgZoom*100)+'%';
      const cutoutMode = p.cutoutMode || 'frame';
      document.getElementById('cutoutModeFrameBtn').classList.toggle('active', cutoutMode === 'frame');
      document.getElementById('cutoutModeAlphaBtn').classList.toggle('active', cutoutMode === 'alpha');
      document.getElementById('cutRotation').value = p.rotation;
      document.getElementById('rotVal').textContent = p.rotation + '°';
      const scalePct = Math.round(p.scale*100);
      document.getElementById('cutScale').value = scalePct;
      document.getElementById('scaleVal').textContent = scalePct + '%';
    } else {
      cutoutControlsEl.style.display = 'none';
      continuousControlsEl.style.display = 'block';
      const g = photoGroups[p.groupId];
      if(g){
        document.getElementById('imgZoomCont').value = Math.round(g.zoom*100);
        document.getElementById('imgZoomValCont').textContent = Math.round(g.zoom*100)+'%';
        bandHeightRow.style.display = g.style==='overlay' ? 'block' : 'none';
        if(g.style==='overlay'){
          const pct = Math.round((g.bandFrac||0.55)*100);
          bandHeightSlider.value = pct;
          document.getElementById('bandHeightVal').textContent = pct+'%';
        }
      }
    }
  }

  // ---------------- upload ----------------
  const fileInput = document.getElementById('fileInput');
  const uploadTriggerBtn = document.getElementById('uploadTrigger');
  document.getElementById('uploadTrigger').addEventListener('click', ()=>fileInput.click());

  let heic2anyLoadPromise = null;
  function ensureHeic2any(){
    if(window.heic2any) return Promise.resolve();
    if(!heic2anyLoadPromise){
      heic2anyLoadPromise = new Promise((resolve, reject)=>{
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
        s.onload = ()=> resolve();
        s.onerror = ()=> reject(new Error('não deu pra carregar o conversor de HEIC'));
        document.head.appendChild(s);
      });
    }
    return heic2anyLoadPromise;
  }
  function isHeicFile(file){
    const name = (file.name||'').toLowerCase();
    const type = (file.type||'').toLowerCase();
    return name.endsWith('.heic') || name.endsWith('.heif') || type==='image/heic' || type==='image/heif';
  }
  function loadImageFromBlob(blob){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = (ev)=>{
        const img = new Image();
        img.onload = ()=> resolve(img);
        img.onerror = ()=> reject(new Error('não deu pra abrir essa imagem'));
        img.src = ev.target.result;
      };
      reader.onerror = ()=> reject(new Error('não deu pra ler o arquivo'));
      reader.readAsDataURL(blob);
    });
  }
  function setUploadBusy(busy, label){
    uploadTriggerBtn.disabled = busy;
    uploadTriggerBtn.textContent = busy ? (label || 'convertendo...') : '+ enviar foto';
  }
  fileInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const afterImageReady = (img)=>{
      const sheet = currentSheet();
      const cutouts = getAllCutoutPhotos();
      const n = cutouts.length;
      
      const globalX = currentSheetIndex * W + W/2 + (n%3 - 1) * 34;

      const p = {
        id: photoIdCounter++,
        kind: 'cutout',
        sourceImg: img,
        photoCanvas: null,
        previewCanvas: null,
        photoShapeSeed: Math.floor(Math.random()*999999),
        cutoutMode: 'frame',
        x: globalX,
        y: H*0.42 + (n%3) * 26,
        rotation: -4,
        scale: 1.0,
        baseW: 532, baseH: 652,
        imgZoom: 1, imgOffsetX: 0, imgOffsetY: 0
      };
      sheet.photos.push(p);
      activePhoto = p;
      processCutoutPhoto(p);
      renderAll();
    };
    if(isHeicFile(file)){
      setUploadBusy(true, 'convertendo HEIC...');
      ensureHeic2any()
        .then(()=> window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 }))
        .then((result)=>{
          const outBlob = Array.isArray(result) ? result[0] : result;
          return loadImageFromBlob(outBlob);
        })
        .then((img)=>{ setUploadBusy(false); afterImageReady(img); })
        .catch((err)=>{
          setUploadBusy(false);
          alert('Não consegui converter essa foto HEIC. Tenta exportar como JPEG antes de enviar.');
          console.error(err);
        });
      return;
    }
    loadImageFromBlob(file).then(afterImageReady).catch((err)=>{
      alert('Não consegui abrir essa imagem.');
      console.error(err);
    });
    fileInput.value = '';
  });

  document.getElementById('reseedShapeBtn').addEventListener('click', ()=>{
    if(!activePhoto || activePhoto.kind!=='cutout') return;
    activePhoto.photoShapeSeed = Math.floor(Math.random()*999999);
    processCutoutPhoto(activePhoto);
    renderAll();
  });

  const cutoutModeFrameBtn = document.getElementById('cutoutModeFrameBtn');
  const cutoutModeAlphaBtn = document.getElementById('cutoutModeAlphaBtn');
  function setCutoutMode(mode){
    if(!activePhoto || activePhoto.kind!=='cutout') return;
    activePhoto.cutoutMode = mode;
    cutoutModeFrameBtn.classList.toggle('active', mode === 'frame');
    cutoutModeAlphaBtn.classList.toggle('active', mode === 'alpha');
    processCutoutPhoto(activePhoto);
    renderAll();
  }
  cutoutModeFrameBtn.addEventListener('click', ()=>setCutoutMode('frame'));
  cutoutModeAlphaBtn.addEventListener('click', ()=>setCutoutMode('alpha'));
  document.getElementById('centerPhotoBtn').addEventListener('click', ()=>{
    if(!activePhoto || activePhoto.kind!=='cutout') return;
    activePhoto.x = currentSheetIndex * W + W/2; 
    activePhoto.y = H*0.42; 
    renderMain();
    if(muralMode) renderMural();
  });
  document.getElementById('centerContentBtn').addEventListener('click', ()=>{
    if(!activePhoto || activePhoto.kind!=='cutout') return;
    activePhoto.imgOffsetX = 0; activePhoto.imgOffsetY = 0;
    processCutoutPhoto(activePhoto);
    renderAll();
  });
  document.getElementById('centerContentContBtn').addEventListener('click', ()=>{
    if(!activePhoto || activePhoto.kind!=='continuous') return;
    const g = photoGroups[activePhoto.groupId];
    if(!g) return;
    g.offsetX = 0; g.offsetY = 0;
    reprocessGroup(g);
    renderAll();
  });
  document.getElementById('shuffleBgBtn').addEventListener('click', ()=>{
    regenerateBackgroundFor(currentSheet(), true); renderAll();
  });

  const modeFrameBtn = document.getElementById('modeFrameBtn');
  const modeContentBtn = document.getElementById('modeContentBtn');
  modeFrameBtn.addEventListener('click', ()=>{
    moveMode='frame'; modeFrameBtn.classList.add('active'); modeContentBtn.classList.remove('active');
  });
  modeContentBtn.addEventListener('click', ()=>{
    moveMode='content'; modeContentBtn.classList.add('active'); modeFrameBtn.classList.remove('active');
  });

  document.getElementById('imgZoom').addEventListener('input', (e)=>{
    if(!activePhoto || activePhoto.kind!=='cutout') return;
    activePhoto.imgZoom = parseFloat(e.target.value)/100;
    document.getElementById('imgZoomVal').textContent = e.target.value+'%';
    activePhoto.previewCanvas = buildQuickFrameFor(activePhoto);
    renderMain();
  });
  document.getElementById('imgZoom').addEventListener('change', ()=>{
    if(!activePhoto || activePhoto.kind!=='cutout') return;
    processCutoutPhoto(activePhoto);
    renderAll();
  });

  document.getElementById('imgZoomCont').addEventListener('input', (e)=>{
    if(!activePhoto || activePhoto.kind!=='continuous') return;
    const g = photoGroups[activePhoto.groupId]; if(!g) return;
    g.zoom = parseFloat(e.target.value)/100;
    document.getElementById('imgZoomValCont').textContent = e.target.value+'%';
    processContinuousMember(activePhoto);
    renderMain();
  });
  document.getElementById('imgZoomCont').addEventListener('change', ()=>{
    if(!activePhoto || activePhoto.kind!=='continuous') return;
    const g = photoGroups[activePhoto.groupId]; if(!g) return;
    reprocessGroup(g);
    renderAll();
  });
  bandHeightSlider.addEventListener('input', (e)=>{
    if(!activePhoto || activePhoto.kind!=='continuous') return;
    const g = photoGroups[activePhoto.groupId]; if(!g || g.style!=='overlay') return;
    g.bandFrac = parseFloat(e.target.value)/100;
    document.getElementById('bandHeightVal').textContent = e.target.value+'%';
    reprocessGroup(g);
    renderMain();
  });
  bandHeightSlider.addEventListener('change', ()=>{ refreshSheetTabs(); });

  // ---------------- carrossel contínuo ----------------
  let carouselStyle = 'full';
  const carouselStyleFullBtn = document.getElementById('carouselStyleFullBtn');
  const carouselStyleOverlayBtn = document.getElementById('carouselStyleOverlayBtn');
  carouselStyleFullBtn.addEventListener('click', ()=>{
    carouselStyle = 'full';
    carouselStyleFullBtn.classList.add('active');
    carouselStyleOverlayBtn.classList.remove('active');
  });
  carouselStyleOverlayBtn.addEventListener('click', ()=>{
    carouselStyle = 'overlay';
    carouselStyleOverlayBtn.classList.add('active');
    carouselStyleFullBtn.classList.remove('active');
  });
  document.getElementById('extendCarouselBtn').addEventListener('click', ()=>{
    if(!activePhoto || activePhoto.kind!=='cutout' || !activePhoto.sourceImg){
      alert('Selecione primeiro uma foto (recorte) na lista "Fotos desta folha".');
      return;
    }
    const n = Math.max(2, Math.min(6, parseInt(document.getElementById('carouselCount').value)||3));
    extendToCarousel(activePhoto, n);
  });
  function extendToCarousel(p, n){
    const sheet = currentSheet();
    const startIdx = currentSheetIndex;
    const groupId = 'g' + (groupIdCounter++);
    const group = {
      sourceImg: p.sourceImg, count: n, zoom: 1, offsetX: 0, offsetY: 0, members: [],
      style: carouselStyle, bandFrac: 0.55, bandSeed: Math.floor(Math.random()*999999)
    };
    photoGroups[groupId] = group;

    sheet.photos = sheet.photos.filter(x=>x!==p);
    const first = { id: photoIdCounter++, kind:'continuous', groupId, groupIndex:0, groupCount:n, photoCanvas:null };
    sheet.photos.push(first);
    group.members.push(first);

    for(let i=1;i<n;i++){
      const s = newSheet();
      const mem = { id: photoIdCounter++, kind:'continuous', groupId, groupIndex:i, groupCount:n, photoCanvas:null };
      s.photos.push(mem);
      group.members.push(mem);
      sheets.splice(startIdx+i, 0, s);
    }
    reprocessGroup(group);
    currentSheetIndex = startIdx;
    activePhoto = first;
    renderAll();
  }

