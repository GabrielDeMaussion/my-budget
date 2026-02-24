/**
 * Interfaz para la categoría de un pago
 *
 * Atributos:
 * - id: Identificador único
 * - value: Nombre de la categoría (e.g. "Salario", "Alimentación")
 */
export interface PaymentCategory {
  id?: number;
  value: string;
}
