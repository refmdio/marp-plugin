use extism_pdk::*;
use serde::{Deserialize, Serialize};

const DEFAULT_TITLE: &str = "Marp Slides";
const DEFAULT_MARKDOWN: &str = "---\nmarp: true\ntheme: default\npaginate: true\nclass: lead\n---\n\n# Welcome to Marp\n\nUse the left pane to edit Markdown.\n";

#[derive(Deserialize)]
struct ExecInput {
    action: String,
    payload: serde_json::Value,
    ctx: serde_json::Value,
}

#[derive(Serialize, Default)]
struct ExecOutput {
    ok: bool,
    data: Option<serde_json::Value>,
    effects: Vec<serde_json::Value>,
    error: Option<serde_json::Value>,
}

#[plugin_fn]
pub fn exec(input: Json<ExecInput>) -> FnResult<Json<ExecOutput>> {
    let inx = input.0;
    let mut out = ExecOutput::default();

    match inx.action.as_str() {
        "marp.create" => {
            let title = inx
                .payload
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or(DEFAULT_TITLE);

            out.ok = true;
            out.effects.push(serde_json::json!({
                "type": "createDocument",
                "title": title,
                "docType": "document",
            }));
            out.effects.push(serde_json::json!({
                "type": "putKv",
                "scope": "doc",
                "key": "meta",
                "value": {"isMarp": true},
            }));
            out.effects.push(serde_json::json!({
                "type": "putKv",
                "scope": "doc",
                "key": "marpState",
                "value": {
                    "markdown": DEFAULT_MARKDOWN,
                },
            }));
            out.effects.push(serde_json::json!({
                "type": "showToast",
                "level": "success",
                "message": "Marp slide deck created",
            }));
            out.effects.push(serde_json::json!({
                "type": "navigate",
                "to": "/marp/:createdDocId",
            }));
        }
        _ => {
            out.error = Some(serde_json::json!({ "code": "UNKNOWN_ACTION" }));
        }
    }

    Ok(Json(out))
}
