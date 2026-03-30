-- SQL INSERT statements for public.events_attendance
-- Test data for two users
-- attended_at matches the start_time of each event
-- id is auto-generated via gen_random_uuid()

INSERT INTO public.events_attendance (event_id, user_id, attended_at) VALUES

-- User: fe277d8d-5e87-4776-a6aa-e6232b20b1b8 | Events 175 - 186
(175, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 175)),
(176, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 176)),
(177, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 177)),
(178, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 178)),
(179, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 179)),
(180, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 180)),
(181, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 181)),
(182, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 182)),
(183, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 183)),
(184, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 184)),
(185, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 185)),
(186, 'fe277d8d-5e87-4776-a6aa-e6232b20b1b8', (SELECT start_time FROM public.events WHERE id = 186)),

-- User: 90ee314a-14aa-4e1a-8a39-b0cbddc793d2 | Events 170 - 186
(170, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 170)),
(171, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 171)),
(172, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 172)),
(173, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 173)),
(174, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 174)),
(175, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 175)),
(176, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 176)),
(177, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 177)),
(178, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 178)),
(179, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 179)),
(180, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 180)),
(181, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 181)),
(182, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 182)),
(183, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 183)),
(184, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 184)),
(185, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 185)),
(186, '90ee314a-14aa-4e1a-8a39-b0cbddc793d2', (SELECT start_time FROM public.events WHERE id = 186));