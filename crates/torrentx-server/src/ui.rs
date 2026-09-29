//! Web UI assets, embedded in release builds (read from disk in debug).

use axum::http::{StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use rust_embed::Embed;

use crate::api::ApiError;

#[derive(Embed)]
#[folder = "../../apps/web/dist"]
struct Assets;

fn asset(path: &str, cache: &'static str) -> Option<Response> {
    let file = Assets::get(path)?;
    let mime = file.metadata.mimetype().to_string();
    Some(
        (
            [
                (header::CONTENT_TYPE, mime),
                (header::CACHE_CONTROL, cache.to_string()),
            ],
            file.data,
        )
            .into_response(),
    )
}

/// Static asset, else `index.html` for client-side routes.
pub async fn serve(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    if path == "api" || path.starts_with("api/") {
        return ApiError::not_found("no such endpoint").into_response();
    }
    // Vite fingerprints everything under assets/.
    let cache = if path.starts_with("assets/") {
        "public, max-age=31536000, immutable"
    } else {
        "no-cache"
    };
    if !path.is_empty()
        && let Some(r) = asset(path, cache)
    {
        return r;
    }
    asset("index.html", "no-cache")
        .unwrap_or_else(|| (StatusCode::NOT_FOUND, "web UI not built").into_response())
}
