-- SQL INSERT statements for public.events
-- Generated from Events sheet Spring 2026
-- Notes:
--   - status: 'CANCELED' mapped to 'cancelled', all others mapped to 'active'
--   - Times assumed PM where ambiguous
--   - NULL used for missing dates/times/locations
--   - google_event_id, point_category, flyer_url left NULL (not in source data)
--   - is_public defaults to false per schema

INSERT INTO public.events (title, description, start_time, end_time, location, status, is_public) VALUES
-- Annual Banquet
(
  'Annual Banquet',
  'Scholarships, Executive Board announcement, Food from Olive Garden',
  '2026-04-30 17:30:00',
  '2026-04-30 20:30:00',
  'Ballroom, SC South',
  'active',
  false
),

-- Study Social
(
  'Study Social',
  'Invite TA for finals study guide',
  '2026-04-23 17:30:00',
  '2026-04-23 19:00:00',
  NULL,
  'active',
  false
),

-- Ice Cream Social (CANCELED)
(
  'Ice Cream Social',
  'Making vanilla ice cream in zip bags (might be better next semester)',
  '2026-04-21 00:00:00',
  NULL,
  NULL,
  'cancelled',
  false
),

-- MatLab Workshop
(
  'MatLab Workshop',
  NULL,
  '2026-04-13 17:30:00',
  '2026-04-13 19:00:00',
  NULL,
  'active',
  false
),

-- Databases
(
  'Databases',
  'Normalization, SQL, MYSQL local hosting project.',
  NULL,
  NULL,
  NULL,
  'active',
  false
),

-- Arcade Night
(
  'Arcade Night',
  'Arcade in Student Center South building',
  NULL,
  NULL,
  NULL,
  'active',
  false
),

-- Game Night
(
  'Game Night',
  'Night where people can bring board games + consoles for participants',
  NULL,
  NULL,
  NULL,
  'active',
  false
),

-- How to get Research Opportunities
(
  'How to get Research Opportunities',
  NULL,
  NULL,
  NULL,
  NULL,
  'active',
  false
),

-- Dell Office Visit
(
  'Dell Office Visit',
  'Office visit to Dell for members to learn about their culture and opportunities',
  '2026-04-10 00:00:00',
  NULL,
  NULL,
  'active',
  false
),

-- How to Network in Houston
(
  'How to Network in Houston',
  'A guide on what events to go to and the Houston tech ecosystem',
  '2026-04-09 17:30:00',
  '2026-04-09 19:00:00',
  NULL,
  'active',
  false
),

-- Intro to Data Science and Machine Learning Workshop
(
  'Intro to Data Science and Machine Learning Workshop',
  'Collab w CAI, a combo of a workshop and career advice',
  '2026-04-08 17:30:00',
  '2026-04-08 19:00:00',
  NULL,
  'active',
  false
),

-- Drawing Social
(
  'Drawing Social',
  'Collab with another org (purpose is to find an artist)',
  '2026-04-07 17:30:00',
  '2026-04-07 19:00:00',
  NULL,
  'active',
  false
),

-- Competitions Workshop 3
(
  'Competitions Workshop 3',
  NULL,
  '2026-04-06 00:00:00',
  NULL,
  NULL,
  'active',
  false
),

-- STEM Tournament with SASE (CANCELED)
(
  'STEM Tournament with SASE',
  NULL,
  '2026-04-03 00:00:00',
  NULL,
  NULL,
  'cancelled',
  false
),

-- Team Social 3
(
  'Team Social 3',
  NULL,
  '2026-04-02 00:00:00',
  NULL,
  NULL,
  'active',
  false
),

-- What I Wish I Knew
(
  'What I Wish I Knew',
  'Reps from HPE, American Airlines and NASA (hopefully) will talk about their experience at UH and what they wish they knew in different areas (networking, resources, etc)',
  '2026-04-01 17:30:00',
  '2026-04-01 19:00:00',
  NULL,
  'active',
  false
),

-- Tetris Social
(
  'Tetris Social',
  'Tetris competition with a novice and pro bracket.',
  '2026-03-31 17:30:00',
  '2026-03-31 19:00:00',
  'CBB Room (VSA)',
  'active',
  false
),

-- Second General Meeting
(
  'Second General Meeting',
  'Free Food, Presidential Election, T shirts for members, Team Projects presentation on their progress, mentorship program',
  '2026-03-30 17:30:00',
  '2026-03-30 19:30:00',
  'S 105',
  'active',
  false
),

