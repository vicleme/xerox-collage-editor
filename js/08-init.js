/**
 * Inicialização da aplicação: cria a primeira folha e faz o primeiro render.
 */

  // ---------------- init ----------------
  sheets = [newSheet()];
  currentSheetIndex = 0;
  regenerateBackgroundFor(currentSheet(), false);
  renderAll();
