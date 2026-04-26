import { useRef, useState, type PointerEvent } from 'react';
import {
  type DemoActivityAction,
  type DemoActivityState,
  type DemoToken,
} from '@/components/activity/activityTypes';

type DemoActivityProps = {
  state: DemoActivityState;
  disabled: boolean;
  onAction: (
    actionType: DemoActivityAction,
    payload: Record<string, unknown>,
    nextState: DemoActivityState,
  ) => Promise<{ error: Error | null }>;
};

function clamp(value: number): number {
  return Math.max(5, Math.min(95, value));
}

function tokenClassName(color: DemoToken['color']): string {
  if (color === 'amber') {
    return 'border-amber-700 bg-amber-500 text-white';
  }
  if (color === 'stone') {
    return 'border-stone-700 bg-stone-500 text-white';
  }
  return 'border-portal-accent bg-portal-accent text-white';
}

function moveToken(state: DemoActivityState, tokenId: string, x: number, y: number): DemoActivityState {
  return {
    ...state,
    tokens: state.tokens.map((token) => (token.id === tokenId ? { ...token, x, y } : token)),
    updatedAt: new Date().toISOString(),
  };
}

export function DemoActivity({ state, disabled, onAction }: DemoActivityProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [draftState, setDraftState] = useState<DemoActivityState | null>(null);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const displayState = draftState ?? state;

  function readPoint(event: PointerEvent): { x: number; y: number } | null {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    };
  }

  function startDrag(tokenId: string, event: PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingTokenId(tokenId);
    setDraftState(state);
  }

  function updateDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingTokenId) return;
    const point = readPoint(event);
    if (!point) return;
    setDraftState((current) => moveToken(current ?? state, draggingTokenId, point.x, point.y));
  }

  async function endDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingTokenId) return;
    const point = readPoint(event);
    const tokenId = draggingTokenId;
    setDraggingTokenId(null);

    if (!point) {
      setDraftState(null);
      return;
    }

    const nextState = moveToken(draftState ?? state, tokenId, point.x, point.y);
    setDraftState(null);
    await onAction('move_token', { tokenId, x: point.x, y: point.y }, nextState);
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={boardRef} className="relative min-h-[24rem] flex-1 overflow-hidden bg-portal-surface">
        {displayState.tokens.map((token) => (
          <button
            key={token.id}
            type="button"
            disabled={disabled}
            onPointerDown={(event) => startDrag(token.id, event)}
            onPointerMove={updateDrag}
            onPointerUp={(event) => void endDrag(event)}
            className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border-2 text-lg font-bold shadow-sm ${tokenClassName(
              token.color,
            )}`}
            style={{ left: `${token.x}%`, top: `${token.y}%` }}
            aria-label={`Move token ${token.name}`}
            title={token.name}
          >
            {token.label}
          </button>
        ))}
      </div>
    </div>
  );
}
