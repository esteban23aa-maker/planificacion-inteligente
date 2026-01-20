import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import * as ExcelJS from 'exceljs';

/** ==== Tema / Colores ==== */
type Theme = { header: string; light: string; title: string };

const THEME: Record<'programacion' | 'domingo' | 'y1' | 'y2', Theme> = {
  programacion: { header: '1e40af', light: 'eef2ff', title: 'ffffff' },
  domingo: { header: '0f766e', light: 'ecfeff', title: 'ffffff' },
  y1: { header: '7c3aed', light: 'f5f3ff', title: 'ffffff' },
  y2: { header: 'b45309', light: 'fff7ed', title: 'ffffff' },
};

type TwoLineHeader = { top: string[]; bottom?: string[] };

// fondo para “chips” de puesto
const BADGE_BG: Record<'MECANICO' | 'PULIDOR' | 'PUESTO', string> = {
  MECANICO: 'ecfeff',   // celeste claro
  PULIDOR: 'fff7ed',   // naranja claro
  PUESTO: 'f3f4f6',   // gris claro
};

type PersonaCell = { nombre: string; puesto: string; fijo?: boolean };

@Injectable({ providedIn: 'root' })
export class ExcelExportService {

  // ======================== PÚBLICO ========================

  /** Programación semanal (tab principal + tab “Coordinadores”) */
  async exportProgramacionSemanal(opts: {
    filename?: string;
    titulo: string; subtitulo: string;
    turnos: string[]; grupos: string[];
    /** fallback simple (por compatibilidad) */
    getCelda?: (grupo: string, turno: string) => string[];
    /** 👉 recomendado: respeta estilo UI (nombre en negrita + puesto en segunda línea) */
    getCeldaRich?: (grupo: string, turno: string) => PersonaCell[];
    /** null si es máquina; si es puesto, devuelve MECANICO / PULIDOR / PUESTO para colorear */
    getBadge?: (grupo: string) => ('MECANICO' | 'PULIDOR' | 'PUESTO') | null;
    coordinadoresPorTurno?: Record<string, string>;
  }) {
    const wb = new ExcelJS.Workbook();

    // Hoja principal
    const ws = wb.addWorksheet('Programación', { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
    this.setupPage(ws);
    this.addTitle(ws, opts.titulo, opts.subtitulo, THEME.programacion);

    this.addTwoLineHeader(ws, { top: ['Máquina / Puesto', ...opts.turnos] }, THEME.programacion);

    // Fila de coordinadores (como en la UI)
    const rowCoord = ws.addRow(['COORDINADOR', ...opts.turnos.map(t => (opts.coordinadoresPorTurno?.[t] ?? '—'))]);
    rowCoord.font = { bold: true };
    rowCoord.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Grilla
    for (const g of opts.grupos) {
      // crea fila vacía con todas las columnas para poder escribir rico por celda
      const row = ws.addRow(new Array(1 + opts.turnos.length).fill(null));
      // Columna 1: grupo con “chip” simulado si aplica
      const c1 = row.getCell(1);
      const badge = opts.getBadge?.(g) ?? null;
      c1.value = badge ? `[${badge}] ${g}` : g;
      c1.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      c1.font = { bold: !badge }; // máquinas en negrita, puestos normal
      if (badge) {
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.toARGB(BADGE_BG[badge]) } };
        c1.border = {
          top: { style: 'thin', color: { argb: this.toARGB('cbd5e1') } },
          left: { style: 'thin', color: { argb: this.toARGB('cbd5e1') } },
          bottom: { style: 'thin', color: { argb: this.toARGB('cbd5e1') } },
          right: { style: 'thin', color: { argb: this.toARGB('cbd5e1') } },
        };
      }

      // Celdas de turnos (2..N)
      opts.turnos.forEach((t, idx) => {
        const cell = row.getCell(2 + idx);
        if (opts.getCeldaRich) {
          const personas = opts.getCeldaRich(g, t);
          this.setPeopleCell(cell, personas);
        } else if (opts.getCelda) {
          cell.value = this.joinMultiline(opts.getCelda(g, t));
          cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
        } else {
          cell.value = '—';
          cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
        }
      });
    }

    // Estética
    this.tableLook(ws, /*headerStart*/3, /*startCol*/1, ws.rowCount, ws.columnCount, THEME.programacion, true, /*headerLines*/1);
    this.autoSizeColumns(ws);

    // Tab opcional con coordinadores
    if (opts.coordinadoresPorTurno && Object.keys(opts.coordinadoresPorTurno).length) {
      const ws2 = wb.addWorksheet('Coordinadores');
      this.setupPage(ws2);
      this.addTitle(ws2, opts.titulo, 'Coordinadores por turno', THEME.programacion);
      ws2.addRow(['Turno', 'Coordinador']).font = { bold: true };
      Object.entries(opts.coordinadoresPorTurno).forEach(([turno, nombre]) => ws2.addRow([turno, nombre]));
      this.tableLook(ws2, 2, 1, ws2.rowCount, 2, THEME.programacion, false, 1);
      this.autoSizeColumns(ws2);
    }

    await this.download(wb, opts.filename || 'Programacion.xlsx');
  }

