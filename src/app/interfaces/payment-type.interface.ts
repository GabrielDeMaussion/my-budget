/**
 * Interfaz para el tipo de pago (Ingreso / Gasto)
 *
 * Atributos:
 * - id: Identificador único
 * - value: Nombre del tipo (e.g. "Ingreso", "Gasto")
 */
export interface PaymentType {
  id: number;
  value: string;
}
