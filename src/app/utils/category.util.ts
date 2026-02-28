import { PaymentCategory } from '../interfaces/payment-category.interface';

/**
 * Devuelve el nombre completo de una categoría.
 * Si es subcategoría, retorna "Padre > Hijo".
 * Si es raíz o no tiene padre, retorna solo el valor.
 */
export function getCategoryDisplayName(
  categoryId: number | undefined,
  categories: PaymentCategory[]
): string {
  if (!categoryId) return '—';
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return '—';

  if (cat.parentId) {
    const parent = categories.find((c) => c.id === cat.parentId);
    return parent ? `${parent.value} > ${cat.value}` : cat.value;
  }

  return cat.value;
}
