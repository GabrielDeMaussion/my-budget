/**
 * Interfaz para el usuario del sistema
 */
export interface User {
  id: number | string;
  email: string;
  password: string;
  name: string;
  lastName: string;
  theme?: string;
}
