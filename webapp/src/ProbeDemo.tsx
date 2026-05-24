import { useRef, useState, type ReactNode } from "react";
import { probe } from "./ffprobe-ts/index.js";
import type {
  Disposition,
  FileResponse,
  Format,
  Rational,
  Stream,
  Tag,
} from "./ffprobe-ts/index.js";

type State =
  | { kind: "idle" }
  | { kind: "working"; name: string }
  | {
      kind: "ok";
      name: string;
      size: number;
      type: string;
      response: FileResponse;
      json: string;
    }
  | { kind: "error"; message: string };

type View = "table" | "raw";

export function ProbeDemo() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<View>("table");
  const inputRef = useRef<HTMLInputElement>(null);

  async function runProbe(file: File | undefined) {
    if (!file) return;
    setState({ kind: "working", name: file.name });
    try {
      const result = await probe(file);
      if (result.error_code === 0 && result.response) {
        setState({
          kind: "ok",
          name: file.name,
          size: file.size,
          type: file.type || "—",
          response: result.response,
          json: stringify(result.response),
        });
      } else {
        setState({
          kind: "error",
          message:
            result.error_message || `ffprobe exited with code ${result.error_code}`,
        });
      }
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-neutral-900 dark:text-neutral-100">
      <header className="flex items-baseline justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <h1 className="text-sm font-medium tracking-tight">ffprobe</h1>
        <span className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          metadata inspector
        </span>
      </header>

      <section className="mt-10">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void runProbe(event.dataTransfer.files[0]);
          }}
          className={[
            "group relative flex w-full flex-col items-center justify-center",
            "rounded-md border border-dashed px-8 py-16 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            dragging
              ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900"
              : "border-neutral-300 hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500",
          ].join(" ")}
        >
          <span className="text-sm text-neutral-900 dark:text-neutral-100">
            Drop a media file
          </span>
          <span className="mt-1 text-xs text-neutral-500">
            or{" "}
            <span className="underline underline-offset-2">click to choose</span>
          </span>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            onChange={(event) => void runProbe(event.target.files?.[0])}
          />
        </button>

        <StatusLine state={state} />
      </section>

      {state.kind === "ok" ? (
        <section className="mt-12 space-y-8">
          <Section label="source">
            <Row k="file" v={state.name} />
            <Row k="size" v={formatBytes(state.size)} />
            <Row k="mime" v={state.type} />
            {state.response.format.duration != null ? (
              <Row k="duration" v={formatDuration(state.response.format.duration)} />
            ) : null}
            {state.response.format.bit_rate != null ? (
              <Row k="bitrate" v={formatBitrate(state.response.format.bit_rate)} />
            ) : null}
          </Section>

          <FormatSection format={state.response.format} />

          {state.response.streams.map((stream) => (
            <StreamSection
              key={stream.index}
              stream={stream}
              isBestVideo={stream.index === state.response.best_video_stream_index}
              isBestAudio={stream.index === state.response.best_audio_stream_index}
            />
          ))}

          <div className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <ViewToggle view={view} onChange={setView} />
              {view === "raw" ? (
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(state.json)}
                  className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  copy
                </button>
              ) : null}
            </div>
            {view === "raw" ? (
              <pre className="mt-3 max-h-[60vh] overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                {state.json}
              </pre>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function StatusLine({ state }: { state: State }) {
  const [dotClass, text] = describe(state);
  return (
    <div className="mt-4 flex items-center gap-2 font-mono text-xs text-neutral-500">
      <span
        className={["inline-block h-1.5 w-1.5 rounded-full", dotClass].join(" ")}
      />
      <span className="truncate">{text}</span>
    </div>
  );
}

function describe(state: State): [string, string] {
  switch (state.kind) {
    case "idle":
      return ["bg-neutral-400", "idle"];
    case "working":
      return ["bg-amber-500 animate-pulse", `probing ${state.name}`];
    case "ok":
      return ["bg-emerald-500", `ok · ${state.name}`];
    case "error":
      return ["bg-red-500", state.message];
  }
}

function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  const opts: View[] = ["table", "raw"];
  return (
    <div className="inline-flex font-mono text-[10px] uppercase tracking-widest">
      {opts.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={[
            "px-2 py-1 transition-colors",
            view === opt
              ? "text-neutral-900 dark:text-neutral-100"
              : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
          ].join(" ")}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Section({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-neutral-300 pb-2 dark:border-neutral-700">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-900 dark:text-neutral-100">
          {label}
        </span>
        {badge ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] items-baseline border-b border-neutral-100 py-1.5 dark:border-neutral-900">
      <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
        {k}
      </span>
      <span className="break-words font-mono text-xs text-neutral-900 dark:text-neutral-100">
        {v}
      </span>
    </div>
  );
}

function FormatSection({ format }: { format: Format }) {
  return (
    <Section label="format" badge={format.format_name}>
      {format.format_long_name ? (
        <Row k="long name" v={format.format_long_name} />
      ) : null}
      <Row k="streams" v={format.nb_streams} />
      {format.nb_programs ? <Row k="programs" v={format.nb_programs} /> : null}
      {format.nb_stream_groups ? (
        <Row k="stream groups" v={format.nb_stream_groups} />
      ) : null}
      {format.start_time != null ? (
        <Row k="start" v={`${format.start_time.toFixed(6)} s`} />
      ) : null}
      <Row k="probe score" v={format.probe_score} />
      <TagsRows tags={format.tags} />
    </Section>
  );
}

function StreamSection({
  stream,
  isBestVideo,
  isBestAudio,
}: {
  stream: Stream;
  isBestVideo: boolean;
  isBestAudio: boolean;
}) {
  const type = stream.codec_type;
  const best =
    (isBestVideo && type === "video") || (isBestAudio && type === "audio")
      ? "best"
      : undefined;
  const badge = [stream.codec_name, best].filter(Boolean).join(" · ");

  return (
    <Section label={`stream ${stream.index} · ${type}`} badge={badge}>
      {stream.codec_long_name ? (
        <Row k="codec" v={stream.codec_long_name} />
      ) : null}
      {stream.profile ? <Row k="profile" v={stream.profile} /> : null}
      {stream.level ? <Row k="level" v={stream.level} /> : null}

      {type === "video" ? <VideoRows stream={stream} /> : null}
      {type === "audio" ? <AudioRows stream={stream} /> : null}

      {stream.duration != null ? (
        <Row k="duration" v={formatDuration(stream.duration)} />
      ) : null}
      {stream.bit_rate != null ? (
        <Row k="bitrate" v={formatBitrate(stream.bit_rate)} />
      ) : null}
      {stream.nb_frames != null && stream.nb_frames > 0n ? (
        <Row k="frames" v={stream.nb_frames.toString()} />
      ) : null}
      {stream.time_base.num && stream.time_base.den ? (
        <Row k="time base" v={formatRational(stream.time_base)} />
      ) : null}

      <DispositionRow disposition={stream.disposition} />
      <TagsRows tags={stream.tags} />
    </Section>
  );
}

function VideoRows({ stream }: { stream: Stream }) {
  return (
    <>
      {stream.width && stream.height ? (
        <Row k="resolution" v={`${stream.width} × ${stream.height}`} />
      ) : null}
      {stream.coded_width &&
      stream.coded_height &&
      (stream.coded_width !== stream.width ||
        stream.coded_height !== stream.height) ? (
        <Row k="coded" v={`${stream.coded_width} × ${stream.coded_height}`} />
      ) : null}
      {stream.pix_fmt ? <Row k="pixel format" v={stream.pix_fmt} /> : null}
      {stream.avg_frame_rate.num && stream.avg_frame_rate.den ? (
        <Row
          k="frame rate"
          v={`${formatFps(stream.avg_frame_rate)} fps · ${formatRational(stream.avg_frame_rate)}`}
        />
      ) : null}
      {stream.r_frame_rate.num &&
      stream.r_frame_rate.den &&
      (stream.r_frame_rate.num !== stream.avg_frame_rate.num ||
        stream.r_frame_rate.den !== stream.avg_frame_rate.den) ? (
        <Row k="r frame rate" v={formatRational(stream.r_frame_rate)} />
      ) : null}
      {stream.display_aspect_ratio.num && stream.display_aspect_ratio.den ? (
        <Row k="aspect" v={formatRational(stream.display_aspect_ratio)} />
      ) : null}
      {stream.color_space ? <Row k="color space" v={stream.color_space} /> : null}
      {stream.color_range ? <Row k="color range" v={stream.color_range} /> : null}
      {stream.color_primaries ? (
        <Row k="primaries" v={stream.color_primaries} />
      ) : null}
      {stream.color_transfer ? (
        <Row k="transfer" v={stream.color_transfer} />
      ) : null}
      {stream.chroma_location ? (
        <Row k="chroma loc" v={stream.chroma_location} />
      ) : null}
      {stream.field_order && stream.field_order !== "unknown" ? (
        <Row k="field order" v={stream.field_order} />
      ) : null}
      {stream.has_b_frames ? <Row k="b-frames" v={stream.has_b_frames} /> : null}
    </>
  );
}

function AudioRows({ stream }: { stream: Stream }) {
  return (
    <>
      {stream.sample_rate ? (
        <Row k="sample rate" v={`${stream.sample_rate.toLocaleString()} Hz`} />
      ) : null}
      {stream.channels ? <Row k="channels" v={stream.channels} /> : null}
      {stream.channel_layout ? (
        <Row k="layout" v={stream.channel_layout} />
      ) : null}
      {stream.sample_fmt ? <Row k="sample format" v={stream.sample_fmt} /> : null}
      {stream.bits_per_sample ? (
        <Row k="bits/sample" v={stream.bits_per_sample} />
      ) : null}
    </>
  );
}

function DispositionRow({ disposition }: { disposition: Disposition }) {
  const flags = (Object.entries(disposition) as [keyof Disposition, number][])
    .filter(([, v]) => v)
    .map(([k]) => k.replace(/_flag$/, "").replace(/_/g, " "));
  if (flags.length === 0) return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] items-baseline border-b border-neutral-100 py-1.5 dark:border-neutral-900">
      <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
        disposition
      </span>
      <span className="flex flex-wrap gap-1">
        {flags.map((flag) => (
          <span
            key={flag}
            className="border border-neutral-300 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
          >
            {flag}
          </span>
        ))}
      </span>
    </div>
  );
}

function TagsRows({ tags }: { tags: Tag[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <>
      <div className="mt-2 border-b border-neutral-200 pb-1 dark:border-neutral-800">
        <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
          tags
        </span>
      </div>
      {tags.map((tag, i) => (
        <Row key={`${tag.key}-${i}`} k={tag.key} v={tag.value} />
      ))}
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return `${seconds}`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = s.toFixed(3).padStart(6, "0");
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${ss}`
    : `${m}:${ss} (${seconds.toFixed(3)} s)`;
}

function formatBitrate(bps: bigint | number): string {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} Mb/s`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} kb/s`;
  return `${n} b/s`;
}

function formatRational(r: Rational): string {
  return `${r.num}/${r.den}`;
}

function formatFps(r: Rational): string {
  if (!r.den) return "0";
  const fps = r.num / r.den;
  return fps >= 10 ? fps.toFixed(2) : fps.toFixed(3);
}

function stringify(value: unknown) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}
