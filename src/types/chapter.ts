import type { Rational, Tag } from "./primitives.js";

export type Chapter = {
  id: number;
  time_base: Rational;
  start: bigint | null;
  start_time: number | null;
  end: bigint | null;
  end_time: number | null;
  tags: Tag[];
};
