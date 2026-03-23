'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Mic, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type WorkflowState = 'dashboard' | 'idle' | 'recording' | 'processing' | 'review';

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<{ [i: number]: { transcript?: string } }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};
const SpeechRecognitionAPI =
  typeof window !== 'undefined' &&
  (
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition
  );

interface ComplaintFormData {
  complainantName: string;
  complainantMobile: string;
  complainantEmail: string;
  assemblyConstituency: string;
  blockMunicipality: string;
  originalBengali: string;
  englishSummary: string;
  locationBoothBlock: string;
  category: string;
  urgency: string;
}

// Voice-captured values (from transcription) — text input overrides these
interface VoiceCapturedData extends ComplaintFormData {}
interface ComplaintListItem {
  id: string;
  complainant_name: string | null;
  complainant_mobile: string | null;
  assembly_constituency: string | null;
  block_municipality: string | null;
  status: string | null;
  created_at: string | null;
  recorded_by: string | null;
}

const CATEGORIES = ['MCC', 'L&O'];
const URGENCY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

// Parse transcript to extract complaint details (works with English or mixed)
function parseTranscriptToComplaintData(transcript: string): Partial<VoiceCapturedData> {
  const t = transcript.trim();
  if (!t) return {};

  const data: Partial<VoiceCapturedData> = {
    originalBengali: t,
    englishSummary: t.length > 200 ? t.slice(0, 200) + '…' : t,
  };

  // Indian mobile: 6/7/8/9 followed by 9 digits (with optional spaces/dashes)
  const mobileMatch = t.match(/(?:mobile|phone|number|মোবাইল|ফোন)\s*[:.]?\s*[\s\-]*(\d[\d\s\-]{8,14}\d)/i)
    || t.match(/\b([6-9]\d{9})\b/);
  if (mobileMatch) {
    const num = (mobileMatch[1] || mobileMatch[0]).replace(/\D/g, '').slice(-10);
    if (num.length === 10) data.complainantMobile = num;
  }
  if (!data.complainantMobile) {
    const fallbackNum = t.match(/\b([6-9]\d{9})\b/);
    if (fallbackNum) data.complainantMobile = fallbackNum[1];
  }

  // Name: "I am X" / "my name is X" / "I'm X" / before mobile/phone
  const namePatterns = [
    /(?:i am|i'm|my name is|name is|আমি)\s+([A-Za-z\u0980-\u09FF\s]{2,40}?)(?:\s*,|\s+and|\s+my|$)/i,
    /(?:complainant|caller)\s*[:.]?\s*([A-Za-z\u0980-\u09FF\s]{2,40})/i,
  ];
  for (const p of namePatterns) {
    const m = t.match(p);
    if (m?.[1]?.trim()) {
      data.complainantName = m[1].trim();
      break;
    }
  }

  // Block / Booth / Location
  const blockMatch = t.match(/(?:block|ব্লক)\s+(?:no\.?|number)?\s*[:.]?\s*([A-Za-z\u0980-\u09FF\s\-]+?)(?:\s*,|\s+booth|$)/i)
    || t.match(/([A-Za-z\u0980-\u09FF]+)\s+(?:block|ব্লক)/i);
  if (blockMatch) data.blockMunicipality = blockMatch[1].trim();

  const boothMatch = t.match(/(?:booth|বুথ)\s*(?:no\.?|number)?\s*[:.]?\s*(\d+)/i);
  if (boothMatch) data.locationBoothBlock = `Booth ${boothMatch[1]}`;

  const acMatch = t.match(/(?:constituency|এসি|AC|assembly)\s*[:.]?\s*([A-Za-z\u0980-\u09FF\s\-]+?)(?:\s*,|$)/i)
    || t.match(/([A-Za-z\u0980-\u09FF]+)\s+(?:constituency|এসি)/i);
  if (acMatch) data.assemblyConstituency = acMatch[1].trim();

  // Urgency keywords
  if (/\b(?:urgent|critical|জরুরি|immediately)\b/i.test(t)) data.urgency = 'High';
  else if (/\b(?:high|important)\b/i.test(t)) data.urgency = 'High';

  return data;
}

function mergeExtracted(
  primary: Partial<VoiceCapturedData>,
  secondary: Partial<VoiceCapturedData>
): Partial<VoiceCapturedData> {
  const keys: (keyof VoiceCapturedData)[] = [
    'complainantName',
    'complainantMobile',
    'complainantEmail',
    'assemblyConstituency',
    'blockMunicipality',
    'originalBengali',
    'englishSummary',
    'locationBoothBlock',
    'category',
    'urgency',
  ];
  const out: Partial<VoiceCapturedData> = {};
  for (const k of keys) {
    const p = (primary[k] || '').toString().trim();
    const s = (secondary[k] || '').toString().trim();
    if (p) out[k] = p;
    else if (s) out[k] = s;
  }
  return out;
}

export default function ComplaintIntakePage() {
  const [state, setState] = useState<WorkflowState>('dashboard');
  const [voiceData, setVoiceData] = useState<VoiceCapturedData | null>(null);
  // Text overrides voice; empty string = use voice value
  const [textOverrides, setTextOverrides] = useState<Partial<Record<keyof ComplaintFormData, string>>>({});
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveExtracting, setLiveExtracting] = useState(false);
  const [livePreviewData, setLivePreviewData] = useState<Partial<VoiceCapturedData>>({});
  const [audioLevel, setAudioLevel] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [stats, setStats] = useState({ queue: 0, recordedToday: 0, escalated: 0 });
  const [recentComplaints, setRecentComplaints] = useState<ComplaintListItem[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'whatsapp' | 'manual'>('all');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<{ stop: () => void } | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const liveTranscriptRef = useRef('');
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/complaints');
      if (res.ok) {
        const data = await res.json();
        setStats({
          queue: data.queue ?? 0,
          recordedToday: data.recordedToday ?? 0,
          escalated: data.escalated ?? 0,
        });
        setRecentComplaints(Array.isArray(data.recent) ? data.recent : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (state === 'dashboard') fetchStats();
  }, [state, fetchStats]);

  const extractWithAI = useCallback(async (text: string): Promise<Partial<VoiceCapturedData> | null> => {
    try {
      const res = await fetch('/api/complaints/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json?.data || typeof json.data !== 'object') return null;
      return json.data as Partial<VoiceCapturedData>;
    } catch {
      return null;
    }
  }, []);

  // Process recorded audio and structure fields (AI first, parser fallback)
  const processRecordedAudio = useCallback(async (audioBlob: Blob, preliminaryTranscript?: string) => {
    setState('processing');
    let parsed: Partial<VoiceCapturedData> = {};

    if (preliminaryTranscript?.trim()) {
      const aiParsed = await extractWithAI(preliminaryTranscript);
      const ruleParsed = parseTranscriptToComplaintData(preliminaryTranscript);
      parsed = aiParsed && Object.keys(aiParsed).length > 0
        ? mergeExtracted(aiParsed, ruleParsed)
        : ruleParsed;
    }

    setVoiceData(Object.keys(parsed).length > 0 ? (parsed as VoiceCapturedData) : null);
    setTextOverrides({});
    setState('review');
  }, [extractWithAI]);

  const processRecordedAudioRef = useRef(processRecordedAudio);
  processRecordedAudioRef.current = processRecordedAudio;

  const liveParsed = useMemo(
    () => (liveTranscript.trim() ? parseTranscriptToComplaintData(liveTranscript) : {}),
    [liveTranscript]
  );
  const liveMergedPreview = useMemo(
    () => mergeExtracted(livePreviewData, liveParsed),
    [livePreviewData, liveParsed]
  );

  const filteredRecentComplaints = useMemo(() => {
    if (sourceFilter === 'all') return recentComplaints;
    if (sourceFilter === 'whatsapp') {
      return recentComplaints.filter((c) => c.recorded_by === 'twilio_whatsapp_webhook');
    }
    return recentComplaints.filter((c) => c.recorded_by !== 'twilio_whatsapp_webhook');
  }, [recentComplaints, sourceFilter]);

  const startRecording = useCallback(async () => {
    setRecordingError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      if (SpeechRecognitionAPI) {
        const SR = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition: SpeechRecognitionCtor }).webkitSpeechRecognition!;
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';
        recognition.onresult = (e: { results: ArrayLike<{ [i: number]: { transcript?: string } }> }) => {
          let transcript = '';
          const results = e.results;
          for (let i = 0; i < results.length; i++) {
            const alt = results[i]?.[0];
            if (alt?.transcript) transcript += alt.transcript;
          }
          if (transcript) {
            liveTranscriptRef.current = transcript;
            setLiveTranscript(transcript);
          }
        };
        recognition.onerror = (e: { error?: string }) => {
          if (e.error === 'not-allowed' || e.error === 'audio-capture') {
            setRecordingError((prev) => prev || 'Microphone in use. Speak for live transcript.');
          } else if (e.error === 'no-speech') {
            setRecordingError((prev) => prev || 'No speech detected. Please speak closer to microphone.');
          }
        };
        speechRecognitionRef.current = recognition;
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            speechRecognitionRef.current = null;
          }
        }, 300);
      }

      mediaRecorder.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        try {
          if (speechRecognitionRef.current) {
            speechRecognitionRef.current.stop();
          }
        } catch {
          /* ignore */
        }
        speechRecognitionRef.current = null;
        setAudioLevel(0);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        processRecordedAudioRef.current(blob, liveTranscriptRef.current || undefined);
      };

      const audioContext = new AudioContext();
      if (audioContext.state === 'suspended') await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(100, Math.round(avg)));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      mediaRecorder.start(1000);
      setLivePreviewData({});
      liveTranscriptRef.current = '';
      setLiveTranscript('');
      setState('recording');
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      setRecordingError(
        err instanceof Error ? err.message : 'Microphone access denied'
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    mediaRecorderRef.current = null;
    try {
      recorder.stop();
    } catch (err) {
      processRecordedAudioRef.current(new Blob(), liveTranscriptRef.current || undefined);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const getVal = (k: keyof ComplaintFormData) =>
      (textOverrides[k] !== undefined ? textOverrides[k] : voiceData?.[k]) ?? '';
    const ac = getVal('assemblyConstituency').trim();
    const bm = getVal('blockMunicipality').trim();
    if (!ac || !bm) {
      setToastError('Assembly Constituency and Block / Municipality are required.');
      setTimeout(() => setToastError(null), 4000);
      return;
    }

    const payload = {
      complainantName: getVal('complainantName'),
      complainantMobile: getVal('complainantMobile'),
      complainantEmail: getVal('complainantEmail'),
      assemblyConstituency: ac,
      blockMunicipality: bm,
      originalBengali: getVal('originalBengali'),
      englishSummary: getVal('englishSummary'),
      locationBoothBlock: getVal('locationBoothBlock'),
      category: getVal('category'),
      urgency: getVal('urgency'),
    };

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setToastError(err.error || 'Failed to save complaint');
        setTimeout(() => setToastError(null), 4000);
        return;
      }

      setVoiceData(null);
      setTextOverrides({});
      setState('dashboard');
      setToast('Complaint submitted successfully.');
      setTimeout(() => setToast(null), 4000);
      fetchStats();
    } catch {
      setToastError('Failed to save complaint');
      setTimeout(() => setToastError(null), 4000);
    }
  }, [voiceData, textOverrides, fetchStats]);

  const handleReset = useCallback(() => {
    setState('dashboard');
    setVoiceData(null);
    setTextOverrides({});
    setRecordingError(null);
  }, []);

  const fieldValue = useCallback(
    (key: keyof ComplaintFormData): string => {
      if (textOverrides[key] !== undefined) return textOverrides[key]!;
      return voiceData?.[key] ?? '';
    },
    [voiceData, textOverrides]
  );

  const setFieldOverride = useCallback((key: keyof ComplaintFormData, value: string) => {
    setTextOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <AppShell>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            District HQ Control Room
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            Election Complaint Intake
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Record complaints in Bengali. Transcribe, review, and submit to the portal.
          </p>
        </div>

        {/* New Complaint Card */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <h2 className="font-semibold text-gray-800">New Complaint</h2>
          </div>

          <div className="p-6 sm:p-8">
            {state === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                    <p className="text-xs text-gray-500">Queue</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.queue}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                    <p className="text-xs text-gray-500">Recorded Today</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.recordedToday}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                    <p className="text-xs text-gray-500">Escalated</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.escalated}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-1">Start New Complaint Intake</h3>
                  <p className="text-sm text-gray-600 mb-4">Record by voice or switch to manual entry.</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceData(null);
                        setTextOverrides({});
                        setState('idle');
                      }}
                      className="px-5 py-2.5 bg-brand-500 text-white font-medium rounded-lg hover:bg-brand-600 transition-colors"
                    >
                      New Intake
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceData(null);
                        setTextOverrides({});
                        setState('review');
                      }}
                      className="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Manual Entry
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold text-gray-900">Recent Complaints</h3>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                        Source
                      </label>
                      <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value as 'all' | 'whatsapp' | 'manual')}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      >
                        <option value="all">All</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="manual">Manual / App</option>
                      </select>
                    </div>
                  </div>
                  {filteredRecentComplaints.length === 0 ? (
                    <p className="text-sm text-gray-500">No complaints recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="py-2 pr-4 font-medium">Name</th>
                            <th className="py-2 pr-4 font-medium">Phone</th>
                            <th className="py-2 pr-4 font-medium">AC</th>
                            <th className="py-2 pr-4 font-medium">Block / ULB</th>
                            <th className="py-2 pr-4 font-medium">Status</th>
                            <th className="py-2 pr-4 font-medium">Entered By</th>
                            <th className="py-2 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecentComplaints.map((c) => (
                            <tr key={c.id} className="border-b last:border-b-0">
                              <td className="py-2 pr-4 text-gray-900">{c.complainant_name || '—'}</td>
                              <td className="py-2 pr-4 text-gray-900">{c.complainant_mobile || '—'}</td>
                              <td className="py-2 pr-4 text-gray-900">{c.assembly_constituency || '—'}</td>
                              <td className="py-2 pr-4 text-gray-900">{c.block_municipality || '—'}</td>
                              <td className="py-2 pr-4">
                                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                                  {c.status || 'submitted'}
                                </span>
                              </td>
                              <td className="py-2 pr-4">
                                {c.recorded_by === 'twilio_whatsapp_webhook' ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                    WhatsApp
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                    Manual / App
                                  </span>
                                )}
                              </td>
                              <td className="py-2 text-gray-600">
                                {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Idle / Recording */}
            {(state === 'idle' || state === 'recording') && (
              <div className="flex flex-col items-center text-center">
                {recordingError && (
                  <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
                    <AlertCircle size={18} />
                    {recordingError}
                  </div>
                )}

                <button
                  onClick={state === 'recording' ? stopRecording : startRecording}
                  className={`
                    w-32 h-32 rounded-full flex items-center justify-center transition-all
                    ${state === 'recording'
                      ? 'bg-red-500 text-white shadow-lg animate-record-pulse hover:bg-red-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                    }
                    border-4 border-gray-200
                  `}
                  aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
                >
                  <Mic size={48} strokeWidth={2} />
                </button>
                <p className="mt-4 font-semibold text-gray-900">
                  {state === 'recording' ? 'Recording…' : 'Record Complaint'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {state === 'recording'
                    ? 'Click mic or Stop below to finish'
                    : 'Click to start recording in Bengali'}
                </p>
                {state === 'recording' && (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="mt-3 px-6 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Stop recording
                  </button>
                )}
                {state === 'idle' && (
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceData(null);
                      setTextOverrides({});
                      setState('review');
                    }}
                    className="mt-4 text-sm text-brand-500 hover:text-brand-600 font-medium underline"
                  >
                    Or enter manually
                  </button>
                )}

                {state === 'recording' && (
                  <div className="mt-6 w-full max-w-xl space-y-4">
                    <div className=" rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Live capture
                      </p>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-100 rounded-full"
                            style={{ width: `${audioLevel}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums w-8">
                          {audioLevel}%
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-2">
                        {audioLevel > 5 ? 'Mic active' : 'Waiting for speech…'}
                        {' '}Include name, mobile, block, booth for auto-fill.
                      </p>
                      <div className="min-h-[80px] max-h-32 overflow-y-auto rounded border border-gray-200 bg-white p-3 text-sm text-gray-800">
                        {liveTranscript || (
                          <span className="text-gray-400 italic">
                            {SpeechRecognitionAPI
                              ? 'Speech will appear here as you speak…'
                              : 'Speaking will show audio levels. Transcript requires Chrome/Edge.'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-left">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-indigo-700 uppercase tracking-wider">
                          Live extracted fields
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!liveTranscript.trim()) return;
                            setLiveExtracting(true);
                            const ai = await extractWithAI(liveTranscript);
                            const merged = ai ? mergeExtracted(ai, liveParsed) : liveParsed;
                            setLivePreviewData(merged);
                            setLiveExtracting(false);
                          }}
                          className="text-xs px-2 py-1 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                          disabled={liveExtracting || !liveTranscript.trim()}
                        >
                          {liveExtracting ? 'Refining...' : 'Refine with AI'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <p><span className="font-medium text-gray-700">Name:</span> {liveMergedPreview.complainantName || '—'}</p>
                        <p><span className="font-medium text-gray-700">Mobile:</span> {liveMergedPreview.complainantMobile || '—'}</p>
                        <p><span className="font-medium text-gray-700">AC:</span> {liveMergedPreview.assemblyConstituency || '—'}</p>
                        <p><span className="font-medium text-gray-700">Block:</span> {liveMergedPreview.blockMunicipality || '—'}</p>
                        <p><span className="font-medium text-gray-700">Polling Station:</span> {liveMergedPreview.locationBoothBlock || '—'}</p>
                        <p><span className="font-medium text-gray-700">Urgency:</span> {liveMergedPreview.urgency || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-red-600 font-mono text-lg">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      {Math.floor(recordingSeconds / 60)}:
                      {(recordingSeconds % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Processing */}
            {state === 'processing' && (
              <div className="flex flex-col items-center py-12">
                <Loader2 size={48} className="text-brand-500 animate-spin" />
                <p className="mt-4 font-semibold text-gray-900">
                  Transcribing & Analyzing…
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Processing Bengali speech
                </p>
              </div>
            )}

            {/* Review Form */}
            {state === 'review' && (
              <div className="space-y-5 animate-fade-in">
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Complainant Details
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name</label>
                      <input
                        type="text"
                        value={fieldValue('complainantName')}
                        onChange={(e) => setFieldOverride('complainantName', e.target.value)}
                        placeholder="From voice or type"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        value={fieldValue('complainantMobile')}
                        onChange={(e) => setFieldOverride('complainantMobile', e.target.value)}
                        placeholder="From voice or type"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Email (optional)</label>
                      <input
                        type="email"
                        value={fieldValue('complainantEmail')}
                        onChange={(e) => setFieldOverride('complainantEmail', e.target.value)}
                        placeholder="From voice or type"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Voice-captured values shown; typing overrides them.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Assembly Constituency <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fieldValue('assemblyConstituency')}
                      onChange={(e) => setFieldOverride('assemblyConstituency', e.target.value)}
                      placeholder="From voice or type"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Block / Municipality <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fieldValue('blockMunicipality')}
                      onChange={(e) => setFieldOverride('blockMunicipality', e.target.value)}
                      placeholder="From voice or type"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    Original Bengali Text
                  </label>
                  <textarea
                    value={fieldValue('originalBengali')}
                    onChange={(e) => setFieldOverride('originalBengali', e.target.value)}
                    rows={3}
                    placeholder="From voice or type"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    English Summary
                  </label>
                  <textarea
                    value={fieldValue('englishSummary')}
                    onChange={(e) => setFieldOverride('englishSummary', e.target.value)}
                    rows={2}
                    placeholder="From voice or type"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    Polling Station <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={fieldValue('locationBoothBlock')}
                    onChange={(e) => setFieldOverride('locationBoothBlock', e.target.value)}
                    placeholder="From voice or type"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Category (MCC / L&O)
                    </label>
                    <select
                      value={fieldValue('category')}
                      onChange={(e) => setFieldOverride('category', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    >
                      <option value="">Select</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Urgency
                    </label>
                    <select
                      value={fieldValue('urgency')}
                      onChange={(e) => setFieldOverride('urgency', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    >
                      <option value="">Select</option>
                      {URGENCY_LEVELS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-4">
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition-colors shadow-sm"
                  >
                    <CheckCircle2 size={18} />
                    Submit to Portal
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Discard & New
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
            <CheckCircle2 size={20} />
            <span className="font-medium">{toast}</span>
          </div>
        )}
        {toastError && (
          <div className="fixed bottom-6 right-6 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
            <AlertCircle size={20} />
            <span className="font-medium">{toastError}</span>
          </div>
        )}
      </div>
    </AppShell>
  );
}
