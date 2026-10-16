#!/usr/bin/env python3
"""Dependency-free layout session builder, local editor server and source verifier."""
import argparse
import copy
import hashlib
import html
import json
import math
import mimetypes
import re
import secrets
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

SKILL = Path(__file__).resolve().parent.parent
TAGS = set("div section article main header footer nav aside span p h1 h2 h3 h4 h5 h6 button a img input textarea label ul ol li hr strong em small table thead tbody tr td th pre code blockquote select option progress video details summary".split())
VOID = {"img", "input", "hr"}
ATTRS = {"src", "alt", "title", "placeholder", "value", "type", "href", "role", "aria-label", "id", "controls", "loop", "muted", "playsinline", "preload", "poster", "open", "min", "max", "step", "selected", "aria-current", "aria-disabled", "data-component", "data-carousel-track", "data-slide-target", "data-total-pages", "data-current-page", "data-page-index", "data-page-action"}
STYLES = set("""display position top left right bottom width height minWidth minHeight maxWidth maxHeight
margin marginTop marginRight marginBottom marginLeft padding paddingTop paddingRight paddingBottom paddingLeft
gap rowGap columnGap flex flexGrow flexShrink flexBasis flexDirection flexWrap justifyContent alignItems alignSelf alignContent
gridTemplateColumns gridTemplateRows gridColumn gridRow gridAutoFlow order
color background backgroundColor backgroundImage backgroundSize backgroundPosition backgroundRepeat
fontFamily fontSize fontWeight fontStyle lineHeight letterSpacing textAlign textDecoration whiteSpace wordBreak overflowWrap
border borderWidth borderStyle borderColor borderRadius borderTop borderRight borderBottom borderLeft
boxShadow opacity overflow overflowX overflowY zIndex objectFit objectPosition aspectRatio
transform transformOrigin visibility boxSizing verticalAlign listStyle textTransform float clear scrollSnapType scrollSnapAlign scrollBehavior""".split())
MEDIA_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/avif": ".avif", "video/mp4": ".mp4", "video/webm": ".webm", "video/ogg": ".ogv"}


