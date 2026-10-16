/* Read-only DOM capture. Evaluate this function with the selected root selector.
   Return its JSON via the browser tool; then write it using a filesystem tool.
   Example: captureLayout("#settings-panel", "web") */
function captureLayout(selector, kind = "web") {
  const root = document.querySelector(selector);
  if (!root) throw new Error("未找到选区：" + selector);
  const rect = root.getBoundingClientRect(), warnings = [];
  const tags = new Set("div section article main header footer nav aside span p h1 h2 h3 h4 h5 h6 button a img input textarea label ul ol li hr strong em small table thead tbody tr td th pre code blockquote select option progress video details summary".split(" "));
  const keys = ("display position top left right bottom width height minWidth minHeight maxWidth maxHeight " +
    "marginTop marginRight marginBottom marginLeft paddingTop paddingRight paddingBottom paddingLeft " +
    "gap rowGap columnGap flexGrow flexShrink flexBasis flexDirection flexWrap justifyContent alignItems alignSelf alignContent " +
    "gridTemplateColumns gridTemplateRows gridColumn gridRow gridAutoFlow order color backgroundColor " +
    "fontFamily fontSize fontWeight fontStyle lineHeight letterSpacing textAlign textDecoration whiteSpace wordBreak overflowWrap " +
    "borderTop borderRight borderBottom borderLeft borderRadius boxShadow opacity overflow overflowX overflowY zIndex " +
    "objectFit objectPosition aspectRatio transform transformOrigin visibility boxSizing verticalAlign listStyle textTransform").split(" ");
  const safeCSS = value => !/[;{}<>\\\u0000-\u0008]|url\s*\(|expression\s*\(|@import/i.test(value);
  const source = (locator, nativeType) => ({locator, adapter: kind === "desktop" ? "electron" : "dom", nativeType});
  let serial = 0;
  function id() { return "captured-" + (++serial); }
  function locator(el) {
    if (el === root) return selector;
    const chain = [];
    while (el && el !== root) {
      let index = 1;
      for (let sibling = el.previousElementSibling; sibling; sibling = sibling.previousElementSibling)
        if (sibling.localName === el.localName) index++;
      chain.unshift(el.localName + ":nth-of-type(" + index + ")");
      el = el.parentElement;
    }
    return selector + " > " + chain.join(" > ");
  }
  function walk(el, depth = 0) {
    if (depth > 70 || serial > 4500) throw new Error("选区过大，请缩小范围");
    const cs = getComputedStyle(el);
    if (cs.display === "none") return null;
    const loc = locator(el), nativeType = el.localName, supported = tags.has(nativeType)||["body","html","form","fieldset","legend"].includes(nativeType);
    if (!supported) {
      if (["head","script","style","link","meta","noscript","template"].includes(nativeType)) return null;
      warnings.push(loc + "：不支持 " + nativeType + "，需重建或补图片代理");
    }
    if (el.shadowRoot) warnings.push(loc + "：Shadow DOM 需单独重建");
    for (const pseudo of ["::before","::after"]) {
      const content = getComputedStyle(el,pseudo).content;
      if (content && content !== "none" && content !== "normal" && content !== '""')
        warnings.push(loc + "：" + pseudo + " 未被采集");
    }
    if (cs.backgroundImage !== "none") warnings.push(loc + "：背景图片/渐变需补充");
    if (cs.translate && cs.translate !== "none") warnings.push(loc + "：原 CSS translate 需核对");
    const node = {id:id(),tag:tags.has(nativeType)?nativeType:"div",name:el.getAttribute("aria-label")||el.id||nativeType,
      text:"",style:{},attrs:{},offset:{x:0,y:0},source:source(loc,nativeType),children:[]};
    for (const key of keys) if (cs[key] && safeCSS(cs[key])) node.style[key] = cs[key];
    if (node.style.position === "fixed") {
      const box = el.getBoundingClientRect();
      node.style.position = "absolute";
      node.style.left = (box.left-rect.left) + "px";node.style.top = (box.top-rect.top) + "px";
      delete node.style.right;delete node.style.bottom;
      warnings.push(loc + "：fixed 已转为选区内 absolute，回写时还原意图");
    }
    for (const key of ["alt","title","placeholder","type","role","aria-label","controls","loop","muted","playsinline","preload","open","min","max","step"]) {
      const value = el.getAttribute(key);if (value !== null) node.attrs[key] = value;
    }
    if (nativeType === "img" || nativeType === "video") {
      const value = el.currentSrc || el.src;
      if (/^https?:\/\//.test(value) || /^data:(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm|ogg));base64,[A-Za-z0-9+/=]+$/.test(value)) node.attrs.src=value;
      else warnings.push(loc + "：媒体需复制到 session/media 并补路径");
      if (nativeType === "video" && /^https?:\/\//.test(el.poster)) node.attrs.poster=el.poster;
    }
    if (nativeType === "a") {
      if (/^https?:\/\//.test(el.href)) node.attrs.href=el.href;
      else warnings.push(loc + "：非 HTTP 链接未采集");
    }
    if (["input","select","option"].includes(nativeType)) node.attrs.value = el.value;
    if (nativeType === "option") node.text = el.textContent;
    if (nativeType === "textarea") node.text = el.value;
    if (supported && !["img","input","hr","textarea","option","video"].includes(nativeType)) {
      for (const child of el.childNodes) {
        if (child.nodeType === 3 && child.textContent.trim()) node.children.push({
          id:id(),tag:"span",name:"文本 · "+child.textContent.trim().slice(0,20),
          text:child.textContent,style:{},attrs:{},offset:{x:0,y:0},
          source:source(loc+" / text["+[...el.childNodes].indexOf(child)+"]","#text"),children:[]
        });
        else if (child.nodeType === 1) {const captured=walk(child,depth+1);if(captured)node.children.push(captured);}
      }
    }
    if (!supported) {
      const box=el.getBoundingClientRect();
      Object.assign(node.style,{width:box.width+"px",height:box.height+"px",backgroundColor:"#e5eae7"});
      node.text=nativeType.toUpperCase()+"（待补代理）";
    }
    return node;
  }
  const tree = walk(root);
  if(!tree)throw new Error("选区不可见");
  Object.assign(tree.style,{position:"relative",marginTop:"0px",marginRight:"0px",marginBottom:"0px",marginLeft:"0px",top:"auto",left:"auto",right:"auto",bottom:"auto"});
  if (rect.width < 1 || rect.height < 1) throw new Error("选区不可见或无有效尺寸");
  return {schemaVersion:1,title:document.title+" · "+selector,
    source:{kind,description:location.href,selector,viewport:{width:innerWidth,height:innerHeight},
      warnings:["计算样式为当前视口静态快照；回写只应用差异，保留原响应式规则。",...warnings]},
    canvas:{width:Math.max(200,Math.min(10000,Math.ceil(rect.width))),height:Math.max(200,Math.min(10000,Math.ceil(rect.height))),background:"#ffffff"},
    referenceImage:"",root:{id:id(),tag:"div",name:"画布",text:"",style:{position:"relative",width:"100%",minHeight:Math.ceil(rect.height)+"px"},attrs:{},offset:{x:0,y:0},source:null,children:[tree]}};
}
