export const DEFAULT_AUTO_LOCK_MINUTES = 5;
export const MIN_AUTO_LOCK_MINUTES = 1;
export const MAX_AUTO_LOCK_MINUTES = 60;

/** Activity events that reset the inactivity timer. */
export const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'click'] as const;
