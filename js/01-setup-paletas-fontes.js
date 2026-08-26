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
  let paletteIndex = 0;
  const paletteGrid = document.getElementById('paletteGrid');
  palettes.forEach((p,i)=>{
    const el = document.createElement('div');
    el.className = 'swatch' + (i===0?' active':'');
    el.style.background = `linear-gradient(135deg, ${p.base} 50%, ${p.a1} 50%)`;
    el.title = p.name;
    el.addEventListener('click', ()=>{
      paletteIndex = i;
      [...paletteGrid.children].forEach(c=>c.classList.remove('active'));
      el.classList.add('active');
      regenerateAllBackgrounds();
      reprocessAllCutoutPhotos();
      reprocessAllContinuousGroups();
      renderAll();
    });
    paletteGrid.appendChild(el);
  });

  const stickerColors = [
    { name:'ciano', bg:'#bfe9e6', fg:'#161311' },
    { name:'mostarda', bg:'#e7b84b', fg:'#161311' },
    { name:'creme', bg:'#faf4e2', fg:'#161311' },
    { name:'preto', bg:'#1c1917', fg:'#faf4e2' },
  ];
  let currentStickerColor = 0;
  let currentStickerCustomColor = '#bfe9e6';
  const colorPicks = document.getElementById('colorPicks');
  stickerColors.forEach((c,i)=>{
    const el = document.createElement('div');
    el.className='colorpick'+(i===0?' active':'');
    el.style.background=c.bg;
    el.addEventListener('click', ()=>{
      currentStickerColor=i;
      [...colorPicks.children].forEach(x=>x.classList.remove('active'));
      el.classList.add('active');
      if(selectedSticker){ selectedSticker.colorIdx=i; renderMain(); }
    });
    colorPicks.appendChild(el);
  });
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

