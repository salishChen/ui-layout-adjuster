(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const prefs = globalThis.LayoutPreferences, t = prefs.t;
  const clone = value => JSON.parse(JSON.stringify(value));
  const boot = JSON.parse($("bootstrap").textContent);
  let model = clone(boot.model), baseline = clone(boot.baseline), revision = boot.revision;
  let token = null, selected = null, zoom = .8, history = [], future = [];
  let saved = JSON.stringify(model), gesture = null, recoveredDraft = null, saving = false, autoFit = true;
  const nodes = new Map(), elements = new Map();
  const containerTags = new Set(["div","section","article","main","header","footer","nav","aside","li","td","details"]);
  let paletteDrag = null;
  let previewMode = false, uploadTarget = null, uploading = false;
  let panels = {left:false,right:false};
  try {const savedPanels=JSON.parse(localStorage.getItem("layout-editor.panels.v1"));panels={left:savedPanels?.left===true,right:savedPanels?.right===true};}catch(_){}
  const mediaAccept="image/png,image/jpeg,image/gif,image/webp,image/avif,video/mp4,video/webm,video/ogg";
  let childDoc = null;
  const localKey = () => "layout-draft:" + model.sessionId;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const px = value => Math.round(value * 100) / 100 + "px";
  let toastTimer;
  function toast(message, error=false) {
    $("toast").textContent = prefs.translateMessage(message); $("toast").className = "toast" + (error?" error":""); $("toast").style.display="block";
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").style.display="none", error?7000:3500);
  }
  function index() {
    nodes.clear();
    function walk(node, parent=null, depth=0) {
      nodes.set(node.id,{node,parent,depth});
      (node.children||[]).forEach(child => walk(child,node,depth+1));
    } walk(model.root);
    if(!nodes.has(selected)||selected===model.root.id)selected=null;
  }
  function current() { return nodes.get(selected)?.node; }
  function dirty() { return JSON.stringify(model)!==saved; }
  function mark() {
    const changed=dirty(); $("dirty").textContent=t(changed?"未保存":"已保存");
    $("dirty").style.color=changed?"var(--unsaved)":"";
    $("undo").disabled=!history.length; $("redo").disabled=!future.length;
    $("status").textContent=t(token?"本地会话":"离线模式：保存将下载 JSON") + " · v"+revision+" · "+model.title+(" · "+t(changed?"有未保存修改":"已保存"));
  }
  function draft() {
    mark();
    try {
      if(dirty()) localStorage.setItem(localKey(),JSON.stringify({model,revision,savedAt:Date.now()}));
      else localStorage.removeItem(localKey());
    } catch(_) { /* Explicit save/export remains available if storage is unavailable. */ }
  }
  function commit(before) {
    if(before===JSON.stringify(model)) return;
    history.push(before); if(history.length>100) history.shift(); future=[];
    index(); render(); draft();
  }
  function mutate(fn, afterRender=null) {
    const before=JSON.stringify(model);
    try {
      fn(); validate(model);
      if(afterRender){index();render();afterRender();validate(model);}
      commit(before);
    }
    catch(error) { model=JSON.parse(before); index(); render(); toast(error.message,true); }
  }
  function undo() {
    if(!history.length) return;
    future.push(JSON.stringify(model)); model=JSON.parse(history.pop()); index(); render(); draft();
  }
  function redo() {
    if(!future.length) return;
    history.push(JSON.stringify(model)); model=JSON.parse(future.pop()); index(); render(); draft();
  }
  function validURL(value,image=false) {
    if(typeof value!=="string" || /[\u0000-\u0020<>"'\\]/.test(value)) return false;
    if(!value) return true;
    if(image&&/^data:(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm|ogg));base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
    if(/^https?:\/\//.test(value)) { try{return !new URL(value).username;}catch(_){return false;} }
    if(image) return /^media\//.test(value)&&!value.split("/").includes("..")&&!/[%:?#]/.test(value);
    return !/^[\w+.-]+:/.test(value)&&!value.startsWith("//");
  }
  function validCSS(value) {
    return typeof value==="string"&&value.length<=4000&&!/[;{}<>\\\u0000-\u0008]|url\s*\(|expression\s*\(|@import/i.test(value);
  }
  function validate(candidate) {
    if(!candidate||candidate.schemaVersion!==1||typeof candidate.title!=="string"||candidate.title.length>300) throw Error("不是有效布局文件");
    if(!candidate.canvas||!["width","height"].every(key=>Number.isInteger(candidate.canvas[key])&&candidate.canvas[key]>=200&&candidate.canvas[key]<=10000)) throw Error("画布宽高应在 200..10000");
    if(!validCSS(candidate.canvas.background||"#fff")||!validURL(candidate.referenceImage||"",true)) throw Error("画布背景或参考图无效");
    for(const key of ["source","sourceFiles","sessionId"]) if(JSON.stringify(candidate[key])!==JSON.stringify(baseline[key])) throw Error("布局文件不属于当前会话，或来源信息已变更");
    if(candidate.root?.id!==baseline.root.id) throw Error("不能替换根元素 ID");
    const original=new Map();
    function baseWalk(n){original.set(n.id,n);(n.children||[]).forEach(baseWalk);}baseWalk(baseline.root);
    const seen=new Set();
    function walk(n,depth=0) {
      if(!n||depth>80||seen.size>=5000||!/^[A-Za-z0-9_-]{1,100}$/.test(n.id)||seen.has(n.id)||!boot.tags.includes(n.tag)) throw Error("元素树无效或包含不支持的标签");
      seen.add(n.id);
      if(!["name","text"].every(k=>typeof(n[k]??"")==="string"&&(n[k]||"").length<=100000)) throw Error("元素文字无效");
      for(const [key,val] of Object.entries(n.style||{})) if(!boot.styles.includes(key)||!validCSS(val)) throw Error("CSS 属性或值不支持："+key);
      for(const [key,val] of Object.entries(n.attrs||{})) if(!boot.attrs.includes(key)||typeof val!=="string"||val.length>6000000||(["src","poster"].includes(key)&&!validURL(val,true))||(key==="href"&&!validURL(val))) throw Error("元素属性不支持："+key);
      if(!["x","y"].every(k=>typeof(n.offset?.[k]??0)==="number"&&Number.isFinite(n.offset?.[k]??0)&&Math.abs(n.offset?.[k]??0)<=100000)) throw Error("位移无效");
      if(original.has(n.id)?JSON.stringify(n.source??null)!==JSON.stringify(original.get(n.id).source??null):n.source!=null) throw Error("不能改变元素来源");
      if(!Array.isArray(n.children||[])||(["img","input","hr"].includes(n.tag)&&(n.children||[]).length)) throw Error("元素不能包含子元素");
      (n.children||[]).forEach(child=>walk(child,depth+1));
    }walk(candidate.root);
  }
  function createElement(node) {
    const el=document.createElement(node.tag);el.dataset.layoutId=node.id;
    el.style.boxSizing="border-box";
    for(const [key,val] of Object.entries(node.style||{})) el.style[key]=val;
    const off=node.offset||{x:0,y:0};if(off.x||off.y)el.style.translate=off.x+"px "+off.y+"px";
    for(const [key,val] of Object.entries(node.attrs||{})) el.setAttribute(key,val);
    if(node.text)el.append(document.createTextNode(node.text));
    (node.children||[]).forEach(child=>el.append(createElement(child)));
    if(node.tag==="select"&&node.attrs?.value!=null)el.value=node.attrs.value;
    if(node.tag==="img")el.draggable=false;
    elements.set(node.id,el);
    return el;
  }
  function renderCanvas() {
    elements.clear();
    if(childDoc) {
      childDoc.body.replaceChildren(createElement(model.root));
      childDoc.body.style.cssText='margin:0;font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif;color:#1f2930';
      childDoc.documentElement.style.overflow="hidden";
      childDoc.documentElement.dataset.preview=String(previewMode);
      childDoc.head.querySelectorAll("style").forEach(el=>el.remove());
      const style=childDoc.createElement("style");
      style.textContent='*,*::before,*::after{box-sizing:border-box}button,input,textarea,select{font:inherit}img,video{max-width:100%}[data-layout-id]{cursor:move}html[data-preview=true] [data-layout-id]{cursor:revert}html[data-preview=true] :is(button,a,summary){cursor:pointer}body{min-height:100vh}';
      childDoc.head.append(style);
    }
    const c=model.canvas;
    $("artboard").style.width=c.width+"px";$("artboard").style.height=c.height+"px";$("artboard").style.background=c.background;
    renderCanvasViewport();
    $("canvas-label").textContent=model.title+" / "+c.width+" × "+c.height;
    $("reference-field").hidden=!model.referenceImage;
    $("reference").src=model.referenceImage||"";
    $("reference").style.display=model.referenceImage?"block":"none";
    $("reference").style.opacity=Number($("reference-opacity").value)/100;
    requestAnimationFrame(outline);
  }
  function renderCanvasViewport() {
    const view=$("viewport"),spaceX=view.clientWidth/2,spaceY=view.clientHeight/2;
    // Scrollable space around the page keeps cursor anchoring possible when zooming out.
    $("artboard").style.left=px(spaceX);$("artboard").style.top=px(spaceY);
    $("artboard").style.transform="scale("+zoom+")";
    $("canvas-label").style.left=px(spaceX);$("canvas-label").style.top=px(spaceY-26);
    $("stage").style.width=px(model.canvas.width*zoom+spaceX*2);
    $("stage").style.height=px(model.canvas.height*zoom+spaceY*2);
    requestAnimationFrame(outline);
  }
  function outline() {
    const el=elements.get(selected);
    if(previewMode||!el||el.getClientRects().length===0) { $("selection").style.display="none"; return; }
    const rect=el.getBoundingClientRect(), box=$("selection");
    Object.assign(box.style,{display:"block",left:px(rect.left),top:px(rect.top),width:px(rect.width),height:px(rect.height)});
    box.style.borderWidth=px(1.5/zoom);
    for(const handle of box.querySelectorAll(".handle")){handle.style.width=px(8/zoom);handle.style.height=px(8/zoom);handle.style.borderWidth=px(1/zoom);}
    $("selection-label").style.fontSize=px(10/zoom);
    $("selection-label").style.padding=px(2/zoom)+" "+px(6/zoom);
    $("selection-label").textContent=(current().name||current().tag)+" · "+Math.round(rect.width)+" × "+Math.round(rect.height);
  }
  function renderLayers() {
    $("layers").replaceChildren();
    for(const [id,{node,depth}] of nodes) {
      if(id===model.root.id){const root=document.createElement("div");root.className="layer layer-root";root.textContent=t("画布")+" · "+(node.name||model.title);$("layers").append(root);continue;}
      const button=document.createElement("button");button.className="layer"+(id===selected?" selected":"");
      button.style.paddingLeft=(6+depth*13)+"px";button.dataset.select=id;
      button.innerHTML='<span class="layer-tag">'+((node.children||[]).length?"▾":"·")+'</span><b>'+esc(node.name||node.tag)+'</b><small>'+esc(node.tag)+'</small>';
      button.title=node.name||id;button.setAttribute("aria-pressed",String(id===selected));$("layers").append(button);
    }
    $("node-count").textContent=t("{count} 个",{count:nodes.size});
  }
  function field(label,key,value,type="text",options=null) {
    const control=options?'<select data-field="'+key+'">'+options.map(x=>'<option value="'+esc(x[0])+'"'+(String(value??"")===x[0]?" selected":"")+'>'+esc(key==="parent"?x[1]:t(x[1]))+'</option>').join("")+'</select>':
      type==="textarea"?'<textarea data-field="'+key+'">'+esc(value)+'</textarea>':'<input data-field="'+key+'" type="'+type+'" value="'+esc(value)+'">';
    return '<label class="field"><span>'+esc(t(label))+'</span>'+control+'</label>';
  }
  const pair=(a,b)=>'<div class="row">'+a+b+'</div>';
  function renderInspector() {
    const active=document.activeElement?.dataset.field;
    const caret=active?{start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd}:null;
    const scroll=$("inspector").scrollTop;
    const n=current();if(!n){$("inspector").innerHTML='<div class="empty">'+esc(t("选择组件以编辑属性，或从左侧拖入新组件。"))+'</div>';return;}
    const s=n.style||{},a=n.attrs||{},off=n.offset||{x:0,y:0};
    const descendants=new Set();function walk(x){descendants.add(x.id);(x.children||[]).forEach(walk);}walk(n);
    const containers=[...nodes.values()].filter(({node})=>!descendants.has(node.id)&&containerTags.has(node.tag));
    const parentId=nodes.get(n.id).parent?.id;
    let out='<section class="section"><div class="section-title"><span data-i18n="元素属性">元素属性</span> <span class="quiet">'+esc(n.tag)+'</span></div><p class="property-label">'+esc(n.name||n.id)+'</p><div class="quiet">'+esc(n.id)+'</div>';
    out+=field("图层名称","name",n.name)+field("文本内容","text",n.text,"textarea")+'<button data-action="apply-fields" style="width:100%"><span data-i18n="应用属性">应用属性</span></button>';
    if(n.tag==="img"||n.tag==="video"){
      out+=field("媒体地址（media/、https 或 data URI）","attrs.src",a.src);
      if(n.tag==="img")out+=field("图片说明","attrs.alt",a.alt);
      if(n.tag==="video")out+=field("封面地址","attrs.poster",a.poster);
      out+='<button data-action="upload-media" style="width:100%">'+esc(t(uploading?"正在上传…":"上传本地图片 / 视频"))+'</button><p class="note">'+esc(t("服务模式单文件最大 100 MB；离线模式最大 4 MB。"))+'</p>';
      if(a.src)out+=n.tag==="img"?'<img class="media-preview" alt="" src="'+esc(a.src)+'">':'<video class="media-preview" controls preload="metadata" src="'+esc(a.src)+'"></video>';
    }
    if(a["data-component"]==="carousel")out+='<button data-action="upload-media" style="width:100%">'+esc(t("上传轮播图片（可多选）"))+'</button><p class="note">'+esc(t("选择多张图片替换轮播内容；预览时可切换图片。"))+'</p>';
    if(n.tag==="select")out+=field("选项（每行一项）","component.options",(n.children||[]).map(c=>c.text||"").join("\n"),"textarea")+field("默认选中值","attrs.value",a.value||n.children?.[0]?.attrs?.value);
    if(n.tag==="input"&&a.type==="time")out+=pair(field("最早时间","attrs.min",a.min,"time"),field("最晚时间","attrs.max",a.max,"time"))+field("步长 / 秒","attrs.step",a.step||"60","number");
    if(n.tag==="details")out+=field("默认状态","component.open",Object.hasOwn(a,"open")?"yes":"no","text",[["yes","展开"],["no","折叠"]]);
    if(a["data-component"]==="pagination")out+=pair(field("总页数（1–50）","component.pages",a["data-total-pages"],"number"),field("当前页","component.page",a["data-current-page"],"number"));
    if(n.tag==="input"||n.tag==="textarea")out+=field("占位文字","attrs.placeholder",a.placeholder);
    if(n.tag==="input")out+=field("内容","attrs.value",a.value);
    if(n.tag==="a")out+=field("链接","attrs.href",a.href);
    out+='</section><section class="section"><div class="section-title"><span data-i18n="位置与尺寸">位置与尺寸</span></div>';
    out+=pair(field("X 位移 / px","offset.x",off.x,"number"),field("Y 位移 / px","offset.y",off.y,"number"));
    out+=pair(field("宽度","style.width",s.width),field("高度","style.height",s.height));
    out+=pair(field("最小宽度","style.minWidth",s.minWidth),field("最小高度","style.minHeight",s.minHeight));
    out+=field("定位","style.position",s.position||"", "text",[["","默认"],["static","static"],["relative","relative"],["absolute","absolute"],["fixed","fixed"],["sticky","sticky"]]);
    out+=pair(field("左 / left","style.left",s.left),field("上 / top","style.top",s.top));
    out+='<p class="note"><span data-i18n="自由拖动记录视觉位移；结构布局可调整父容器、顺序与间距。">自由拖动记录视觉位移；结构布局可调整父容器、顺序与间距。</span></p></section><section class="section"><div class="section-title"><span data-i18n="外观">外观</span></div>';
    out+=pair(field("文字颜色","style.color",s.color),field("背景颜色","style.background",s.background||s.backgroundColor));
    out+=pair(field("字号","style.fontSize",s.fontSize),field("字重","style.fontWeight",s.fontWeight));
    out+=pair(field("行高","style.lineHeight",s.lineHeight),field("圆角","style.borderRadius",s.borderRadius));
    out+=field("边框","style.border",s.border)+field("阴影","style.boxShadow",s.boxShadow);
    out+=pair(field("透明度 0..1","style.opacity",s.opacity),field("层级","style.zIndex",s.zIndex));
    out+=field("文本对齐","style.textAlign",s.textAlign||"", "text",[["","默认"],["left","左"],["center","居中"],["right","右"]]);
    out+='</section><section class="section"><div class="section-title"><span data-i18n="容器与排列">容器与排列</span></div>';
    out+=field("显示布局","style.display",s.display||"", "text",[["","默认"],["block","block"],["inline","inline"],["inline-block","inline-block"],["flex","flex"],["grid","grid"],["none","隐藏"]]);
    out+=pair(field("内边距","style.padding",s.padding),field("间距","style.gap",s.gap));
    out+=field("外边距","style.margin",s.margin);
    out+=pair(field("Flex 方向","style.flexDirection",s.flexDirection||"", "text",[["","默认"],["row","横向"],["column","纵向"],["row-reverse","反向横排"],["column-reverse","反向竖排"]]),
      field("换行","style.flexWrap",s.flexWrap||"","text",[["","默认"],["nowrap","不换行"],["wrap","换行"]]));
    out+=pair(field("主轴对齐","style.justifyContent",s.justifyContent||"","text",[["","默认"],["flex-start","起点"],["center","居中"],["flex-end","终点"],["space-between","两端"],["space-around","均匀"]]),
      field("交叉轴对齐","style.alignItems",s.alignItems||"","text",[["","默认"],["stretch","拉伸"],["flex-start","起点"],["center","居中"],["flex-end","终点"]]));
    out+=field("Grid 列","style.gridTemplateColumns",s.gridTemplateColumns);
    if(n.id!==model.root.id)out+=field("父容器","parent",parentId,"text",containers.map(({node})=>[node.id,node.name||node.id]));
    out+='<div class="mini-actions"><button data-action="up"'+(n.id===model.root.id?" disabled":"")+'><span data-i18n="上移层级">上移层级</span></button><button data-action="down"'+(n.id===model.root.id?" disabled":"")+'><span data-i18n="下移层级">下移层级</span></button></div>';
    out+='<div class="mini-actions"><button data-action="clone"'+(n.id===model.root.id?" disabled":"")+'><span data-i18n="复制">复制</span></button><button data-action="remove" class="danger"'+(n.id===model.root.id?" disabled":"")+'><span data-i18n="删除">删除</span></button></div></section>';
    out+='<section class="section"><details><summary><span data-i18n="高级样式 JSON">高级样式 JSON</span></summary><textarea id="css-json" spellcheck="false">'+esc(JSON.stringify(s,null,2))+'</textarea><button data-action="css" style="width:100%;margin-top:8px"><span data-i18n="应用样式 JSON">应用样式 JSON</span></button><p class="note"><span data-i18n="只支持样式白名单；清空属性即可恢复默认。">只支持样式白名单；清空属性即可恢复默认。</span></p></details></section>';
    out+='<section class="section"><div class="section-title"><span data-i18n="来源映射">来源映射</span></div><div class="source-box">'+esc(n.source?JSON.stringify(n.source,null,2):t("新增元素 / 未映射\n回写时由 Codex 定位或创建"))+'</div></section>';
    $("inspector").innerHTML=out; prefs.translateDocument($("inspector"));
    for(const control of $("inspector").querySelectorAll("[data-field]"))control.dataset.initial=control.value;
    if(active){
      const control=[...$("inspector").querySelectorAll("[data-field]")].find(c=>c.dataset.field===active);
      if(control){control.focus({preventScroll:true});if(caret?.start!=null&&control.setSelectionRange)try{control.setSelectionRange(caret.start,caret.end);}catch(_){}}
    }
    $("inspector").scrollTop=scroll;
  }
  function render() {
    clearGuides();renderCanvas();renderLayers();renderInspector();prefs.translateDocument();
    $("canvas-w").value=model.canvas.width;$("canvas-h").value=model.canvas.height;
    $("canvas-bg").value=model.canvas.background;$("session-title").value=model.title;
    $("kind").textContent=({web:"WEB",desktop:"DESKTOP",image:"IMAGE",demo:"DEMO"})[model.source.kind];
    mark();
    updatePreviewButton();
  }
  function select(id) {if(id==null||id===model.root.id||nodes.has(id)){selected=id===model.root.id?null:id;clearGuides();renderLayers();renderInspector();outline();}}
  function uid() {return "new-"+crypto.randomUUID().replaceAll("-","").slice(0,16);}
  function make(tag,name,text="",style={},children=[]) {
    return {id:uid(),tag,name:t(name),text:t(text),style,attrs:{},offset:{x:0,y:0},source:null,children};
  }
  function carouselContent(node, sources=["","",""]) {
    const slides=sources.map((src,i)=>{
      const image=make("img","轮播图片","",{width:"100%",height:"100%",objectFit:"cover",display:src?"block":"none"});image.attrs={src,alt:t("轮播图片")+" "+(i+1)};
      const slide=make("div","轮播页","",{position:"relative",flex:"0 0 100%",width:"100%",height:"100%",scrollSnapAlign:"start",background:["#dce9e0","#e9e2d5","#dce7ef"][i%3],display:"flex",alignItems:"center",justifyContent:"center"},src?[image]:[image,make("span","图片占位",t("轮播图片")+" "+(i+1),{fontSize:"22px",color:"#52685b"})]);
      slide.attrs={id:slide.id};return slide;
    });
    const arrowStyle={position:"absolute",top:"45%",padding:"2px 12px",background:"#ffffffdd",borderRadius:"20px",color:"#264b36",textDecoration:"none",fontSize:"24px",zIndex:"1"};
    slides.forEach((slide,i)=>{
      for(const [step,side,text] of [[-1,"left","‹"],[1,"right","›"]]){
        const arrow=make("a",step<0?"上一张":"下一张",text,{...arrowStyle,[side]:"12px"});
        arrow.attrs={href:"#"+slides[(i+step+slides.length)%slides.length].id,"data-slide-target":slides[(i+step+slides.length)%slides.length].id,"aria-label":t(step<0?"上一张":"下一张")};slide.children.push(arrow);
      }
    });
    const track=make("div","轮播轨道","",{display:"flex",width:"100%",height:"220px",overflowX:"auto",overflowY:"hidden",scrollSnapType:"x mandatory",scrollBehavior:"smooth",borderRadius:"12px"},slides);track.attrs={"data-carousel-track":"true"};
    const dots=make("div","轮播导航","",{display:"flex",gap:"8px",justifyContent:"center",padding:"10px"},slides.map((slide,i)=>{
      const dot=make("a","轮播导航",String(i+1),{padding:"2px 9px",background:"#e4eee7",color:"#315d43",borderRadius:"12px",textDecoration:"none"});dot.attrs={href:"#"+slide.id,"data-slide-target":slide.id};return dot;
    }));node.children=[track,dots];
  }
  function paginationContent(node,total=5,page=1) {
    total=Math.min(50,Math.max(1,Math.round(total)));page=Math.min(total,Math.max(1,Math.round(page)));
    node.attrs={...node.attrs,"data-component":"pagination","data-total-pages":String(total),"data-current-page":String(page),"aria-label":t("分页")};
    const link=(name,text,index,action=null)=>{
      const n=make("a",name,text,{padding:"7px 12px",border:"1px solid #c9d9cf",borderRadius:"6px",background:index===page&&!action?"#32674b":"#fff",color:index===page&&!action?"#fff":"#32674b",textDecoration:"none"});
      n.attrs={href:"#page-"+index,...(action?{"data-page-action":action}:{"data-page-index":String(index)}),...(index===page&&!action?{"aria-current":"page"}:{})};return n;
    };
    node.children=[link("上一页","‹",Math.max(1,page-1),"previous"),...Array.from({length:total},(_,i)=>link("页码",String(i+1),i+1)),link("下一页","›",Math.min(total,page+1),"next")];
  }
  function add(kind, placement=null) {
    mutate(()=>{
      let parent=placement?nodes.get(placement.parentId)?.node:(current()||model.root);
      if(!parent)return;
      if(!containerTags.has(parent.tag))parent=nodes.get(parent.id).parent||model.root;
      const styles={fontSize:"14px",color:"#263e30"};
      let node;
      if(kind==="text")node=make("p","新文本","双击右侧文本内容修改",{...styles,margin:"0",lineHeight:"1.6"});
      if(kind==="button")node=make("button","新按钮","按钮",{...styles,background:"#32674b",color:"#fff",border:"0",borderRadius:"8px",padding:"12px 22px"});
      if(kind==="container")node=make("div","新容器","",{display:"flex",flexDirection:"column",gap:"12px",padding:"20px",minWidth:"180px",minHeight:"100px",border:"1px dashed #95b6a0",borderRadius:"10px"});
      if(kind==="card")node=make("div","新卡片","",{background:"#fff",border:"1px solid #dce7de",borderRadius:"14px",padding:"24px",minWidth:"220px"},[make("h3","卡片标题","新卡片",{fontSize:"19px",margin:"0 0 12px",color:"#243b2c"}),make("p","卡片说明","在这里补充一段说明。",{...styles,margin:"0",color:"#748077"})]);
      if(kind==="input"){node=make("input","输入框","",{...styles,padding:"12px",border:"1px solid #bacdbf",borderRadius:"8px",width:"240px",background:"#fff"});node.attrs={placeholder:t("请输入内容"),type:"text"};}
      if(kind==="image"){node=make("img","图片","",{width:"240px",height:"160px",objectFit:"cover",borderRadius:"10px",background:"#e7eee9"});node.attrs={alt:t("新图片"),src:""};}
      if(kind==="video"){node=make("video","视频","",{width:"320px",height:"180px",objectFit:"contain",borderRadius:"10px",background:"#15251b"});node.attrs={src:"",controls:"",preload:"metadata",playsinline:""};}
      if(kind==="carousel"){node=make("div","轮播图","",{width:"420px",maxWidth:"100%"});node.attrs={"data-component":"carousel"};carouselContent(node);}
      if(kind==="select"){
        const options=["选项一","选项二","选项三"].map(label=>{const option=make("option",label,label);option.attrs={value:t(label)};return option;});
        node=make("select","选择框","",{...styles,width:"220px",padding:"11px 14px",background:"#fff",border:"1px solid #bacdbf",borderRadius:"8px"},options);node.attrs={"aria-label":t("选择框"),value:options[0].attrs.value};
      }
      if(kind==="time"){node=make("input","时间选择器","",{...styles,width:"180px",padding:"11px 14px",background:"#fff",border:"1px solid #bacdbf",borderRadius:"8px"});node.attrs={type:"time",value:"09:00",step:"60","aria-label":t("时间选择器")};}
      if(kind==="accordion"){node=make("details","折叠面板","",{width:"320px",padding:"16px 20px",background:"#fff",border:"1px solid #dce7de",borderRadius:"10px"},[make("summary","面板标题","折叠面板",{fontWeight:"600",color:"#31543e"}),make("div","面板内容","这里是可以展开或折叠的内容。",{paddingTop:"14px",lineHeight:"1.7",color:"#657b6b"})]);node.attrs={open:""};}
      if(kind==="pagination"){node=make("nav","分页","",{display:"flex",flexWrap:"wrap",gap:"6px",alignItems:"center"});paginationContent(node);}
      if(kind==="rectangle")node=make("div","色块","",{width:"160px",height:"100px",background:"#b6d4bf",borderRadius:"12px"});
      if(kind==="divider")node=make("hr","分隔线","",{width:"100%",border:"0",borderTop:"1px solid #cfdbd1",margin:"12px 0"});
      if(parent.style?.position==="absolute" || (parent.children||[]).some(c=>c.style?.position==="absolute")) {
        node.style.position="absolute";node.style.left="24px";node.style.top="24px";
        if(!parent.style.position)parent.style.position="relative";
      }
      parent.children??=[];parent.children.push(node);selected=node.id;
    },placement?()=>{
      const n=current(),rect=elements.get(n.id).getBoundingClientRect();
      n.offset={x:Math.round(((n.offset?.x||0)+placement.x-rect.left)*100)/100,y:Math.round(((n.offset?.y||0)+placement.y-rect.top)*100)/100};
    }:null);
  }
  function clearDropPreview() {
    $("drop-target").style.display="none";$("drop-marker").style.display="none";
  }
  function dropPlacement(event, fromChild=false) {
    const rect=$("artboard").getBoundingClientRect();
    const x=fromChild?event.clientX:(event.clientX-rect.left)/zoom;
    const y=fromChild?event.clientY:(event.clientY-rect.top)/zoom;
    if(x<0||y<0||x>model.canvas.width||y>model.canvas.height)return null;
    const target=fromChild?event.target:childDoc?.elementFromPoint(x,y);
    let entry=nodes.get(target?.closest?.("[data-layout-id]")?.dataset.layoutId);
    while(entry&&!containerTags.has(entry.node.tag))entry=entry.parent?nodes.get(entry.parent.id):null;
    return {x,y,parentId:entry?.node.id||model.root.id};
  }
  function paletteDragOver(event, fromChild=false) {
    if(!paletteDrag)return;
    const placement=dropPlacement(event,fromChild);
    if(!placement){event.dataTransfer.dropEffect="none";clearDropPreview();return;}
    event.preventDefault();event.dataTransfer.dropEffect="copy";
    const rect=elements.get(placement.parentId)?.getBoundingClientRect();
    if(rect)Object.assign($("drop-target").style,{display:"block",left:px(rect.left),top:px(rect.top),width:px(rect.width),height:px(rect.height),borderWidth:px(1.5/zoom)});
    Object.assign($("drop-marker").style,{display:"block",left:px(placement.x),top:px(placement.y),width:px(12/zoom),height:px(12/zoom),borderWidth:px(1/zoom)});
    $("drop-label").textContent=t("放置到 {name}",{name:nodes.get(placement.parentId).node.name||placement.parentId});
    $("drop-label").style.fontSize=px(11/zoom);$("drop-label").style.padding=px(3/zoom)+" "+px(7/zoom);
  }
  function paletteDrop(event, fromChild=false) {
    if(!paletteDrag)return;
    event.preventDefault();
    const kind=paletteDrag,placement=dropPlacement(event,fromChild);
    paletteDrag=null;clearDropPreview();
    if(placement)add(kind,placement);
  }
  function updatePreviewButton() {
    $("preview-mode").textContent=t(previewMode?"返回编辑":"预览交互");
    $("preview-mode").setAttribute("aria-pressed",String(previewMode));
  }
  function setPreview(value) {
    previewMode=value;clearGuides();clearDropPreview();renderCanvas();updatePreviewButton();
  }
  function previewClick(event) {
    if(!previewMode){event.preventDefault();return;}
    const slideLink=event.target.closest("[data-slide-target]");
    if(slideLink){
      event.preventDefault();const carousel=slideLink.closest('[data-component="carousel"]'),track=carousel?.querySelector("[data-carousel-track]");
      const slide=childDoc.getElementById(slideLink.dataset.slideTarget);
      if(track&&slide)track.scrollTo({left:track.scrollLeft+slide.getBoundingClientRect().left-track.getBoundingClientRect().left,behavior:"smooth"});return;
    }
    const pageLink=event.target.closest("[data-page-index],[data-page-action]");
    if(pageLink){
      event.preventDefault();const nav=pageLink.closest('[data-component="pagination"]');if(!nav)return;
      const current=Number(nav.dataset.previewPage||nav.dataset.currentPage),total=Number(nav.dataset.totalPages);
      const page=Math.max(1,Math.min(total,pageLink.dataset.pageIndex?Number(pageLink.dataset.pageIndex):current+(pageLink.dataset.pageAction==="next"?1:-1)));
      nav.dataset.previewPage=String(page);
      for(const link of nav.querySelectorAll("[data-page-index]")){
        const active=Number(link.dataset.pageIndex)===page;link.style.background=active?"#32674b":"#fff";link.style.color=active?"#fff":"#32674b";
        if(active)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");
      }return;
    }
    if(event.target.closest("a"))event.preventDefault();
  }
  async function uploadMedia(files,targetId) {
    if(uploading||!files.length)return;
    const target=nodes.get(targetId)?.node;if(!target)return;
    const carousel=target.attrs?.["data-component"]==="carousel";
    const extensions={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",avif:"image/avif",mp4:"video/mp4",webm:"video/webm",ogv:"video/ogg",ogg:"video/ogg"};
    const accepted=new Set(mediaAccept.split(","));
    const items=(carousel?files:files.slice(0,1)).map(file=>({file,mime:file.type||extensions[file.name.split(".").pop().toLowerCase()]}));
    try {
      for(const {file,mime} of items){
        if(!accepted.has(mime)||carousel&&!mime.startsWith("image/"))throw Error("不支持的图片或视频格式");
        if(!file.size||file.size>(token?100:4)*1024*1024)throw Error(token?"单个媒体文件不能超过 100 MB":"离线媒体文件不能超过 4 MB，请使用本地服务上传大文件");
      }
      uploading=true;$("media-file").disabled=true;toast("正在上传…");renderInspector();
      const sources=[];
      for(const {file,mime} of items){
        if(token){
          const response=await fetch("/api/media",{method:"POST",headers:{"Content-Type":mime,"X-Layout-Token":token},body:file});
          const data=await response.json();if(!response.ok)throw Error(data.error||"上传失败");sources.push(data.src);
        }else{
          sources.push(await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error("读取本地媒体失败"));reader.readAsDataURL(new Blob([file],{type:mime}));}));
        }
      }
      if(!nodes.has(targetId))throw Error("目标组件已删除，请重新选择组件");
      mutate(()=>{
        const n=nodes.get(targetId).node;
        if(carousel)carouselContent(n,sources);
        else {
          const video=items[0].mime.startsWith("video/");n.tag=video?"video":"img";
          const attrs={...n.attrs,src:sources[0]};
          if(video){delete attrs.alt;Object.assign(attrs,{controls:"",preload:"metadata",playsinline:""});}
          else {for(const key of ["controls","preload","playsinline","poster","loop","muted"])delete attrs[key];attrs.alt=attrs.alt||items[0].file.name;}
          n.attrs=attrs;n.style??={};n.style.display=n.style.display==="none"?"block":n.style.display||"block";
        }
        selected=targetId;
      });toast("媒体已导入，请保存布局");
    }catch(error){toast(error.message,true);}
    finally{uploading=false;$("media-file").disabled=false;renderInspector();}
  }
  function remove() {
    const item=nodes.get(selected);if(!item?.parent)return;
    mutate(()=>{item.parent.children=item.parent.children.filter(n=>n.id!==selected);selected=item.parent.id;});
  }
  function duplicate() {
    const item=nodes.get(selected);if(!item?.parent)return;
    mutate(()=>{const node=clone(item.node),ids=new Map();function renew(n){n.id=uid();n.source=null;if(n.attrs?.id){const previous=n.attrs.id;n.attrs.id=n.id;ids.set(previous,n.id);}(n.children||[]).forEach(renew);}renew(node);
      function links(n){if(n.attrs?.["data-slide-target"]&&ids.has(n.attrs["data-slide-target"]))n.attrs["data-slide-target"]=ids.get(n.attrs["data-slide-target"]);if(n.attrs?.href?.startsWith("#")&&ids.has(n.attrs.href.slice(1)))n.attrs.href="#"+ids.get(n.attrs.href.slice(1));(n.children||[]).forEach(links);}links(node);
      node.name+=" "+t("副本");node.offset={x:(node.offset?.x||0)+16,y:(node.offset?.y||0)+16};
      item.parent.children.splice(item.parent.children.indexOf(item.node)+1,0,node);selected=node.id;});
  }
  function reorder(direction) {
    const {node,parent}=nodes.get(selected);if(!parent)return;
    mutate(()=>{const i=parent.children.indexOf(node),j=i+direction;if(j>=0&&j<parent.children.length){parent.children.splice(i,1);parent.children.splice(j,0,node);}});
  }
  function applyField(control) {
    const key=control.dataset.field,value=control.value;
    mutate(()=>{
      const n=current();
      if(key==="component.options"){
        const labels=value.split("\n").map(x=>x.trim()).filter(Boolean);if(!labels.length)return;
        n.children=labels.map((label,i)=>{const option=n.children?.[i]||make("option",label,label);option.text=label;option.name=label;option.attrs={...option.attrs,value:label};return option;});
        if(!labels.includes(n.attrs?.value))n.attrs.value=labels[0];return;
      }
      if(key==="component.open"){n.attrs??={};if(value==="yes")n.attrs.open="";else delete n.attrs.open;return;}
      if(key==="component.pages"||key==="component.page"){
        const number=Number(value);if(!Number.isInteger(number)||number<1||number>50)throw Error("页码和页数须为 1–50 的整数");
        paginationContent(n,key==="component.pages"?number:Number(n.attrs["data-total-pages"]),key==="component.page"?number:Number(n.attrs["data-current-page"]));return;
      }
      if(key==="parent"){const parent=nodes.get(value)?.node,old=nodes.get(n.id).parent;if(!parent||!old)return;old.children=old.children.filter(x=>x.id!==n.id);parent.children??=[];parent.children.push(n);n.offset={x:0,y:0};return;}
      if(key.startsWith("style.")) {const prop=key.slice(6);n.style??={};if(value)n.style[prop]=value;else delete n.style[prop];if(prop==="background")delete n.style.backgroundColor;}
      else if(key.startsWith("attrs.")) {n.attrs??={};n.attrs[key.slice(6)]=value;}
      else if(key.startsWith("offset.")) {n.offset??={x:0,y:0};n.offset[key.slice(7)]=Number(value);}
      else n[key]=value;
    });
  }
  function applyVisibleFields() {
    const changed=[...$("inspector").querySelectorAll("[data-field]")].filter(c=>c.value!==c.dataset.initial);
    changed.forEach(applyField);
  }
  function pointerStart(event,resize=null,fromChild=false) {
    if(previewMode)return;
    if(event.button!==0)return;
    const target=resize?elements.get(selected):event.target.closest?.("[data-layout-id]");
    if(!target||target.dataset.layoutId===model.root.id){if(!resize){event.preventDefault();select(null);}return;}
    event.preventDefault();if(!resize)select(target.dataset.layoutId);
    const n=current(),rect=elements.get(selected).getBoundingClientRect();
    if(n.id===model.root.id&&!resize)return;
    const captureEl=fromChild?childDoc.documentElement:$("surface");
    clearGuides();
    gesture={id:n.id,startX:event.clientX,startY:event.clientY,width:rect.width,height:rect.height,offset:clone(n.offset||{x:0,y:0}),before:JSON.stringify(model),resize,pointerId:event.pointerId,fromChild,captureEl,rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom},targets:alignmentTargets(n.id)};
    captureEl.setPointerCapture(event.pointerId);
  }
  function clearGuides() {
    $("guide-x").style.display="none";$("guide-y").style.display="none";
  }
  function alignmentTargets(id) {
    const excluded=new Set();
    function walk(n){excluded.add(n.id);(n.children||[]).forEach(walk);}walk(nodes.get(id).node);
    let ancestor=nodes.get(id).parent?.id;
    const parentId=ancestor;
    while(ancestor){if(ancestor!==parentId)excluded.add(ancestor);ancestor=nodes.get(ancestor).parent?.id;}
    const targets=[];
    for(const [key,el] of elements) {
      if(excluded.has(key)||!el.getClientRects().length)continue;
      const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
      targets.push({left:r.left,right:r.right,top:r.top,bottom:r.bottom,id:key,priority:key===parentId?2:nodes.get(key).parent?.id===parentId?0:1});
    }
    if(id!==model.root.id)targets.push({left:0,top:0,right:model.canvas.width,bottom:model.canvas.height,id:"canvas",priority:3});
    return targets;
  }
  function drawGuides(rect, x, y) {
    clearGuides();
    const padding=12/zoom;
    if(x){const el=$("guide-x"),top=Math.min(rect.top,x.target.top)-padding,bottom=Math.max(rect.bottom,x.target.bottom)+padding;
      Object.assign(el.style,{display:"block",left:px(x.position),top:px(top),height:px(bottom-top),borderLeftWidth:px(1/zoom)});}
    if(y){const el=$("guide-y"),left=Math.min(rect.left,y.target.left)-padding,right=Math.max(rect.right,y.target.right)+padding;
      Object.assign(el.style,{display:"block",top:px(y.position),left:px(left),width:px(right-left),borderTopWidth:px(1/zoom)});}
  }
  function move(event) {
    if(!gesture)return;
    const g=gesture,scale=g.fromChild?1:zoom;
    let dx=(event.clientX-g.startX)/scale,dy=(event.clientY-g.startY)/scale;
    let lockX=false,lockY=false;
    if(event.shiftKey&&!g.resize){if(Math.abs(dx)>Math.abs(dy)){dy=0;lockY=true;}else{dx=0;lockX=true;}}
    const snap=value=>$("snap").checked?Math.round(value/8)*8:Math.round(value*10)/10;
    const n=nodes.get(g.id).node,el=elements.get(g.id),r=g.rect,threshold=6/zoom;
    let proposed={...r},x=null,y=null;
    if(!g.resize){proposed={left:r.left+dx,right:r.right+dx,top:r.top+dy,bottom:r.bottom+dy};}
    else {
      if(g.resize.includes("e"))proposed.right=Math.max(r.left+8,r.right+dx);
      if(g.resize.includes("w"))proposed.left=Math.min(r.right-8,r.left+dx);
      if(g.resize.includes("s"))proposed.bottom=Math.max(r.top+8,r.bottom+dy);
      if(g.resize.includes("n"))proposed.top=Math.min(r.bottom-8,r.top+dy);
    }
    if($("guides").checked){
      const match=globalThis.LayoutAlignment.matchAxis;
      if(!lockX&&(!g.resize||/[ew]/.test(g.resize)))x=match(proposed,g.targets,"x",threshold,g.resize?[g.resize.includes("e")?2:0]:[0,1,2]);
      if(!lockY&&(!g.resize||/[ns]/.test(g.resize)))y=match(proposed,g.targets,"y",threshold,g.resize?[g.resize.includes("s")?2:0]:[0,1,2]);
    }
    if(!g.resize){
      n.offset={x:lockX?g.offset.x:x?g.offset.x+dx+x.delta:snap(g.offset.x+dx),y:lockY?g.offset.y:y?g.offset.y+dy+y.delta:snap(g.offset.y+dy)};
    }else{
      n.style??={};n.offset=clone(g.offset);
      let w=g.width,h=g.height;
      if(g.resize.includes("e"))w=Math.max(8,x?proposed.right+x.delta-r.left:snap(proposed.right-r.left));
      if(g.resize.includes("w")){w=Math.max(8,x?r.right-proposed.left-x.delta:snap(r.right-proposed.left));n.offset.x=g.offset.x+g.width-w;}
      if(g.resize.includes("s"))h=Math.max(8,y?proposed.bottom+y.delta-r.top:snap(proposed.bottom-r.top));
      if(g.resize.includes("n")){h=Math.max(8,y?r.bottom-proposed.top-y.delta:snap(r.bottom-proposed.top));n.offset.y=g.offset.y+g.height-h;}
      if(/[ew]/.test(g.resize)) {
        n.style.width=px(w);n.style.flex="0 0 auto";n.style.flexGrow="0";n.style.flexShrink="0";n.style.flexBasis="auto";
        el.style.width=n.style.width;el.style.flex="0 0 auto";
      }
      if(/[ns]/.test(g.resize)) {n.style.height=px(h);el.style.height=n.style.height;}
    }
    n.offset.x=Math.round(n.offset.x*100)/100;n.offset.y=Math.round(n.offset.y*100)/100;
    el.style.translate=n.offset.x+"px "+n.offset.y+"px";
    const actual=el.getBoundingClientRect();
    // Flex/grid reflow or min/max constraints can move a tentative alignment.
    const check=(candidate,axis)=>candidate&&globalThis.LayoutAlignment.matchAxis(actual,[candidate.target],axis,.6/zoom,[candidate.index]);
    drawGuides(actual,check(x,"x"),check(y,"y"));outline();
  }
  function pointerEnd() {
    if(!gesture)return;
    const g=gesture;gesture=null;clearGuides();
    if(g.captureEl.hasPointerCapture(g.pointerId))g.captureEl.releasePointerCapture(g.pointerId);
    commit(g.before);
  }
  function download(filename,data,type="application/json") {
    const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement("a");
    a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function exportJSON() {download("layout-"+model.sessionId+".json",JSON.stringify(model,null,2));toast("已导出布局 JSON");}
  async function save() {
    if(saving)return;
    if(uploading)return toast("请等待媒体上传完成",true);
    applyVisibleFields();
    try {validate(model);}catch(error){return toast(error.message,true);}
    if(!token){exportJSON();toast("离线布局已下载；将 JSON 交给 Codex 导入会话后应用。");return;}
    saving=true;$("save").disabled=true;
    const snapshot=clone(model),serialized=JSON.stringify(snapshot),saveRevision=revision;
    try {
      const result=await fetch("/api/save",{method:"POST",headers:{"Content-Type":"application/json","X-Layout-Token":token},body:JSON.stringify({model:snapshot,revision:saveRevision})});
      const data=await result.json();if(!result.ok)throw Error(data.error||"保存失败");
      revision=data.revision;saved=serialized;draft();toast("布局已保存。回到 Codex 说“应用已保存布局”。");
    }catch(error){toast(error.message,true);}finally{saving=false;$("save").disabled=false;mark();}
  }
  function updatePanels() {
    for(const side of ["left","right"]){
      const collapsed=panels[side],button=$("toggle-"+side);
      document.documentElement.dataset[side+"Collapsed"]=String(collapsed);
      $(side==="left"?"left-sidebar":"inspector").hidden=collapsed;
      const label=t((collapsed?"展开":"收起")+(side==="left"?"左侧栏":"右侧栏"));
      button.title=label;button.setAttribute("aria-label",label);button.setAttribute("aria-expanded",String(!collapsed));
      button.textContent=side==="left"?(collapsed?"›":"‹"):(collapsed?"‹":"›");
    }
  }
  function togglePanel(side) {
    panels[side]=!panels[side];updatePanels();
    try{localStorage.setItem("layout-editor.panels.v1",JSON.stringify(panels));}catch(_){}
    requestAnimationFrame(()=>{if(autoFit)fit();else setZoom(zoom);});
  }
  function fit() {
    const z=Math.min(1.5,Math.max(.2,($("viewport").clientWidth-90)/model.canvas.width));
    setZoom(Math.round(z*100)/100,true);
    const view=$("viewport"),rect=view.getBoundingClientRect(),board=$("artboard").getBoundingClientRect();
    view.scrollLeft+=board.left-(rect.left+view.clientLeft+(view.clientWidth-board.width)/2);
    view.scrollTop+=board.top-(rect.top+view.clientTop+parseFloat(getComputedStyle(view).paddingTop));
  }
  function setZoom(value,automatic=false,anchor=null) {
    if(gesture||paletteDrag||!Number.isFinite(value))return;
    value=Math.round(Math.min(4,Math.max(.2,value))*1000)/1000;
    const view=$("viewport"),viewRect=view.getBoundingClientRect(),before=$("artboard").getBoundingClientRect();
    if(!automatic&&!anchor)anchor={x:viewRect.left+view.clientLeft+view.clientWidth/2,y:viewRect.top+view.clientTop+view.clientHeight/2};
    const point=anchor?{x:(anchor.x-before.left)/zoom,y:(anchor.y-before.top)/zoom}:null;
    autoFit=automatic;zoom=value;
    const options=[...$("zoom").options],custom=options.find(o=>o.dataset.custom);
    let opt=options.find(o=>Number(o.value)===value);
    if(!opt){opt=custom||new Option();opt.value=String(value);opt.textContent=Math.round(value*100)+"%";opt.dataset.custom="true";if(!custom)$("zoom").add(opt);}
    else if(custom&&custom!==opt)custom.remove();
    $("zoom").value=opt.value;clearGuides();clearDropPreview();renderCanvasViewport();
    if(point){const after=$("artboard").getBoundingClientRect();view.scrollLeft+=after.left+point.x*zoom-anchor.x;view.scrollTop+=after.top+point.y*zoom-anchor.y;}
  }
  function wheelZoom(event,fromChild=false) {
    if(!event.ctrlKey)return;
    event.preventDefault();
    if(gesture||paletteDrag||!event.deltaY)return;
    const units=event.deltaMode===1?16:event.deltaMode===2?$("viewport").clientHeight:1;
    const delta=Math.max(-240,Math.min(240,event.deltaY*units));
    const frame=$("child-frame").getBoundingClientRect();
    const anchor=fromChild?{x:frame.left+event.clientX*zoom,y:frame.top+event.clientY*zoom}:{x:event.clientX,y:event.clientY};
    setZoom(zoom*Math.exp(-delta*.002),false,anchor);
  }
  $("selection").addEventListener("pointerdown",event=>{const dir=event.target.dataset.dir;if(dir)pointerStart(event,dir);});
  window.addEventListener("pointermove",move);window.addEventListener("pointerup",pointerEnd);
  window.addEventListener("pointercancel",()=>{if(gesture){const g=gesture;gesture=null;clearGuides();model=JSON.parse(g.before);index();render();}});
  window.addEventListener("resize",()=>{if(autoFit)fit();else setZoom(zoom);});
  $("viewport").addEventListener("wheel",event=>wheelZoom(event),{passive:false,capture:true});
  $("viewport").addEventListener("pointerdown",event=>{if(event.button===0&&[ $("viewport"),$("stage"),$("artboard") ].includes(event.target))select(null);});
  $("viewport").addEventListener("dragover",event=>paletteDragOver(event));
  $("viewport").addEventListener("drop",event=>paletteDrop(event));
  $("viewport").addEventListener("dragleave",event=>{if(!$("viewport").contains(event.relatedTarget))clearDropPreview();});
  $("layers").addEventListener("click",event=>{const button=event.target.closest("[data-select]");if(button)select(button.dataset.select);});
  document.querySelectorAll("[data-add]").forEach(button=>{
    button.onclick=()=>add(button.dataset.add);button.draggable=true;
    button.dataset.i18nTitle="点击添加，或拖动到画布指定位置";
    button.addEventListener("dragstart",event=>{
      if(gesture){event.preventDefault();return;}
      if(previewMode)setPreview(false);
      paletteDrag=button.dataset.add;event.dataTransfer.effectAllowed="copy";
      event.dataTransfer.setData("application/x-layout-component",paletteDrag);clearGuides();
    });
    button.addEventListener("dragend",()=>{paletteDrag=null;clearDropPreview();});
  });
  $("inspector").addEventListener("change",event=>{if(event.target.dataset.field)applyField(event.target);});
  $("inspector").addEventListener("input",event=>{if(event.target.dataset.field&&!event.isComposing&&event.target.tagName!=="SELECT")applyField(event.target);});
  $("inspector").addEventListener("click",event=>{
    const action=event.target.closest("[data-action]")?.dataset.action;
    if(action==="clone")duplicate();if(action==="remove")remove();if(action==="up")reorder(-1);if(action==="down")reorder(1);
    if(action==="apply-fields")applyVisibleFields();
    if(action==="upload-media"){
      if(uploading)return;uploadTarget=selected;const input=$("media-file");
      input.accept=current().attrs?.["data-component"]==="carousel"?mediaAccept.split(",").filter(x=>x.startsWith("image/")).join(","):mediaAccept;
      input.multiple=current().attrs?.["data-component"]==="carousel";input.click();
    }
    if(action==="css"){const raw=$("css-json").value;mutate(()=>{const style=JSON.parse(raw);if(!style||Array.isArray(style)||typeof style!=="object")throw Error("请输入 CSS 对象");current().style=style;});}
  });
  $("undo").onclick=undo;$("redo").onclick=redo;$("save").onclick=save;$("export").onclick=exportJSON;
  $("preview-mode").onclick=()=>setPreview(!previewMode);
  $("toggle-left").onclick=()=>togglePanel("left");$("toggle-right").onclick=()=>togglePanel("right");
  $("media-file").onchange=event=>{const files=[...event.target.files];event.target.value="";uploadMedia(files,uploadTarget);};
  $("theme-mode").onchange=event=>prefs.setTheme(event.target.value);
  $("language-mode").onchange=event=>prefs.setLanguage(event.target.value);
  $("guides").onchange=clearGuides;
  window.addEventListener("layout-preferences-change",()=>{
    prefs.translateDocument();if(nodes.size){renderInspector();renderLayers();mark();}
    updatePreviewButton();updatePanels();
  });
  $("fit").onclick=fit;$("zoom").onchange=event=>setZoom(Number(event.target.value));
  ["w","h"].forEach((axis,i)=>$("canvas-"+axis).onchange=event=>mutate(()=>model.canvas[i?"height":"width"]=Number(event.target.value)));
  $("canvas-bg").onchange=event=>mutate(()=>model.canvas.background=event.target.value);
  $("session-title").onchange=event=>mutate(()=>model.title=event.target.value);
  $("reference-opacity").oninput=event=>$("reference").style.opacity=Number(event.target.value)/100;
  $("import").onclick=()=>$("import-file").click();
  $("import-file").onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try {if(file.size>15000000)throw Error("文件过大");const candidate=JSON.parse(await file.text());validate(candidate);mutate(()=>model=candidate);toast("布局已导入，请保存");}
    catch(error){toast(error.message,true);}event.target.value="";
  };
  $("recover").onclick=()=>{
    try {validate(recoveredDraft.model);mutate(()=>model=clone(recoveredDraft.model));toast("已恢复草稿，请检查后保存");}
    catch(error){toast(error.message,true);}$("recovery").style.display="none";
  };
  $("discard-draft").onclick=()=>{localStorage.removeItem(localKey());$("recovery").style.display="none";};
  function keydown(event) {
    const input=event.composedPath().some(el=>el?.matches?.("input,textarea,select")||el?.isContentEditable);
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();save();return;}
    if(previewMode)return;
    if(input)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redo():undo();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="d"){event.preventDefault();duplicate();return;}
    if(event.key==="Delete"||event.key==="Backspace"){event.preventDefault();remove();return;}
    if(event.key==="Escape"){select(null);return;}
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)&&current()){
      event.preventDefault();mutate(()=>{const n=current(),step=event.shiftKey?10:1;n.offset??={x:0,y:0};n.offset.x+=(event.key==="ArrowRight"?step:event.key==="ArrowLeft"?-step:0);n.offset.y+=(event.key==="ArrowDown"?step:event.key==="ArrowUp"?-step:0);});
    }
  }
  window.addEventListener("keydown",keydown);
  window.addEventListener("beforeunload",event=>{if(dirty()){event.preventDefault();event.returnValue="";}});
  async function start() {
    prefs.translateDocument();updatePanels();
    if(location.protocol!=="file:"){
      try {
        const res=await fetch("/api/state");if(!res.ok)throw Error("本地会话读取失败");
        const data=await res.json();model=data.model;baseline=data.baseline;revision=data.revision;token=data.token;saved=JSON.stringify(model);
      }catch(error){toast(prefs.translateMessage(error.message)+t("；当前可离线导出"),true);}
    }
    validate(model);index();
    const frame=$("child-frame");
    await new Promise((resolve,reject)=>{
      frame.onload=()=>{
        try {
          childDoc=frame.contentDocument;
          if(!childDoc?.body)throw Error("无法读取子页面");
          childDoc.addEventListener("pointerdown",event=>pointerStart(event,null,true));
          childDoc.addEventListener("pointermove",move);childDoc.addEventListener("pointerup",pointerEnd);
          childDoc.addEventListener("pointercancel",()=>{if(gesture){const g=gesture;gesture=null;clearGuides();model=JSON.parse(g.before);index();render();}});
          childDoc.addEventListener("click",previewClick);
          childDoc.addEventListener("dblclick",event=>{if(!previewMode){event.preventDefault();$("inspector").querySelector('[data-field="text"]')?.focus();}});
          childDoc.addEventListener("keydown",keydown);childDoc.addEventListener("load",outline,true);
          childDoc.addEventListener("wheel",event=>wheelZoom(event,true),{passive:false,capture:true});
          childDoc.addEventListener("dragover",event=>paletteDragOver(event,true));
          childDoc.addEventListener("drop",event=>paletteDrop(event,true));
          childDoc.addEventListener("dragleave",event=>{if(event.target===childDoc.documentElement)clearDropPreview();});
          resolve();
        }catch(error){reject(error);}
      };
      // srcdoc keeps offline file mode same-origin. child.html is the standalone deliverable.
      frame.srcdoc=boot.childHtml;
    });
    render();requestAnimationFrame(fit);
    try {
      const raw=localStorage.getItem(localKey());if(raw){
        const draftData=JSON.parse(raw);
        if(JSON.stringify(draftData.model)!==saved){
          recoveredDraft=draftData;
          if(draftData.revision!==revision)$("recovery-message").dataset.i18n="发现旧版本草稿；恢复后请检查与当前保存版本的差异。";
          prefs.translateDocument($("recovery"));
          $("recovery").style.display="block";
        }
      }
    }catch(_){}
  }
  start().catch(error=>toast(error.message,true));
})();
