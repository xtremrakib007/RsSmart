import { SetMetadata } from '@nestjs/common';

// Marks a route as not requiring authentication. Used sparingly: company
// registration/login/refresh, and the WhatsApp Meta webhook endpoints (which
// authenticate via their own signature check, not a user JWT).
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
