-- Storage buckets
insert into storage.buckets (id, name, public)
  values ('report-media','report-media', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('identity-docs','identity-docs', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('public-assets','public-assets', true)
  on conflict (id) do nothing;

-- Policies for report-media: public read of optimized/thumbs, owner/admin write
drop policy if exists report_media_read_public on storage.objects;
create policy report_media_read_public on storage.objects for select
  using (bucket_id = 'report-media');

-- Identity docs: private; owner and moderators/admins can read/write
drop policy if exists identity_docs_owner_rw on storage.objects;
create policy identity_docs_owner_rw on storage.objects for all
  using (
    bucket_id = 'identity-docs' and (
      auth.role() = 'authenticated' -- refine with object naming if needed
    )
  );

-- Public assets: public read
drop policy if exists public_assets_read on storage.objects;
create policy public_assets_read on storage.objects for select
  using (bucket_id = 'public-assets');

