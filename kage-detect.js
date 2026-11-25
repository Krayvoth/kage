function repairSeams(ctx,W,H){
  const id=ctx.getImageData(0,0,W,H),d=id.data,band=new Uint8Array(H);
  for(let y=0;y<H;y++){
    const b=y*W*4;let n=0,dk=0,sr=0,sg=0,sb=0;
    for(let x=0;x<W;x+=2){const p=b+x*4;if((d[p]*299+d[p+1]*587+d[p+2]*114)/1000<90)dk++;sr+=d[p];sg+=d[p+1];sb+=d[p+2];n++;}
    if(dk/n<0.97) continue;
    const mr=sr/n,mg=sg/n,mb=sb/n;let same=0;
    for(let x=0;x<W;x+=2){const p=b+x*4;if(Math.abs(d[p]-mr)+Math.abs(d[p+1]-mg)+Math.abs(d[p+2]-mb)<60)same++;}
    if(same/n>=0.96) band[y]=1;
  }
  const lightShare=y=>{const b=y*W*4;let n=0,lt=0;for(let x=0;x<W;x+=2){const p=b+x*4;if((d[p]*299+d[p+1]*587+d[p+2]*114)/1000>110)lt++;n++;}return lt/n;};
  let fixed=0;
  for(let y=0;y<H;){
    if(!band[y]){y++;continue;}
    let y1=y;while(y1+1<H&&band[y1+1])y1++;
    const t=y1-y+1,a=y-1,z=y1+1,top=a-1,bot=z+1;
    if(t>=2&&t<=14&&top>=0&&bot<H&&lightShare(top)>=0.15&&lightShare(bot)>=0.15){
      const mid=(a+z)/2;
      for(let r=a;r<=z;r++){const s=(r<=mid?top:bot)*W*4;d.set(d.subarray(s,s+W*4),r*W*4);}
      fixed++;
    }
    y=y1+1;
  }
  if(fixed) ctx.putImageData(id,0,0);
  return fixed;
}

function cleanOcr(t){
  const k=t.split(' ').filter(Boolean);
  const bad=(w,lead)=>{const l=w.replace(/[^\p{L}]/gu,'');
    if(l.length===0) return true;
    return l.length===1&&w.length<=2&&!/^[AaIi]$/.test(l)&&(lead||l===l.toLowerCase());};
  while(k.length>1&&bad(k[0],true)) k.shift();
  while(k.length>1&&bad(k[k.length-1],false)) k.pop();
  return k.join(' ');
}