def media_signature(mime, head):
    if mime == "image/png": return head.startswith(b"\x89PNG\r\n\x1a\n")
    if mime == "image/jpeg": return head.startswith(b"\xff\xd8\xff")
    if mime == "image/gif": return head[:6] in (b"GIF87a", b"GIF89a")
    if mime == "image/webp": return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    if mime == "image/avif": return head[4:8] == b"ftyp" and (b"avif" in head[8:64] or b"avis" in head[8:64])
    if mime == "video/mp4": return head[4:8] == b"ftyp" and b"avif" not in head[8:64] and b"avis" not in head[8:64]
    if mime == "video/webm": return head.startswith(b"\x1a\x45\xdf\xa3")
    if mime == "video/ogg": return head.startswith(b"OggS")
    return False


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def encoded(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_atomic(path, data):
    path = Path(path)
    temp = path.with_name(path.name + "." + secrets.token_hex(4) + ".tmp")
    try:
        temp.write_bytes(data)
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def relative_file(root, rel):
    if not isinstance(rel, str) or not rel or "\\" in rel or ":" in rel:
        raise ValueError("文件路径必须是使用 / 的项目内相对路径")
    parts = PurePosixPath(rel)
    if parts.is_absolute() or ".." in parts.parts:
        raise ValueError("文件路径超出项目范围")
    target = (Path(root) / rel).resolve()
    if not target.is_relative_to(Path(root).resolve()):
        raise ValueError("文件路径超出项目范围")
    return target


def safe_url(value, image=False):
    if not isinstance(value, str) or re.search(r"[\x00-\x20<>\"'\\]", value):
        return False
    if value == "":
        return True
    if image and re.fullmatch(r"data:(image/(png|jpe?g|gif|webp|avif)|video/(mp4|webm|ogg));base64,[A-Za-z0-9+/=]+", value):
        return True
    parsed = urlsplit(value)
    if parsed.scheme in ("http", "https") and parsed.netloc and not parsed.username:
        return True
    if image:
        return value.startswith("media/") and not parsed.query and not parsed.fragment and ".." not in PurePosixPath(value).parts and "%" not in value and ":" not in value
    return not parsed.scheme and not value.startswith("//") and not value.startswith("\\")


def css_value(value):
    # CSS declarations are data; never allow declaration/HTML breakout or remote CSS imports.
    return isinstance(value, str) and len(value) <= 4000 and not re.search(r"[;{}<>\\\x00-\x08]|url\s*\(|expression\s*\(|@import", value, re.I)


def validate_model(model, baseline=None):
    if not isinstance(model, dict) or model.get("schemaVersion") != 1:
        raise ValueError("需要 schemaVersion: 1")
    if not isinstance(model.get("title"), str) or len(model["title"]) > 300:
        raise ValueError("无效标题")
    if not isinstance(model.get("source"), dict) or model["source"].get("kind") not in {"web", "desktop", "image", "demo"}:
        raise ValueError("无效 source.kind")
    canvas = model.get("canvas", {})
    if not isinstance(canvas, dict):
        raise ValueError("canvas 应为对象")
    for key in ("width", "height"):
        if type(canvas.get(key)) is not int or not 200 <= canvas[key] <= 10000:
            raise ValueError("画布宽高必须在 200..10000")
    if not css_value(canvas.get("background", "#ffffff")):
        raise ValueError("无效画布背景")
    if not safe_url(model.get("referenceImage", ""), image=True):
        raise ValueError("无效参考图地址")
    nodes = {}

    def walk(node, depth=0):
        if not isinstance(node, dict) or depth > 80 or len(nodes) >= 5000:
            raise ValueError("元素树过深或过大")
        ident = node.get("id")
        if not isinstance(ident, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", ident) or ident in nodes:
            raise ValueError("元素 ID 无效或重复")
        nodes[ident] = node
        if node.get("tag") not in TAGS:
            raise ValueError("不支持的元素标签: " + str(node.get("tag")))
        for key in ("name", "text"):
            if not isinstance(node.get(key, ""), str) or len(node.get(key, "")) > 100000:
                raise ValueError("元素文字无效")
        style = node.get("style", {})
        attrs = node.get("attrs", {})
        if not isinstance(style, dict) or any(key not in STYLES or not css_value(value) for key, value in style.items()):
            raise ValueError("元素 CSS 含不支持的属性或值")
        if not isinstance(attrs, dict) or any(key not in ATTRS or not isinstance(value, str) for key, value in attrs.items()):
            raise ValueError("元素属性无效")
        for key, value in attrs.items():
            if len(value) > 6000000 or key in {"src", "href", "poster"} and not safe_url(value, image=key != "href"):
                raise ValueError("资源地址不支持: " + key)
        offset = node.get("offset", {})
        if not isinstance(offset, dict):
            raise ValueError("offset 应为对象")
        for key in ("x", "y"):
            value = offset.get(key, 0)
            if type(value) not in (int, float) or not math.isfinite(value) or abs(value) > 100000:
                raise ValueError("元素位移无效")
        source = node.get("source")
        if source is not None and not isinstance(source, dict):
            raise ValueError("source 应为对象或 null")
        if source and source.get("file"):
            relative_file(Path.cwd(), source["file"])
        children = node.get("children", [])
        if not isinstance(children, list) or node["tag"] in VOID and children:
            raise ValueError("元素 children 无效")
        for child in children:
            walk(child, depth + 1)
    walk(model.get("root"))
    files = model.get("sourceFiles", {})
    if not isinstance(files, dict):
        raise ValueError("sourceFiles 应为对象")
    for rel, sha in files.items():
        relative_file(Path.cwd(), rel)
        if not isinstance(sha, str) or not re.fullmatch(r"[a-f0-9]{64}", sha):
            raise ValueError("无效源文件 SHA-256")
    if baseline:
        if model["root"]["id"] != baseline["root"]["id"]:
            raise ValueError("不可替换根元素 ID")
        for key in ("source", "sourceFiles", "sessionId"):
            if model.get(key) != baseline.get(key):
                raise ValueError("不可改变来源信息: " + key)
        original = flatten(baseline["root"])
        for ident, node in nodes.items():
            if ident in original:
                if node.get("source") != original[ident]["node"].get("source"):
                    raise ValueError("不可改变已有元素来源")
            elif node.get("source") is not None:
                raise ValueError("新增元素不能伪造来源映射")
    return model


def flatten(root):
    result = {}
    def walk(node, parent=None, index=0):
        result[node["id"]] = {"node": node, "parent": parent, "index": index}
        for i, child in enumerate(node.get("children", [])):
            walk(child, node["id"], i)
    walk(root)
    return result


def changes_between(base, model):
    before, after = flatten(base["root"]), flatten(model["root"])
    changes = []
    for ident in reversed(list(before)):
        item = before[ident]
        if ident not in after:
            changes.append({"op": "remove", "id": ident, "source": item["node"].get("source"), "parent": item["parent"], "index": item["index"], "before": {k: v for k, v in item["node"].items() if k != "children"}})
    for ident, item in after.items():
        node = item["node"]
        if ident not in before:
            changes.append({"op": "add", "id": ident, "parent": item["parent"], "index": item["index"], "node": {**node, "children": []}})
            continue
        previous = before[ident]
        fields = {}
        for key in ("tag", "name", "text", "style", "attrs", "offset"):
            if previous["node"].get(key) != node.get(key):
                fields[key] = {"before": previous["node"].get(key), "after": node.get(key)}
        if fields:
            changes.append({"op": "update", "id": ident, "source": node.get("source"), "fields": fields})
        if (previous["parent"], previous["index"]) != (item["parent"], item["index"]):
            changes.append({"op": "move", "id": ident, "source": node.get("source"), "before": {"parent": previous["parent"], "index": previous["index"]}, "after": {"parent": item["parent"], "index": item["index"]}})
    metadata = {key: {"before": base.get(key), "after": model.get(key)} for key in ("title", "canvas", "referenceImage") if base.get(key) != model.get(key)}
    return {"schemaVersion": 1, "sessionId": model["sessionId"], "source": base["source"], "sourceFiles": base.get("sourceFiles", {}), "metadata": metadata, "changes": changes}


def render_preview(model):
    def render(node, selected_value=None):
        style = {"boxSizing": "border-box", **node.get("style", {})}
        off = node.get("offset", {})
        if off.get("x", 0) or off.get("y", 0):
            style["translate"] = str(off.get("x", 0)) + "px " + str(off.get("y", 0)) + "px"
        css = ";".join(re.sub(r"[A-Z]", lambda m: "-" + m[0].lower(), key) + ":" + value for key, value in style.items())
        attributes = {"data-layout-id": node["id"], "style": css, **node.get("attrs", {})}
        if node["tag"] == "option" and selected_value is not None:
            attributes.pop("selected", None)
            if node.get("attrs", {}).get("value", node.get("text", "")) == selected_value:
                attributes["selected"] = ""
        attrs = "".join(" " + key + '="' + html.escape(value, quote=True) + '"' for key, value in attributes.items())
        opening = "<" + node["tag"] + attrs + ">"
        if node["tag"] in VOID:
            return opening
        selection = node.get("attrs", {}).get("value") if node["tag"] == "select" else None
        return opening + html.escape(node.get("text", "")) + "".join(render(child, selection) for child in node.get("children", [])) + "</" + node["tag"] + ">"
    canvas = model["canvas"]
    return ('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>' + html.escape(model["title"]) + '</title><style>body{margin:0;font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif}'
            'button,input,textarea,select{font:inherit}button,a,summary{cursor:pointer}img,video{max-width:100%}'
            '</style><body><main style="position:relative;isolation:isolate;width:' + str(canvas["width"]) + 'px;min-height:' + str(canvas["height"]) + 'px;background:' + html.escape(canvas.get("background", "#fff"), quote=True) + '">'
            + render(model["root"]) + '</main></body></html>')


def build_editor(session, model, base, revision):
    bootstrap = {"model": model, "baseline": base, "revision": revision, "styles": sorted(STYLES), "tags": sorted(TAGS), "attrs": sorted(ATTRS), "childHtml": render_preview(model)}
    raw = json.dumps(bootstrap, ensure_ascii=False).replace("<", "\\u003c").replace("&", "\\u0026")
    template = (SKILL / "assets/editor.html").read_text(encoding="utf-8")
    editor_js = (SKILL / "assets/editor.js").read_text(encoding="utf-8")
    preferences_js = (SKILL / "assets/preferences.js").read_text(encoding="utf-8")
    alignment_js = (SKILL / "assets/alignment.js").read_text(encoding="utf-8")
    template = template.replace("__BOOTSTRAP__", raw).replace("__PREFERENCES_JS__", preferences_js).replace("__ALIGNMENT_JS__", alignment_js).replace("__EDITOR_JS__", editor_js)
    write_atomic(session / "editor.html", template.encode("utf-8"))


def save_snapshot(session, model, base, revision):
    validate_model(model, base)
    payloads = {
        "model.json": encoded(model),
        "changes.json": encoded(changes_between(base, model)),
        "preview.html": render_preview(model).encode("utf-8"),
        "child.html": render_preview(model).encode("utf-8"),
    }
    manifest = {"revision": revision, "sessionId": model["sessionId"], "savedAt": datetime.now(timezone.utc).isoformat(), "hashes": {name: digest(data) for name, data in payloads.items()}}
    for name, data in payloads.items():
        write_atomic(session / name, data)
    build_editor(session, model, base, revision)
    write_atomic(session / "saved.json", encoded(manifest))
    return manifest


def demo_model():
    def node(ident, tag="div", text="", style=None, children=None, name=None):
        return {"id": ident, "tag": tag, "name": name or text or ident, "text": text, "style": style or {}, "attrs": {}, "offset": {"x": 0, "y": 0}, "source": None, "children": children or []}
    def card(ident, number, title, desc, accent):
        return node(ident, style={"background": "#fff", "border": "1px solid #e4e8e5", "borderRadius": "16px", "padding": "24px", "flex": "1", "minWidth": "0"}, children=[
            node(ident+"-badge", "span", number, {"display": "inline-block", "background": accent, "padding": "7px 12px", "borderRadius": "9px", "fontSize": "12px", "fontWeight": "700"}),
            node(ident+"-title", "h3", title, {"fontSize": "19px", "margin": "20px 0 10px"}),
            node(ident+"-desc", "p", desc, {"fontSize": "14px", "color": "#748077", "lineHeight": "1.7", "margin": "0"})
        ])
    return {"schemaVersion": 1, "title": "工作台 · 布局实验", "source": {"kind": "demo", "description": "编辑器功能示例，请在正式会话中替换为选定界面"}, "canvas": {"width": 1000, "height": 700, "background": "#f7f9f6"}, "referenceImage": "", "root": node("workspace", style={"padding": "36px 44px", "color": "#24352a", "minHeight": "700px"}, name="工作台", children=[
        node("nav", style={"display": "flex", "justifyContent": "space-between", "alignItems": "center", "paddingBottom": "26px", "borderBottom": "1px solid #dce4dc"}, name="导航栏", children=[
            node("brand", "strong", "FIELD / 工作台", {"fontSize": "18px", "letterSpacing": "1px"}),
            node("nav-links", "span", "概览     项目     资源", {"fontSize": "13px", "color": "#6c7d70"})]),
        node("eyebrow", "p", "YOUR NEXT CHAPTER", {"margin": "36px 0 12px", "fontSize": "11px", "letterSpacing": "2px", "color": "#738776"}),
        node("hero", style={"display": "flex", "alignItems": "center", "justifyContent": "space-between", "gap": "20px"}, name="欢迎区域", children=[
            node("heading", style={"flex": "1"}, children=[node("title", "h1", "为好想法，留一点空间。", {"fontSize": "34px", "letterSpacing": "-1px", "margin": "0 0 14px", "fontWeight": "600"}), node("subtitle", "p", "整理灵感、推进项目，让每一步都清晰可见。", {"fontSize": "14px", "color": "#748077", "margin": "0"})]),
            node("primary", "button", "＋ 新建项目", {"background": "#32674b", "color": "#fff", "border": "0", "padding": "13px 20px", "borderRadius": "9px", "fontSize": "13px"})]),
        node("cards", style={"display": "flex", "gap": "18px", "marginTop": "36px"}, name="项目卡片容器", children=[
            card("card-a", "01 / EXPLORE", "收集灵感", "把零散的想法汇成一条线索，\n发现值得展开的下一步。", "#e5efdc"),
            card("card-b", "02 / CREATE", "专注创造", "留出完整的时间，\n把想象变成可以触摸的成果。", "#f7eddb"),
            card("card-c", "03 / GROW", "持续生长", "记录每一次小小进步，\n让经验成为下一次的起点。", "#e4edf4")]),
        node("footer", style={"display": "flex", "justifyContent": "space-between", "marginTop": "30px", "padding": "22px", "background": "#edf2e9", "borderRadius": "12px"}, name="底部提示", children=[
            node("footer-note", "span", "一点一点，接近你想做的事。", {"fontSize": "13px", "color": "#5d735f"}),
            node("footer-link", "span", "查看本周计划 →", {"fontSize": "13px", "fontWeight": "600", "color": "#32674b"})])
    ])}


def initialize(args):
    session = Path(args.session).resolve()
    session.mkdir(parents=True, exist_ok=True)
    if any((session / name).exists() for name in ("baseline.json", "saved.json", "editor.html")):
        raise ValueError("会话已存在；请使用新的会话目录，避免丢失用户编辑")
    model = demo_model() if args.demo else read_json(args.model)
    model["sessionId"] = secrets.token_hex(12)
    model["sourceFiles"] = {}
    validate_model(model)
    for item in flatten(model["root"]).values():
        source = item["node"].get("source")
        if source and source.get("file"):
            if not args.source_root:
                raise ValueError("有源码映射时必须提供 --source-root")
            rel = source["file"]
            model["sourceFiles"][rel] = digest(relative_file(args.source_root, rel).read_bytes())
    write_atomic(session / "baseline.json", encoded(model))
    save_snapshot(session, model, model, 0)
    print(json.dumps({"session": str(session), "editor": str(session / "editor.html")}, ensure_ascii=False))


def check_snapshot(session):
    manifest = read_json(session / "saved.json")
    for name in ("model.json", "changes.json", "preview.html", "child.html"):
        if digest((session / name).read_bytes()) != manifest["hashes"].get(name):
            raise ValueError("保存快照不完整或被外部修改: " + name)
    base, model = read_json(session / "baseline.json"), read_json(session / "model.json")
    validate_model(model, base)
    if read_json(session / "changes.json") != changes_between(base, model):
        raise ValueError("变更清单与模型不一致")
    if model["sessionId"] != manifest["sessionId"]:
        raise ValueError("会话 ID 不一致")
    return base, model, manifest


def serve(args):
    session = Path(args.session).resolve()
    check_snapshot(session)
    token = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def respond(self, status, data, mime="application/json; charset=utf-8", headers=None):
            self.send_response(status)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: https: http:; media-src 'self' data: https: http:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
            for key, value in (headers or {}).items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(data)

        def permitted(self):
            return self.headers.get("Host") == "127.0.0.1:" + str(self.server.server_port)

        def do_GET(self):
            if not self.permitted():
                return self.respond(403, encoded({"error": "无效 Host"}))
            path = unquote(urlsplit(self.path).path)
            if path == "/api/state":
                try:
                    base, model, manifest = check_snapshot(session)
                    return self.respond(200, encoded({"model": model, "baseline": base, "revision": manifest["revision"], "token": token}))
                except (ValueError, OSError) as exc:
                    return self.respond(500, encoded({"error": str(exc)}))
            if path in ("/", "/editor.html", "/child.html", "/preview.html", "/model.json", "/changes.json", "/saved.json"):
                target = session / ("editor.html" if path == "/" else path[1:])
            elif path.startswith("/media/"):
                try:
                    target = relative_file(session, path[1:])
                except ValueError:
                    return self.respond(403, encoded({"error": "无效媒体路径"}))
                if target.suffix.lower() not in set(MEDIA_TYPES.values()) | {".jpeg", ".ogg"}:
                    return self.respond(403, encoded({"error": "只提供支持的图片和视频文件"}))
            else:
                return self.respond(404, encoded({"error": "不存在"}))
            try:
                mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
                if path.startswith("/media/"):
                    size = target.stat().st_size
                    byte_range = self.headers.get("Range")
                    if byte_range:
                        match = re.fullmatch(r"bytes=(\d*)-(\d*)", byte_range)
                        if not match or not any(match.groups()) or not size:
                            return self.respond(416, b"", mime, {"Content-Range": "bytes */" + str(size)})
                        start = int(match[1]) if match[1] else max(0, size-int(match[2]))
                        end = min(size-1, int(match[2])) if match[1] and match[2] else size-1
                        if start > end or start >= size:
                            return self.respond(416, b"", mime, {"Content-Range": "bytes */" + str(size)})
                        with target.open("rb") as stream:
                            stream.seek(start)
                            return self.respond(206, stream.read(end-start+1), mime, {"Content-Range": f"bytes {start}-{end}/{size}", "Accept-Ranges": "bytes"})
                    return self.respond(200, target.read_bytes(), mime, {"Accept-Ranges": "bytes"})
                return self.respond(200, target.read_bytes(), mime + ("; charset=utf-8" if mime.startswith("text/") else ""))
            except OSError:
                return self.respond(404, encoded({"error": "文件不存在"}))

        def do_POST(self):
            origin = "http://127.0.0.1:" + str(self.server.server_port)
            if not self.permitted() or self.headers.get("Origin") not in (None, origin) or self.headers.get("X-Layout-Token") != token:
                return self.respond(403, encoded({"error": "保存请求未通过本地会话校验"}))
            if self.path == "/api/media":
                try:
                    size = int(self.headers.get("Content-Length", 0))
                    mime = self.headers.get("Content-Type", "").split(";", 1)[0].lower()
                    if mime not in MEDIA_TYPES:
                        return self.respond(415, encoded({"error": "不支持的图片或视频格式"}))
                    if not 0 < size <= 100 * 1024 * 1024:
                        return self.respond(413, encoded({"error": "单个媒体文件不能超过 100 MB"}))
                    head = self.rfile.read(min(size, 64))
                    if not media_signature(mime, head):
                        return self.respond(415, encoded({"error": "媒体文件内容与格式不匹配"}))
                    relative = "media/" + secrets.token_hex(16) + MEDIA_TYPES[mime]
                    target = relative_file(session, relative)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    temp = target.with_suffix(target.suffix + ".tmp")
                    try:
                        with temp.open("wb") as stream:
                            stream.write(head)
                            remaining = size - len(head)
                            while remaining:
                                chunk = self.rfile.read(min(remaining, 1024 * 1024))
                                if not chunk: raise ValueError("媒体上传未完成")
                                stream.write(chunk)
                                remaining -= len(chunk)
                        temp.replace(target)
                    finally:
                        temp.unlink(missing_ok=True)
                    return self.respond(201, encoded({"src": relative, "mime": mime, "size": size}))
                except (ValueError, OSError) as exc:
                    return self.respond(400, encoded({"error": str(exc)}))
            if self.path != "/api/save":
                return self.respond(404, encoded({"error": "不存在"}))
            try:
                size = int(self.headers.get("Content-Length", 0))
                if not 0 < size <= 15000000:
                    return self.respond(413, encoded({"error": "保存内容过大或为空"}))
                payload = json.loads(self.rfile.read(size))
                if not isinstance(payload, dict):
                    raise ValueError("保存请求应为 JSON 对象")
                base, _, manifest = check_snapshot(session)
                if payload.get("revision") != manifest["revision"]:
                    return self.respond(409, encoded({"error": "另一标签页已保存新版本，请先导出本页 JSON，再重新载入进行合并。"}))
                model = payload["model"]
                result = save_snapshot(session, model, base, manifest["revision"] + 1)
                return self.respond(200, encoded(result))
            except (ValueError, KeyError, TypeError, OSError) as exc:
                return self.respond(400, encoded({"error": str(exc)}))

    server = HTTPServer(("127.0.0.1", args.port), Handler)
    server.timeout = 1
    print("EDITOR_URL=http://127.0.0.1:" + str(server.server_port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def verify(args):
    session = Path(args.session).resolve()
    base, model, manifest = check_snapshot(session)
    report = []
    for rel, sha in base.get("sourceFiles", {}).items():
        if not args.source_root:
            report.append({"file": rel, "status": "source-root-required"})
            continue
        path = relative_file(args.source_root, rel)
        status = "unchanged" if path.exists() and digest(path.read_bytes()) == sha else "changed-or-missing"
        report.append({"file": rel, "status": status})
    ok = all(item["status"] == "unchanged" for item in report)
    print(json.dumps({"ok": ok, "revision": manifest["revision"], "savedAt": manifest["savedAt"], "changeCount": len(changes_between(base, model)["changes"]), "sourceFiles": report}, ensure_ascii=False, indent=2))
    return 0 if ok else 2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init")
    init.add_argument("--session", required=True)
    group = init.add_mutually_exclusive_group(required=True)
    group.add_argument("--model")
    group.add_argument("--demo", action="store_true")
    init.add_argument("--source-root")
    server = sub.add_parser("serve")
    server.add_argument("--session", required=True)
    server.add_argument("--port", type=int, default=0)
    for name in ("diff", "verify", "import", "refresh"):
        command = sub.add_parser(name)
        command.add_argument("--session", required=True)
        if name == "verify":
            command.add_argument("--source-root")
        if name == "import":
            command.add_argument("--model", required=True)
            command.add_argument("--revision", required=True, type=int)
    args = parser.parse_args()
    try:
        if args.command == "init":
            initialize(args)
        elif args.command == "serve":
            serve(args)
        elif args.command == "verify":
            return verify(args)
        else:
            session = Path(args.session).resolve()
            base, model, manifest = check_snapshot(session)
            if args.command == "refresh":
                build_editor(session, model, base, manifest["revision"])
                print("Editor refreshed")
            elif args.command == "import":
                if args.revision != manifest["revision"]:
                    raise ValueError("版本冲突，请检查当前 saved.json")
                imported = read_json(args.model)
                print(json.dumps(save_snapshot(session, imported, base, args.revision + 1), ensure_ascii=False))
            else:
                print(json.dumps(changes_between(base, model), ensure_ascii=False, indent=2))
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print("ERROR: " + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