-- Global AI Bootcamp Hackathon with Microsoft
(
  'Global AI Bootcamp Hackathon with Microsoft',
  'Hackathon',
  '2026-03-25 17:30:00',
  '2026-03-25 19:00:00',
  'Microsoft Office',
  'active',
  false
),

-- Competition 2
(
  'Competition 2',
  NULL,
  '2026-03-23 17:30:00',
  '2026-03-23 19:00:00',
  'Fleming Room 162',
  'active',
  false
),

-- CS Field Day
(
  'CS Field Day',
  NULL,
  '2026-03-13 13:00:00',
  '2026-03-13 19:00:00',
  'MacGregor Park',
  'active',
  false
),

-- Teams Social 2
(
  'Teams Social 2',
  'Hang back with your teams to eat some food, make some pull requests and have fun!',
  '2026-03-10 17:30:00',
  '2026-03-10 19:00:00',
  'S 116',
  'active',
  false
),

-- WISTEM HPE Event
(
  'WISTEM HPE Event',
  'Partnering with HPE and Cougaretts, 5-6 panelists',
  '2026-03-03 17:30:00',
  '2026-03-03 19:00:00',
  'Honor''s College',
  'active',
  false
),

-- Competition 1
(
  'Competition 1',
  'Extra Credit Opportunity! - Rizk''s & Dan''s Data Structures',
  '2026-03-02 17:30:00',
  '2026-03-02 19:00:00',
  'Fleming Room 162',
  'active',
  false
),

-- Competition 2 Workshop
(
  'Competition 2 Workshop',
  'Learn about new Data structure materials on Arrays, Maps, and Stacks',
  '2026-03-09 17:30:00',
  '2026-03-09 19:00:00',
  'Fleming Room 162',
  'active',
  false
),

-- Portfolio In a Box
(
  'Portfolio In a Box',
  'Free Food included! With Jake Burger GitHub repo that has a repository to set up that has everything they need to build and deploy their own portfolio project',
  '2026-02-26 17:30:00',
  '2026-02-26 19:00:00',
  'S 116',
  'active',
  false
),

-- Introduction to Web Development
(
  'Introduction to Web Development',
  'HTML, CSS',
  '2026-02-25 17:30:00',
  '2026-02-25 19:00:00',
  'Roy G Cullen Room 132A',
  'active',
  false
),

-- Teams Social
(
  'Teams Social',
  'Free Food',
  '2026-02-24 17:30:00',
  '2026-02-24 19:30:00',
  'Ballroom East',
  'active',
  false
),

-- Competitions 1 Workshop
(
  'Competitions 1 Workshop',
  'Data Structures workshop, Extra credit opportunity',
  '2026-02-23 17:30:00',
  '2026-02-23 19:00:00',
  'Heyne Building H 34',
  'active',
  false
),

-- Career Fair
(
  'Career Fair',
  NULL,
  '2026-02-19 00:00:00',
  NULL,
  'SC South',
  'active',
  false
),

-- Member-Exclusive LinkedIn Headshots
(
  'Member-Exclusive LinkedIn Headshots',
  NULL,
  '2026-02-18 14:00:00',
  '2026-02-18 16:00:00',
  'SC North',
  'active',
  false
),

-- Career Fair Prep Workshop
(
  'Career Fair Prep Workshop',
  'Resume building, review and elevator pitch',
  '2026-02-12 17:30:00',
  '2026-02-12 19:00:00',
  'Roy G. Cullen, Room 104',
  'active',
  false
),

-- Kokee Tea Social & Fundraiser
(
  'Kokee Tea Social & Fundraiser',
  NULL,
  '2026-02-10 17:30:00',
  '2026-02-10 19:00:00',
  'Kokee Tea',
  'active',
  false
),

-- Resume Building & Review (CANCELED)
(
  'Resume Building & Review',
  NULL,
  '2026-02-09 17:30:00',
  '2026-02-09 19:00:00',
  'PGH 563',
  'cancelled',
  false
),

-- Code Coogs First GM
(
  'Code Coogs First GM',
  'Food, prizes, officer intro, info on member point system, and scholarships',
  '2026-01-28 17:30:00',
  '2026-01-28 19:00:00',
  'Multipurpose Room',
  'active',
  false
),

-- Cat''s Back
(
  'Cat''s Back',
  NULL,
  '2026-01-22 00:00:00',
  NULL,
  NULL,
  'active',
  false
),

-- Officer Social (TBD date)
(
  'Officer Social',
  NULL,
  NULL,
  NULL,
  NULL,
  'active',
  false
);