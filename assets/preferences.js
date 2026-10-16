/* Parent-editor preferences only. Never translate or theme the child model. */
(() => {
  "use strict";
  const EN = {
    "UI 布局调节器":"UI Layout Editor",
    "编辑器设置":"Editor settings", "主题":"Theme", "语言":"Language",
    "跟随浏览器":"Use browser", "深色":"Dark", "浅色":"Light",
    "对齐辅助线":"Alignment guides",
    "拖动和缩放时显示对齐虚线，并吸附组件边缘与中心":"Show dashed guides and snap to component edges and centers while moving or resizing",
    "撤销 Ctrl+Z":"Undo Ctrl+Z", "重做 Ctrl+Shift+Z":"Redo Ctrl+Shift+Z",
    "画布":"Canvas", "画布宽度":"Canvas width", "画布高度":"Canvas height", "画布缩放":"Canvas zoom",
    "适合窗口":"Fit", "吸附 8px":"8px grid", "已保存":"Saved", "未保存":"Unsaved",
    "导出 JSON":"Export JSON", "保存布局":"Save layout", "添加组件":"Add components",
    "文本":"Text", "按钮":"Button", "容器":"Container", "卡片":"Card", "输入框":"Input",
    "图片":"Image", "色块":"Shape", "分隔线":"Divider",
    "添加到当前容器；选中叶子元素时添加到它的父级。":"Add to the selected container, or to a leaf element's parent.",
    "点击添加到当前容器，或拖动组件到画布指定位置。":"Click to add to the current container, or drag a component onto the canvas.",
    "点击添加，或拖动到画布指定位置":"Click to add, or drag to a position on the canvas",
    "放置到 {name}":"Drop into {name}",
    "Ctrl＋滚轮缩放工作区（20%–400%）":"Ctrl + mouse wheel to zoom the workspace (20%–400%)",
    "拖动移动 · 拖角缩放 · Ctrl+滚轮缩放 · Ctrl+S 保存":"Drag to move · Handles to resize · Ctrl+wheel to zoom · Ctrl+S to save",
    "视频":"Video", "轮播图":"Carousel", "选择框":"Select", "时间选择器":"Time picker", "折叠面板":"Accordion", "分页":"Pagination",
    "选择组件以编辑属性，或从左侧拖入新组件。":"Select a component to edit its properties, or drag in a new component from the left.",
    "预览交互":"Preview", "返回编辑":"Back to edit", "轮播图片":"Carousel image", "轮播页":"Slide", "图片占位":"Image placeholder", "轮播轨道":"Carousel track", "轮播导航":"Carousel navigation",
    "收起左侧栏":"Collapse left sidebar", "展开左侧栏":"Expand left sidebar", "收起右侧栏":"Collapse right sidebar", "展开右侧栏":"Expand right sidebar",
    "上一张":"Previous image", "下一张":"Next image", "上一页":"Previous page", "下一页":"Next page", "页码":"Page",
    "选项一":"Option 1", "选项二":"Option 2", "选项三":"Option 3", "面板标题":"Panel title", "面板内容":"Panel content", "这里是可以展开或折叠的内容。":"This content can be expanded or collapsed.",
    "媒体地址（media/、https 或 data URI）":"Media URL (media/, https or data URI)", "封面地址":"Poster URL",
    "上传本地图片 / 视频":"Upload image / video", "正在上传…":"Uploading…", "服务模式单文件最大 100 MB；离线模式最大 4 MB。":"Up to 100 MB per file with the local server; 4 MB offline.",
    "上传轮播图片（可多选）":"Upload carousel images", "选择多张图片替换轮播内容；预览时可切换图片。":"Select multiple images to replace the slides. Use Preview to switch slides.",
    "选项（每行一项）":"Options (one per line)", "默认选中值":"Default value", "最早时间":"Earliest time", "最晚时间":"Latest time", "步长 / 秒":"Step / seconds",
    "默认状态":"Default state", "展开":"Expanded", "折叠":"Collapsed", "总页数（1–50）":"Total pages (1–50)", "当前页":"Current page",
    "页码和页数须为 1–50 的整数":"Page numbers and counts must be integers from 1 to 50",
    "不支持的图片或视频格式":"Unsupported image or video format", "单个媒体文件不能超过 100 MB":"Each media file must be no larger than 100 MB",
    "离线媒体文件不能超过 4 MB，请使用本地服务上传大文件":"Offline media is limited to 4 MB per file. Use the local server for larger uploads.",
    "上传失败":"Upload failed", "读取本地媒体失败":"Could not read local media", "目标组件已删除，请重新选择组件":"The component was deleted. Select another component.",
    "媒体已导入，请保存布局":"Media imported. Save the layout to keep it.", "请等待媒体上传完成":"Wait for the media upload to finish", "媒体文件内容与格式不匹配":"Media contents do not match the selected format", "媒体上传未完成":"Media upload was interrupted",
    "会话":"Session", "界面名称":"Page title", "画布背景":"Canvas background",
    "导入布局 JSON":"Import layout JSON", "参考图透明度":"Reference opacity", "图层":"Layers",
    "布局画布":"Layout canvas", "选定界面（子页面）":"Selected interface (child page)", "界面参考图":"Interface reference",
    "发现尚未保存的本地草稿。":"An unsaved local draft is available.",
    "发现旧版本草稿；恢复后请检查与当前保存版本的差异。":"An older draft is available. Review its differences from the current saved version after restoring.",
    "恢复草稿":"Restore draft", "忽略":"Dismiss", "正在初始化…":"Initializing…",
    "拖动移动 · 拖角缩放 · 方向键微调 · Shift 加速 · Ctrl+S 保存":"Drag to move · Handles to resize · Arrows to nudge · Shift for 10px · Ctrl+S to save",
    "本地会话":"Local session", "离线模式：保存将下载 JSON":"Offline: saving downloads JSON",
    "有未保存修改":"Unsaved changes", "{count} 个":"{count} layers",
    "元素属性":"Properties", "图层名称":"Layer name", "文本内容":"Text content", "应用属性":"Apply properties",
    "图片地址（media/、https 或 data URI）":"Image URL (media/, https or data URI)",
    "图片说明":"Alt text", "占位文字":"Placeholder", "内容":"Value", "链接":"Link",
    "位置与尺寸":"Position & size", "X 位移 / px":"X offset / px", "Y 位移 / px":"Y offset / px",
    "宽度":"Width", "高度":"Height", "最小宽度":"Min. width", "最小高度":"Min. height",
    "定位":"Position", "默认":"Default", "左 / left":"Left", "上 / top":"Top",
    "自由拖动记录视觉位移；结构布局可调整父容器、顺序与间距。":"Dragging adjusts visual offsets. Use parent, order and spacing for structural layout.",
    "外观":"Appearance", "文字颜色":"Text color", "背景颜色":"Background", "字号":"Font size",
    "字重":"Font weight", "行高":"Line height", "圆角":"Radius", "边框":"Border", "阴影":"Shadow",
    "透明度 0..1":"Opacity 0..1", "层级":"Z-index", "文本对齐":"Text align", "左":"Left", "居中":"Center", "右":"Right",
    "容器与排列":"Layout & arrangement", "显示布局":"Display", "隐藏":"Hidden", "内边距":"Padding",
    "间距":"Gap", "外边距":"Margin", "Flex 方向":"Flex direction", "横向":"Row", "纵向":"Column",
    "反向横排":"Row reverse", "反向竖排":"Column reverse", "换行":"Wrap", "不换行":"No wrap",
    "主轴对齐":"Justify content", "交叉轴对齐":"Align items", "起点":"Start", "终点":"End",
    "两端":"Space between", "均匀":"Space around", "拉伸":"Stretch", "Grid 列":"Grid columns",
    "父容器":"Parent", "上移层级":"Move earlier", "下移层级":"Move later", "复制":"Duplicate", "删除":"Delete",
    "高级样式 JSON":"Advanced style JSON", "应用样式 JSON":"Apply style JSON",
    "只支持样式白名单；清空属性即可恢复默认。":"Only supported style properties are allowed. Remove a property to restore its default.",
    "来源映射":"Source mapping", "新增元素 / 未映射\n回写时由 Codex 定位或创建":"New element / unmapped\nCodex will locate or create its source.",
    "新文本":"New text", "双击右侧文本内容修改":"Edit this text in the properties panel",
    "新按钮":"New button", "新容器":"New container", "新卡片":"New card", "卡片标题":"Card title",
    "卡片说明":"Card description", "在这里补充一段说明。":"Add a description here.",
    "请输入内容":"Enter a value", "新图片":"New image", "副本":"Copy",
    "已导出布局 JSON":"Layout JSON exported",
    "离线布局已下载；将 JSON 交给 Codex 导入会话后应用。":"Offline layout downloaded. Ask Codex to import the JSON into this session and apply it.",
    "布局已保存。回到 Codex 说“应用已保存布局”。":"Layout saved. Return to Codex and ask: “Apply the saved layout.”",
    "保存失败":"Save failed", "文件过大":"File is too large", "布局已导入，请保存":"Layout imported. Save to keep it.",
    "已恢复草稿，请检查后保存":"Draft restored. Review it before saving.",
    "本地会话读取失败":"Could not load the local session", "；当前可离线导出":"; offline export is available",
    "无法读取子页面":"Could not access the child page",
    "不是有效布局文件":"Invalid layout file", "画布宽高应在 200..10000":"Canvas dimensions must be between 200 and 10000",
    "画布背景或参考图无效":"Invalid canvas background or reference image",
    "布局文件不属于当前会话，或来源信息已变更":"This layout belongs to another session or its source metadata was changed",
    "不能替换根元素 ID":"The root element ID cannot be replaced",
    "元素树无效或包含不支持的标签":"Invalid element tree or unsupported tag",
    "元素文字无效":"Invalid element text", "CSS 属性或值不支持：":"Unsupported CSS property or value: ",
    "元素属性不支持：":"Unsupported element attribute: ", "位移无效":"Invalid offset", "不能改变元素来源":"Element source mappings cannot be changed",
    "元素不能包含子元素":"This element cannot contain children", "请输入 CSS 对象":"Enter a CSS object",
    "另一标签页已保存新版本，请先导出本页 JSON，再重新载入进行合并。":"Another tab saved a newer revision. Export this tab's JSON, then reload and merge.",
    "保存请求未通过本地会话校验":"The save request failed local session verification",
    "保存内容过大或为空":"The save payload is empty or too large", "保存请求应为 JSON 对象":"The save request must be a JSON object",
    "不可改变来源信息: ":"Source metadata cannot be changed: ",
    "不可改变已有元素来源":"Existing source mappings cannot be changed",
    "新增元素不能伪造来源映射":"New elements cannot specify an existing source mapping",
    "元素 CSS 含不支持的属性或值":"Unsupported element CSS property or value", "元素属性无效":"Invalid element attributes",
    "资源地址不支持: ":"Unsupported resource URL: ", "元素位移无效":"Invalid element offset",
    "保存快照不完整或被外部修改: ":"The saved snapshot is incomplete or was externally modified: "
  };
  const STORAGE_KEY = "layout-editor.preferences.v1";
  const themeValues = new Set(["auto","dark","light"]), languageValues = new Set(["auto","zh","en"]);
  let stored = {};
  try {stored = JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")||{};} catch (_) {}
  let themeMode = themeValues.has(stored.theme) ? stored.theme : "auto";
  let languageMode = languageValues.has(stored.language) ? stored.language : "auto";
  const media = matchMedia("(prefers-color-scheme: dark)");
  const browserLanguage = () => {
    for(const value of navigator.languages?.length ? navigator.languages : [navigator.language||"en"]) {
      if(/^zh(?:-|$)/i.test(value))return "zh";
      if(/^en(?:-|$)/i.test(value))return "en";
    }
    return "en";
  };
  const language = () => languageMode==="auto" ? browserLanguage() : languageMode;
  const theme = () => themeMode==="auto" ? (media.matches?"dark":"light") : themeMode;
  function t(key,values={}) {
    const message = language()==="en" ? (EN[key]??key) : key;
    return message.replace(/\{(\w+)\}/g,(match,name)=>values[name]??match);
  }
  function translateMessage(message) {
    if(language()!=="en")return message;
    if(Object.hasOwn(EN,message))return EN[message];
    for(const [key,value] of Object.entries(EN)) {
      if((key.endsWith("：")||key.endsWith(": "))&&message.startsWith(key))return value+message.slice(key.length);
    }
    return message;
  }
  function translateDocument(root=document) {
    for(const el of root.querySelectorAll("[data-i18n]"))el.textContent=t(el.dataset.i18n);
    for(const [attribute,key] of [["aria-label","i18nAria"],["title","i18nTitle"],["alt","i18nAlt"]])
      for(const el of root.querySelectorAll("[data-"+key.replace(/[A-Z]/g,m=>"-"+m.toLowerCase())+"]"))el.setAttribute(attribute,t(el.dataset[key]));
    const themeSelect=document.getElementById("theme-mode"),languageSelect=document.getElementById("language-mode");
    if(themeSelect)themeSelect.value=themeMode;
    if(languageSelect)languageSelect.value=languageMode;
  }
  function apply(notify=true) {
    document.documentElement.dataset.theme=theme();
    document.documentElement.lang=language()==="zh"?"zh-CN":"en";
    document.title=t("UI 布局调节器");
    if(notify)window.dispatchEvent(new CustomEvent("layout-preferences-change"));
  }
  function persist() {try{localStorage.setItem(STORAGE_KEY,JSON.stringify({theme:themeMode,language:languageMode}));}catch(_){}}
  const api = {
    t,translateMessage,translateDocument,language,theme,
    get themeMode(){return themeMode;},get languageMode(){return languageMode;},
    setTheme(value){if(!themeValues.has(value))return;themeMode=value;persist();apply();},
    setLanguage(value){if(!languageValues.has(value))return;languageMode=value;persist();apply();}
  };
  globalThis.LayoutPreferences=api;
  media.addEventListener("change",()=>{if(themeMode==="auto")apply();});
  window.addEventListener("languagechange",()=>{if(languageMode==="auto")apply();});
  window.addEventListener("storage",event=>{
    if(event.key!==STORAGE_KEY)return;
    try {const value=JSON.parse(event.newValue||"{}");themeMode=themeValues.has(value?.theme)?value.theme:"auto";languageMode=languageValues.has(value?.language)?value.language:"auto";apply();}catch(_){}
  });
  apply(false);
})();
