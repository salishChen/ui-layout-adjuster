/* Geometry helper for parent-side dashed guides. Coordinates are child CSS pixels. */
(() => {
  "use strict";
  const anchors=(rect,axis)=>axis==="x"?[rect.left,(rect.left+rect.right)/2,rect.right]:[rect.top,(rect.top+rect.bottom)/2,rect.bottom];
  function matchAxis(rect,targets,axis,threshold,indices=[0,1,2]) {
    let best=null;
    const points=anchors(rect,axis);
    for(const target of targets) {
      const values=anchors(target,axis);
      for(const index of indices)for(let j=0;j<3;j++) {
        const delta=values[j]-points[index],distance=Math.abs(delta);
        const priority=target.priority??0,previousPriority=best?.target.priority??0;
        if(distance<=threshold&&(!best||priority<previousPriority||(priority===previousPriority&&(distance<best.distance-.001||(Math.abs(distance-best.distance)<.001&&index===j&&best.index!==best.targetIndex)))))
          best={axis,position:values[j],delta,distance,index,targetIndex:j,target};
      }
    }
    return best;
  }
  globalThis.LayoutAlignment={matchAxis};
})();
