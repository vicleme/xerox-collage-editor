/**
 * Pipeline de renderização: posicionamento de imagem no quadro, hachura p&b, processamento de fotos recortadas e do carrossel contínuo, pintura de fundo, stickers, giz e o paint principal da folha.
 */

  // ---------------- shared hatch/paper pipeline ----------------
  function buildHatchedPaper(src, bw, bh){
    const pal = activePalette();
    const sctx = src.getContext('2d');
    const imgData = sctx.getImageData(0,0,bw,bh);

    const d = imgData.data;
    const lum = new Float32Array(bw*bh);
    const contrast = settings.contrast, bright = settings.brightness/255;
    for(let i=0, p=0; i<d.length; i+=4, p++){
      let l = (0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) / 255;
      l = (l - 0.5) * contrast + 0.5 + bright;
      lum[p] = Math.min(1, Math.max(0, l));
    }
    function sample(x,y){
      x = Math.max(0, Math.min(bw-1, x|0));
      y = Math.max(0, Math.min(bh-1, y|0));
      return lum[y*bw+x];
    }

    const ink = document.createElement('canvas'); ink.width=bw; ink.height=bh;
    const ictx = ink.getContext('2d');
    ictx.strokeStyle = '#111'; ictx.lineWidth = 1.15; ictx.lineCap='round';
    const spacing = settings.hatchSpacing;
    const step = 2.1;
    const diag = Math.hypot(bw,bh);

    function hatchPass(angleDeg, thresh){
      const rad = angleDeg*Math.PI/180;
      const dx = Math.cos(rad), dy = Math.sin(rad);
      const px = -dy, py = dx;
      for(let offset=-diag; offset<diag; offset+=spacing){
        ictx.beginPath();
        let drawing = false;
        for(let t=-diag; t<diag; t+=step){
          const x = bw/2 + px*offset + dx*t;
          const y = bh/2 + py*offset + dy*t;
          if(x<0||y<0||x>=bw||y>=bh){ if(drawing){ictx.stroke(); drawing=false;} continue; }
          const l = sample(x,y);
          if(l < thresh){
            if(!drawing){ ictx.moveTo(x,y); drawing = true; } else { ictx.lineTo(x,y); }
          } else if(drawing){
            ictx.lineTo(x,y); ictx.stroke(); ictx.beginPath(); drawing = false;
          }
        }
        if(drawing) ictx.stroke();
      }
    }
    hatchPass(45, 0.78);
    hatchPass(-45, 0.5);
    hatchPass(90, 0.24);

    const grainN = Math.floor(bw*bh*settings.grain*0.0009);
    for(let i=0;i<grainN;i++){
      const x = Math.random()*bw, y = Math.random()*bh;
      ictx.fillStyle = Math.random()>0.5 ? 'rgba(15,10,8,'+(Math.random()*0.35)+')' : 'rgba(255,255,255,0)';
      ictx.fillRect(x,y,1,1);
    }

    function tint(canvas, color){
      const t = document.createElement('canvas'); t.width=canvas.width; t.height=canvas.height;
      const tctx = t.getContext('2d');
      tctx.drawImage(canvas,0,0);
      tctx.globalCompositeOperation='source-in';
      tctx.fillStyle=color;
      tctx.fillRect(0,0,t.width,t.height);
      return t;
    }

    const paper = document.createElement('canvas'); paper.width=bw; paper.height=bh;
    const pctx = paper.getContext('2d');
    pctx.fillStyle = '#f7f2e6';
    pctx.fillRect(0,0,bw,bh);

    const off = settings.fringe;
    if(off > 0){
      const tealInk = tint(ink, pal.a1);
      const orangeInk = tint(ink, pal.base);
      pctx.globalCompositeOperation='multiply';
      pctx.globalAlpha = 0.9;
      pctx.drawImage(tealInk, -off, 0);
      pctx.drawImage(orangeInk, off, off*0.6);
      pctx.globalAlpha = 1;
    }
    pctx.globalCompositeOperation='multiply';
    pctx.drawImage(ink, 0, 0);
    pctx.globalCompositeOperation='source-over';

    const grain2 = Math.floor(bw*bh*0.01);
    for(let i=0;i<grain2;i++){
      const x=Math.random()*bw, y=Math.random()*bh;
      pctx.fillStyle = Math.random()>0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
      pctx.fillRect(x,y,1,1);
    }
    return paper;
  }

  // ---------------- cutout photo processing ----------------
  function getAlphaImageDrawFor(p){
    if(!p.sourceImg) return null;
    // No modo de transparência, mostramos a imagem inteira dentro do quadro
    // (contain), para que a silhueta não seja cortada por uma moldura retangular.
    const containScale = Math.min(frame.w/p.sourceImg.width, frame.h/p.sourceImg.height);
    const scale = containScale * p.imgZoom;
    const dw = p.sourceImg.width*scale, dh = p.sourceImg.height*scale;
    const dx = (frame.w - dw)/2 + p.imgOffsetX;
    const dy = (frame.h - dh)/2 + p.imgOffsetY;
    return { dw, dh, dx, dy };
  }

  function tintAlphaMask(mask, color){
    const out = document.createElement('canvas'); out.width=mask.width; out.height=mask.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation='source-in';
    ctx.fillStyle=color;
    ctx.fillRect(0,0,out.width,out.height);
    ctx.globalCompositeOperation='source-over';
    return out;
  }

  function dilateAlphaMask(mask, radius, seed){
    const out = document.createElement('canvas'); out.width=mask.width; out.height=mask.height;
    const ctx = out.getContext('2d');
    const rng = mulberry32(seed || 1);
    const steps = Math.max(12, Math.round(radius*2.5));
    for(let i=0;i<steps;i++){
      const a = (i/steps)*Math.PI*2;
      const wobble = (rng()-0.5)*1.6;
      const dx = Math.cos(a)*(radius+wobble);
      const dy = Math.sin(a)*(radius+wobble);
      ctx.drawImage(mask, dx, dy);
    }
    ctx.drawImage(mask, 0, 0);
    return out;
  }

  function buildAlphaCutout(p, bw, bh, margin){
    const pal = activePalette();
    const draw = getAlphaImageDrawFor(p);

    // Máscara baseada exclusivamente no canal alfa da imagem original.
    const source = document.createElement('canvas'); source.width=bw; source.height=bh;
    const sctx = source.getContext('2d');
    sctx.clearRect(0,0,bw,bh);
    sctx.drawImage(p.sourceImg, draw.dx+margin, draw.dy+margin, draw.dw, draw.dh);

    const alphaMask = document.createElement('canvas'); alphaMask.width=bw; alphaMask.height=bh;
    const actx = alphaMask.getContext('2d');
    actx.drawImage(source,0,0);

    // A imagem precisa entrar no pipeline xerox como antes, mas fora da silhueta
    // tudo permanece transparente.
    const paper = buildHatchedPaper(source, bw, bh);
    const maskedPaper = document.createElement('canvas'); maskedPaper.width=bw; maskedPaper.height=bh;
    const mpctx = maskedPaper.getContext('2d');
    mpctx.drawImage(paper,0,0);
    mpctx.globalCompositeOperation='destination-in';
    mpctx.drawImage(alphaMask,0,0);
    mpctx.globalCompositeOperation='source-over';

    // Contorno dilatado: duas passagens cromáticas atrás da figura e uma fina
    // linha escura junto à borda. A máscara continua irregular pela aleatoriedade
    // determinística do seed, sem voltar a formar um retângulo.
    const border = 8;
    const expanded = dilateAlphaMask(alphaMask, border, p.photoShapeSeed);
    const expanded2 = dilateAlphaMask(alphaMask, border+2.5, p.photoShapeSeed+7919);

    const final = document.createElement('canvas'); final.width=bw; final.height=bh;
    const fctx = final.getContext('2d');
    fctx.clearRect(0,0,bw,bh);

    const teal = tintAlphaMask(expanded2, pal.a1);
    const orange = tintAlphaMask(expanded, outlineSafeColor(pal.base));
    fctx.drawImage(teal, -2, 0);
    fctx.drawImage(orange, 2, 1);

    // Uma borda preta mais fina, acompanhando exatamente a região opaca.
    const innerBorder = dilateAlphaMask(alphaMask, 2.8, p.photoShapeSeed+1543);
    const black = tintAlphaMask(innerBorder, '#161311');
    fctx.drawImage(black,0,0);
    fctx.drawImage(maskedPaper,0,0);

    return final;
  }

  function processCutoutPhoto(p){
    if(!p.sourceImg) return;
    const w = frame.w, h = frame.h;
    const pal = activePalette();
    const margin = 26;
    const bw = w + margin*2, bh = h + margin*2;

    if((p.cutoutMode || 'frame') === 'alpha'){
      p.photoCanvas = buildAlphaCutout(p, bw, bh, margin);
      p.previewCanvas = null;
      p.baseW = bw; p.baseH = bh;
      return;
    }

    const src = document.createElement('canvas'); src.width=bw; src.height=bh;
    const sctx = src.getContext('2d');
    sctx.fillStyle = '#fff'; sctx.fillRect(0,0,bw,bh);
    const draw = computeImageDrawFor(p);
    sctx.drawImage(p.sourceImg, draw.dx+margin, draw.dy+margin, draw.dw, draw.dh);

    const paper = buildHatchedPaper(src, bw, bh);

    const rng = mulberry32(p.photoShapeSeed);
    const inner = jagPoints(rng, w, h, settings.jag, 7);
    const clipped = document.createElement('canvas'); clipped.width=bw; clipped.height=bh;
    const cctx = clipped.getContext('2d');
    pathFromPoints(cctx, inner, margin, margin);
    cctx.clip();
    cctx.drawImage(paper, 0, 0);

    const final = document.createElement('canvas'); final.width=bw; final.height=bh;
    const fctx = final.getContext('2d');
    const rng2 = mulberry32(p.photoShapeSeed);
    const outer = jagPoints(rng2, w, h, settings.jag, 7);

    fctx.lineJoin='round';
    fctx.strokeStyle = pal.a1; fctx.lineWidth = 7;
    pathFromPoints(fctx, outer, margin - 3, margin + 2);
    fctx.stroke();
    fctx.strokeStyle = outlineSafeColor(pal.base); fctx.lineWidth = 7;
    pathFromPoints(fctx, outer, margin + 3, margin - 2);
    fctx.stroke();

    fctx.fillStyle = '#fdf9ee';
    pathFromPoints(fctx, outer, margin, margin);
    fctx.fill();
    fctx.strokeStyle = '#161311'; fctx.lineWidth = 2.5;
    fctx.stroke();

    fctx.save();
    pathFromPoints(fctx, outer, margin, margin);
    fctx.clip();
    fctx.drawImage(clipped, 0, 0);
    fctx.restore();

    p.photoCanvas = final;
    p.previewCanvas = null;
    p.baseW = bw; p.baseH = bh;
  }

  function reprocessCutoutPhotosOfSheet(sheet){
    sheet.photos.forEach(p=>{ if(p.kind==='cutout') processCutoutPhoto(p); });
  }
  function reprocessAllCutoutPhotos(){
    getAllCutoutPhotos().forEach(p=>processCutoutPhoto(p));
  }

  // ---------------- continuous carousel background processing ----------------
  function computeContinuousDraw(group){
    const totalW = W * group.count;
    const coverScale = Math.max(totalW/group.sourceImg.width, H/group.sourceImg.height) * group.zoom;
    const dw = group.sourceImg.width*coverScale, dh = group.sourceImg.height*coverScale;
    let dx = (totalW - dw)/2 + group.offsetX;
    let dy = (H - dh)/2 + group.offsetY;
    const minX = totalW - dw, maxX = 0;
    const minY = H - dh, maxY = 0;
    dx = Math.min(maxX, Math.max(minX, dx));
    dy = Math.min(maxY, Math.max(minY, dy));
    return { dw, dh, dx, dy, totalW };
  }
  function processContinuousMember(p){
    const group = photoGroups[p.groupId];
    if(!group) return;
    const draw = computeContinuousDraw(group);
    const src = document.createElement('canvas'); src.width=W; src.height=H;
    const sctx = src.getContext('2d');
    sctx.fillStyle = '#fff'; sctx.fillRect(0,0,W,H);
    sctx.drawImage(group.sourceImg, draw.dx - p.groupIndex*W, draw.dy, draw.dw, draw.dh);

    if(group.style === 'overlay'){
      const bandFrac = group.bandFrac || 0.55;
      const bandH = Math.max(20, Math.round(H * bandFrac));
      const bandY = Math.round((H - bandH)/2);
      const margin = 20;
      const bw = W, bh = bandH + margin*2;
      const sy = bandY - margin;
      const bandSrc = document.createElement('canvas'); bandSrc.width=bw; bandSrc.height=bh;
      const bsctx = bandSrc.getContext('2d');
      bsctx.fillStyle = '#fff'; bsctx.fillRect(0,0,bw,bh);
      bsctx.drawImage(src, 0, sy, bw, bh, 0, 0, bw, bh);
      const paper = buildHatchedPaper(bandSrc, bw, bh);

      const rng = mulberry32(group.bandSeed);
      const pts = bandPoints(rng, bw, bandH, settings.jag, 10);

      const out = document.createElement('canvas'); out.width=W; out.height=H;
      const octx = out.getContext('2d');
      octx.save();
      octx.translate(0, sy);
      pathFromPoints(octx, pts, 0, margin);
      octx.save();
      octx.clip();
      octx.drawImage(paper, 0, 0);
      octx.restore();
      octx.lineJoin = 'round';
      octx.strokeStyle = '#161311';
      octx.lineWidth = 2.5;
      octx.stroke();
      octx.restore();
      p.photoCanvas = out;
    } else {
      p.photoCanvas = buildHatchedPaper(src, W, H);
    }
  }
  function reprocessGroup(group){ group.members.forEach(m=>{ m.previewCanvas = null; processContinuousMember(m); }); }
  function buildQuickContinuousPreview(p){
    const group = photoGroups[p.groupId];
    if(!group) return null;
    const draw = computeContinuousDraw(group);
    const c = document.createElement('canvas'); c.width=W; c.height=H;
    const cctx = c.getContext('2d');
    if(group.style === 'overlay'){
      const bandH = Math.max(20, Math.round(H * (group.bandFrac||0.55)));
      const bandY = Math.round((H - bandH)/2);
      cctx.save();
      cctx.beginPath(); cctx.rect(0, bandY, W, bandH); cctx.clip();
      cctx.drawImage(group.sourceImg, draw.dx - p.groupIndex*W, draw.dy, draw.dw, draw.dh);
      cctx.restore();
    } else {
      cctx.drawImage(group.sourceImg, draw.dx - p.groupIndex*W, draw.dy, draw.dw, draw.dh);
    }
    return c;
  }
  function reprocessAllContinuousGroups(){ Object.values(photoGroups).forEach(reprocessGroup); }

  // ---------------- background painting ----------------
  function paintBackground(seed){
    const pal = activePalette();
    const rng = mulberry32(seed);
    const c = document.createElement('canvas'); c.width=W; c.height=H;
    const bctx = c.getContext('2d');
    bctx.fillStyle = pal.base;
    bctx.fillRect(0,0,W,H);

    const colors = [pal.a1, pal.a2, pal.base];

    const patchCount = 6 + settings.bgIntensity*3;
    for(let i=0;i<patchCount;i++){
      const cx = rng()*W, cy = rng()*H;
      const len = W*(0.28 + rng()*0.4);
      const thick = len*(0.35 + rng()*0.45);
      const angle = (rng()-0.5)*1.1;
      const col = colors[Math.floor(rng()*colors.length)];
      chalkStroke(bctx, rng, cx, cy, len, thick, angle, col);
    }

    const lineCount = 8 + settings.bgIntensity*4;
    for(let i=0;i<lineCount;i++){
      const cx = rng()*W, cy = rng()*H;
      const len = 40 + rng()*(W*0.3);
      const thick = 6 + rng()*22;
      const angle = rng()*Math.PI*2;
      const col = colors[Math.floor(rng()*colors.length)];
      chalkStroke(bctx, rng, cx, cy, len, thick, angle, col);
    }

    const grainN = Math.floor(W*H*settings.bgGrain*0.00035);
    for(let i=0;i<grainN;i++){
      const x = Math.random()*W, y = Math.random()*H;
      const dark = Math.random()>0.55;
      bctx.fillStyle = dark ? 'rgba(20,16,12,0.28)' : 'rgba(255,255,255,0.42)';
      const r = Math.random()*1.4;
      bctx.beginPath();
      bctx.ellipse(x, y, r, r*0.6, Math.random()*Math.PI, 0, Math.PI*2);
      bctx.fill();
    }
    return c;
  }
  function regenerateBackgroundFor(sheet, newSeed){
    if(newSeed) sheet.bgSeed = Math.floor(Math.random()*999999);
    sheet.bgCanvas = paintBackground(sheet.bgSeed);
  }
  function regenerateAllBackgrounds(){ sheets.forEach(s=>regenerateBackgroundFor(s,false)); }

  // ---------------- sticker rendering ----------------
  function stickerFont(s){ return fontOptions.find(f=>f.id===s.fontId) || fontOptions[0]; }

  // ---------------- rich text markup (negrito/itálico/sublinhado à mão/cor por trecho) ----------------
  // sintaxe leve aplicada pela barra de ferramentas sobre o texto selecionado:
  //   **negrito**   _itálico_   ~~sublinhado à mão~~   [[#rrggbb]]cor[[/c]]
  // os marcadores podem ser combinados/aninhados (ex: **_negrito e itálico_**)
  function parseFormattedLine(line){
    const runs = [];
    let buf = '';
    let bold = false, italic = false, underline = false;
    const colorStack = [];
    function flush(){
      if(buf.length){
        runs.push({ text: buf, bold, italic, underline, color: colorStack.length ? colorStack[colorStack.length-1] : null });
        buf = '';
      }
    }
    let i = 0;
    while(i < line.length){
      if(line.startsWith('**', i)){ flush(); bold = !bold; i += 2; continue; }
      if(line.startsWith('~~', i)){ flush(); underline = !underline; i += 2; continue; }
      if(line[i] === '_'){ flush(); italic = !italic; i += 1; continue; }
      const openMatch = /^\[\[#([0-9a-fA-F]{6})\]\]/.exec(line.slice(i));
      if(openMatch){ flush(); colorStack.push('#'+openMatch[1]); i += openMatch[0].length; continue; }
      if(line.startsWith('[[/c]]', i)){ flush(); colorStack.pop(); i += 6; continue; }
      buf += line[i]; i += 1;
    }
    flush();
    return runs.length ? runs : [{ text:'', bold:false, italic:false, underline:false, color:null }];
  }
  function runFont(fo, run){
    const weight = run.bold ? 700 : fo.weight;
    const style = run.italic ? 'italic ' : '';
    return `${style}${weight} ${fo.size}px ${fo.family}`;
  }
  function measureLineRuns(fo, runs){
    let width = 0;
    const measured = runs.map(r=>{
      ctx.font = runFont(fo, r);
      const w = ctx.measureText(r.text).width;
      width += w;
      return { r, w };
    });
    return { width, measured };
  }
  // sublinhado com aspecto manuscrito: uma linha levemente ondulada, não reta e uniforme
  function drawHandUnderline(c, x, y, width, color, seed){
    if(width <= 0) return;
    const rng = mulberry32(seed);
    const segs = Math.max(3, Math.round(width/14));
    c.save();
    c.strokeStyle = color;
    c.lineWidth = 2.1;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    let prevX = x, prevY = y + (rng()-0.5)*2;
    c.moveTo(prevX, prevY);
    for(let i=1;i<=segs;i++){
      const t = i/segs;
      const px = x + t*width;
      const wob = Math.sin(t*Math.PI*(1.6+rng()*0.8)) * 2.1 + (rng()-0.5)*1.3;
      const py = y + wob;
      const midX = (prevX+px)/2, midY = (prevY+py)/2;
      c.quadraticCurveTo(prevX, prevY, midX, midY);
      prevX = px; prevY = py;
    }
    c.lineTo(x+width, y + (rng()-0.5)*2);
    c.stroke();
    c.restore();
  }
  function stickerMetrics(s){
    const fo = stickerFont(s);
    ctx.font = `${fo.weight} ${fo.size}px ${fo.family}`;
    ctx.textBaseline = 'alphabetic';
    const padX = 22, padY = 15;
    const rawText = s.text;
    const lines = rawText.split('\n').map(line=>{
      const runs = parseFormattedLine(line);
      if(s.uppercase) runs.forEach(r=>{ r.text = r.text.toUpperCase(); });
      return runs;
    });
    const lineHeight = fo.size * 1.18;
    let maxW = 0;
    lines.forEach(runs=>{ const { width } = measureLineRuns(fo, runs); if(width>maxW) maxW = width; });
    const textH = lineHeight*(lines.length-1) + fo.size;
    const skewDeg = s.skew || 0;
    const skewPad = skewDeg ? Math.abs(Math.tan(skewDeg * Math.PI/180)) * (textH + padY*2) / 2 : 0;
    return { w: maxW + padX*2 + skewPad*2, h: textH + padY*2, padX: padX + skewPad, padY, lines, lineHeight, fo, skewDeg };
  }
  // pinta a caixa como se fosse papel branco riscado de giz por cima, na cor escolhida
  function paintChalkBox(c, rng, w, h, color){
    c.fillStyle = '#fdf9ee';
    c.fillRect(0, 0, w, h);
    const strokeCount = 9 + Math.floor((w*h)/2400);
    for(let i=0;i<strokeCount;i++){
      const cx = rng()*w, cy = rng()*h;
      const len = w*(0.4 + rng()*0.65);
      const thick = h*(0.5 + rng()*0.6);
      const angle = (rng()-0.5)*0.55;
      chalkStroke(c, rng, cx, cy, len, thick, angle, color);
    }
    // uma segunda passada mais fina reforça a cobertura sem virar bloco de cor chapada
    for(let i=0;i<Math.ceil(strokeCount*0.6);i++){
      const cx = rng()*w, cy = rng()*h;
      const len = w*(0.25 + rng()*0.4);
      const thick = h*(0.3 + rng()*0.35);
      const angle = (rng()-0.5)*1.4;
      chalkStroke(c, rng, cx, cy, len, thick, angle, color);
    }
  }
  function drawSticker(c, s, isCurrentSheet){
    const m = stickerMetrics(s);
    const col = s.colorIdx === -1 ? { bg: s.customBg, fg: s.customFg } : stickerColors[s.colorIdx];
    c.save();
    c.translate(s.x, s.y);
    c.rotate(s.rot * Math.PI/180);
    c.translate(-m.w/2, -m.h/2);

    const jr = mulberry32(Math.floor(s.x*13+s.y*7+s.id*99));
    const pts = jagPoints(jr, m.w, m.h, 3, 3);

    if(s.box !== false){
      if((s.boxStyle || 'solid') === 'chalk'){
        const bw = Math.ceil(m.w), bh = Math.ceil(m.h);
        const cache = s._chalkCache;
        // a textura de giz é cara de gerar (centenas de traços); ela só depende do
        // tamanho da caixa e da cor, nunca da posição — então fica em cache num canvas
        // separado e só é recalculada quando um desses dois muda (arrastar fica leve).
        if(!cache || cache.w !== bw || cache.h !== bh || cache.color !== col.bg){
          const off = document.createElement('canvas');
          off.width = bw; off.height = bh;
          const octx = off.getContext('2d');
          const chalkRng = mulberry32(Math.floor(s.id*53 + bw*7 + bh*11));
          paintChalkBox(octx, chalkRng, bw, bh, col.bg);
          s._chalkCache = { w: bw, h: bh, color: col.bg, canvas: off };
        }
        c.save();
        pathFromPoints(c, pts);
        c.clip();
        c.drawImage(s._chalkCache.canvas, 0, 0, bw, bh, 0, 0, m.w, m.h);
        c.restore();
        pathFromPoints(c, pts);
        c.strokeStyle = '#161311';
        c.lineWidth = 2;
        c.stroke();
      } else {
        c.fillStyle = col.bg;
        c.strokeStyle = '#161311';
        c.lineWidth = 2;
        pathFromPoints(c, pts);
        c.fill();
        c.stroke();
      }
    }

    c.save();
    if(s.box !== false){
      pathFromPoints(c, pts);
      c.clip();
    }
    if(s.textRot){
      // gira só o texto ao redor do centro da caixa — a caixa em si (já desenhada
      // acima, com o clip acima) não roda, só o conteúdo escrito dentro dela.
      c.translate(m.w/2, m.h/2);
      c.rotate(s.textRot * Math.PI/180);
      c.translate(-m.w/2, -m.h/2);
    }
    if(m.skewDeg){
      const shear = Math.tan(m.skewDeg * Math.PI/180);
      c.transform(1, 0, -shear, 1, shear*m.h/2, 0);
    }
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const align = s.align || 'left';
    const textLeft = m.padX;
    const available = m.w - m.padX*2;
    m.lines.forEach((runs, li)=>{
      const baseline = m.padY + m.fo.size + li*m.lineHeight - 2;
      const { width: lineWidth, measured } = measureLineRuns(m.fo, runs);
      const isLastLine = li === m.lines.length-1;
      // divide a linha em "palavras" (podendo cruzar limites de estilo) só pra justificado
      const words = [];
      if(align === 'justify'){
        measured.forEach(({r})=>{
          r.text.split(/(\s+)/).forEach(part=>{
            if(!part || /^\s+$/.test(part)) return;
            words.push({ text: part, bold:r.bold, italic:r.italic, underline:r.underline, color:r.color });
          });
        });
      }
      if(align === 'justify' && !isLastLine && words.length > 1){
        const widths = words.map(w=>{ ctx.font = runFont(m.fo, w); return ctx.measureText(w.text).width; });
        const gap = (available - widths.reduce((a,b)=>a+b,0)) / (words.length-1);
        let x = textLeft;
        words.forEach((word, wi)=>{
          c.font = runFont(m.fo, word);
          c.fillStyle = word.color || col.fg;
          c.fillText(word.text, x, baseline);
          if(word.underline) drawHandUnderline(c, x, baseline+3, widths[wi], word.color || col.fg, s.id*97 + li*31 + wi*11);
          x += widths[wi] + gap;
        });
      } else {
        let x;
        if(align === 'center') x = textLeft + (available - lineWidth)/2;
        else if(align === 'right') x = textLeft + (available - lineWidth);
        else x = textLeft;
        measured.forEach(({r, w}, ri)=>{
          c.font = runFont(m.fo, r);
          c.fillStyle = r.color || col.fg;
          c.fillText(r.text, x, baseline);
          if(r.underline) drawHandUnderline(c, x, baseline+3, w, r.color || col.fg, s.id*97 + li*31 + ri*11);
          x += w;
        });
      }
    });
    c.restore();

    if(isCurrentSheet && s === selectedSticker){
      c.strokeStyle = '#ff5a1f';
      c.lineWidth = 2;
      c.setLineDash([6,4]);
      c.strokeRect(-4,-4,m.w+8,m.h+8);
      c.setLineDash([]);
    }
    c.restore();
  }

  // ---------------- giz livre ----------------
  function startScribbleStroke(sheet, p){
    sheet.scribbleRedoStack = [];
    const stroke = {
      id: scribbleIdCounter++,
      color: scribbleColor,
      thick: scribbleThick,
      dabs: [],
      lastX: p.x, lastY: p.y,
      rng: mulberry32((Date.now() % 100000) + scribbleIdCounter * 97)
    };
    addScribbleDabs(stroke, p.x, p.y, p.x + 0.01, p.y + 0.01);
    sheet.scribbles.push(stroke);
    return stroke;
  }
  function addScribblePoint(stroke, p){
    if(!stroke) return;
    addScribbleDabs(stroke, stroke.lastX, stroke.lastY, p.x, p.y);
    stroke.lastX = p.x; stroke.lastY = p.y;
  }
  function addScribbleDabs(stroke, x0, y0, x1, y1){
    const rng = stroke.rng, thick = stroke.thick;
    const dist = Math.hypot(x1-x0, y1-y0);
    const angle = Math.atan2(y1-y0, x1-x0);
    const px = -Math.sin(angle), py = Math.cos(angle);
    const steps = Math.max(1, Math.ceil(dist/2.2));
    for(let i=1;i<=steps;i++){
      const t = i/steps;
      const x = x0 + (x1-x0)*t, y = y0 + (y1-y0)*t;
      const passCount = 2 + Math.floor(rng()*2);
      for(let k=0;k<passCount;k++){
        const jitter = (rng()-0.5)*thick*0.42;
        const dx = x + px*jitter + (rng()-0.5)*1.4;
        const dy = y + py*jitter + (rng()-0.5)*1.4;
        const r = thick*0.10 + rng()*thick*0.16;
        stroke.dabs.push({ x:dx, y:dy, r, alpha: 0.10 + rng()*0.16, rot: rng()*Math.PI });
      }
    }
  }
  function undoScribble(){
    const sheet = currentSheet();
    if(sheet.scribbles.length === 0) return;
    sheet.scribbleRedoStack.push(sheet.scribbles.pop());
    renderMain();
  }
  function redoScribble(){
    const sheet = currentSheet();
    if(sheet.scribbleRedoStack.length === 0) return;
    sheet.scribbles.push(sheet.scribbleRedoStack.pop());
    renderMain();
  }
  function drawScribblesInto(c, list){
    list.forEach(s=>{
      s.dabs.forEach(d=>{
        c.fillStyle = rgbaFromHex(s.color, d.alpha);
        c.beginPath();
        c.ellipse(d.x, d.y, d.r*1.5, d.r*0.85, d.rot, 0, Math.PI*2);
        c.fill();
      });
    });
  }

  // ---------------- main paint ----------------
  function paintSheetInto(sheet, destCtx){
    const sheetIdx = sheets.indexOf(sheet);
    destCtx.clearRect(0,0,W,H);
    if(sheet.bgCanvas){
      destCtx.drawImage(sheet.bgCanvas, 0, 0);
    } else {
      destCtx.fillStyle = '#ff5b1f'; destCtx.fillRect(0,0,W,H);
    }
    const contPhoto = sheet.photos.find(p=>p.kind==='continuous');
    if(contPhoto && (contPhoto.previewCanvas || contPhoto.photoCanvas)){
      destCtx.drawImage(contPhoto.previewCanvas || contPhoto.photoCanvas, 0, 0);
    }

    const isCurrent = sheet === currentSheet();
    const cutouts = getAllCutoutPhotos();
    cutouts.forEach(p=>{
      const drawCanvas = p.previewCanvas || p.photoCanvas;
      if(!drawCanvas) return;
      const s = p.scale;
      const w = p.baseW * s, h = p.baseH * s;
      
      const localX = (sheetIdx >= 0) ? (p.x - sheetIdx * W) : p.x;
      
      if(localX + w/2 < -100 || localX - w/2 > W + 100) return;

      destCtx.save();
      destCtx.translate(localX, p.y);
      destCtx.rotate(p.rotation * Math.PI/180);
      destCtx.shadowColor = 'rgba(0,0,0,0.45)';
      destCtx.shadowBlur = 26;
      destCtx.shadowOffsetY = 14;
      destCtx.drawImage(drawCanvas, -w/2, -h/2, w, h);
      destCtx.restore();

      if(isCurrent && p === activePhoto){
        destCtx.save();
        destCtx.translate(localX, p.y);
        destCtx.rotate(p.rotation * Math.PI/180);
        destCtx.shadowColor = 'transparent'; destCtx.shadowBlur = 0;
        destCtx.strokeStyle = '#1fb8b0';
        destCtx.lineWidth = 3;
        destCtx.setLineDash([10,6]);
        destCtx.strokeRect(-w/2-6, -h/2-6, w+12, h+12);
        destCtx.setLineDash([]);
        destCtx.restore();
      }
    });

    sheet.stickers.forEach(s => drawSticker(destCtx, s, isCurrent));
    drawScribblesInto(destCtx, sheet.scribbles);
  }

  function renderMain(){
    paintSheetInto(currentSheet(), ctx);
    const hasPhoto = currentSheet().photos.length > 0 || getAllCutoutPhotos().length > 0;
    emptyState.style.display = hasPhoto ? 'none' : 'block';
  }
  function renderAll(){
    renderMain();
    refreshSheetTabs();
    refreshPhotoList();
    updatePhotoControlsUI();
    if(muralMode) renderMural();
  }

