alter table public.profiles
  add column if not exists student_document_type text;

comment on column public.profiles.student_document_type
  is 'Type of student document uploaded for verification (e.g. student_id, enrollment_letter, class_schedule, other)';
