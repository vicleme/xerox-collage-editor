/**
 * RNG determinístico, helpers de cor/textura giz, estado global (settings, folhas/sheets, contadores de id) e utilitário de caminho serrilhado.
 */

  // ---------------- deterministic RNG ----------------
  function mulberry32(seed){
    return function(){
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------------- chalk texture helpers ----------------
  function hexToRgb(hex){
    hex = hex.replace('#','');
    const n = parseInt(hex,16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function rgbaFromHex(hex, a){
    const {r,g,b} = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }
  function luminance(hex){
    const {r,g,b} = hexToRgb(hex);
    return 0.299*r + 0.587*g + 0.114*b;
  }
  function outlineSafeColor(hex){
    const {r,g,b} = hexToRgb(hex);
    const amt = luminance(hex) > 140 ? -95 : 95;
    const clamp = v => Math.max(0, Math.min(255, v+amt))|0;
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
  }
  function chalkStroke(bctx, rng, cx, cy, len, thick, angle, color){
    bctx.save();
    bctx.translate(cx, cy);
    bctx.rotate(angle);
    const passes = 2 + Math.floor(rng()*3);
    for(let p=0; p<passes; p++){
      const yOff = (rng()-0.5)*thick*0.7;
      const passLen = len*(0.55+rng()*0.45);
      const dabCount = Math.max(24, Math.floor(passLen/2.4));
      for(let i=0;i<dabCount;i++){
        const t = i/dabCount;
        const wobble = Math.sin(t*Math.PI*(2+rng()*2)) * thick*0.16;
        const x = (t-0.5)*passLen + (rng()-0.5)*3;
        const y = yOff + wobble + (rng()-0.5)*thick*0.22;
        const r = 0.8 + rng()*2.6;
        const alpha = 0.035 + rng()*0.09;
        bctx.fillStyle = rgbaFromHex(color, alpha);
        bctx.beginPath();
        bctx.ellipse(x, y, r*(1+rng()*0.7), r*0.55, rng()*Math.PI, 0, Math.PI*2);
        bctx.fill();
      }
    }
    bctx.restore();
  }

  // ---------------- global look settings ----------------
  const frame = { w: 480, h: 600 };
  const settings = {
    hatchSpacing: 5, contrast: 1.3, brightness: 0, grain: 18, fringe: 3,
    bgIntensity: 6, bgGrain: 30, jag: 10
  };
  let moveMode = 'frame';

  let drawMode = false;
  let scribbleColor = '#fdf9ee';
  let scribbleThick = 14;

  let currentBoxStyle = 'solid';
  let currentSkew = 0;
  let currentTextRot = 0;

  // usado pra mostrar no canvas, em tempo real, o resultado de uma paleta personalizada
  // sendo criada/editada — antes mesmo de o usuário clicar em salvar
  let previewPaletteOverride = null;
  function activePalette(){ return previewPaletteOverride || palettes[paletteIndex]; }

  let photoIdCounter = 1;
  let stickerIdCounter = 1;
  let scribbleIdCounter = 1;
  let sheetIdCounter = 1;
  let groupIdCounter = 1;

  const photoGroups = {}; // groupId -> { sourceImg, count, zoom, offsetX, offsetY, members:[photoObj,...] }

  // ---------------- sheets (folhas) ----------------
  let sheets = [];
  let currentSheetIndex = 0;
  let activePhoto = null;
  let selectedSticker = null;

  function currentSheet(){ return sheets[currentSheetIndex]; }

  function getAllCutoutPhotos(){
    const list = [];
    const seen = new Set();
    sheets.forEach(s => {
      s.photos.forEach(p => {
        if(p.kind === 'cutout' && !seen.has(p.id)){
          seen.add(p.id);
          list.push(p);
        }
      });
    });
    return list;
  }

  function newSheet(){
    return {
      id: sheetIdCounter++,
      bgSeed: Math.floor(Math.random()*999999),
      bgCanvas: null,
      photos: [],
      stickers: [],
      scribbles: [],
      scribbleRedoStack: []
    };
  }

  // ---------------- jagged path helper ----------------
  function jagPoints(rng, w, h, jag, perEdge){
    perEdge = perEdge || 7;
    const pts = [];
    function edge(x0,y0,x1,y1){
      for(let i=0;i<perEdge;i++){
        const t = i/perEdge;
        let x = x0+(x1-x0)*t, y = y0+(y1-y0)*t;
        let nx = (y1-y0), ny = -(x1-x0);
        const len = Math.hypot(nx,ny)||1; nx/=len; ny/=len;
        const j = (rng()-0.5)*jag;
        pts.push([x+nx*j, y+ny*j]);
      }
    }
    edge(0,0,w,0); edge(w,0,w,h); edge(w,h,0,h); edge(0,h,0,0);
    return pts;
  }
  function pathFromPoints(c, pts, ox, oy){
    ox=ox||0; oy=oy||0;
    c.beginPath();
    c.moveTo(pts[0][0]+ox, pts[0][1]+oy);
    for(let i=1;i<pts.length;i++) c.lineTo(pts[i][0]+ox, pts[i][1]+oy);
    c.closePath();
  }
  function bandPoints(rng, w, h, jag, perEdge){
    perEdge = perEdge || 10;
    const pts = [];
    for(let i=0;i<=perEdge;i++){ const t=i/perEdge; pts.push([t*w, (rng()-0.5)*jag]); }
    for(let i=0;i<=perEdge;i++){ const t=i/perEdge; pts.push([w - t*w, h + (rng()-0.5)*jag]); }
    return pts;
  }

  // ---------------- image placement inside a cutout frame ----------------
  function computeImageDrawFor(p){
    if(!p.sourceImg) return null;
    const coverScale = Math.max(frame.w/p.sourceImg.width, frame.h/p.sourceImg.height);
    const scale = coverScale * p.imgZoom;
    const dw = p.sourceImg.width*scale, dh = p.sourceImg.height*scale;
    let dx = (frame.w - dw)/2 + p.imgOffsetX;
    let dy = (frame.h - dh)/2 + p.imgOffsetY;
    const minX = frame.w - dw, maxX = 0;
    const minY = frame.h - dh, maxY = 0;
    dx = Math.min(maxX, Math.max(minX, dx));
    dy = Math.min(maxY, Math.max(minY, dy));
    return { dw, dh, dx, dy };
  }

  function buildQuickFrameFor(p){
    if(!p.sourceImg) return null;
    if((p.cutoutMode || 'frame') === 'alpha' && typeof buildAlphaCutout === 'function'){
      const w = frame.w, h = frame.h, margin = 26;
      return buildAlphaCutout(p, w+margin*2, h+margin*2, margin);
    }
    const w = frame.w, h = frame.h, margin = 26;
    const draw = computeImageDrawFor(p);
    const rngIn = mulberry32(p.photoShapeSeed);
    const inner = jagPoints(rngIn, w, h, settings.jag, 7);
    const rngOut = mulberry32(p.photoShapeSeed);
    const outer = jagPoints(rngOut, w, h, settings.jag, 7);
    const fw = w+margin*2, fh = h+margin*2;
    const c = document.createElement('canvas'); c.width=fw; c.height=fh;
    const cctx = c.getContext('2d');
    cctx.fillStyle = '#fdf9ee';
    pathFromPoints(cctx, outer, margin, margin); cctx.fill();
    cctx.strokeStyle = '#161311'; cctx.lineWidth = 2.5; cctx.stroke();
    cctx.save();
    pathFromPoints(cctx, inner, margin, margin); cctx.clip();
    cctx.drawImage(p.sourceImg, draw.dx+margin, draw.dy+margin, draw.dw, draw.dh);
    cctx.restore();
    p.baseW = fw; p.baseH = fh;
    return c;
  }

