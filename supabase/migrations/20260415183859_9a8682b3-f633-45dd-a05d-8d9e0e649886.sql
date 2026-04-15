
-- Create roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'editor', 'viewer');

-- Create project status enum
CREATE TYPE public.project_status AS ENUM ('briefing', 'in_progress', 'review', 'completed', 'paused', 'cancelled');

-- Create content status enum
CREATE TYPE public.content_status AS ENUM ('draft', 'in_review', 'revision', 'approved', 'published');

-- Create content type enum
CREATE TYPE public.content_type AS ENUM ('photo', 'video', 'reels', 'stories', 'carousel', 'cover', 'banner', 'other');

-- Create priority enum
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create client status enum
CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'prospect');

-- Update timestamps function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Roles viewable by authenticated" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  status public.client_status NOT NULL DEFAULT 'active',
  notes TEXT,
  profile_type TEXT DEFAULT 'normal',
  avg_response_time INTERVAL,
  total_revisions INTEGER DEFAULT 0,
  total_approvals INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients viewable by authenticated" ON public.clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clients manageable by authenticated" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Clients updatable by authenticated" ON public.clients
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Clients deletable by authenticated" ON public.clients
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  status public.project_status NOT NULL DEFAULT 'briefing',
  priority public.priority_level NOT NULL DEFAULT 'medium',
  deadline DATE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Projects viewable by authenticated" ON public.projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Projects manageable by authenticated" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Projects updatable by authenticated" ON public.projects
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Projects deletable by authenticated" ON public.projects
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contents table
CREATE TABLE public.contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type public.content_type NOT NULL DEFAULT 'other',
  status public.content_status NOT NULL DEFAULT 'draft',
  priority public.priority_level NOT NULL DEFAULT 'medium',
  deadline DATE,
  revision_limit INTEGER DEFAULT 3,
  revision_count INTEGER DEFAULT 0,
  checklist JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contents viewable by authenticated" ON public.contents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Contents manageable by authenticated" ON public.contents
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Contents updatable by authenticated" ON public.contents
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Contents deletable by authenticated" ON public.contents
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Content versions table
CREATE TABLE public.content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES public.contents(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_url TEXT,
  notes TEXT,
  status public.content_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Versions viewable by authenticated" ON public.content_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Versions manageable by authenticated" ON public.content_versions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Versions updatable by authenticated" ON public.content_versions
  FOR UPDATE TO authenticated USING (true);

-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_version_id UUID REFERENCES public.content_versions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated" ON public.comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comments insertable by authenticated" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Comments deletable by owner" ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tags viewable by authenticated" ON public.tags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tags manageable by authenticated" ON public.tags
  FOR ALL TO authenticated USING (true);

-- Tag associations
CREATE TABLE public.client_tags (
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (client_id, tag_id)
);

ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client tags accessible by authenticated" ON public.client_tags
  FOR ALL TO authenticated USING (true);

CREATE TABLE public.project_tags (
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (project_id, tag_id)
);

ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project tags accessible by authenticated" ON public.project_tags
  FOR ALL TO authenticated USING (true);

CREATE TABLE public.content_tags (
  content_id UUID REFERENCES public.contents(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (content_id, tag_id)
);

ALTER TABLE public.content_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Content tags accessible by authenticated" ON public.content_tags
  FOR ALL TO authenticated USING (true);

-- Activity logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logs viewable by authenticated" ON public.activity_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Logs insertable by authenticated" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_contents_project_id ON public.contents(project_id);
CREATE INDEX idx_contents_status ON public.contents(status);
CREATE INDEX idx_content_versions_content_id ON public.content_versions(content_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);
