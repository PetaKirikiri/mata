import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type ClassroomChatMessage = {
  id: string;
  classId: number;
  lessonNumber: number;
  appUserId: number;
  senderName: string;
  body: string;
  createdAt: string;
};

type MessageRow = {
  id: string;
  class_id: number;
  lesson_number: number;
  app_user_id: number;
  body: string;
  created_at: string;
};

type InsertPayload = {
  new?: MessageRow;
};

type SenderProfile = {
  display_name: string | null;
  email: string;
};

type UseClassroomChatArgs = {
  classId: number | null;
  lessonNumber: number;
  appUserId: number | null;
};

function readSenderName(user: SenderProfile | undefined): string {
  return user?.display_name?.trim() || user?.email?.split('@')[0] || 'User';
}

function mapMessage(row: MessageRow, profiles: Map<number, SenderProfile>): ClassroomChatMessage {
  return {
    id: row.id,
    classId: row.class_id,
    lessonNumber: row.lesson_number,
    appUserId: row.app_user_id,
    senderName: readSenderName(profiles.get(row.app_user_id)),
    body: row.body,
    createdAt: row.created_at,
  };
}

async function fetchSenderProfiles(appUserIds: number[]): Promise<Map<number, SenderProfile>> {
  const uniqueIds = Array.from(new Set(appUserIds));
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase.from('app_users').select('id, display_name, email').in('id', uniqueIds);
  if (error) throw error;

  return new Map(
    ((data ?? []) as Array<SenderProfile & { id: number }>).map((profile) => [
      profile.id,
      { display_name: profile.display_name, email: profile.email },
    ]),
  );
}

async function fetchMessages(classId: number, lessonNumber: number): Promise<ClassroomChatMessage[]> {
  const { data, error } = await supabase
    .from('classroom_messages')
    .select('id, class_id, lesson_number, app_user_id, body, created_at')
    .eq('class_id', classId)
    .eq('lesson_number', lessonNumber)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;
  const rows = (data ?? []) as MessageRow[];
  const profiles = await fetchSenderProfiles(rows.map((row) => row.app_user_id));
  return rows.map((row) => mapMessage(row, profiles));
}

async function fetchMessage(id: string): Promise<ClassroomChatMessage | null> {
  const { data, error } = await supabase
    .from('classroom_messages')
    .select('id, class_id, lesson_number, app_user_id, body, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row = data as MessageRow;
  const profiles = await fetchSenderProfiles([row.app_user_id]);
  return mapMessage(row, profiles);
}

export function useClassroomChat({ classId, lessonNumber, appUserId }: UseClassroomChatArgs) {
  const [messages, setMessages] = useState<ClassroomChatMessage[]>([]);

  const messagesQuery = useQuery({
    queryKey: ['mata', 'classroom-chat', classId, lessonNumber],
    enabled: classId != null && appUserId != null,
    queryFn: () => fetchMessages(classId as number, lessonNumber),
  });

  useEffect(() => {
    if (messagesQuery.data) {
      setMessages(messagesQuery.data);
    }
  }, [messagesQuery.data]);

  useEffect(() => {
    if (classId == null || appUserId == null) return undefined;

    const channel = supabase
      .channel(`classroom-chat:${classId}:${lessonNumber}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'classroom_messages',
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          const row = (payload as InsertPayload).new;
          if (!row || row.lesson_number !== lessonNumber) return;
          void fetchMessage(row.id).then((message) => {
            if (!message) return;
            setMessages((current) => {
              if (current.some((existing) => existing.id === message.id)) return current;
              return [...current, message];
            });
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appUserId, classId, lessonNumber]);

  const sendMessage = useCallback(
    async (body: string): Promise<{ error: Error | null }> => {
      const trimmed = body.trim();
      if (!trimmed || classId == null || appUserId == null) {
        return { error: null };
      }

      const { error } = await supabase.from('classroom_messages').insert({
        class_id: classId,
        lesson_number: lessonNumber,
        app_user_id: appUserId,
        body: trimmed,
      });

      return { error: (error as Error | null) ?? null };
    },
    [appUserId, classId, lessonNumber],
  );

  return useMemo(
    () => ({
      messages,
      sendMessage,
      loading: messagesQuery.isPending,
      error: messagesQuery.error as Error | null,
    }),
    [messages, messagesQuery.error, messagesQuery.isPending, sendMessage],
  );
}
