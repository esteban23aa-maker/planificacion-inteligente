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

  /** Compensatorios Y1 */
  /** Compensatorios Y1 (cabecera 2 líneas + celdas ricas) */
  async exportY1(opts: {
    filename?: string;
    titulo: string; subtitulo: string;
    cols: { label: string; iso: string }[];
    rows: Array<{ reemplazo: string; cells: Record<string, { groups: Array<{ puesto: string; maquina: string; turno: string; colaboradores: string[] }> }> }>;
  }) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Compensatorios', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] });
    this.setupPage(ws);
    this.addTitle(ws, opts.titulo, opts.subtitulo, THEME.y1);

    // Cabecera “Día / ISO”
    this.addTwoLineHeader(ws, {
      top: ['Reemplazo', ...opts.cols.map(c => c.label)],
      bottom: ['', ...opts.cols.map(c => c.iso)],
    }, THEME.y1);

    // Filas
    for (const r of opts.rows) {
      // fila vacía para poder escribir richText por celda
      const row = ws.addRow(new Array(1 + opts.cols.length).fill(null));

      // Columna 1: Reemplazo (bonito = negrita)
      const c1 = row.getCell(1);
      c1.value = r.reemplazo || '—';
      c1.font = { bold: true };
      c1.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      // Celdas por día (rich)
      opts.cols.forEach((col, i) => {
        const cell = row.getCell(2 + i);
        const cellData = r.cells[col.iso];
        if (!cellData?.groups?.length) {
          cell.value = '—';
          cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
        } else {
          this.setY1Cell(cell, cellData.groups);
        }
      });

      this.wrapRow(row);
    }

    this.tableLook(ws, 4, 1, ws.rowCount, ws.columnCount, THEME.y1, true, 2);
    this.autoSizeColumns(ws);
    await this.download(wb, opts.filename || 'Compensatorios_Y1.xlsx');
  }

  /** RichText Y1: encabezado gris/itálica + lista de nombres (solo el nombre en negrilla) */
  private setY1Cell(
    cell: ExcelJS.Cell,
    groups: Array<{ puesto: string; maquina: string; turno: string; colaboradores: string[] }>
  ) {
    const runs: ExcelJS.RichText[] = [];
    const gray = this.toARGB('6b7280');

    groups.forEach((g, gi) => {
      const header = `[${g.puesto || '-'}] • [${g.maquina || '-'}] • [${g.turno || '-'}]`;

      // Encabezado del grupo (no en negrita)
      runs.push({ text: header, font: { italic: true, color: { argb: gray }, bold: false } });

      if (g.colaboradores?.length) {
        g.colaboradores.forEach((nombre) => {
          // Viñeta normal (siempre quitar bold explícitamente)
          runs.push({ text: '\n• ', font: { bold: false, color: { argb: gray } } });
          // Nombre en negrita
          runs.push({ text: nombre, font: { bold: true } });
          // (opcional) Puesto en itálica gris para igualar el look de Domingo
        });
      } else {
        runs.push({ text: '\n—', font: { bold: false } });
      }

      // Separación entre grupos (forzar no-bold)
      if (gi < groups.length - 1) runs.push({ text: '\n', font: { bold: false } });
    });

    (cell as any).value = { richText: runs };
    cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
  }

  /** Reducciones Y2 */
  /** Reducciones Y2 (cabecera 2 líneas + celdas ricas) */
  async exportY2(opts: {
    filename?: string;
    titulo: string; subtitulo: string;
    cols: { label: string; iso: string }[];
    rows: Array<{ reemplazo: string; cells: Record<string, { groups: Array<{ puesto: string; maquina: string; turno: string; franja: string; horas: number; colaboradores: string[] }> }> }>;
    incidencias?: Array<{ colaboradorNombre: string; grupo: string; fecha: string; turno?: string; franja?: string; motivo: string; }>;
  }) {
    const wb = new ExcelJS.Workbook();

    // Hoja Reducciones
    const ws = wb.addWorksheet('Reducciones', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] });
    this.setupPage(ws);
    this.addTitle(ws, opts.titulo, opts.subtitulo, THEME.y2);

    // Cabecera Día / ISO
    this.addTwoLineHeader(ws, {
      top: ['Reemplazo', ...opts.cols.map(c => c.label)],
      bottom: ['', ...opts.cols.map(c => c.iso)],
    }, THEME.y2);

    // Filas (una por reemplazo)
    for (const r of opts.rows) {
      const row = ws.addRow(new Array(1 + opts.cols.length).fill(null));

      // Columna 1: Reemplazo en negrita
      const c1 = row.getCell(1);
      c1.value = r.reemplazo || '—';
      c1.font = { bold: true };
      c1.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      // Celdas por día (richText)
      opts.cols.forEach((col, i) => {
        const cell = row.getCell(2 + i);
        const data = r.cells[col.iso];
        if (!data?.groups?.length) {
          cell.value = '—';
          cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
        } else {
          this.setY2Cell(cell, data.groups);
        }
      });

      this.wrapRow(row);
    }

    this.tableLook(ws, 4, 1, ws.rowCount, ws.columnCount, THEME.y2, true, 2);
    this.autoSizeColumns(ws);

    // Hoja Incidencias (igual que ya tenías)
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

  // ======================== HELPERS ========================
  /** RichText Y2: encabezado gris/itálica + lista de nombres (solo el nombre en negrilla) */
  private setY2Cell(
    cell: ExcelJS.Cell,
    groups: Array<{ puesto: string; maquina: string; turno: string; franja: string; horas: number; colaboradores: string[] }>
  ) {
    const runs: ExcelJS.RichText[] = [];
    const gray = this.toARGB('6b7280');

    groups.forEach((g, gi) => {
      // Encabezado del grupo (turno + franja + horas + puesto/maquina) en gris itálica, SIN negrita <--------------
      const header =
        `${g.franja || '-'} ${g.horas ? `(${g.horas}h)` : ''} • ${g.puesto || '-'}/${g.maquina || '-'}`;
      runs.push({ text: header, font: { italic: true, color: { argb: gray }, bold: false } });

      // Lista de colaboradores: viñeta normal + NOMBRE en negrita
      if (g.colaboradores?.length) {
        g.colaboradores.forEach(nombre => {
          runs.push({ text: '\n• ', font: { bold: false, color: { argb: gray } } });
          runs.push({ text: nombre, font: { bold: true } });
          // si quisieras añadir (puesto) debajo: descomenta la línea siguiente
          // runs.push({ text: `\n(${g.puesto || ''})`, font: { italic: true, color: { argb: gray }, bold: false } });
        });
      } else {
        runs.push({ text: '\n—', font: { bold: false } });
      }

      // Separación entre grupos
      if (gi < groups.length - 1) runs.push({ text: '\n', font: { bold: false } });
    });

    (cell as any).value = { richText: runs };
    cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
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
      const isData = r > dataStart;
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
