alter table public.users enable row level security;
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users for select to authenticated using (id = auth.uid());

alter table public.period_settings enable row level security;
drop policy if exists period_settings_select on public.period_settings;
drop policy if exists period_settings_insert on public.period_settings;
drop policy if exists period_settings_update on public.period_settings;
drop policy if exists period_settings_delete on public.period_settings;
create policy period_settings_select on public.period_settings for select to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = period_settings.tenant_id));
create policy period_settings_insert on public.period_settings for insert to authenticated with check ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = period_settings.tenant_id));
create policy period_settings_update on public.period_settings for update to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = period_settings.tenant_id)) with check ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = period_settings.tenant_id));
create policy period_settings_delete on public.period_settings for delete to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = period_settings.tenant_id));

alter table public.subjects enable row level security;
drop policy if exists subjects_select on public.subjects;
drop policy if exists subjects_insert on public.subjects;
drop policy if exists subjects_update on public.subjects;
drop policy if exists subjects_delete on public.subjects;
create policy subjects_select on public.subjects for select to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = subjects.tenant_id));
create policy subjects_insert on public.subjects for insert to authenticated with check ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = subjects.tenant_id));
create policy subjects_update on public.subjects for update to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = subjects.tenant_id)) with check ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = subjects.tenant_id));
create policy subjects_delete on public.subjects for delete to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = subjects.tenant_id));

alter table public.teacher_subjects enable row level security;
drop policy if exists teacher_subjects_select on public.teacher_subjects;
drop policy if exists teacher_subjects_insert on public.teacher_subjects;
drop policy if exists teacher_subjects_update on public.teacher_subjects;
drop policy if exists teacher_subjects_delete on public.teacher_subjects;
create policy teacher_subjects_select on public.teacher_subjects for select to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = teacher_subjects.tenant_id));
create policy teacher_subjects_insert on public.teacher_subjects for insert to authenticated with check ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = teacher_subjects.tenant_id));
create policy teacher_subjects_update on public.teacher_subjects for update to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = teacher_subjects.tenant_id)) with check ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = teacher_subjects.tenant_id));
create policy teacher_subjects_delete on public.teacher_subjects for delete to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = teacher_subjects.tenant_id));

alter table public.timetable_entries enable row level security;
drop policy if exists timetable_entries_select on public.timetable_entries;
drop policy if exists timetable_entries_insert on public.timetable_entries;
drop policy if exists timetable_entries_update on public.timetable_entries;
drop policy if exists timetable_entries_delete on public.timetable_entries;
create policy timetable_entries_select on public.timetable_entries for select to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = timetable_entries.tenant_id));
create policy timetable_entries_insert on public.timetable_entries for insert to authenticated with check ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = timetable_entries.tenant_id));
create policy timetable_entries_update on public.timetable_entries for update to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = timetable_entries.tenant_id)) with check ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = timetable_entries.tenant_id));
create policy timetable_entries_delete on public.timetable_entries for delete to authenticated using ((auth.jwt() ? 'tenant_id' and (auth.jwt()->>'tenant_id')::uuid = tenant_id) or exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = timetable_entries.tenant_id));
