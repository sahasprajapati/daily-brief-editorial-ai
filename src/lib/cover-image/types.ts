export interface GeneratedCoverImage {
  /** data: URI (image/png;base64,...) — see generated-pieces.coverImageDataUrl for why this is
   *  inline storage rather than a real asset pipeline: placeholder until Atlas AI replaces it. */
  dataUrl: string
  prompt: string
}