// ---------- 1) Matnni topish: harflar -> qatorlar -> bloklar ----------
function findTextBlocks(ctx,W,H){
  const sD=Math.min(1,1400/W),Wd=Math.max(1,Math.round(W*sD)),Hd=Math.max(1,Math.round(H*sD)),N=Wd*Hd;
  const c=document.createElement('canvas');c.width=Wd;c.height=Hd;
  const cx=c.getContext('2d',{willReadFrequently:true});cx.imageSmoothingQuality='high';
  cx.drawImage(ctx.canvas,0,0,Wd,Hd);
  const d=cx.getImageData(0,0,Wd,Hd).data,g=new Uint8Array(N);
  for(let i=0,p=0;i<N;i++,p+=4) g[i]=(d[p]*299+d[p+1]*587+d[p+2]*114)/1000;
  const INK=115,lab=new Int32Array(N),stack=new Int32Array(N),isLetter=new Uint8Array((N>>1)+4),letters=[];
  const maxH=Math.max(24,Math.min(110,Math.round(Wd*0.07)));
  let id=0;
  for(let s=0;s<N;s++){
    if(lab[s]||g[s]>=INK) continue;
    id++;
    let sp=0;stack[sp++]=s;lab[s]=id;
    let x0=Wd,y0=Hd,x1=0,y1=0,area=0;
    while(sp){
      const i=stack[--sp],x=i%Wd,y=(i-x)/Wd;area++;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=Hd)continue;
        for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=Wd)continue;
          const j=yy*Wd+xx;if(!lab[j]&&g[j]<INK){lab[j]=id;stack[sp++]=j;}}}
    }
    const w=x1-x0+1,h=y1-y0+1,fr=area/(w*h);
    const sizeOk=h<=maxH&&w<=Math.min(10*h+10,320);
    let ok=area>=8&&h>=5&&sizeOk&&fr>=0.1&&(fr<=0.92||w<=0.4*h)&&h/w<=14;
    if(ok){ // atrofi yorug' bo'lishi kerak (pufakcha, izoh qutisi)
      const smp=[],rx0=Math.max(0,x0-3),ry0=Math.max(0,y0-3),rx1=Math.min(Wd-1,x1+3),ry1=Math.min(Hd-1,y1+3);
      const sx=Math.max(1,Math.floor((rx1-rx0)/6)),sy=Math.max(1,Math.floor((ry1-ry0)/6));
      for(let x=rx0;x<=rx1;x+=sx){smp.push(g[ry0*Wd+x],g[ry1*Wd+x]);}
      for(let y=ry0;y<=ry1;y+=sy){smp.push(g[y*Wd+rx0],g[y*Wd+rx1]);}
      smp.sort((a,b)=>a-b);ok=smp[smp.length>>1]>=150;
    }
    isLetter[id]=ok?1:(sizeOk?2:0); // 1 harf, 2 kichik belgi (o'chiriladi), 0 katta chiziq (himoyalanadi)
    if(ok) letters.push({x0,y0,x1,y1,h});
    else if(sizeOk&&area>=2&&h<=0.8*maxH) letters.push({x0,y0,x1,y1,h,small:true}); // nuqta, vergul: qator uzunligiga qo'shiladi
  }
  const med=a=>{const t=[...a].sort((u,v)=>u-v);return t[t.length>>1];};
  letters.sort((a,b)=>a.x0-b.x0);
  const lines=[];
  for(const c of letters){
    let best=null;
    for(const ln of lines){
      const gap=c.x0-ln.x1,gm=Math.max(1.5*ln.h,0.9*(ln.y1-ln.y0));
      if(c.small){
        if(gap>0.9*ln.h||gap<-0.35*ln.h||c.h>0.7*ln.h||c.y1<ln.y0-0.3*ln.h||c.y0>ln.y1+0.3*ln.h) continue;
        best=ln;break;
      }
      if(gap>gm||gap<-0.35*ln.h) continue;
      if(Math.min(ln.y1,c.y1)-Math.max(ln.y0,c.y0)<0.5*Math.min(ln.h,c.h)) continue;
      if(c.h<0.55*ln.h||c.h>1.8*ln.h) continue;
      best=ln;break;
    }
    if(c.small){ if(best){best.x1=Math.max(best.x1,c.x1);best.x0=Math.min(best.x0,c.x0);} }
    else if(best){best.hs.push(c.h);best.n++;best.x1=Math.max(best.x1,c.x1);best.y0=Math.min(best.y0,c.y0);best.y1=Math.max(best.y1,c.y1);best.h=med(best.hs);}
    else lines.push({hs:[c.h],n:1,x0:c.x0,x1:c.x1,y0:c.y0,y1:c.y1,h:c.h});
  }
  const ls=lines.filter(l=>l.n>=2&&l.x1-l.x0>=1.2*l.h&&l.n/((l.x1-l.x0+1)/l.h)>=0.6).sort((a,b)=>a.y0-b.y0||a.x0-b.x0);
  const blocks=[];
  for(const ln of ls){
    let bk=null;
    for(const b of blocks){
      const last=b.lines[b.lines.length-1],gap=ln.y0-last.y1;
      const ox=Math.min(b.x1,ln.x1)-Math.max(b.x0,ln.x0),mw=Math.min(b.x1-b.x0,ln.x1-ln.x0);
      if(gap>1.0*b.h||gap<-0.4*b.h||ox<0.25*mw) continue;
      const tight=gap<=0.7*b.h&&ox>=0.5*mw; // qatorlar zich va ustma-ust: o'lcham farqiga yumshoq
      const r=ln.h/b.h;
      if(tight?(r<0.5||r>2):(r<0.7||r>1.4)) continue;
      bk=b;break;
    }
    if(bk){bk.lines.push(ln);bk.x0=Math.min(bk.x0,ln.x0);bk.x1=Math.max(bk.x1,ln.x1);bk.y1=Math.max(bk.y1,ln.y1);bk.h=med(bk.lines.map(l=>l.h));bk.n+=ln.n;}
    else blocks.push({lines:[ln],x0:ln.x0,x1:ln.x1,y0:ln.y0,y1:ln.y1,h:ln.h,n:ln.n});
  }
  const out=blocks.filter(b=>b.n>=3&&b.x1-b.x0>=2.5*b.h).sort((a,b)=>a.y0-b.y0||a.x0-b.x0).slice(0,90);
  for(const b of out){ // qator oralig'i va tekislash
    const cy=b.lines.map(l=>(l.y0+l.y1)/2),pitches=[];
    for(let i=1;i<cy.length;i++) pitches.push((cy[i]-cy[i-1])/b.h);
    b.pitchR=Math.min(2.4,Math.max(1.35,pitches.length?med(pitches):1.7));
    const sd=a=>{const m=a.reduce((p,q)=>p+q,0)/a.length;return Math.sqrt(a.reduce((p,q)=>p+(q-m)*(q-m),0)/a.length);};
    b.align=(b.lines.length>1&&sd(b.lines.map(l=>l.x0))<0.6*sd(b.lines.map(l=>(l.x0+l.x1)/2)))?'left':'center';
  }
  return {blocks:out,sD,Wd,Hd,lab,isLetter};
}

