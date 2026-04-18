import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { formatDisplayDateTime } from '@shared/dateUtils';
import { TIMEZONE } from '@shared/constants';
import type { ApprovalDetailsResponse } from '@shared/types';
import {
  CalendarCheck, User, Clock, FileText, Mail,
  CheckCircle2, XCircle, Loader2, AlertTriangle,
} from 'lucide-react';

interface Props {
  token: string;
}

type PageState =
  | { phase: 'loading' }
  | { phase: 'loaded'; details: ApprovalDetailsResponse }
  | { phase: 'decided'; outcome: 'approved' | 'rejected' }
  | { phase: 'error'; message: string };

export function ApprovalPage({ token }: Props) {
  const [state, setState] = useState<PageState>({ phase: 'loading' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    api
      .getApprovalDetails(token)
      .then((details) => setState({ phase: 'loaded', details }))
      .catch((err: { error?: string }) =>
        setState({ phase: 'error', message: err.error ?? 'Failed to load appointment details.' }),
      );
  }, [token]);

  async function handleConfirm() {
    setActionLoading(true);
    try {
      await api.confirmApproval(token);
      setState({ phase: 'decided', outcome: 'approved' });
    } catch (err: unknown) {
      const e = err as { error?: string };
      setState({ phase: 'error', message: e.error ?? 'Failed to confirm appointment.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecline() {
    setActionLoading(true);
    try {
      await api.declineApproval(token);
      setState({ phase: 'decided', outcome: 'rejected' });
    } catch (err: unknown) {
      const e = err as { error?: string };
      setState({ phase: 'error', message: e.error ?? 'Failed to decline appointment.' });
    } finally {
      setActionLoading(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <div className="form-card max-w-md w-full mx-4 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading appointment details…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <div className="form-card max-w-md w-full mx-4 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-300 dark:border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Invalid Link</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Already decided ──────────────────────────────────────────────────────
  if (state.phase === 'decided') {
    const approved = state.outcome === 'approved';
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <div className="form-card max-w-md w-full mx-4 text-center space-y-4 animate-fade-in">
          <div className="flex justify-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${approved ? 'screen-icon-bg-emerald' : 'bg-red-500/15 border border-red-300 dark:border-red-500/30'}`}>
              {approved
                ? <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                : <XCircle className="w-7 h-7 text-red-600 dark:text-red-400" />}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {approved ? 'Appointment Confirmed' : 'Appointment Declined'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {approved
                ? 'A calendar invitation has been created and the client has been notified.'
                : 'The client has been notified that their request was declined.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loaded — show details + action buttons ───────────────────────────────
  const { details } = state;
  const displayDateTime = formatDisplayDateTime(details.dateTime, TIMEZONE);
  const alreadyActed = details.status !== 'pending';

  return (
    <div className="min-h-screen page-bg flex items-center justify-center py-10">
      <div className="form-card max-w-lg w-full mx-4 space-y-6 animate-fade-in">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-brand-500/15 border border-brand-300 dark:border-brand-500/30 flex items-center justify-center">
              <CalendarCheck className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Appointment Review</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review the details below and confirm or decline this request.
          </p>
        </div>

        {/* Already acted banner */}
        {alreadyActed && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            This request has already been <strong>{details.status}</strong>.
          </div>
        )}

        {/* Details panel */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden inset-surface">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/40 inset-deep flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Appointment Details
            </p>
            <span className="text-xs font-mono text-slate-400">{details.bookingReference}</span>
          </div>
          <div className="px-5 py-4 space-y-4">
            {[
              { icon: User,     bg: 'bg-blue-500/15',   text: 'text-blue-600 dark:text-blue-400',   label: 'Name',     value: details.name  },
              { icon: Mail,     bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400', label: 'Email',    value: details.email },
              { icon: Clock,    bg: 'bg-emerald-500/15',text: 'text-emerald-600 dark:text-emerald-400', label: 'Date & Time', value: displayDateTime },
            ].map(({ icon: Icon, bg, text, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${bg} flex items-center justify-center mt-0.5`}>
                  <Icon className={`w-3.5 h-3.5 ${text}`} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{value}</p>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center mt-0.5">
                <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Enquiry</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{details.enquiry}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons — hidden once already decided */}
        {!alreadyActed && (
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={actionLoading}
              className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {actionLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />}
              Confirm
            </button>
            <button
              onClick={handleDecline}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm
                         text-red-700 dark:text-red-400 bg-red-500/10 border border-red-300 dark:border-red-500/30
                         hover:bg-red-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {actionLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <XCircle className="w-4 h-4" />}
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