  /** Domingo (tab único) */
  /** Domingo (tab único) */
  async exportDomingo(opts: {
    filename?: string;
    titulo: string; subtitulo: string;
    turnos: string[]; grupos: string[];
    /** fallback simple si no quieres rich text */
    getCelda?: (grupo: string, turno: string) => string[];
    /** 👉 recomendado: nombre en negrita + (puesto) en 2ª línea */
    getCeldaRich?: (grupo: string, turno: string) => PersonaCell[];
    /** null si es máquina; si es puesto, devuelve MECANICO / PULIDOR / PUESTO para colorear */
    getBadge?: (grupo: string) => ('MECANICO' | 'PULIDOR' | 'PUESTO') | null;
    coordinadoresPorTurno?: Record<string, string>;
  }) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Domingo', { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
    this.setupPage(ws);
    this.addTitle(ws, opts.titulo, opts.subtitulo, THEME.domingo);

    this.addTwoLineHeader(ws, { top: ['Máquina / Puesto', ...opts.turnos] }, THEME.domingo);

    // Fila COORDINADOR
    const rowCoord = ws.addRow(['COORDINADOR', ...opts.turnos.map(t => (opts.coordinadoresPorTurno?.[t] ?? '—'))]);
    rowCoord.font = { bold: true };
    rowCoord.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Grilla
    for (const g of opts.grupos) {
      const row = ws.addRow(new Array(1 + opts.turnos.length).fill(null));

      // Columna 1: “chip” si es puesto
      const c1 = row.getCell(1);
      const badge = opts.getBadge?.(g) ?? null;
      c1.value = badge ? `[${badge}] ${g}` : g;
      c1.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      c1.font = { bold: !badge }; // máquinas en negrita
      if (badge) {
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.toARGB(BADGE_BG[badge]) } };
        c1.border = {
          top: { style: 'thin', color: { argb: this.toARGB('cbd5e1') } },
          left: { style: 'thin', color: { argb: this.toARGB('cbd5e1') } },
          bottom: { style: 'thin', color: { argb: this.toARGB('cbd5e1') } },
          right: { style: 'thin', color: { argb: this.toARGB('cbd5e1') } },
        };
      }

      // Celdas por turno (rich text si viene)
      opts.turnos.forEach((t, idx) => {
        const cell = row.getCell(2 + idx);
        if (opts.getCeldaRich) {
          const personas = opts.getCeldaRich(g, t);
          this.setPeopleCell(cell, personas);
        } else if (opts.getCelda) {
          cell.value = this.joinMultiline(opts.getCelda(g, t));
          cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
        } else {
          cell.value = '—';
          cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
        }
      });
    }

    this.tableLook(ws, 3, 1, ws.rowCount, ws.columnCount, THEME.domingo, true, 1);
    this.autoSizeColumns(ws);
    await this.download(wb, opts.filename || 'Domingo.xlsx');
  }

 /** Compensatorios Y1 (cabecera 2 líneas + columnas por día desdobladas en: Turno | Compensatorio) */
