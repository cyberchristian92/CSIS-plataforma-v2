import { SetMetadata } from '@nestjs/common';
import { Papel } from '../constants/papeis';

export const ROLES_KEY = 'roles';
export const Roles = (...papeis: Papel[]) => SetMetadata(ROLES_KEY, papeis);
