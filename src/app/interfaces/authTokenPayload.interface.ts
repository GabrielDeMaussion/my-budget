/** Interfaz para el payload del token de autenticación */
export interface AuthTokenPayload {
    sub: string;
    name: string;
    lastName: string;
    email: string;
}