async exportY1(opts: {
  filename?: string;
  titulo: string; subtitulo: string;
  cols: { label: string; iso: string }[];
  rows: Array<{ reemplazo: string; cells: Record<string, { groups: Array<{ puesto: string; maquina: string; turno: string; colaboradores: string[] }> }> }>;
  /** NUEVO: callback para marcar si un nombre está en "Reducción" ese día */
  isReduc?: (iso: string, nombre: string) => boolean;
}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Compensatorios', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] });
  this.setupPage(ws);
  this.addTitle(ws, opts.titulo, opts.subtitulo, THEME.y1);

  // Cabecera “desdoblada”: por cada día => 2 columnas (Turno | Compensatorio)
  const topHdr = ['Reemplazo', ...opts.cols.flatMap(c => [c.label, c.label])];
  const botHdr = ['', ...opts.cols.flatMap(_ => ['Turno', 'Compensatorio'])];
  this.addTwoLineHeader(ws, { top: topHdr, bottom: botHdr }, THEME.y1);

  // Filas (una por reemplazo)
  for (const r of opts.rows) {
    const row = ws.addRow(new Array(1 + (opts.cols.length * 2)).fill(null));

    // Columna 1: Reemplazo en negrita
    const c1 = row.getCell(1);
    c1.value = r.reemplazo || '—';
    c1.font = { bold: true };
    c1.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Celdas por día: [Turno] | [Compensatorio]
    opts.cols.forEach((col, i) => {
      const baseCol = 2 + (i * 2);
      const cellTurno = row.getCell(baseCol + 0);
      const cellData  = row.getCell(baseCol + 1);

      const data = r.cells[col.iso];
      const groups = (data?.groups || []).slice();

      if (!groups.length) {
        // Si el REEMPLAZO de la fila está en Reducción ese día, muéstralo.
        const reducFila = opts.isReduc ? opts.isReduc(col.iso, r.reemplazo) : false;

        cellTurno.value = '—';
        cellTurno.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };

        if (reducFila) {
          (cellData as any).value = {
            richText: [
              { text: 'Reducción', font: { italic: true, bold: false, color: { argb: this.toARGB('6b7280') } } }
            ]
          };
          cellData.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
        } else {
          cellData.value = '—';
          cellData.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
        }
      } else {
        this._setY1SplitCells(cellTurno, cellData, groups, col.iso, opts.isReduc);
      }
    });

    this.wrapRow(row);
  }

  this.tableLook(ws, 4, 1, ws.rowCount, ws.columnCount, THEME.y1, true, 2);
  this.autoSizeColumns(ws);

  // Estrechar columnas "Turno" (2, 4, 6, …) para que se ajusten al texto
  opts.cols.forEach((_, i) => {
    const turnoColIdx = 2 + (i * 2);
    const col = ws.getColumn(turnoColIdx);
    const current = Number(col.width) || 12;
    col.width = Math.min(current, 12);
    col.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' } as any;
  });

  await this.download(wb, opts.filename || 'Compensatorios_Y1.xlsx');
}

  /** Reducciones Y2 */
  /** Reducciones Y2 (cabecera 2 líneas + celdas ricas) */
 /** Reducciones Y2 (cabecera 2 líneas + columnas por día desdobladas en: Turno | Reducción) */
