-- Pulse — sidebar gradient theme preference.

alter table public.user_settings
  add column if not exists sidebar_theme text not null default 'midnight';

