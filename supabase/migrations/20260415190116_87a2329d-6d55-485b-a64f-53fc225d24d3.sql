
-- Create storage bucket for content files
INSERT INTO storage.buckets (id, name, public) VALUES ('content-files', 'content-files', true);

-- Anyone can view files (public bucket for portal access)
CREATE POLICY "Content files publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'content-files');

-- Authenticated users can upload files
CREATE POLICY "Authenticated users can upload content files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content-files');

-- Authenticated users can delete their files
CREATE POLICY "Authenticated users can delete content files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'content-files');

-- Authenticated users can update files
CREATE POLICY "Authenticated users can update content files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'content-files');
