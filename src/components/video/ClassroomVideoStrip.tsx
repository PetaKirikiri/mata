import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication } from 'livekit-client';
import { supabase } from '@/lib/supabase';

type RosterMember = {
  id: string;
  name: string;
  role: 'teacher' | 'coordinator' | 'student';
  appUserId: number | null;
};

type ClassroomVideoStripProps = {
  classId: number | null;
  lessonNumber: number;
  roster: RosterMember[];
};

type LiveKitTokenResponse = {
  url: string;
  token: string;
  identity: string;
};

type VideoTrackMap = Record<string, Track | undefined>;

async function fetchLiveKitToken(classId: number, lessonNumber: number): Promise<LiveKitTokenResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!session?.access_token || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('You need to sign in before joining video.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ classId, lessonNumber }),
  });
  const body = (await response.json().catch(() => ({}))) as Partial<LiveKitTokenResponse> & { error?: string };

  if (!response.ok || !body.url || !body.token || !body.identity) {
    throw new Error(body.error ?? 'Could not join video room.');
  }

  return { url: body.url, token: body.token, identity: body.identity };
}

function liveKitIdentity(member: RosterMember): string | null {
  return typeof member.appUserId === 'number' ? `app-user-${member.appUserId}` : null;
}

function isVideoTrack(track: Track): boolean {
  return track.kind === Track.Kind.Video;
}

function VideoTile({ member, track }: { member: RosterMember; track?: Track }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !track) return undefined;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return (
    <div className="relative flex aspect-square w-24 shrink-0 flex-col justify-between overflow-hidden border-r border-portal-border bg-portal-bg p-2">
      {track ? (
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-portal-accent text-sm font-semibold text-white">
          {member.name.slice(0, 1)}
        </div>
      )}
      <p className="relative mt-auto truncate text-sm font-medium text-portal-ink">{member.name}</p>
    </div>
  );
}

export function ClassroomVideoStrip({ classId, lessonNumber, roster }: ClassroomVideoStripProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoTracks, setVideoTracks] = useState<VideoTrackMap>({});

  function setParticipantVideo(identity: string, track?: Track) {
    setVideoTracks((current) => ({ ...current, [identity]: track }));
  }

  function removeParticipant(identity: string) {
    setVideoTracks((current) => {
      const next = { ...current };
      delete next[identity];
      return next;
    });
  }

  async function joinRoom() {
    if (classId == null || connecting || connected) return;
    setError(null);
    setConnecting(true);
    try {
      const tokenResponse = await fetchLiveKitToken(classId, lessonNumber);

      const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
      nextRoom
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (isVideoTrack(track)) setParticipantVideo(participant.identity, track);
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (isVideoTrack(track)) removeParticipant(participant.identity);
        })
        .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => removeParticipant(participant.identity))
        .on(RoomEvent.Disconnected, () => {
          setConnected(false);
          setCameraEnabled(false);
          setMicEnabled(false);
          setVideoTracks({});
          setRoom(null);
        });

      await nextRoom.connect(tokenResponse.url, tokenResponse.token);
      const camera = await nextRoom.localParticipant.setCameraEnabled(true);
      await nextRoom.localParticipant.setMicrophoneEnabled(false);
      if (camera?.videoTrack) setParticipantVideo(tokenResponse.identity, camera.videoTrack);
      setRoom(nextRoom);
      setConnected(true);
      setCameraEnabled(Boolean(camera?.videoTrack));
      setMicEnabled(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join video room.');
    } finally {
      setConnecting(false);
    }
  }

  async function leaveRoom() {
    await room?.disconnect(true);
    setRoom(null);
    setConnected(false);
    setCameraEnabled(false);
    setMicEnabled(false);
    setVideoTracks({});
  }

  async function toggleCamera() {
    if (!room) return;
    const nextEnabled = !cameraEnabled;
    const publication = await room.localParticipant.setCameraEnabled(nextEnabled);
    const identity = room.localParticipant.identity;
    setCameraEnabled(nextEnabled);
    setParticipantVideo(identity, publication?.videoTrack);
  }

  async function toggleMic() {
    if (!room) return;
    const nextEnabled = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(nextEnabled);
    setMicEnabled(nextEnabled);
  }

  useEffect(() => {
    return () => {
      void room?.disconnect(true);
    };
  }, [room]);

  return (
    <div className="overflow-hidden border-b border-portal-border bg-portal-surface">
      <div className="flex items-stretch overflow-x-auto">
        <div className="flex aspect-square w-24 shrink-0 flex-col justify-between border-r border-portal-border bg-portal-surface p-1">
          {connected ? (
            <>
              <button type="button" onClick={() => void toggleCamera()} className="rounded-md border border-portal-border px-1 py-1 text-xs">
                {cameraEnabled ? 'Cam on' : 'Cam off'}
              </button>
              <button type="button" onClick={() => void toggleMic()} className="rounded-md border border-portal-border px-1 py-1 text-xs">
                {micEnabled ? 'Mic on' : 'Mic off'}
              </button>
              <button type="button" onClick={() => void leaveRoom()} className="rounded-md bg-portal-accent px-1 py-1 text-xs text-white">
                Leave
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={classId == null || connecting}
              onClick={() => void joinRoom()}
              className="h-full rounded-md bg-portal-accent px-1 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {connecting ? 'Joining...' : 'Join camera'}
            </button>
          )}
        </div>
        {roster.map((member) => {
          const identity = liveKitIdentity(member);
          return <VideoTile key={member.id} member={member} track={identity ? videoTracks[identity] : undefined} />;
        })}
      </div>
      {error ? <p className="border-t border-portal-border px-2 py-1 text-xs text-portal-danger">{error}</p> : null}
    </div>
  );
}
