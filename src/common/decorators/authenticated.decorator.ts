import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_KEY = 'authenticated';
export const Authenticated = () => SetMetadata(AUTHENTICATED_KEY, true);
