import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  Circle,
  Square,
  X,
  Users,
  Copy,
  Check,
  Radio,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { CompletedVideoArchive, Course, User } from '../types';
import { getAuthHeaders, uploadMp4VideoSmart } from '../services/firebaseService';

export interface LiveSessionContext {
  mode: 'host' | 'student';
  title: string;
  courseId?: string;
  courseTitle?: string;
  scheduleId?: string;
  eventId?: string;
  instructorName: string;
  meetingId: string;
  meetingPasscode?: string;
  joinUrl?: string;
}

interface LiveClassroomModalProps {
  session: LiveSessionContext | null;
  currentUser: User;
  courses: Course[];
  onClose: () => void;
  onRecordingSaved: (courseId: string, recording: CompletedVideoArchive) => void;
  onMeetingEnded?: (info: { courseId?: string; scheduleId?: string; eventId?: string }) => void;
}

export const LiveClassroomModal: React.FC<LiveClassroomModalProps> = ({
  session,
  currentUser,
  courses,
  onClose,
  onRecordingSaved,
  onMeetingEnded,
}) => {
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string>('Initializing sanctuary camera...');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [copiedId, setCopiedId] = useState(false);

  // Host Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [savingRecording, setSavingRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingMessage, setRecordingMessage] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [targetCourseId, setTargetCourseId] = useState<string>(
    session?.courseId || courses[0]?.id || ''
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!session) return;
    setTargetCourseId(session.courseId || courses[0]?.id || '');
    setElapsedSec(0);
    setRecordSeconds(0);
    setIsRecording(false);
    setRecordingMessage(null);
    setRecordingError(null);

    const interval = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [session, courses]);

  useEffect(() => {
    if (!session) return;
    let active = true;

    async function initMedia() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          if (active) setCameraStatus('Interactive Audio/Sanctuary Canvas Active');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraStatus('Live Camera & Audio Connected');
      } catch {
        if (active) {
          setCamOn(false);
          setCameraStatus('Virtual Sanctuary Mode (Camera hardware unavailable or muted)');
        }
      }
    }

    initMedia();

    return () => {
      active = false;
      if (canvasIntervalRef.current) {
        window.clearInterval(canvasIntervalRef.current);
        canvasIntervalRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // Ignore stop errors on unmount
        }
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      screenStreamRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    if (!isRecording) return;
    const t = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [isRecording]);

  if (!session) return null;

  const isHost = session.mode === 'host';
  const formatClock = (totalSec: number) => {
    const m = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleCamera = () => {
    const next = !camOn;
    setCamOn(next);
    mediaStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      if (videoRef.current && mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      setCameraStatus('Camera Feed Restored');
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = displayStream;
      setScreenSharing(true);
      setCameraStatus('Screen Share Active');
      if (videoRef.current) {
        videoRef.current.srcObject = displayStream;
      }
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setScreenSharing(false);
          if (videoRef.current && mediaStreamRef.current) {
            videoRef.current.srcObject = mediaStreamRef.current;
          }
          setCameraStatus('Live Camera & Audio Connected');
        };
      }
    } catch {
      setRecordingError('Screen sharing was cancelled or is unavailable on this browser.');
    }
  };

  const startHostRecording = () => {
    setRecordingError(null);
    setRecordingMessage(null);
    if (!targetCourseId) {
      setRecordingError('Please select a target course to save this class recording.');
      return;
    }

    try {
      let recordStream: MediaStream | null =
        screenStreamRef.current || mediaStreamRef.current || null;

      // Fallback synthetic sanctuary canvas stream if running without physical webcam
      if (!recordStream || recordStream.getVideoTracks().length === 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 540;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const drawFrame = () => {
            ctx.fillStyle = '#071120';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#00F2FE';
            ctx.lineWidth = 4;
            ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
            ctx.fillStyle = '#E2E8F0';
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText(session.title, 56, 120);
            ctx.fillStyle = '#00F2FE';
            ctx.font = '20px sans-serif';
            ctx.fillText(`Instructor: ${session.instructorName}`, 56, 170);
            ctx.fillStyle = '#10B981';
            ctx.font = '18px monospace';
            ctx.fillText(`Deen Hijrah Academia • Room ${session.meetingId}`, 56, 220);
          };
          drawFrame();
          canvasIntervalRef.current = window.setInterval(drawFrame, 500);
          recordStream = canvas.captureStream(10);
        }
      }

      if (!recordStream) {
        setRecordingError('Unable to initialize media stream for recording.');
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(recordStream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        if (canvasIntervalRef.current) {
          window.clearInterval(canvasIntervalRef.current);
          canvasIntervalRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType.split(';')[0] || 'video/webm' });
        if (blob.size <= 0) {
          setRecordingError('Recorded session was empty.');
          return;
        }

        setSavingRecording(true);
        setUploadProgress(15);
        try {
          const recId = `rec-${Date.now()}`;
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const uploadRes = await uploadMp4VideoSmart(
            'live_recording',
            blob,
            {
              courseId: targetCourseId,
              recordingId: recId,
              isOrientation: false,
              fileName: `live_class_${Date.now()}.${ext}`,
            },
            (p) => setUploadProgress(p)
          );

          const durationLabel =
            recordSeconds >= 60
              ? `${Math.floor(recordSeconds / 60)} min ${recordSeconds % 60} sec`
              : `${Math.max(1, recordSeconds)} sec`;

          const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
          const saveResp = await fetch(`/api/courses/${targetCourseId}/recordings`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              id: recId,
              title: `${session.title} (Recorded Live)`,
              videoUrl: uploadRes.streamUrl,
              storagePath: uploadRes.storagePath,
              thumbnailUrl: courses.find((c) => c.id === targetCourseId)?.thumbnail || 'fallback://course',
              duration: durationLabel,
              isOrientation: false,
              syncedFromZoomWebhook: true,
              fileSize: uploadRes.fileSize,
            }),
          });

          const savedRec = await saveResp.json();
          if (!saveResp.ok) {
            throw new Error(savedRec?.error || 'Failed to archive class recording.');
          }

          onRecordingSaved(targetCourseId, savedRec);
          setRecordingMessage('Live class recording permanently saved to Course Recordings.');
        } catch (err: any) {
          setRecordingError(err?.message || 'Failed to publish recording.');
        } finally {
          setSavingRecording(false);
          setUploadProgress(0);
        }
      };

      recorderRef.current = recorder;
      recorder.start(1000);
      setRecordSeconds(0);
      setIsRecording(true);
    } catch (err: any) {
      setRecordingError(err?.message || 'Browser does not support live classroom recording.');
    }
  };

  const stopHostRecording = () => {
    setIsRecording(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const handleCopyInvite = () => {
    const shareUrl = `${window.location.origin}/?tab=classroom&room=${session.meetingId.replace(/\s+/g, '')}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleEndOrLeave = async () => {
    if (isHost && onMeetingEnded) {
      await onMeetingEnded({
        courseId: session.courseId,
        scheduleId: session.scheduleId,
        eventId: session.eventId,
      });
    }
    onClose();
  };

  const externalZoomHref =
    session.joinUrl && session.joinUrl.startsWith('http')
      ? session.joinUrl
      : `https://zoom.us/j/${session.meetingId.replace(/\s+/g, '')}${
          session.meetingPasscode ? `?pwd=${session.meetingPasscode}` : ''
        }`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-slate-100 backdrop-blur-xl"
      >
        {/* Top Live Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {isHost ? 'HOSTING LIVE' : 'LIVE SANCTUARY'}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {session.title}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Instructor: <span className="text-cyan-400 font-medium">{session.instructorName}</span>
                {session.courseTitle ? ` • ${session.courseTitle}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-2">
              <span>Room: {session.meetingId}</span>
              {session.meetingPasscode && <span className="text-slate-400">PIN: {session.meetingPasscode}</span>}
              <button
                type="button"
                onClick={handleCopyInvite}
                className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                title="Copy Class Invite Link"
              >
                {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-xs font-mono text-emerald-400 border border-emerald-500/30">
              {formatClock(elapsedSec)}
            </span>

            <a
              href={externalZoomHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 inline-flex items-center gap-1.5"
            >
              <span>Zoom Bridge</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={handleEndOrLeave}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <X className="w-4 h-4" />
              <span>{isHost ? 'End Session' : 'Leave Class'}</span>
            </button>
          </div>
        </div>

        {/* Main Classroom Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 sm:p-6 overflow-y-auto">
          {/* Video Stage */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video flex items-center justify-center shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${camOn || screenSharing ? 'opacity-100' : 'opacity-20'}`}
              />

              {(!camOn && !screenSharing) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
                  <div className="w-20 h-20 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-2xl font-bold text-cyan-300 mb-3">
                    {session.instructorName.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-base font-bold text-white">{session.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{cameraStatus}</p>
                </div>
              )}

              {isRecording && (
                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-rose-600/90 text-white text-xs font-bold flex items-center gap-2 shadow-lg">
                  <Circle className="w-2.5 h-2.5 fill-white animate-pulse" />
                  <span>REC {formatClock(recordSeconds)}</span>
                </div>
              )}

              <div className="absolute bottom-4 left-4 px-3 py-1 rounded-lg bg-slate-950/75 border border-slate-700/60 text-xs text-slate-200">
                {currentUser.firstName} {currentUser.lastName} ({isHost ? 'Host' : 'Student'}) • {cameraStatus}
              </div>
            </div>

            {/* Host / Student Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition ${
                    camOn
                      ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  <span>{camOn ? 'Camera On' : 'Camera Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleMic}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition ${
                    micOn
                      ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span>{micOn ? 'Mic On' : 'Muted'}</span>
                </button>

                {isHost && (
                  <button
                    type="button"
                    onClick={toggleScreenShare}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition ${
                      screenSharing
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <MonitorUp className="w-4 h-4" />
                    <span>{screenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
                  </button>
                )}
              </div>

              {isHost && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={targetCourseId}
                    onChange={(e) => setTargetCourseId(e.target.value)}
                    disabled={isRecording || savingRecording}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 outline-none"
                    title="Select course archive destination"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        Save to: {c.title}
                      </option>
                    ))}
                  </select>

                  {!isRecording ? (
                    <button
                      type="button"
                      disabled={savingRecording}
                      onClick={startHostRecording}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition disabled:opacity-60"
                    >
                      <Circle className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Start Recording Class</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopHostRecording}
                      className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs inline-flex items-center gap-2 transition"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>Stop & Publish Recording</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {savingRecording && (
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading and archiving recorded lecture to course recordings ({uploadProgress}%)...</span>
              </div>
            )}
            {recordingMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{recordingMessage}</span>
              </div>
            )}
            {recordingError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                {recordingError}
              </div>
            )}
          </div>

          {/* Right Classroom Info & Attendees Sidebar */}
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Sanctuary Roster
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold">
                  Active
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{session.instructorName}</p>
                    <p className="text-[11px] text-cyan-400">Host Instructor</p>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                </div>
                {!isHost && (
                  <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-200">
                        {currentUser.firstName} {currentUser.lastName}
                      </p>
                      <p className="text-[11px] text-emerald-400">Enrolled Scholar (Attendance Logged)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs text-slate-300">
              <h4 className="font-bold text-white text-sm">Classroom Recording Policy</h4>
              <p className="leading-relaxed text-slate-400">
                {isHost
                  ? 'Click "Start Recording Class" to record audio, camera, or screen share. Stopping the recording automatically publishes it permanently to the selected Course Recordings library.'
                  : 'Your live attendance is automatically logged with your local timezone. Recorded lectures are published into your Course Syllabus modal upon session completion.'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
