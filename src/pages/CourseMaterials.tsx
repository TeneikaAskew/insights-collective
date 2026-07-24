// ABOUTME: Drive-style course materials page. Enrolled students can browse & download files;
// ABOUTME: instructors can create folders, upload files, rename, and delete.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Folder,
  FolderPlus,
  File as FileIcon,
  Upload,
  Trash2,
  Download,
  ChevronRight,
  Home,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { CourseLayout } from '@/components/course/CourseLayout';
import CourseErrorState from '@/components/course/CourseErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useQuery } from '@tanstack/react-query';

interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  course_id: string;
}
interface FileRow {
  id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  bucket: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

const BUCKET = 'course-documents';

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

const CourseMaterials = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { canEdit, isInstructor, isAdmin } = useCoursePermissions(courseId);
  const canManage = canEdit || isInstructor || isAdmin;

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Verify user is enrolled OR instructor. A failed RPC is an outage, not an
  // enrollment verdict — throw so it renders as an error with retry instead
  // of the "You must be enrolled" message. Only a successful `false` result
  // means the user genuinely lacks access.
  const {
    data: canAccess,
    isLoading: accessLoading,
    error: accessError,
    refetch: refetchAccess,
  } = useQuery({
    queryKey: ['can-access-materials', courseId, user?.id],
    enabled: !!courseId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_access_course_materials', {
        _user: user!.id,
        _course: courseId!,
      });
      if (error) throw new Error(error.message || 'Failed to verify course access');
      return !!data;
    },
  });

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setLoadError(null);
    const [foldersRes, filesRes] = await Promise.all([
      supabase.from('course_material_folders').select('*').eq('course_id', courseId).order('name'),
      supabase.from('course_material_files').select('*').eq('course_id', courseId).order('name'),
    ]);
    // A failed query must render as an error, never as an empty folder.
    const queryError = foldersRes.error ?? filesRes.error;
    if (queryError) {
      setFolders([]);
      setFiles([]);
      setLoadError(queryError.message || 'Failed to load course materials');
      setLoading(false);
      return;
    }
    setFolders((foldersRes.data ?? []) as FolderRow[]);
    setFiles((filesRes.data ?? []) as FileRow[]);
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleFolders = useMemo(
    () => folders.filter((f) => f.parent_id === currentFolderId),
    [folders, currentFolderId],
  );
  const visibleFiles = useMemo(
    () => files.filter((f) => f.folder_id === currentFolderId),
    [files, currentFolderId],
  );

  const breadcrumbs = useMemo(() => {
    const chain: FolderRow[] = [];
    let cursor = currentFolderId;
    while (cursor) {
      const f = folders.find((x) => x.id === cursor);
      if (!f) break;
      chain.unshift(f);
      cursor = f.parent_id;
    }
    return chain;
  }, [folders, currentFolderId]);

  const createFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim() || !courseId) return;
    const { error } = await supabase
      .from('course_material_folders')
      .insert({ course_id: courseId, parent_id: currentFolderId, name: name.trim(), created_by: user?.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Folder created');
    await load();
  };

  const renameItem = async (kind: 'folder' | 'file', id: string, current: string) => {
    const name = window.prompt('New name', current);
    if (!name?.trim()) return;
    const table = kind === 'folder' ? 'course_material_folders' : 'course_material_files';
    const { error } = await supabase.from(table).update({ name: name.trim() }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Renamed');
    await load();
  };

  const deleteFolder = async (id: string) => {
    if (!window.confirm('Delete folder and everything inside?')) return;
    const { error } = await supabase.from('course_material_folders').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Folder deleted');
    await load();
  };

  const deleteFile = async (file: FileRow) => {
    if (!window.confirm(`Delete ${file.name}?`)) return;
    await supabase.storage.from(file.bucket).remove([file.storage_path]);
    const { error } = await supabase.from('course_material_files').delete().eq('id', file.id);
    if (error) return toast.error(error.message);
    toast.success('File deleted');
    await load();
  };

  const downloadFile = async (file: FileRow) => {
    const { data, error } = await supabase.storage
      .from(file.bucket)
      .createSignedUrl(file.storage_path, 60 * 10);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? 'Download failed');
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const onUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const input = evt.target;
    const filesToUpload = Array.from(input.files ?? []);
    if (!filesToUpload.length || !courseId) return;
    setUploading(true);
    try {
      for (const f of filesToUpload) {
        const path = `${courseId}/${currentFolderId ?? 'root'}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, f, { cacheControl: '3600', upsert: false });
        if (upErr) {
          toast.error(`${f.name}: ${upErr.message}`);
          continue;
        }
        const { error: dbErr } = await supabase.from('course_material_files').insert({
          course_id: courseId,
          folder_id: currentFolderId,
          name: f.name,
          storage_path: path,
          bucket: BUCKET,
          mime_type: f.type || null,
          size_bytes: f.size,
          uploaded_by: user?.id,
        });
        if (dbErr) toast.error(`${f.name}: ${dbErr.message}`);
      }
      toast.success('Upload complete');
      await load();
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  if (accessLoading) {
    return (
      <CourseLayout>
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </CourseLayout>
    );
  }

  if (accessError) {
    return (
      <CourseLayout>
        <CourseErrorState
          title="Couldn't verify course access"
          error={accessError}
          onRetry={() => void refetchAccess()}
        />
      </CourseLayout>
    );
  }

  if (!canAccess) {
    return (
      <CourseLayout>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You must be enrolled in this course to view its materials.{' '}
            <Link className="underline" to={`/courses/${courseId}`}>
              Back to course
            </Link>
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="text-left">
            <Link
              to={`/courses/${courseId}`}
              className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Back to course
            </Link>
            <h1 className="text-3xl font-bold mt-2">Course materials</h1>
            <p className="text-muted-foreground">Files and folders shared with enrolled students.</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={createFolder}>
                <FolderPlus className="h-4 w-4 mr-2" /> New folder
              </Button>
              <label
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:opacity-90 ${
                  uploading ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload files'}
                <input type="file" multiple className="hidden" onChange={onUpload} />
              </label>
            </div>
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center flex-wrap gap-1 text-sm">
          <button
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setCurrentFolderId(null)}
          >
            <Home className="h-4 w-4" /> Materials
          </button>
          {breadcrumbs.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => setCurrentFolderId(f.id)}
                className="hover:text-foreground text-muted-foreground"
              >
                {f.name}
              </button>
            </span>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : loadError ? (
              <div className="p-6">
                <CourseErrorState
                  title="Error loading materials"
                  error={loadError}
                  onRetry={() => void load()}
                />
              </div>
            ) : visibleFolders.length === 0 && visibleFiles.length === 0 ? (
              <div className="p-10 text-center">
                <Folder className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {canManage
                    ? 'This folder is empty. Upload files or create a subfolder to get started.'
                    : 'No materials here yet.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {visibleFolders.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between p-3 hover:bg-accent/40 group"
                  >
                    <button
                      onClick={() => setCurrentFolderId(f.id)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <Folder className="h-5 w-5 text-primary" />
                      <span className="font-medium truncate">{f.name}</span>
                    </button>
                    {canManage && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" onClick={() => renameItem('folder', f.id, f.name)}>
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteFolder(f.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
                {visibleFiles.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between p-3 hover:bg-accent/40 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatSize(file.size_bytes)}
                          {file.mime_type ? ` • ${file.mime_type}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => downloadFile(file)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => renameItem('file', file.id, file.name)}
                          >
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteFile(file)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </CourseLayout>
  );
};

export default CourseMaterials;