async exportY2(opts: {
  filename?: string;
  titulo: string; subtitulo: string;
  cols: { label: string; iso: string }[];
  rows: Array<{ reemplazo: string; cells: Record<string, { groups: Array<{ puesto: string; maquina: string; turno: string; franja: string; horas: number; colaboradores: string[] }> }> }>;
  incidencias?: Array<{ colaboradorNombre: string; grupo: string; fecha: string; turno?: string; franja?: string; motivo: string; }>;
  /** NUEVO: callback para marcar si un nombre está en compensatorio ese día */
  isComp?: (iso: string, nombre: string) => boolean;
}) {

  const wb = new ExcelJS.Workbook();

  // Hoja Reducciones
  const ws = wb.addWorksheet('Reducciones', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] });
  this.setupPage(ws);
  this.addTitle(ws, opts.titulo, opts.subtitulo, THEME.y2);

  // Cabecera “desdoblada”: por cada día => 2 columnas (Turno | Reducción)
  const topHdr = ['Reemplazo', ...opts.cols.flatMap(c => [c.label, c.label])];
  const botHdr = ['', ...opts.cols.flatMap(_ => ['Turno', 'Reducción'])];
  this.addTwoLineHeader(ws, { top: topHdr, bottom: botHdr }, THEME.y2);

  // Filas (una por reemplazo)
  for (const r of opts.rows) {
    const row = ws.addRow(new Array(1 + (opts.cols.length * 2)).fill(null));

    // Columna 1: Reemplazo en negrita
    const c1 = row.getCell(1);
    c1.value = r.reemplazo || '—';
    c1.font = { bold: true };
    c1.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Celdas por día: [Turno] | [Reducción]
    opts.cols.forEach((col, i) => {
      const baseCol = 2 + (i * 2);
      const cellTurno = row.getCell(baseCol + 0);
      const cellData  = row.getCell(baseCol + 1);

      const data = r.cells[col.iso];
      const groups = this._sortY2GroupsByFranja(data?.groups || []);

      if (!groups.length) {
    // 🔧 NUEVO: si el REEMPLAZO de la fila está en compensatorio, muéstralo.
    const compFila = opts.isComp ? opts.isComp(col.iso, r.reemplazo) : false;

    cellTurno.value = '—';
    cellTurno.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };

    if (compFila) {
      // pinta "Compensatorio" bonito en la celda de Reducción
      (cellData as any).value = {
        richText: [
          { text: 'Compensatorio', font: { italic: true, bold: false, color: { argb: this.toARGB('6b7280') } } }
        ]
      };
      cellData.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    } else {
      cellData.value = '—';
      cellData.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
    }
  } else {
    this._setY2SplitCells(cellTurno, cellData, groups, col.iso, opts.isComp);
  }
});

    this.wrapRow(row);
  }

  this.tableLook(ws, 4, 1, ws.rowCount, ws.columnCount, THEME.y2, true, 2);
  this.autoSizeColumns(ws);

  // Estrechar columnas "Turno" (2, 4, 6, …)
opts.cols.forEach((_, i) => {
  const turnoColIdx = 2 + (i * 2);
  const col = ws.getColumn(turnoColIdx);
  // ancho máximo 12 (ajusta a tu gusto: 10-12 queda bien)
  const current = Number(col.width) || 12;
  col.width = Math.min(current, 12);
  // centra por si acaso
  col.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' } as any;
});

  // Hoja Incidencias (igual)
  if (opts.incidencias?.length) {
    const ws2 = wb.addWorksheet('Incidencias');
    this.setupPage(ws2);
    this.addTitle(ws2, opts.titulo, 'Incidencias de la semana', THEME.y2);
    ws2.addRow(['Titular', 'Grupo', 'Fecha', 'Turno', 'Franja', 'Motivo']).font = { bold: true };
    for (const i of opts.incidencias) {
      ws2.addRow([i.colaboradorNombre, i.grupo, i.fecha, i.turno || '—', i.franja || '—', i.motivo]);
    }
    this.tableLook(ws2, 2, 1, ws2.rowCount, 6, THEME.y2, false, 1);
    this.autoSizeColumns(ws2);
  }

  await this.download(wb, opts.filename || 'Reducciones.xlsx');
}

