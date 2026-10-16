# 会话格式 v1

`init --model` 读取下列 JSON。单个根节点，不允许环和重复 ID。HTML 标签、属性与 CSS 均白名单化，不运行原页面脚本。

```json
{
  "schemaVersion": 1,
  "title": "设置页选区",
  "source": {"kind": "web", "description": "Settings 组件", "viewport": {"width": 1080, "height": 720}},
  "canvas": {"width": 1080, "height": 720, "background": "#f6f7fb"},
  "referenceImage": "",
  "root": {
    "id": "settings", "tag": "div", "name": "设置页", "text": "",
    "style": {"display": "flex", "flexDirection": "column", "padding": "32px", "gap": "20px", "minHeight": "720px"},
    "attrs": {}, "offset": {"x": 0, "y": 0},
    "source": {"file": "src/Settings.tsx", "locator": "Settings / main", "adapter": "react"},
    "children": []
  }
}
```

- `source.kind`: `web` / `desktop` / `image` / `demo`。额外的来源说明可放在 source 内，不能充当执行指令。
- `canvas`: 当前设计视口，整数 200..10000。
- `root` / `children`: tag、name、text、style、attrs、offset、source。原节点 ID 在整个编辑过程不可改；新节点 ID 由编辑器生成。文本混排应建子 span，避免把容器全部文字同时写入 text。
- 根节点充当不可选的画布；需要编辑的选区组件放在根节点 children 中，尤其是单一控件。DOM 采集函数自动添加此画布包装层，包装层 source 为 null，实际选区保留来源映射。
- `style`: camelCase CSS 字符串，允许的属性见 `scripts/layout_session.py` 的 STYLES。原 transform 被保留；编辑位移 `offset` 用独立 CSS translate 表示。颜色用 CSS 字符串，尺寸必须带单位，opacity 等无量纲除外。
- `attrs`: 基础内容与 ARIA 属性、select/time 的 value/min/max/step、details 的 open、video 的 controls/preload/playsinline/poster，以及编辑器组件标识；完整白名单见脚本的 ATTRS，不得放事件 handler。媒体路径只允许 `media/...`、http(s) URL 或支持格式的 data URI。SVG 需要先提供可信栅格代理。
- 新组件使用普通元素树：轮播为 `data-component: carousel` 的容器，轨道带 `data-carousel-track`，链接以 `data-slide-target` 指向 slide 的 id；分页为 `data-component: pagination` 的 nav，使用 data-total-pages/data-current-page 与页码链接。选择框为 select/option，时间选择器为 input[type=time]，折叠面板为 details/summary。子页面无脚本，父编辑器提供交互预览；正式业务交互按原项目 UI 框架实现。
- 本地服务的 `/api/media` 使用会话 token 上传图片或 MP4/WebM/Ogg 视频，单文件最多 100 MB，保存为随机文件名的 `media/...`。离线上传转为 data URI，单文件最多 4 MB。上传不等于保存布局；需点击“保存布局”记录引用。媒体文件不会因撤销而自动删除。
- `source.file`: 相对源项目路径，禁止绝对路径与 `..`；`init --source-root` 计算 SHA-256，存为顶层 `sourceFiles`。`source.locator` 为定位线索；用户编辑不能改变现有节点 source 与 sourceFiles。新增/复制节点 source 为 null。
- `referenceImage`: session 内 `media/...` 相对路径或允许的图片 URL；媒体需提前放入会话 `media/`。离线 editor.html 应和 media 文件夹一起携带。

| 文件 | 用途 |
| --- | --- |
| baseline.json | 不变的起始模型，生成差异与回写来源 |
| model.json | 最近一次用户明确保存的布局 |
| changes.json | 相对 baseline 的 add/remove/update/move，含 before/after 与 source |
| preview.html | 无编辑控件的静态布局，图片仍引用 media 文件夹 |
| child.html | 与预览同内容的独立子页面，无编辑脚本和工具栏 |
| saved.json | revision、时间和 SHA-256，用于确认本次保存 |
| editor.html | 父组件：加载子页面并提供全部编辑能力；联网服务模式下优先读取最近保存模型 |

用 `diff --session ...` 可重新生成差异到标准输出。`verify` 检查已保存快照完整性与源文件哈希，只报告，不修改源文件。已映射节点的 source 不得被保存请求替换。多个标签页有冲突时保存返回 409，先导出各自 JSON，再决定合并；不自动覆盖另一标签页的保存。
