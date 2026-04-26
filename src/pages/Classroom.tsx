import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ActivityDisplay } from '@/components/activity/ActivityDisplay';
import type { DemoTokenSource } from '@/components/activity/activityTypes';
import { MataLayout, Surface } from '@/components/MataLayout';
import { ClassroomVideoStrip } from '@/components/video/ClassroomVideoStrip';
import { useAuth } from '@/context/AuthContext';
import { useClassroomChat, type ClassroomChatMessage } from '@/hooks/useClassroomChat';
import { supabase } from '@/lib/supabase';

type ClassroomContext = {
  classId: number;
  lessonNumber: number;
  classLabel: string;
  courseName: string;
  sessionDate: string | null;
  meetingStart: string | null;
  meetingEnd: string | null;
  roster: ClassroomRosterMember[];
};

type ClassroomRosterMember = {
  id: string;
  name: string;
  role: 'teacher' | 'coordinator' | 'student';
  appUserId: number | null;
};

type AppUserSummary = {
  id: number | null;
  display_name: string | null;
  email: string | null;
};

type StudentSummary = {
  id: number;
  name: string | null;
  email: string | null;
  app_user_id: number | null;
  app_users: AppUserSummary | AppUserSummary[] | null;
};

type ClassRow = {
  id: number;
  label: string | null;
  teacher_app_user_id: number | null;
  coordinator_app_user_id: number | null;
  meeting_start: string | null;
  meeting_end: string | null;
  courses: { name: string } | { name: string }[] | null;
  class_sessions: { session_date: string; session_number: number }[] | null;
  teacher: AppUserSummary | AppUserSummary[] | null;
  coordinator: AppUserSummary | AppUserSummary[] | null;
  class_enrollments: { students: StudentSummary | StudentSummary[] | null }[] | null;
};

function readNumberParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readFirstNumberParam(params: URLSearchParams, keys: string[]): number | null {
  for (const key of keys) {
    const value = readNumberParam(params.get(key));
    if (value != null) return value;
  }
  return null;
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function displayName(user: AppUserSummary | null): string | null {
  return user?.display_name?.trim() || user?.email?.split('@')[0] || null;
}

// #region agent log
function debugClassroom(hypothesisId: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7771/ingest/79f1aff3-86e0-4db0-a74d-86ce63141809', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '358ecf' },
    body: JSON.stringify({
      sessionId: '358ecf',
      runId: 'pre-fix',
      hypothesisId,
      location: 'src/pages/Classroom.tsx',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

function buildClassroomRoster(row: ClassRow): ClassroomRosterMember[] {
  const seen = new Set<string>();
  const roster: ClassroomRosterMember[] = [];

  function addMember(member: ClassroomRosterMember) {
    const cleanName = member.name.trim();
    const key = `${member.role}:${member.id}`;
    if (!cleanName || seen.has(key)) return;
    seen.add(key);
    roster.push({ ...member, name: cleanName });
  }

  function addStaff(id: string, role: 'teacher' | 'coordinator', appUser: AppUserSummary | null, appUserId: number | null) {
    const name = displayName(appUser);
    if (!name) return;
    addMember({ id, name, role, appUserId });
  }

  addStaff('teacher', 'teacher', firstRow(row.teacher), row.teacher_app_user_id);

  (row.class_enrollments ?? []).forEach((enrollment, index) => {
    const student = firstRow(enrollment.students);
    const appUser = firstRow(student?.app_users);
    const appUserId = student?.app_user_id ?? appUser?.id ?? null;
    const name = displayName(appUser) || student?.name || student?.email?.split('@')[0] || null;
    if (!student?.id || !name || appUserId === row.teacher_app_user_id || appUserId === row.coordinator_app_user_id) return;
    addMember({
      id: `student-${student.id ?? index}`,
      name,
      role: 'student',
      appUserId,
    });
  });

  debugClassroom('H1', 'built classroom roster', {
    classId: row.id,
    enrollmentCount: row.class_enrollments?.length ?? 0,
    rosterCount: roster.length,
    teacherCount: roster.filter((member) => member.role === 'teacher').length,
    coordinatorCount: roster.filter((member) => member.role === 'coordinator').length,
    studentCount: roster.filter((member) => member.role === 'student').length,
    teacherAppUserIdPresent: row.teacher_app_user_id != null,
    coordinatorAppUserIdPresent: row.coordinator_app_user_id != null,
  });

  return roster;
}

function rosterTokenSources(roster: ClassroomRosterMember[]): DemoTokenSource[] {
  const sources = roster
    .filter((member) => member.role === 'student')
    .map((member) => ({ id: member.id, name: member.name }));
  debugClassroom('H2', 'derived token sources from roster', {
    rosterIsArray: Array.isArray(roster),
    rosterCount: roster.length,
    studentCount: roster.filter((member) => member.role === 'student').length,
    tokenSourceCount: sources.length,
  });
  return sources;
}

export default function Classroom() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { user, loading } = useAuth();
  const classId = readFirstNumberParam(params, ['classId', 'class_id', 'class']);
  const lessonNumber = readFirstNumberParam(params, ['lessonNumber', 'lesson_number', 'lesson']) ?? 1;

  const classroomQuery = useQuery({
    queryKey: ['mata', 'classroom', classId, lessonNumber],
    enabled: !loading && user != null && classId != null,
    queryFn: async (): Promise<ClassroomContext> => {
      const { data: hasAccess, error: accessError } = await supabase.rpc('classroom_has_access', {
        p_class_id: classId as number,
      });
      debugClassroom('H10', 'checked classroom route access', {
        classId,
        lessonNumber,
        hasAccess,
        accessError: accessError?.message ?? null,
      });
      if (accessError) throw accessError;
      if (!hasAccess) throw new Error('You do not have access to this classroom.');

      const { data, error } = await supabase
        .from('classes')
        .select(
          'id, label, teacher_app_user_id, coordinator_app_user_id, meeting_start, meeting_end, courses(name), class_sessions(session_date, session_number), teacher:app_users!classes_teacher_app_user_id_fkey(id, display_name, email), coordinator:app_users!classes_coordinator_app_user_id_fkey(id, display_name, email), class_enrollments(students(id, name, email, app_user_id, app_users(id, display_name, email)))',
        )
        .eq('id', classId as number)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Class not found.');
      const row = data as ClassRow;
      const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      const session = (row.class_sessions ?? []).find((s) => s.session_number === lessonNumber) ?? null;
      return {
        classId: row.id,
        lessonNumber,
        classLabel: row.label ?? `Class ${row.id}`,
        courseName: course?.name ?? 'Course',
        sessionDate: session?.session_date ?? null,
        meetingStart: row.meeting_start,
        meetingEnd: row.meeting_end,
        roster: buildClassroomRoster(row),
      };
    },
  });

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-portal-bg text-portal-muted">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  const classroomData =
    classroomQuery.isSuccess && !classroomQuery.isFetching && classroomQuery.data.classId === classId
      ? classroomQuery.data
      : null;
  const roster = classroomData?.roster ?? [];
  const tokenSources = classroomData ? rosterTokenSources(roster) : [];
  const accessibleClassId = classroomData?.classId ?? null;

  debugClassroom('H1,H2', 'render classroom downstream inputs', {
    classId,
    lessonNumber,
    queryStatus: classroomQuery.status,
    hasData: classroomData != null,
    isFetching: classroomQuery.isFetching,
    rosterCount: roster.length,
    tokenSourceCount: tokenSources.length,
  });

  return (
    <MataLayout>
      <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-[34rem] min-w-0 flex-col lg:min-h-0">
          <ClassroomVideoStrip classId={accessibleClassId} lessonNumber={lessonNumber} roster={roster} />
          <PresentationPlaceholder>
            {classId == null ? (
              <MissingClassroomParams />
            ) : classroomQuery.isPending ? (
              <p className="text-sm text-portal-muted">Loading classroom...</p>
            ) : classroomQuery.isFetching ? (
              <p className="text-sm text-portal-muted">Loading classroom...</p>
            ) : classroomQuery.isError ? (
              <p className="text-sm text-portal-danger">{(classroomQuery.error as Error).message}</p>
            ) : classroomData ? (
              <ActivityDisplay
                classId={classroomData.classId}
                lessonNumber={classroomData.lessonNumber}
                tokenSources={tokenSources}
              />
            ) : null}
          </PresentationPlaceholder>
        </div>
        <ChatPanel classId={accessibleClassId} lessonNumber={lessonNumber} />
      </main>
    </MataLayout>
  );
}

function MissingClassroomParams() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Classroom link missing</h1>
      <p className="mt-2 text-sm text-portal-muted">Open Mata from an akomanga lesson link with class and lesson details.</p>
    </div>
  );
}

function PresentationPlaceholder({ children }: { children: ReactNode }) {
  return (
    <Surface className="flex min-h-[28rem] flex-1 items-center justify-center rounded-none border-0 bg-portal-bg/60 p-0 shadow-none">
      {children}
    </Surface>
  );
}

function ChatPanel({ classId, lessonNumber }: { classId: number | null; lessonNumber: number }) {
  const { appUser } = useAuth();
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const { messages, sendMessage, loading, error } = useClassroomChat({
    classId,
    lessonNumber,
    appUserId: appUser?.id ?? null,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendError(null);
    const nextDraft = draft.trim();
    if (!nextDraft) return;
    const { error: messageError } = await sendMessage(nextDraft);
    if (messageError) {
      setSendError(messageError.message);
      return;
    }
    setDraft('');
  }

  return (
    <Surface className="flex min-h-[24rem] flex-col overflow-hidden rounded-none border-0 border-l border-portal-border shadow-none lg:min-h-0">
      <div className="flex items-center justify-between border-b border-portal-border px-2 py-1">
        <button
          type="button"
          aria-label="Open chat settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-portal-border bg-portal-surface text-portal-muted shadow-sm hover:bg-portal-bg"
        >
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M19.4 15a8 8 0 0 0 .1-1.1v-3.8a8 8 0 0 0-.1-1.1l-2.1-.7-.9-1.5.4-2.2a8.4 8.4 0 0 0-3.3-1.9L12 4.3l-1.5-1.6a8.4 8.4 0 0 0-3.3 1.9l.4 2.2-.9 1.5-2.1.7a8 8 0 0 0-.1 1.1v3.8a8 8 0 0 0 .1 1.1l2.1.7.9 1.5-.4 2.2a8.4 8.4 0 0 0 3.3 1.9l1.5-1.6 1.5 1.6a8.4 8.4 0 0 0 3.3-1.9l-.4-2.2.9-1.5 2.1-.7Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-portal-accent text-xs font-semibold text-white"
          aria-label="Mata profile"
        >
          M
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-1 text-sm">
        {classId == null ? (
          <p className="text-portal-muted">Open a class link to use chat.</p>
        ) : loading ? (
          <p className="text-portal-muted">Loading chat...</p>
        ) : error ? (
          <p className="text-portal-danger">{error.message}</p>
        ) : messages.length === 0 ? (
          <p className="text-portal-muted">No messages yet.</p>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} isOwn={message.appUserId === appUser?.id} />)
        )}
        {sendError ? <p className="text-xs text-portal-danger">{sendError}</p> : null}
      </div>
      <form className="border-t border-portal-border p-0" onSubmit={(event) => void handleSubmit(event)}>
        <label className="sr-only" htmlFor="chat-message">
          Message
        </label>
        <div className="flex">
          <input
            id="chat-message"
            value={draft}
            disabled={classId == null || appUser == null}
            placeholder="Message"
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 border-0 bg-portal-bg px-2 py-1.5 text-sm text-portal-ink placeholder:text-portal-muted"
          />
          <button
            type="submit"
            disabled={classId == null || appUser == null || draft.trim() === ''}
            className="bg-portal-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </Surface>
  );
}

function ChatMessage({ message, isOwn }: { message: ClassroomChatMessage; isOwn: boolean }) {
  return (
    <div className={isOwn ? 'text-right' : undefined}>
      <p className="text-xs font-semibold text-portal-accent">{message.senderName}</p>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-portal-ink">{message.body}</p>
    </div>
  );
}