/** Orden por franja: M1, M2, T1, T2, y de último DIA_COMPLETO / otros */
private _sortY2GroupsByFranja<T extends { franja: string; horas: number }>(groups: T[]): T[] {
  const order = [
    '06:00-10:00',  // M1
    '10:00-14:00',  // M2
    '14:00-18:00',  // T1
    '18:00-22:00',  // T2
    'DIA_COMPLETO'
  ];
  const rank = (f?: string) => {
    const up = (f || '').toUpperCase();
    const idx = order.indexOf(up);
    return idx === -1 ? 99 : idx;
  };
  return groups.slice().sort((a, b) =>
    rank(a.franja) - rank(b.franja) ||
    (a.horas || 0) - (b.horas || 0)
  );
}

/** Normaliza texto y filtra valores “vacíos” o placeholders que no deben exportarse */
private _cleanToken(v?: string | null): string {
  const t = (v || '').trim();
  if (!t) return '';
  const up = t.toUpperCase();
  if (up === '—' || up === '-' || up === 'SIN PUESTO' || up === 'SIN MAQUINA' || up === 'SIN MÁQUINA') return '';
  return t;
}

/** Deriva el texto de turno “bonito” desde franja o turno */
private _turnoFromGroup(g: { turno: string; franja: string }): string {
  const f = (g.franja || '').toUpperCase();
  if (f === '06:00-10:00' || f === '10:00-14:00') return '06:00-14:00';
  if (f === '14:00-18:00' || f === '18:00-22:00') return '14:00-22:00';
  // fallback con lo que venga en “turno”
  return g.turno || '';
}

/**
 * Escribe en dos celdas:
 *  - cellTurno: solo el turno (una línea por grupo, ordenado por franja)
 *  - cellData:  encabezado SIN turno (franja + (horas) + puesto/maquina limpios) + lista de nombres
 */
private _setY2SplitCells(
  cellTurno: ExcelJS.Cell,
  cellData: ExcelJS.Cell,
  groups: Array<{ puesto: string; maquina: string; turno: string; franja: string; horas: number; colaboradores: string[] }>,
  iso?: string,
  isComp?: (iso: string, nombre: string) => boolean
) {
  // 1) Celda de TURNOS: SIN duplicados
  const uniqTurnos = Array.from(new Set(
    groups.map(g => this._turnoFromGroup(g)).map(t => t || '—')
  ));
  cellTurno.value = uniqTurnos.join('\n');
  cellTurno.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };

  // 2) Celda de DATOS (richText SIN turno)
  const runs: ExcelJS.RichText[] = [];
  const gray = this.toARGB('6b7280');

  groups.forEach((g, gi) => {
    const fr = g.franja || '';
    const hh = g.horas ? `(${g.horas}h)` : '';

    const p = this._cleanToken(g.puesto);
    const m = this._cleanToken(g.maquina);

    const extras: string[] = [];
    if (p) extras.push(p);
    if (m) extras.push(m);

    const header = extras.length
      ? `${fr} ${hh} • ${extras.join(' / ')}`
      : `${fr} ${hh}`.trim();

    runs.push({ text: header || '-', font: { italic: true, color: { argb: gray }, bold: false } });

    // Nombres (+ “compensatorio” si aplica)
    if (g.colaboradores?.length) {
      g.colaboradores.forEach(nombre => {
        runs.push({ text: '\n• ', font: { bold: false, color: { argb: gray } } });
        runs.push({ text: nombre, font: { bold: true } });

        const comp = iso && isComp ? isComp(iso, nombre) : false;
        if (comp) {
          runs.push({ text: ' (compensatorio)', font: { italic: true, color: { argb: gray }, bold: false } });
        }
      });
    } else {
      runs.push({ text: '\n—', font: { bold: false } });
    }

    if (gi < groups.length - 1) runs.push({ text: '\n', font: { bold: false } });
  });

  (cellData as any).value = { richText: runs };
  cellData.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
}

