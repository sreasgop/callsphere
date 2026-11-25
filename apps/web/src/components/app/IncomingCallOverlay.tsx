import { Phone, PhoneOff } from 'lucide-react';
import { formatUidDisplay } from '../../lib/format';
import { Badge } from '../ui/Badge';

interface IncomingCallOverlayProps {
  callerName: string;
  fromUid: string;
  isSavedContact: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallOverlay({
  callerName,
  fromUid,
  isSavedContact,
  onAccept,
  onReject,
}: IncomingCallOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-[380px] bg-surface border border-border-default rounded-lg p-7 text-center shadow-2xl">
        <div className="relative mx-auto size-20 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-online/40 animate-ping" />
          <div className="relative size-20 rounded-full bg-elevated border border-border-strong flex items-center justify-center text-2xl font-semibold text-text-primary">
            {callerName.charAt(0).toUpperCase()}
          </div>
        </div>

        <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-text-primary">
          {callerName}
        </h2>
        <div className="mt-1 font-mono tabular-nums text-sm text-text-secondary">
          {formatUidDisplay(fromUid)}
        </div>

        <div className="mt-3 flex justify-center">
          <Badge tone={isSavedContact ? 'online' : 'neutral'}>
            {isSavedContact ? 'Saved Contact' : 'Not in Contacts'}
          </Badge>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onReject}
            className="h-12 rounded-full bg-danger hover:bg-danger/90 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <PhoneOff className="size-4" strokeWidth={1.75} />
            <span>Decline</span>
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="h-12 rounded-full bg-online hover:bg-online/90 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Phone className="size-4" strokeWidth={1.75} />
            <span>Answer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
