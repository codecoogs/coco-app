-- Where each position sits on the org chart canvas.
--
-- The reporting lines themselves live in positions.parent_position_id (added
-- with the task system). These two columns only remember the arrangement, so
-- the chart someone lays out is the chart everyone else opens. Null means
-- "never been placed", and the page falls back to an automatic tree layout.
--
-- No policy changes: positions already restricts UPDATE to manage_positions,
-- which the President, the VPs, Admin and Software Director hold.

alter table public.positions
  add column if not exists canvas_x double precision;

alter table public.positions
  add column if not exists canvas_y double precision;

comment on column public.positions.canvas_x is
  'Org chart canvas x coordinate. Null until someone arranges the chart.';

comment on column public.positions.canvas_y is
  'Org chart canvas y coordinate. Null until someone arranges the chart.';
