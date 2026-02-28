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

/**
 * Devuelve SOLO el nombre de la categoría raíz (padre).
 * Si el categoryId apunta a una subcategoría, retorna el nombre del padre.
 * Si es una categoría raíz, retorna su propio valor.
 */
export function getParentCategoryName(
  categoryId: number | undefined,
  categories: PaymentCategory[]
): string {
  if (!categoryId) return '—';
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return '—';

  if (cat.parentId) {
    const parent = categories.find((c) => c.id === cat.parentId);
    return parent ? parent.value : cat.value;
  }

  return cat.value;
}

/**
 * Devuelve el nombre de la subcategoría (si existe).
 * Si el categoryId apunta a una subcategoría, retorna su valor.
 * Si es una categoría raíz, retorna '—'.
 */
export function getSubcategoryName(
  categoryId: number | undefined,
  categories: PaymentCategory[]
): string {
  if (!categoryId) return '—';
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return '—';

  return cat.parentId ? cat.value : '—';
}

/**
 * Devuelve el ID de la categoría padre (raíz).
 * Si el categoryId apunta a una subcategoría, retorna el parentId.
 * Si es una categoría raíz, retorna el id propio.
 */
export function getParentCategoryId(
  categoryId: number | undefined,
  categories: PaymentCategory[]
): number | undefined {
  if (!categoryId) return undefined;
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return undefined;

  return cat.parentId ? (cat.parentId as number) : cat.id;
}