/**
 * Y1: Escribe en dos celdas:
 *  - cellTurno: solo el turno (una línea por grupo, SIN duplicados)
 *  - cellData:  encabezado SIN turno (solo puesto/maquina si existen) + lista de nombres
 *               y marca "(reducción)" al lado del nombre si está en Reducción ese día.
 */
private _setY1SplitCells(
  cellTurno: ExcelJS.Cell,
  cellData: ExcelJS.Cell,
  groups: Array<{ puesto: string; maquina: string; turno: string; colaboradores: string[] }>,
  iso?: string,
  isReduc?: (iso: string, nombre: string) => boolean
) {
  // 1) Celda de TURNOS: SIN duplicados
  const uniqTurnos = Array.from(new Set(
    groups.map(g => (g.turno || '').trim()).map(t => t || '—')
  ));
  cellTurno.value = uniqTurnos.join('\n');
  cellTurno.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };

  // 2) Celda de DATOS (richText SIN turno)
  const runs: ExcelJS.RichText[] = [];
  const gray = this.toARGB('6b7280');

  groups.forEach((g, gi) => {
    // Oculta puesto/maquina si vienen nulos/"sin" (igual que Y2 _cleanToken)
    const p = this._cleanToken(g.puesto);
    const m = this._cleanToken(g.maquina);

    const extras: string[] = [];
    if (p) extras.push(p);
    if (m) extras.push(m);

    const header = extras.length ? extras.join(' / ') : ''; // SIN turno

    // Encabezado (si hay algo que mostrar)
    if (header) {
      runs.push({ text: header, font: { italic: true, color: { argb: gray }, bold: false } });
    } else {
      runs.push({ text: '-', font: { italic: true, color: { argb: gray }, bold: false } });
    }

    // Nombres (+ “reducción” si aplica)
    if (g.colaboradores?.length) {
      g.colaboradores.forEach(nombre => {
        runs.push({ text: '\n• ', font: { bold: false, color: { argb: gray } } });
        runs.push({ text: nombre, font: { bold: true } });

        const reduc = iso && isReduc ? isReduc(iso, nombre) : false;
        if (reduc) {
          runs.push({ text: ' (reducción)', font: { italic: true, color: { argb: gray }, bold: false } });
        }
      });
    } else {
      runs.push({ text: '\n—', font: { bold: false } });
    }

    if (gi < groups.length - 1) runs.push({ text: '\n', font: { bold: false } });
  });

  (cellData as any).value = { richText: runs };
  cellData.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
}


  private setupPage(ws: ExcelJS.Worksheet) {
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 /*A4*/ };
    ws.properties.defaultColWidth = 14;
    ws.properties.defaultRowHeight = 18;
  }

  private addTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, theme: Theme) {
    const titleRow = ws.addRow([title]);
    titleRow.font = { bold: true, size: 16, color: { argb: this.toARGB(theme.title) } };
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    titleRow.height = 24;

    const subRow = ws.addRow([subtitle]);
    subRow.font = { size: 12, color: { argb: this.toARGB(theme.title) } };
    subRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // fondo
    ws.getRow(1).eachCell(cell => cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.toARGB(theme.header) } });
    ws.getRow(2).eachCell(cell => cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.toARGB(theme.header) } });
  }

  private addTwoLineHeader(ws: ExcelJS.Worksheet, hdr: TwoLineHeader, theme: Theme) {
    const top = ws.addRow(hdr.top);
    const bottom = hdr.bottom ? ws.addRow(hdr.bottom) : null;

    [top, bottom].forEach(r => {
      if (!r) return;
      r.font = { bold: true };
      r.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      r.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.toARGB(theme.light) } };
        c.border = {
          top: { style: 'thin', color: { argb: this.toARGB('999999') } },
          left: { style: 'thin', color: { argb: this.toARGB('999999') } },
          bottom: { style: 'thin', color: { argb: this.toARGB('999999') } },
          right: { style: 'thin', color: { argb: this.toARGB('999999') } },
        };
      });
    });

    const lastCol = ws.columnCount || hdr.top.length;
    ws.mergeCells(1, 1, 1, lastCol);
    ws.mergeCells(2, 1, 2, lastCol);
  }

  private wrapRow(row: ExcelJS.Row) {
    row.alignment = { wrapText: true, vertical: 'top' };
  }

  /**
   * headerStart: fila donde comienzan los headers (p.ej. 3 en programación, 4 en Y1/Y2)
   * headerLines: 1 si header de una línea; 2 si header con día + ISO
   */
  private tableLook(
    ws: ExcelJS.Worksheet,
    headerStart: number,
    startCol: number,
    endRow: number,
    endCol: number,
    _theme: Theme,
    zebra = true,
    headerLines = 2
  ) {
    const dataStart = headerStart + headerLines;
    for (let r = headerStart; r <= endRow; r++) {
      const isData = r >= dataStart;
      for (let c = startCol; c <= endCol; c++) {
        const cell = ws.getCell(r, c);
        cell.border = {
          top: { style: 'thin', color: { argb: this.toARGB('cccccc') } },
          left: { style: 'thin', color: { argb: this.toARGB('cccccc') } },
          bottom: { style: 'thin', color: { argb: this.toARGB('cccccc') } },
          right: { style: 'thin', color: { argb: this.toARGB('cccccc') } },
        };
        if (zebra && isData) {
          const odd = (r % 2) === 1;
          if (odd) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.toARGB('f9fafb') } };
        }
        if (c === startCol && !isData) cell.font = { bold: true };
      }
    }
  }

  private autoSizeColumns(ws: ExcelJS.Worksheet) {
    const total = ws.columnCount || (ws as any)._columns?.length || 0;
    for (let i = 1; i <= total; i++) {
      const col = ws.getColumn(i);
      let max = 12;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const raw = cell.value as any;
        let v = '';
        if (raw == null) v = '';
        else if (typeof raw === 'object' && 'text' in raw) v = String((raw as any).text);
        else if (typeof raw === 'object' && 'richText' in raw) v = ((raw as any).richText as any[]).map(r => r.text).join('');
        else if (typeof raw === 'object' && 'formula' in raw) v = String((raw as any).result ?? '');
        else v = String(raw);
        const longest = v.split('\n').reduce((m, line) => Math.max(m, line.length), 0);
        max = Math.max(max, longest + 2);
      });
      col.width = Math.min(Math.max(12, max), 60);
    }
  }

  private joinMultiline(lines: string[]): string {
    if (!lines?.length) return '—';
    return lines.join('\n');
  }

  /** Crea una celda con richText: Nombre (negrita) + salto + (Puesto) en itálica; centrado. */
  private setPeopleCell(cell: ExcelJS.Cell, items: PersonaCell[] | undefined) {
    if (!items?.length) {
      cell.value = '—';
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
      return;
    }
    const runs: ExcelJS.RichText[] = [];
    items.forEach((p, i) => {
      runs.push({ text: `${p.nombre}${p.fijo ? ' 🔒' : ''}`, font: { bold: true } });
      runs.push({ text: `\n(${p.puesto || ''})`, font: { italic: true, color: { argb: this.toARGB('6b7280') } } });
      if (i < items.length - 1) runs.push({ text: '\n' }); // separación entre personas
    });
    (cell as any).value = { richText: runs };
    cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
  }

  private async download(workbook: ExcelJS.Workbook, filename: string) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
  }

  /** Convierte #rrggbb o rrggbb a ARGB (FFrrggbb) */
  private toARGB(hex: string): string {
    const clean = hex.replace('#', '').trim().toUpperCase();
    return clean.length === 8 ? clean : `FF${clean}`;
  }
}
