/**
 * Setup inicial do canvas, favicon, presets de tamanho, paletas de cor, cores de frase e seleção de fontes.
 */

  let W = 1080, H = 1350;
  const finalCanvas = document.getElementById('finalCanvas');
  const ctx = finalCanvas.getContext('2d');
  const emptyState = document.getElementById('emptyState');
  const favLink = document.createElement('link');
  favLink.rel = 'icon';
  const favSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect x='1' y='1' width='38' height='38' rx='8' fill='%23ff5a1f'/><polygon points='8,10 32,7 34,20 30,32 10,31 6,18' fill='%23fdf8ef' stroke='%23161311' stroke-width='2'/><path d='M11,14 L29,26 M29,14 L11,26' stroke='%231fb8b0' stroke-width='2.6' stroke-linecap='round'/></svg>`;
  favLink.href = 'data:image/svg+xml,' + favSvg;
  document.head.appendChild(favLink);

  // ---------------- canvas size presets ----------------
  const sizePresets = [
    { name:'Quadrado', w:1080, h:1080 },
    { name:'Retrato 4:5', w:1080, h:1350 },
    { name:'Story 9:16', w:1080, h:1920 },
    { name:'Paisagem', w:1350, h:1080 },
    { name:'Wide 16:9', w:1920, h:1080 },
    { name:'A4 retrato', w:1240, h:1754 },
  ];
  const sizePresetGrid = document.getElementById('sizePresetGrid');
  sizePresets.forEach(p=>{
    const b = document.createElement('button');
    b.className = 'presetBtn' + (p.w===1080 && p.h===1350 ? ' active' : '');
    b.textContent = p.name;
    b.addEventListener('click', ()=>{
      [...sizePresetGrid.children].forEach(c=>c.classList.remove('active'));
      b.classList.add('active');
      resizeCanvas(p.w, p.h);
    });
    sizePresetGrid.appendChild(b);
  });
  document.getElementById('applyCustomSize').addEventListener('click', ()=>{
    const w = Math.max(200, Math.min(3000, parseInt(document.getElementById('customW').value)||1080));
    const h = Math.max(200, Math.min(3000, parseInt(document.getElementById('customH').value)||1350));
    [...sizePresetGrid.children].forEach(c=>c.classList.remove('active'));
    resizeCanvas(w,h);
  });

  function resizeCanvas(newW, newH){
    const sx = newW / W, sy = newH / H;
    sheets.forEach(sheet=>{
      sheet.photos.forEach(p=>{ if(p.kind==='cutout'){ p.x *= sx; p.y *= sy; } });
      sheet.stickers.forEach(s => { s.x *= sx; s.y *= sy; });
      sheet.scribbles.forEach(s => { s.dabs.forEach(d => { d.x *= sx; d.y *= sy; d.r *= (sx+sy)/2; }); });
    });
    W = newW; H = newH;
    finalCanvas.width = W; finalCanvas.height = H;
    document.getElementById('customW').value = W;
    document.getElementById('customH').value = H;
    regenerateAllBackgrounds();
    reprocessAllContinuousGroups();
    renderAll();
  }

  // ---------------- palettes ----------------
  const BUILTIN_PALETTE_COUNT = 8;
  const palettes = [
    { name:'Solar', base:'#ff5b1f', a1:'#1fb8b0', a2:'#faf4e2' },
    { name:'Uva', base:'#6c2bd9', a1:'#ff3d81', a2:'#f3e9ff' },
    { name:'Menta', base:'#0e7c6b', a1:'#ff8a3d', a2:'#fff6e3' },
    { name:'Noturno', base:'#211c2b', a1:'#ff5c8a', a2:'#e6e0d2' },
    { name:'Limão', base:'#c7d92e', a1:'#ff477e', a2:'#fff8e0' },
    { name:'Céu', base:'#2467d9', a1:'#ffb23d', a2:'#eaf3ff' },
    { name:'Terra', base:'#b5502a', a1:'#3fb5a3', a2:'#f6ead6' },
    { name:'Rosa', base:'#e94f8a', a1:'#3ad6c8', a2:'#fff0f5' },
  ];

  // paletas personalizadas ficam salvas no navegador (localStorage), sobrevivem a reload
  const CUSTOM_PALETTES_KEY = 'xerox_customPalettes_v1';
  function loadCustomPalettes(){
    try{
      const raw = localStorage.getItem(CUSTOM_PALETTES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function saveCustomPalettesToStorage(){
    try{
      localStorage.setItem(CUSTOM_PALETTES_KEY, JSON.stringify(palettes.slice(BUILTIN_PALETTE_COUNT)));
    }catch(e){ /* localStorage indisponível (modo privado, cota etc.) — ignora silenciosamente */ }
  }
  loadCustomPalettes().forEach(p=>{
    if(p && p.base && p.a1 && p.a2) palettes.push({ name: p.name || 'Personalizada', base:p.base, a1:p.a1, a2:p.a2 });
  });

  let paletteIndex = 0;
  let editingPaletteIndex = null; // null = criando nova; número = editando paleta personalizada existente
  let previewRAF = null;
  const paletteGrid = document.getElementById('paletteGrid');
  const customPaletteForm = document.getElementById('customPaletteForm');
  const customPaletteBaseInput = document.getElementById('customPaletteBase');
  const customPaletteA1Input = document.getElementById('customPaletteA1');
  const customPaletteA2Input = document.getElementById('customPaletteA2');
  const customPalettePreview = document.getElementById('customPalettePreview');
  const saveCustomPaletteBtn = document.getElementById('saveCustomPaletteBtn');
  const cancelCustomPaletteBtn = document.getElementById('cancelCustomPaletteBtn');
  const customPaletteFormHelp = document.getElementById('customPaletteFormHelp');

  function updateCustomPalettePreview(){
    customPalettePreview.style.background = `linear-gradient(135deg, ${customPaletteBaseInput.value} 0%, ${customPaletteBaseInput.value} 40%, ${customPaletteA1Input.value} 40%, ${customPaletteA1Input.value} 70%, ${customPaletteA2Input.value} 70%)`;
  }
  // aplica de imediato as 3 cores em edição como pré-visualização no canvas de verdade
  // (é isso que importa pra saber como vai ficar — o quadradinho ao lado é só um resumo rápido)
  function applyPalettePreviewNow(){
    previewPaletteOverride = {
      base: customPaletteBaseInput.value,
      a1: customPaletteA1Input.value,
      a2: customPaletteA2Input.value
    };
    regenerateAllBackgrounds();
    reprocessAllCutoutPhotos();
    reprocessAllContinuousGroups();
    renderAll();
  }
  // enquanto o usuário arrasta o seletor de cor, o evento 'input' dispara muitas vezes;
  // agrupamos numa única atualização por frame pra não travar
  function schedulePalettePreviewUpdate(){
    if(previewRAF) return;
    previewRAF = requestAnimationFrame(()=>{ previewRAF = null; applyPalettePreviewNow(); });
  }
  [customPaletteBaseInput, customPaletteA1Input, customPaletteA2Input].forEach(inp=>{
    inp.addEventListener('input', ()=>{
      updateCustomPalettePreview();
      schedulePalettePreviewUpdate();
    });
  });
  updateCustomPalettePreview();

  function closeCustomPaletteForm(){
    previewPaletteOverride = null;
    editingPaletteIndex = null;
    customPaletteForm.classList.remove('open');
    regenerateAllBackgrounds();
    reprocessAllCutoutPhotos();
    reprocessAllContinuousGroups();
    renderAll();
  }

  function openCustomPaletteForm(editIndex){
    editingPaletteIndex = editIndex;
    // ao criar uma nova, parte da paleta atualmente selecionada em vez de cores soltas
    const src = editIndex !== null ? palettes[editIndex] : palettes[paletteIndex];
    customPaletteBaseInput.value = src.base;
    customPaletteA1Input.value = src.a1;
    customPaletteA2Input.value = src.a2;
    if(editIndex !== null){
      saveCustomPaletteBtn.textContent = 'salvar alterações';
      customPaletteFormHelp.textContent = 'editando essa paleta — o canvas já mostra a prévia ao vivo. as mudanças substituem a versão salva.';
    } else {
      saveCustomPaletteBtn.textContent = 'salvar paleta';
      customPaletteFormHelp.textContent = 'base / destaque 1 / destaque 2 — o canvas já mostra a prévia ao vivo. clique em salvar quando gostar do resultado.';
    }
    updateCustomPalettePreview();
    customPaletteForm.classList.add('open');
    applyPalettePreviewNow();
  }

  function renderPaletteGrid(){
    paletteGrid.innerHTML = '';
    palettes.forEach((p,i)=>{
      const el = document.createElement('div');
      el.className = 'swatch' + (i===paletteIndex?' active':'');
      el.style.background = `linear-gradient(135deg, ${p.base} 50%, ${p.a1} 50%)`;
      el.title = p.name;
      el.addEventListener('click', ()=>{
        paletteIndex = i;
        previewPaletteOverride = null;
        editingPaletteIndex = null;
        customPaletteForm.classList.remove('open');
        [...paletteGrid.children].forEach(c=>c.classList.remove('active'));
        el.classList.add('active');
        regenerateAllBackgrounds();
        reprocessAllCutoutPhotos();
        reprocessAllContinuousGroups();
        renderAll();
      });
      if(i >= BUILTIN_PALETTE_COUNT){
        const edit = document.createElement('div');
        edit.className = 'swatch-edit';
        edit.textContent = '✎';
        edit.title = 'editar esta paleta';
        edit.addEventListener('click', (ev)=>{
          ev.stopPropagation();
          openCustomPaletteForm(i);
        });
        el.appendChild(edit);
        const del = document.createElement('div');
        del.className = 'swatch-del';
        del.textContent = '×';
        del.title = 'apagar esta paleta';
        del.addEventListener('click', (ev)=>{
          ev.stopPropagation();
          palettes.splice(i,1);
          saveCustomPalettesToStorage();
          if(paletteIndex === i) paletteIndex = 0;
          else if(paletteIndex > i) paletteIndex -= 1;
          if(editingPaletteIndex === i){ previewPaletteOverride = null; editingPaletteIndex = null; customPaletteForm.classList.remove('open'); }
          renderPaletteGrid();
          regenerateAllBackgrounds();
          reprocessAllCutoutPhotos();
          reprocessAllContinuousGroups();
          renderAll();
        });
        el.appendChild(del);
      }
      paletteGrid.appendChild(el);
    });
    const addTile = document.createElement('div');
    addTile.className = 'swatch swatch-add';
    addTile.textContent = '+';
    addTile.title = 'criar paleta personalizada';
    addTile.addEventListener('click', ()=>{
      if(customPaletteForm.classList.contains('open') && editingPaletteIndex === null){
        closeCustomPaletteForm();
      } else {
        openCustomPaletteForm(null);
      }
    });
    paletteGrid.appendChild(addTile);
  }
  renderPaletteGrid();

  cancelCustomPaletteBtn.addEventListener('click', closeCustomPaletteForm);

  saveCustomPaletteBtn.addEventListener('click', ()=>{
    const base = customPaletteBaseInput.value;
    const a1 = customPaletteA1Input.value;
    const a2 = customPaletteA2Input.value;
    if(editingPaletteIndex !== null){
      const p = palettes[editingPaletteIndex];
      p.base = base; p.a1 = a1; p.a2 = a2;
      saveCustomPalettesToStorage();
    } else {
      palettes.push({ name:'Personalizada', base, a1, a2 });
      saveCustomPalettesToStorage();
      paletteIndex = palettes.length - 1;
    }
    previewPaletteOverride = null;
    editingPaletteIndex = null;
    customPaletteForm.classList.remove('open');
    regenerateAllBackgrounds();
    reprocessAllCutoutPhotos();
    reprocessAllContinuousGroups();
    renderAll();
    renderPaletteGrid();
  });

  const BUILTIN_STICKER_COLOR_COUNT = 4;
  const stickerColors = [
    { name:'ciano', bg:'#bfe9e6', fg:'#161311' },
    { name:'mostarda', bg:'#e7b84b', fg:'#161311' },
    { name:'creme', bg:'#faf4e2', fg:'#161311' },
    { name:'preto', bg:'#1c1917', fg:'#faf4e2' },
  ];

  // cores personalizadas da caixa de texto (frases recortadas) — salvas no navegador
  const CUSTOM_STICKER_COLORS_KEY = 'xerox_customStickerColors_v1';
  function loadCustomStickerColors(){
    try{
      const raw = localStorage.getItem(CUSTOM_STICKER_COLORS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function saveCustomStickerColorsToStorage(){
    try{
      const customs = stickerColors.slice(BUILTIN_STICKER_COLOR_COUNT).map(c=>c.bg);
      localStorage.setItem(CUSTOM_STICKER_COLORS_KEY, JSON.stringify(customs));
    }catch(e){ /* localStorage indisponível — ignora silenciosamente */ }
  }
  // nota: `luminance` só é definida no script seguinte (02-utils-estado.js); como este
  // trecho roda de imediato (antes dele carregar), usamos um cálculo local equivalente
  function _luminanceLocal(hex){
    const h = hex.replace('#','');
    const n = parseInt(h,16);
    const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    return 0.299*r + 0.587*g + 0.114*b;
  }
  loadCustomStickerColors().forEach(bg=>{
    if(typeof bg === 'string') stickerColors.push({ name:'personalizada', bg, fg: _luminanceLocal(bg) > 140 ? '#161311' : '#faf4e2' });
  });

  let currentStickerColor = 0;
  let currentStickerCustomColor = '#bfe9e6';
  const colorPicks = document.getElementById('colorPicks');

  function renderColorPicks(){
    colorPicks.innerHTML = '';
    stickerColors.forEach((c,i)=>{
      const el = document.createElement('div');
      el.className='colorpick'+(i===currentStickerColor?' active':'');
      el.style.background=c.bg;
      el.addEventListener('click', ()=>{
        currentStickerColor=i;
        [...colorPicks.children].forEach(x=>x.classList.remove('active'));
        el.classList.add('active');
        if(selectedSticker){ selectedSticker.colorIdx=i; renderMain(); }
      });
      if(i >= BUILTIN_STICKER_COLOR_COUNT){
        const del = document.createElement('div');
        del.className = 'colorpick-del';
        del.textContent = '×';
        del.title = 'apagar esta cor';
        del.addEventListener('click', (ev)=>{
          ev.stopPropagation();
          stickerColors.splice(i,1);
          saveCustomStickerColorsToStorage();
          if(currentStickerColor === i) currentStickerColor = 0;
          else if(currentStickerColor > i) currentStickerColor -= 1;
          renderColorPicks();
        });
        el.appendChild(del);
      }
      colorPicks.appendChild(el);
    });
  }
  renderColorPicks();

  const stickerColorCustomInput = document.getElementById('stickerColorCustom');
  stickerColorCustomInput.addEventListener('input', (e)=>{
    currentStickerColor = -1;
    currentStickerCustomColor = e.target.value;
    [...colorPicks.children].forEach(x=>x.classList.remove('active'));
    if(selectedSticker){
      selectedSticker.colorIdx = -1;
      selectedSticker.customBg = currentStickerCustomColor;
      selectedSticker.customFg = luminance(currentStickerCustomColor) > 140 ? '#161311' : '#faf4e2';
      renderMain();
    }
  });
  document.getElementById('saveCustomStickerColorBtn').addEventListener('click', ()=>{
    const bg = currentStickerCustomColor;
    stickerColors.push({ name:'personalizada', bg, fg: luminance(bg) > 140 ? '#161311' : '#faf4e2' });
    saveCustomStickerColorsToStorage();
    currentStickerColor = stickerColors.length - 1;
    renderColorPicks();
    if(selectedSticker){ selectedSticker.colorIdx = currentStickerColor; renderMain(); }
  });

  // ---------------- fonts ----------------
  const fontOptions = [
    { id:'stamp', label:'Carimbo (padrão)', family:'"Courier New", monospace', weight:900, size:34, upper:true },
    { id:'kalam', label:'Kalam — manuscrita forte', family:'"Kalam", cursive', weight:700, size:40, upper:false },
    { id:'caveat', label:'Caveat — manuscrita fina', family:'"Caveat", cursive', weight:700, size:46, upper:false },
    { id:'marker', label:'Permanent Marker', family:'"Permanent Marker", cursive', weight:400, size:34, upper:false },
    { id:'patrick', label:'Patrick Hand', family:'"Patrick Hand", cursive', weight:400, size:36, upper:false },
    { id:'shantell', label:'Shantell Sans', family:'"Shantell Sans", cursive', weight:700, size:32, upper:false },
  ];
  let currentFontId = 'stamp';
  let currentUppercase = true;
  const fontSelect = document.getElementById('stickerFontSelect');
  function rebuildFontSelect(){
    fontSelect.innerHTML = '';
    fontOptions.forEach(f=>{
      const opt = document.createElement('option');
      opt.value = f.id; opt.textContent = f.label;
      if(f.id===currentFontId) opt.selected = true;
      fontSelect.appendChild(opt);
    });
  }
  rebuildFontSelect();
  fontSelect.addEventListener('change', ()=>{
    currentFontId = fontSelect.value;
    const fo = fontOptions.find(f=>f.id===currentFontId);
    currentUppercase = fo.upper;
    document.getElementById('stickerUppercase').checked = currentUppercase;
    if(selectedSticker){ selectedSticker.fontId = currentFontId; selectedSticker.uppercase = currentUppercase; renderMain(); }
  });
  document.getElementById('stickerUppercase').addEventListener('change', (e)=>{
    currentUppercase = e.target.checked;
    if(selectedSticker){ selectedSticker.uppercase = currentUppercase; renderMain(); }
  });

  document.getElementById('uploadFontTrigger').addEventListener('click', ()=>document.getElementById('fontFileInput').click());
  document.getElementById('fontFileInput').addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const status = document.getElementById('fontStatus');
    status.textContent = 'carregando fonte...';
    try{
      const buf = await file.arrayBuffer();
      const face = new FontFace('CustomUserFont', buf);
      await face.load();
      document.fonts.add(face);
      if(!fontOptions.find(f=>f.id==='custom')){
        fontOptions.push({ id:'custom', label:'★ ' + file.name, family:'"CustomUserFont", sans-serif', weight:700, size:38, upper:false });
      } else {
        fontOptions.find(f=>f.id==='custom').label = '★ ' + file.name;
      }
      rebuildFontSelect();
      currentFontId = 'custom';
      fontSelect.value = 'custom';
      status.textContent = 'fonte "'+file.name+'" carregada — selecionada no menu acima.';
      renderMain();
    }catch(err){
      status.textContent = 'não foi possível carregar esse arquivo de fonte.';
    }
  });

  Promise.all(fontOptions.filter(f=>f.id!=='stamp'&&f.id!=='custom').map(f=>{
    return document.fonts.load(`${f.weight} ${f.size}px ${f.family}`).catch(()=>{});
  })).then(()=>renderMain());

