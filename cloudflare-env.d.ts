declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    LOCAL_PREVIEW?: string;
    DESK_ADMIN_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
