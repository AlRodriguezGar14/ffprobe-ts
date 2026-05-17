// structs translated to C from FFmpeg repo fftools/doc/ffprobe.xsd

#ifndef FFPROBE_FFPROBE_H
#define FFPROBE_FFPROBE_H
#include <stdint.h>

typedef struct Rational {
  int num;
  int den;
} Rational;

/*
 * FFmpeg stores stream dispositions as a bitmask. Expose the commonly
 * reported ffprobe flags as explicit 0/1 fields for easier consumers.
 */
typedef struct Disposition {
  int default_flag; // the original key is default, but it's a reserved keyword
                    // in C, so we rename it to default_flag
  int dub;
  int original;
  int comment;
  int lyrics;
  int karaoke;
  int forced;
  int hearing_impaired;
  int visual_impaired;
  int clean_effects;
  int attached_pic;
  int timed_thumbnails;
  int non_diegetic;
  int captions;
  int descriptions;
  int metadata;
  int dependent;
  int still_image;
  int multilayer;
} Disposition;

typedef struct Tag {
  char *key;
  char *value;
} Tag;

typedef struct TagList {
  Tag *entries;
  int count;
} TagList;

typedef struct Stream {
  int index;
  char *codec_name;
  char *codec_long_name;
  char *profile;
  char *codec_type;
  char *codec_tag;
  char *codec_tag_string;
  // char *extradata;
  int extradata_size;
  // char *extradata_hash;
  // char *mime_codec_string;

  /* video attributes */
  int width;
  int height;
  int coded_width;
  int coded_height;
  // int closed_captions;
  // int film_grain;
  int has_b_frames;
  Rational sample_aspect_ratio;
  Rational display_aspect_ratio;
  char *pix_fmt;
  int level;
  char *color_range;
  char *color_space;
  char *color_transfer;
  char *color_primaries;
  char *chroma_location;
  char *field_order;
  // int refs;

  /* audio attributes */
  char *sample_fmt;
  int sample_rate;
  int channels;
  char *channel_layout;
  int bits_per_sample;
  int initial_padding;

  char *id;
  Rational r_frame_rate;
  Rational avg_frame_rate;
  Rational time_base;
  int64_t start_pts;
  double start_time;
  int64_t duration_ts;
  double duration;
  int64_t bit_rate;
  // int64_t max_bit_rate;
  int bits_per_raw_sample;
  int64_t nb_frames;
  // int64_t nb_read_frames;
  // int64_t nb_read_packets;
  int frame_size; // not in ffprobe XSD; kept for AVCodecParameters.frame_size
  Disposition disposition;
  TagList tags;
} Stream;

typedef struct Format {
  char *filename;
  int nb_streams;
  int nb_programs;
  int nb_stream_groups;
  char *format_name;
  char *format_long_name;
  double start_time;
  double duration;
  int64_t size;
  int64_t bit_rate;
  int probe_score;
  int flags; // not in ffprobe XSD; kept for AVFormatContext.flags
  TagList tags;
} Format;

typedef struct Chapter {
  int id;
  Rational time_base;
  int64_t start;
  double start_time;
  int64_t end;
  double end_time;
  TagList tags;
} Chapter;

typedef struct FileResponse {
  char *input_url;
  int stream_count;
  int best_video_stream_index;
  int best_audio_stream_index;
  Format format;
  Stream *streams;
  int chapter_count;
  Chapter *chapters;
} FileResponse;

typedef struct Frame {
  int frame_number;
  char pict_type;
  int64_t pts;
  int64_t dts;
  int64_t pos;
  int pkt_size;
} Frame;

typedef struct FramesResponse {
  Frame *frames;
  int frame_count;
  int nb_frames;
  int gop_size;
  double duration;
  double time_base;
  double avg_frame_rate;
} FramesResponse;

int probe_file(const char *input, FileResponse **out_response);
void free_file_response(FileResponse *response);

#endif
