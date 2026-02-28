/**
 * Interfaz para la categoría de un pago
 *
 * Atributos:
 * - id: Identificador único
 * - value: Nombre de la categoría (e.g. "Salario", "Alimentación")
 * - parentId: ID de la categoría padre (null/undefined = categoría raíz)
 */
export interface PaymentCategory {
  id?: number;
  value: string;
  parentId?: number | null;
}
