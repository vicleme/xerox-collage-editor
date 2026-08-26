/**
 * Interação de arraste (drag) no canvas principal e exportação/download das folhas em PNG.
 */

  // ---------------- drag interaction ----------------
  let dragTarget = null; 
  let dragOffset = {x:0,y:0};
  let dragStart = {x:0,y:0,offX:0,offY:0};
  let activeScribbleStroke = null;

  function canvasPoint(e){
    const rect = finalCanvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const cx = (e.clientX !== undefined ? e.clientX : e.touches[0].clientX);
    const cy = (e.clientY !== undefined ? e.clientY : e.touches[0].clientY);
    return { x: (cx - rect.left)*scaleX, y: (cy - rect.top)*scaleY };
  }
  function inRotatedBox(px, py, cx, cy, w, h, rotDeg){
    const rad = -rotDeg*Math.PI/180;
    const dx = px-cx, dy = py-cy;
    const rx = dx*Math.cos(rad) - dy*Math.sin(rad);
    const ry = dx*Math.sin(rad) + dy*Math.cos(rad);
    return Math.abs(rx) <= w/2 && Math.abs(ry) <= h/2;
  }

  finalCanvas.addEventListener('pointerdown', (e)=>{
    const p = canvasPoint(e);
    const sheet = currentSheet();
    dragTarget = null;
    if(drawMode){
      activeScribbleStroke = startScribbleStroke(sheet, p);
      dragTarget = 'draw';
      finalCanvas.classList.add('dragging');
      renderMain();
      return;
    }
    for(let i=sheet.stickers.length-1; i>=0; i--){
      const s = sheet.stickers[i];
      const m = stickerMetrics(s);
      if(inRotatedBox(p.x,p.y, s.x, s.y, m.w, m.h, s.rot)){
        dragTarget = s;
        selectSticker(s);
        dragOffset = { x: p.x - s.x, y: p.y - s.y };
        finalCanvas.classList.add('dragging');
        return;
      }
    }

    const cutouts = getAllCutoutPhotos();
    for(let i=cutouts.length-1; i>=0; i--){
      const ph = cutouts[i];
      if(!ph.photoCanvas && !ph.previewCanvas) continue;
      const w = ph.baseW*ph.scale, h = ph.baseH*ph.scale;
      const localX = ph.x - currentSheetIndex * W;
      if(inRotatedBox(p.x, p.y, localX, ph.y, w, h, ph.rotation)){
        selectPhoto(ph);
        if(moveMode === 'frame'){
          dragTarget = { kind:'photoFrame', p: ph };
          dragOffset = { x: p.x - localX, y: p.y - ph.y };
        } else {
          dragTarget = { kind:'photoContent', p: ph };
          dragStart = { x: p.x, y: p.y, offX: ph.imgOffsetX, offY: ph.imgOffsetY };
        }
        finalCanvas.classList.add('dragging');
        return;
      }
    }
    const contPhoto = sheet.photos.find(ph=>ph.kind==='continuous');
    if(contPhoto){
      const group = photoGroups[contPhoto.groupId];
      if(group){
        selectPhoto(contPhoto);
        dragTarget = { kind:'continuousContent', p: contPhoto, group };
        dragStart = { x: p.x, y: p.y, offX: group.offsetX, offY: group.offsetY };
        finalCanvas.classList.add('dragging');
        return;
      }
    }
    selectSticker(null);
  });

  window.addEventListener('pointermove', (e)=>{
    if(!dragTarget) return;
    if(muralMode) return; 

    const p = canvasPoint(e);
    if(dragTarget === 'draw'){
      addScribblePoint(activeScribbleStroke, p);
      renderMain();
    } else if(dragTarget.kind === 'photoFrame'){
      const ph = dragTarget.p;
      ph.x = (p.x - dragOffset.x) + currentSheetIndex * W;
      ph.y = p.y - dragOffset.y;
      renderMain();
    } else if(dragTarget.kind === 'photoContent'){
      const ph = dragTarget.p;
      const ddx = p.x - dragStart.x, ddy = p.y - dragStart.y;
      const rad = -ph.rotation*Math.PI/180;
      const ldx = (ddx*Math.cos(rad) - ddy*Math.sin(rad)) / ph.scale;
      const ldy = (ddx*Math.sin(rad) + ddy*Math.cos(rad)) / ph.scale;
      ph.imgOffsetX = dragStart.offX + ldx;
      ph.imgOffsetY = dragStart.offY + ldy;
      ph.previewCanvas = buildQuickFrameFor(ph);
      renderMain();
    } else if(dragTarget.kind === 'continuousContent'){
      const ddx = p.x - dragStart.x, ddy = p.y - dragStart.y;
      dragTarget.group.offsetX = dragStart.offX + ddx;
      dragTarget.group.offsetY = dragStart.offY + ddy;
      dragTarget.p.previewCanvas = buildQuickContinuousPreview(dragTarget.p);
      renderMain();
    } else if(dragTarget.x !== undefined) {
      dragTarget.x = p.x - dragOffset.x;
      dragTarget.y = p.y - dragOffset.y;
      renderMain();
    }
  });
  window.addEventListener('pointerup', ()=>{
    if(muralMode) return;
    const wasContent = dragTarget && dragTarget.kind === 'photoContent';
    const wasDraw = dragTarget === 'draw';
    const wasContinuous = dragTarget && dragTarget.kind === 'continuousContent';
    const contentPhoto = wasContent ? dragTarget.p : null;
    const continuousGroup = wasContinuous ? dragTarget.group : null;
    dragTarget = null;
    finalCanvas.classList.remove('dragging');
    if(wasContent){ processCutoutPhoto(contentPhoto); renderAll(); }
    if(wasDraw){ activeScribbleStroke = null; renderAll(); }
    if(wasContinuous){ reprocessGroup(continuousGroup); renderAll(); }
  });

  // ---------------- download ----------------
  document.getElementById('downloadBtn').addEventListener('click', ()=>{
    renderMain();
    const link = document.createElement('a');
    link.download = 'colagem-xerox-folha-' + (currentSheetIndex+1) + '.png';
    link.href = finalCanvas.toDataURL('image/png');
    link.click();
  });
  document.getElementById('downloadAllBtn').addEventListener('click', ()=>{
    const savedIndex = currentSheetIndex;
    sheets.forEach((sheet, idx)=>{
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      paintSheetInto(sheet, off.getContext('2d'));
      const link = document.createElement('a');
      link.download = 'colagem-xerox-folha-' + (idx+1) + '.png';
      link.href = off.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    currentSheetIndex = savedIndex;
  });

