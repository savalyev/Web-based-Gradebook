import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type Role = 'student' | 'teacher';

export interface JwtPayload {
  id: number;
  role: Role;
  email: string;
  fullName: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
