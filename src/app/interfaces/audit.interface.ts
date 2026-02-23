/**
 * Interfaz base de auditoría que comparten todas las entidades
 *
 * Atributos:
 * - id: Identificador único
 * - createdDate: Fecha de creación
 * - updatedDate: Fecha de última actualización
 * - isActive: Indica si el registro está activo
 */
export interface Audit {
  id: number;
  createdDate: string;
  updatedDate: string;
  isActive: boolean;
}
