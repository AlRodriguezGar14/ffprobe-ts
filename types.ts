// Mirrors the JS objects produced by ffprobe_bindings.cpp (to_js helpers).

export type Rational = { num: number; den: number };

export type Disposition = {
  default_flag: number;
  dub: number;
  original: number;
  comment: number;
  lyrics: number;
  karaoke: number;
  forced: number;
  hearing_impaired: number;
  visual_impaired: number;
  clean_effects: number;
  attached_pic: number;
  timed_thumbnails: number;
  non_diegetic: number;
  captions: number;
  descriptions: number;
  metadata: number;
  dependent: number;
  still_image: number;
  multilayer: number;
};

export type Tag = { key: string; value: string };

export type Stream = {
  index: number;
  codec_name: string;
  codec_long_name: string;
  profile: string;
  codec_type: string;
  codec_tag_string: string;
  codec_tag: string;
  width: number;
  height: number;
  coded_width: number;
  coded_height: number;
  has_b_frames: number;
  sample_aspect_ratio: Rational;
  display_aspect_ratio: Rational;
  pix_fmt: string;
  level: number;
  color_range: string;
  color_space: string;
  color_transfer: string;
  color_primaries: string;
  chroma_location: string;
  field_order: string;
  sample_fmt: string;
  sample_rate: number;
  channels: number;
  channel_layout: string;
  bits_per_sample: number;
  initial_padding: number;
  id: string;
  r_frame_rate: Rational;
  avg_frame_rate: Rational;
  time_base: Rational;
  // js_i64_or_null: null when AV_NOPTS_VALUE
  start_pts: bigint | null;
  // js_double_or_null: null when NaN
  start_time: number | null;
  duration_ts: bigint | null;
  duration: number | null;
  // js_bitrate_or_null: null when <= 0
  bit_rate: bigint | null;
  bits_per_raw_sample: number;
  // js_count_or_null: null when <= 0
  nb_frames: bigint | null;
  frame_size: number;
  extradata_size: number;
  disposition: Disposition;
  tags: Tag[];
};

export type Format = {
  filename: string;
  nb_streams: number;
  nb_programs: number;
  nb_stream_groups: number;
  format_name: string;
  format_long_name: string;
  start_time: number | null;
  duration: number | null;
  // js_size_or_null: null when < 0
  size: bigint | null;
  bit_rate: bigint | null;
  probe_score: number;
  flags: number;
  tags: Tag[];
};

export type Chapter = {
  id: number;
  time_base: Rational;
  start: bigint | null;
  start_time: number | null;
  end: bigint | null;
  end_time: number | null;
  tags: Tag[];
};

export type FileResponse = {
  input_url: string;
  stream_count: number;
  best_video_stream_index: number;
  best_audio_stream_index: number;
  format: Format;
  streams: Stream[];
  chapter_count: number;
  chapters: Chapter[];
};

// probe() in ffprobe_bindings.cpp returns this wrapper, never a bare
// FileResponse. response is undefined on error.
export type ProbeResult = {
  error_code: number;
  error_message: string;
  response: FileResponse | undefined;
};
