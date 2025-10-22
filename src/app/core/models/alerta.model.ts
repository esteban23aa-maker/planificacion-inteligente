export interface Alerta {
  id: number;
  tipo: string;
  mensaje: string;
  nivel: string;
  resuelta: boolean; // ✅ Añadido
}
