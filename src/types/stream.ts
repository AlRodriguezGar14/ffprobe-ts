import type { Disposition, Rational, Tag } from "./primitives.js";

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
