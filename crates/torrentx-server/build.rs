//! rust-embed needs `apps/web/dist` to exist at compile time. On a clean
//! checkout write a stub page so `cargo build` works without building the UI.

use std::path::Path;

fn main() {
    let dist = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../apps/web/dist");
    let index = dist.join("index.html");
    if !index.exists() {
        std::fs::create_dir_all(&dist).expect("create apps/web/dist");
        std::fs::write(
            &index,
            "<!doctype html><title>TorrentX</title>\
             <body style=\"background:#000;color:#22c55e;font-family:monospace\">\
             <p>Web UI not built. Run <code>pnpm build:web</code>, then rebuild the server.</p>",
        )
        .expect("write stub index.html");
    }
    println!("cargo:rerun-if-changed=../../apps/web/dist");
}
