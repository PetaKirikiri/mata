import { DemoActivity } from '@/components/activity/DemoActivity';
import type { DemoTokenSource } from '@/components/activity/activityTypes';
import { useAuth } from '@/context/AuthContext';
import { useClassroomActivity } from '@/hooks/useClassroomActivity';

type ActivityDisplayProps = {
  classId: number;
  lessonNumber: number;
  tokenSources: DemoTokenSource[];
};

// #region agent log
function debugActivityDisplay(hypothesisId: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7771/ingest/79f1aff3-86e0-4db0-a74d-86ce63141809', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '358ecf' },
    body: JSON.stringify({
      sessionId: '358ecf',
      runId: 'pre-fix',
      hypothesisId,
      location: 'src/components/activity/ActivityDisplay.tsx',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

export function ActivityDisplay({ classId, lessonNumber, tokenSources }: ActivityDisplayProps) {
  const { appUser } = useAuth();
  debugActivityDisplay('H3', 'activity display props', {
    classId,
    lessonNumber,
    hasAppUser: appUser != null,
    tokenSourcesIsArray: Array.isArray(tokenSources),
    tokenSourceCount: Array.isArray(tokenSources) ? tokenSources.length : null,
    tokenSourceNames: Array.isArray(tokenSources) ? tokenSources.map((source) => source.name) : null,
  });
  const { state, sendAction, loading, error } = useClassroomActivity({
    classId,
    lessonNumber,
    appUserId: appUser?.id ?? null,
    tokenSources,
  });

  if (!appUser) {
    return <p className="text-sm text-portal-muted">Loading activity profile...</p>;
  }

  if (loading) {
    return <p className="text-sm text-portal-muted">Loading shared activity...</p>;
  }

  if (error) {
    return <p className="text-sm text-portal-danger">{error.message}</p>;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <DemoActivity state={state} disabled={!appUser} onAction={sendAction} />
    </div>
  );
}
