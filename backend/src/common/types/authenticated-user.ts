import { Papel } from '../constants/papeis';

export interface AuthenticatedUser {
  id: string;
  email: string;
  papel_global: Papel;
}
