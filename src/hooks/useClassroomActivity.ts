import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  buildDemoActivityState,
  DEMO_ACTIVITY_TYPE,
  parseDemoActivityState,
  type DemoActivityAction,
  type DemoActivityState,
  type DemoTokenSource,
} from '@/components/activity/activityTypes';

type ActivityRow = {
  id: string;
  class_id: number;
  lesson_number: number;
  activity_type: string;
  title: string;
  is_active: boolean;
};

type ActivitySnapshotPayload = {
  new?: {
    state?: unknown;
  };
};

type UseClassroomActivityArgs = {
  classId: number;
  lessonNumber: number;
  appUserId: number | null;
  tokenSources: DemoTokenSource[];
};

type SendActivityAction = (
  actionType: DemoActivityAction,
  payload: Record<string, unknown>,
  nextState: DemoActivityState,
) => Promise<{ error: Error | null }>;

// #region agent log
function debugActivityHook(hypothesisId: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7771/ingest/79f1aff3-86e0-4db0-a74d-86ce63141809', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '358ecf' },
    body: JSON.stringify({
      sessionId: '358ecf',
      runId: 'pre-fix',
      hypothesisId,
      location: 'src/hooks/useClassroomActivity.ts',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

async function loadOrCreateActivity(
  classId: number,
  lessonNumber: number,
  appUserId: number,
  tokenSources: DemoTokenSource[],
): Promise<{ activity: ActivityRow; state: DemoActivityState }> {
  const { data: existing, error: existingError } = await supabase
    .from('classroom_activities')
    .select('id, class_id, lesson_number, activity_type, title, is_active')
    .eq('class_id', classId)
    .eq('lesson_number', lessonNumber)
    .eq('activity_type', DEMO_ACTIVITY_TYPE)
    .maybeSingle();

  if (existingError) throw existingError;

  let activity = existing as ActivityRow | null;
  if (!activity) {
    const [accessCheck, currentAppUserCheck] = await Promise.all([
      supabase.rpc('classroom_has_access', { p_class_id: classId }),
      supabase.rpc('current_app_user_id'),
    ]);

    debugActivityHook('H7,H8,H9', 'before classroom activity create', {
      classId,
      lessonNumber,
      appUserId,
      currentAppUserId: currentAppUserCheck.data,
      currentAppUserError: currentAppUserCheck.error?.message ?? null,
      hasClassroomAccess: accessCheck.data,
      accessError: accessCheck.error?.message ?? null,
      tokenSourceCount: Array.isArray(tokenSources) ? tokenSources.length : null,
    });

    const { data: created, error: createError } = await supabase
      .from('classroom_activities')
      .insert({
        class_id: classId,
        lesson_number: lessonNumber,
        activity_type: DEMO_ACTIVITY_TYPE,
        title: 'Demo board',
        created_by_app_user_id: appUserId,
      })
      .select('id, class_id, lesson_number, activity_type, title, is_active')
      .single();

    if (createError) {
      debugActivityHook('H7,H8,H9', 'classroom activity create failed', {
        classId,
        lessonNumber,
        appUserId,
        currentAppUserId: currentAppUserCheck.data,
        hasClassroomAccess: accessCheck.data,
        errorMessage: createError.message,
        errorCode: createError.code,
        errorDetails: createError.details,
      });
      throw createError;
    }
    activity = created as ActivityRow;
  }

  const { data: snapshot, error: snapshotError } = await supabase
    .from('classroom_activity_snapshots')
    .select('state')
    .eq('activity_id', activity.id)
    .maybeSingle();

  if (snapshotError) throw snapshotError;

  debugActivityHook('H5', 'loaded activity snapshot', {
    classId,
    lessonNumber,
    hasExistingActivity: existing != null,
    hasSnapshot: snapshot?.state != null,
    tokenSourcesIsArray: Array.isArray(tokenSources),
    tokenSourceCount: Array.isArray(tokenSources) ? tokenSources.length : null,
  });

  return {
    activity,
    state: parseDemoActivityState(snapshot?.state, tokenSources),
  };
}

export function useClassroomActivity({ classId, lessonNumber, appUserId, tokenSources }: UseClassroomActivityArgs) {
  debugActivityHook('H3,H4', 'activity hook entry', {
    classId,
    lessonNumber,
    appUserIdPresent: appUserId != null,
    tokenSourcesIsArray: Array.isArray(tokenSources),
    tokenSourceCount: Array.isArray(tokenSources) ? tokenSources.length : null,
  });
  const [state, setState] = useState<DemoActivityState>(() => buildDemoActivityState(tokenSources));
  const tokenSourceKey = tokenSources.map((source) => source.id).join('|');

  const activityQuery = useQuery({
    queryKey: ['mata', 'classroom-activity', classId, lessonNumber, appUserId, tokenSourceKey],
    enabled: appUserId != null,
    queryFn: () => loadOrCreateActivity(classId, lessonNumber, appUserId as number, tokenSources),
  });

  const activity = activityQuery.data?.activity ?? null;

  useEffect(() => {
    if (activityQuery.data?.state) {
      setState(activityQuery.data.state);
    }
  }, [activityQuery.data?.state]);

  useEffect(() => {
    if (!activity?.id) return undefined;

    const channel = supabase
      .channel(`classroom-activity:${activity.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'classroom_activity_snapshots',
          filter: `activity_id=eq.${activity.id}`,
        },
        (payload) => {
          const next = (payload as ActivitySnapshotPayload).new?.state;
          if (next) {
            setState(parseDemoActivityState(next, tokenSources));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activity?.id, tokenSourceKey, tokenSources]);

  const sendAction: SendActivityAction = useCallback(
    async (actionType, payload, nextState) => {
      if (!activity?.id || appUserId == null) {
        return { error: new Error('Activity is not ready.') };
      }

      const previousState = state;
      setState(nextState);

      const { error } = await supabase.from('classroom_activity_events').insert({
        activity_id: activity.id,
        app_user_id: appUserId,
        action_type: actionType,
        payload,
        state_after: nextState,
      });

      if (error) {
        setState(previousState);
        return { error: error as Error };
      }

      return { error: null };
    },
    [activity?.id, appUserId, state],
  );

  return useMemo(
    () => ({
      activity,
      state,
      sendAction,
      loading: activityQuery.isPending,
      error: activityQuery.error as Error | null,
    }),
    [activity, activityQuery.error, activityQuery.isPending, sendAction, state],
  );
}
