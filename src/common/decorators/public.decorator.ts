import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global JwtAuthGuard (see main.ts / AppModule —
 * the JWT guard is applied app-wide by default; this is the escape hatch
 * for signup/login/public catalog browsing). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