// Blok atrofini tayyorlash: fon, matn rangi, himoyalangan piksellar (chiziq, rasm)
function prepBlock(ctx,det,b){
  const {sD,Wd,lab,isLetter}=det,cap=b.h/sD,padX=Math.round(1.8*cap)+2,padY=Math.round(0.45*cap)+2;
  const tx0=Math.floor(b.x0/sD),ty0=Math.floor(b.y0/sD),tx1=Math.ceil((b.x1+1)/sD),ty1=Math.ceil((b.y1+1)/sD);
  const X0=Math.max(0,tx0-padX),Y0=Math.max(0,ty0-padY),X1=Math.min(ctx.canvas.width,tx1+padX),Y1=Math.min(ctx.canvas.height,ty1+padY);
  const w=X1-X0,h=Y1-Y0,N=w*h,px=ctx.getImageData(X0,Y0,w,h).data;
  const ls=[];for(let i=0;i<N;i+=7) ls.push(lumOf(px,i*4));ls.sort((u,v)=>u-v);
  const bgL=ls[Math.floor(ls.length*0.7)];
  const prot=new Uint8Array(N),small=new Uint8Array(N);
  for(let y=0;y<h;y++){const dy=Math.min(det.Hd-1,Math.floor((Y0+y)*sD));
    for(let x=0;x<w;x++){const l=lab[dy*Wd+Math.min(Wd-1,Math.floor((X0+x)*sD))];if(l>0){if(isLetter[l]===0)prot[y*w+x]=1;else if(isLetter[l]===2)small[y*w+x]=1;}}}
  const R=[],G=[],B=[],ink=[];
  for(let i=0;i<N;i++){ if(prot[i]) continue; const p=i*4,l=lumOf(px,p);
    if(l>=bgL*0.85){ if(i%3===0){R.push(px[p]);G.push(px[p+1]);B.push(px[p+2]);} }
    else if(l<bgL*0.5) ink.push([l,p]); }
  const md=a=>a.length?a.sort((u,v)=>u-v)[a.length>>1]:255;
  const fill=[md(R),md(G),md(B)];
  let color='#000';
  if(ink.length>=15){ink.sort((u,v)=>u[0]-v[0]);const k=Math.max(15,Math.floor(ink.length*0.4));let r=0,g=0,bl=0;
    for(let j=0;j<k;j++){const p=ink[j][1];r+=px[p];g+=px[p+1];bl+=px[p+2];}
    color=`rgb(${Math.round(r/k)},${Math.round(g/k)},${Math.round(bl/k)})`;}
  const ep=Math.round(0.22*cap)+1;
  return {X0,Y0,w,h,bgL,prot,small,fill,color,cap,tx0,ty0,tx1,ty1,
    rects:b.lines.map(l=>{const lx0=Math.floor(l.x0/sD)-X0,lx1=Math.ceil((l.x1+1)/sD)-X0,ly0=Math.floor(l.y0/sD)-Y0,ly1=Math.ceil((l.y1+1)/sD)-Y0,exx=Math.round(1.5*cap);
      return {x0:Math.max(0,lx0-ep),y0:Math.max(0,ly0-ep),x1:Math.min(w,lx1+ep),y1:Math.min(h,ly1+ep),ex0:Math.max(0,lx0-exx),ex1:Math.min(w,lx1+exx)};}),
    nLines:b.lines.length,pitchR:b.pitchR,align:b.align,px,
    prof:b.lines.map(l=>({x0:l.x0/sD,x1:(l.x1+1)/sD,y0:l.y0/sD,y1:(l.y1+1)/sD}))};
}
