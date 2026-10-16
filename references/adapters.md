# 来源适配与回写

三个入口都生成同一种元素树；HTML 是编辑代理，原工程仍是最终实现。服务器不会自行用字符串替换原工程；Codex 读取差异并依据目标技术栈做结构化修改。

## 框架识别与最小差异

回写前检查依赖清单、目标文件 imports、项目共享组件与相邻页面。Web 可读取 package.json、锁文件、组件自动导入配置；桌面可读取项目文件、QML imports、XAML 命名空间和资源字典。以实际使用的组件和版本为依据，不能把“有 React/Vue”直接等同于“已使用某个 UI 库”。

已有 UI 框架时，优先使用它和项目自身的组件封装、布局 API、主题 token。轮播、选择框、时间选择器、折叠面板和分页按现有组件的 props、插槽、事件、数据源实现；上传的媒体转为原工程已有资源引用方式。分页代理不含真实数据请求，保留或接入现有分页数据逻辑，不凭空替换业务实现。

没有 UI 组件框架时，在现有应用技术内使用最简单的标准能力：Web 使用语义化 HTML、原生 CSS flex/grid 与必要的少量脚本；桌面使用系统控件、原生布局与现有主题。优先零新增依赖，不为了布局引入组件库、工具库、插件或运行时；只有标准能力和已有依赖无法满足真实需求时才考虑最小必要增量，并说明理由。

逐项按 changes.json 的 add/remove/update/move 修改对应源节点；update 只修改变动字段。必要时调整支撑该变化的父级布局约束，保持其他元素、事件、绑定、数据与资源原状。不要重写整个页面、机械粘贴代理 HTML、引入新 UI 框架或格式化未修改代码。空差异不写源码；完成后检查最终 diff 并报告框架识别依据与实际影响范围。

## Web / React / Vue / Svelte / Electron

1. 读取选区的组件、样式、资源和可用运行入口。记录路由、选区 selector 和视口。尽量从实际渲染获取几何与计算样式。
2. `capture.js` 中 `captureLayout(selector, kind)` 只读取该根节点下的可见 DOM。文本节点被建为独立 span，保持混合内容的顺序。采集的是当前断点的静态外观，不包含媒体查询、伪元素、WebGL、跨域 iframe、运行时状态。检查返回的 warnings。
3. 给节点补 `source.file`（相对 project 根）、`source.locator`（稳定 class、组件名+prop、测试 ID、唯一文本等）、`source.component`；列表实例还需说明 key/数据来源。行号只是辅助。保留 computed style 供展示，回写仅以实际差异为依据。
4. 新组件尽量使用项目现有组件库；重复列表中一个实例的改动，先判断是局部实例还是共享模板。保留 handler、v-model、props、ARIA、语义标签和资源引用。
5. 响应式布局优先调整 flex/grid/约束与设计 token；拖动的像素差异是当前视口的参考。检查重叠、滚动、触达区域和至少一个相邻视口。

## Desktop

有代码时以代码中的组件树/控件树为主，截图和几何作补充。每个 HTML 代理节点对应控件或布局容器，`source.locator` 填原控件稳定标识，`source.adapter` 填框架；代理使用 HTML 标签，但在 `source.nativeType` 记录真实控件类型。

| 原实现 | 映射线索 | 回写选择 |
| --- | --- | --- |
| Qt Designer `.ui` | widget/layout 的 name、class、property | 有 layout 时改 spacing、margin、stretch、sizePolicy、minimum/maximum；只有自由布局才改 geometry；保持 signals/slots 和 objectName |
| Qt QML | id、组件文件、anchors、Layout 属性 | 优先 anchors / Layout / Row / Column；保留 binding 与 signal handler，避免给被 anchors 管理的控件同时写冲突坐标 |
| WPF/WinUI XAML | x:Name、Grid.Row/Column、资源键、DataTemplate | Grid 定义、Margin、Padding、Alignment、Width/Height、Style 局部覆盖；保留 Binding、Command、资源、名称空间 |
| WinForms | Name、父容器、Designer 初始化段 | Dock、Anchor、Margin、Padding、Table/FlowLayout；只有适用时改 Location/Size；保留事件注册与 Designer 约定 |
| SwiftUI / Compose / Flutter | 源组件位置与稳定标识 | 翻译为原布局修饰符、约束与主题，不生成 HTML 替换原 UI |
| Electron | 渲染层 DOM + React/Vue/HTML 来源 | 使用 Web 路径；保留 IPC 和 preload 边界 |

原生菜单、系统字体、复杂控件、动画、DPI 的 HTML 外观只是近似。示例组件是设计意图，需要适配真实控件库。回写后编译项目并在实际应用检查，无法运行则准确说明未验证部分。

## 截图 / 设计图

识别图的尺寸与选区，人工/视觉重建容器、文本、按钮、图标和图片区。优先按层次和间距建树；无法推断关系的部分可暂用 absolute 布局并标注。将参考图片复制到 session/media，设置 `referenceImage: "media/reference.png"`，编辑器可调参考图透明度。

不可只放一张图然后宣称所有内部组件可编辑。文字内容、坐标、颜色与字体需要核对；模糊区域保持显式不确定性。若输入是可访问的 Figma/设计工具选区，使用已提供且获准的接口取节点和 token，不假设一定有连接器。

输出目标有源码时补 source 并走对应 adapter；否则保存的 preview.html 是可运行静态重建，交互由后续实现补齐。用户指定 React、Vue、Qt 等目标时据 model 和 changes 生成对应工程；目标未知时默认静态 HTML，不凭空选择原生框架。
