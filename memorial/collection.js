(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const sources = {reverie:'虚实之间',afterlight:'余温',until:'直到下次再见'};
  const groups = {artworks:'插画',videos:'视频',tracks:'音乐',voices:'角色语音',extras:'扩展作品',models:'模型资料',wallpapers:'壁纸',community:'同人作品',publicEvents:'公开记录',storyEvents:'剧情记录',storyNodes:'剧情片段',memories:'记忆',journal:'剧情相册',forms:'形态资料',sections:'章节索引',works:'作品',assets:'视觉素材',connections:'相关角色',relations:'关系',questions:'留存的问题',ability:'能力',flavors:'寄语'};
  let unlocked = false, data = null, loading = null, page = 1;
  const el = (tag,text) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; return n; };
  function isUnlocked() { try {return sessionStorage.getItem('denia.memorial.spoilers.session')==='yes';} catch (_) {return unlocked;} }
  function load() {
    if(data)return Promise.resolve(data);
    if(loading)return loading;
    loading=new Promise((resolve,reject)=>{const s=el('script');s.src='./memorial/collection-data.js';s.onload=()=>{data=window.DENIA_COLLECTION;resolve(data);};s.onerror=()=>{loading=null;s.remove();reject(Error('旧站收藏暂未载入，请刷新后重试。'));};document.head.append(s);});
    return loading;
  }
  function card(record) {
    const card=el('article');card.className='collection-card';
    card.append(el('p',sources[record.sourceVersion]+' · '+(groups[record.group]||record.group)),el('h2',record.title),el('p',record.author||'原作者待补录'));
    if(record.localMedia){
      const path='./'+record.localMedia.suggestedTargetPath;
      if(/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(path)){const img=el('img');img.src=path;img.alt=record.title;img.loading='lazy';card.append(img);}
      if(/\.(mp3|ogg|wav)$/i.test(path)){const audio=el('audio');audio.controls=true;audio.preload='none';audio.src=path;audio.setAttribute('aria-label',record.title);audio.addEventListener('play',()=>document.querySelectorAll('#collection-grid audio').forEach(other=>{if(other!==audio)other.pause();}));card.append(audio);}
      const download=el('a','打开保留的原文件 ↗');download.href=path;download.target='_blank';download.rel='noopener';const downloadLine=el('p');downloadLine.append(download);card.append(downloadLine);
    }
    const description=record.raw.description||record.raw.summary||record.raw.text||record.raw.note||record.raw.official_intro_text;
    if(typeof description==='string')card.append(el('p',description));
    record.sourceUrls.filter(url=>/^https?:\/\//i.test(url)).forEach((url,index)=>{const a=el('a','原记录出处 '+(index+1)+' ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';const line=el('p');line.append(a);card.append(line);});
    card.append(el('p','历史来源记录 · 本轮已核对迁移，原帖与内容审核状态见下方记录。'));
    const details=el('details');details.append(el('summary','查看原记录与来源'));const raw=el('pre',JSON.stringify({id:record.id,sourceVersion:sources[record.sourceVersion],sourceCommit:record.sourceCommit,sourceFile:record.sourceFile,verificationStatus:record.verificationStatus,sourceReliability:record.sourceReliability,raw:record.raw},null,2));details.append(raw);card.append(details);return card;
  }
  function render() {
    if(!unlocked||!data)return;
    const q=$('collection-search').value.trim().toLocaleLowerCase();
    const source=$('collection-source').value,group=$('collection-group').value;
    const records=data.records.filter(r=>(!source||r.sourceVersion===source)&&(!group||r.group===group)&&(!q||JSON.stringify([r.title,r.author,r.raw]).toLocaleLowerCase().includes(q)));
    const pages=Math.max(1,Math.ceil(records.length/12));page=Math.min(page,pages);
    $('collection-grid').replaceChildren(...records.slice((page-1)*12,page*12).map(card));
    $('collection-count').textContent=records.length+' 条原记录 · 第 '+page+' / '+pages+' 页';
    $('collection-prev').disabled=page===1;$('collection-next').disabled=page===pages;
  }
  async function sync() {
    unlocked=isUnlocked();$('collection-gate').hidden=unlocked;$('collection-body').hidden=!unlocked;
    if(!unlocked){document.querySelectorAll('#collection-grid audio').forEach(a=>a.pause());$('collection-grid').replaceChildren();return;}
    try {await load();if(!isUnlocked())return;
      if($('collection-group').options.length===1){[...new Set(data.records.map(r=>r.group))].sort().forEach(g=>{const o=el('option',groups[g]||g);o.value=g;$('collection-group').append(o);});}render();
    }catch(error){$('collection-count').textContent=error.message;}
  }
  ['collection-source','collection-group'].forEach(id=>$(id).onchange=()=>{page=1;render();});
  $('collection-search').oninput=()=>{page=1;render();};
  $('collection-prev').onclick=()=>{page--;render();};$('collection-next').onclick=()=>{page++;render();};
  document.addEventListener('denia:spoilerchange',event=>{unlocked=event.detail.unlocked;sync();});
  window.addEventListener('pageshow',sync);sync();
})();
