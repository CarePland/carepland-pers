insert into public.health_topics (
  slug,
  display_name,
  domain,
  category,
  description,
  aliases,
  sort_order
)
values
  ('diabetes', 'Diabetes', 'health', 'conditions', 'Diabetes, blood sugar, A1C, insulin, and related care context.', array['blood sugar', 'glucose', 'a1c', 'insulin'], 110),
  ('arthritis', 'Arthritis', 'health', 'conditions', 'Arthritis, joint stiffness, inflammation, and related mobility context.', array['joint stiffness', 'joint inflammation'], 120),
  ('asthma_breathing', 'Asthma / Breathing', 'health', 'conditions', 'Asthma, breathing symptoms, inhalers, and respiratory follow-up.', array['asthma', 'breathing', 'shortness of breath', 'wheezing', 'inhaler'], 130),
  ('procedures', 'Procedures', 'health', 'procedures', 'Procedures, surgeries, biopsies, colonoscopies, and procedure follow-up.', array['procedure', 'surgery', 'biopsy', 'colonoscopy', 'operation'], 140),
  ('physical_therapy', 'Physical Therapy', 'health', 'therapy', 'Physical therapy, rehab exercises, and therapy follow-up.', array['pt', 'physio', 'rehab', 'rehabilitation', 'therapy exercises'], 150),
  ('walking_balance', 'Walking / Balance', 'health', 'mobility', 'Walking, balance, falls, mobility, and exercise tolerance.', array['walking', 'balance', 'fall risk', 'falls', 'mobility', 'exercise tolerance'], 160),
  ('anxiety_stress', 'Anxiety / Stress', 'health', 'mental_health', 'Anxiety, stress, worry, and related care context.', array['anxiety', 'stress', 'worry', 'panic'], 170),
  ('mood_depression', 'Mood / Depression', 'health', 'mental_health', 'Mood, depression, low mood, and emotional health context.', array['depression', 'depressed', 'mood', 'low mood'], 180),
  ('preventive_care', 'Preventive Care', 'health', 'preventive_care', 'Annual visits, screenings, vaccines, and preventive care planning.', array['annual physical', 'wellness visit', 'screening', 'screenings', 'vaccination', 'vaccinations', 'vaccine'], 190),
  ('nutrition_weight', 'Nutrition / Weight', 'health', 'nutrition', 'Nutrition, diet, weight, appetite, and related care context.', array['nutrition', 'diet', 'weight', 'appetite', 'eating'], 200),
  ('cardiology', 'Cardiology', 'health', 'specialists', 'Cardiology visits and heart-related specialist context.', array['cardiologist', 'heart doctor'], 210),
  ('orthopedics', 'Orthopedics', 'health', 'specialists', 'Orthopedics visits and bone, joint, or muscle specialist context.', array['orthopedic', 'orthopedist', 'ortho'], 220),
  ('neurology', 'Neurology', 'health', 'specialists', 'Neurology visits and nervous-system specialist context.', array['neurologist', 'neuro'], 230),
  ('home_monitoring', 'Home Monitoring', 'care_logistics', 'follow_up', 'Home readings, logs, tracking, and monitoring between appointments.', array['home monitoring', 'home readings', 'tracking at home', 'log readings'], 240)
on conflict (slug) do update
set
  display_name = excluded.display_name,
  domain = excluded.domain,
  category = excluded.category,
  description = excluded.description,
  aliases = excluded.aliases,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
