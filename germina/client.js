/**
 * [INPUT]: 依赖浏览器模块表提供的 React（无 JSX、无外部 import）；
 *          ctx.slots / ctx.locale / ctx.uiWorkspace（目录选择）/ ctx.sessions（目录会话）服务；
 *          同源 client-workspace.js 与 vendor/client-ui.js|css 提供目录 UI 与 coss 组件（内置官方 JSX runtime）；
 *          vendor/marked.min.js 以源码内联（UMD，惰性求值）
 * [OUTPUT]: 注册 sidebar.panellist 图标与 main 面板（key: germina）：
 *           文件选择 + 编辑/预览 + 原生 AI 聊天三栏工作区；文档/选区可引用至聊天草稿，
 *           JSON 格式化与可折叠树视图，HTML 源码+沙箱预览；「打开文件夹」切换根目录；
 *           文件/标签删除；脏标签保护（驱逐只选干净标签、关闭/切根先确认）；
 *           marked 渲染器覆写：原始 HTML 全转义 + link/image 协议白名单（防同源 XSS）
 * [POS]: germina 的浏览器半边；Host 半边是 index.js（同源 fetch API）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
window.__ModuleLoader__.load({
  id: 'germina',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useMemo, useRef } = React

    const NS = 'germina'
    const API_ROUTE = '/plugins/germina/api'

    /* ---------- marked（vendored UMD，惰性求值一次） ---------- */
    let markedFn = null
    function getMarked() {
      if (markedFn) return markedFn
      try {
        const module_ = { exports: {} }
        /* eslint-disable no-new-func */
        const load = new Function('module', 'exports', "/**\n * marked v12.0.2 - a markdown parser\n * Copyright (c) 2011-2024, Christopher Jeffrey. (MIT Licensed)\n * https://github.com/markedjs/marked\n */\n!function(e,t){\"object\"==typeof exports&&\"undefined\"!=typeof module?t(exports):\"function\"==typeof define&&define.amd?define([\"exports\"],t):t((e=\"undefined\"!=typeof globalThis?globalThis:e||self).marked={})}(this,(function(e){\"use strict\";function t(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}function n(t){e.defaults=t}e.defaults={async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null};const s=/[&<>\"']/,r=new RegExp(s.source,\"g\"),i=/[<>\"']|&(?!(#\\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\\w+);)/,l=new RegExp(i.source,\"g\"),o={\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\",\"'\":\"&#39;\"},a=e=>o[e];function c(e,t){if(t){if(s.test(e))return e.replace(r,a)}else if(i.test(e))return e.replace(l,a);return e}const h=/&(#(?:\\d+)|(?:#x[0-9A-Fa-f]+)|(?:\\w+));?/gi;function p(e){return e.replace(h,((e,t)=>\"colon\"===(t=t.toLowerCase())?\":\":\"#\"===t.charAt(0)?\"x\"===t.charAt(1)?String.fromCharCode(parseInt(t.substring(2),16)):String.fromCharCode(+t.substring(1)):\"\"))}const u=/(^|[^\\[])\\^/g;function k(e,t){let n=\"string\"==typeof e?e:e.source;t=t||\"\";const s={replace:(e,t)=>{let r=\"string\"==typeof t?t:t.source;return r=r.replace(u,\"$1\"),n=n.replace(e,r),s},getRegex:()=>new RegExp(n,t)};return s}function g(e){try{e=encodeURI(e).replace(/%25/g,\"%\")}catch(e){return null}return e}const f={exec:()=>null};function d(e,t){const n=e.replace(/\\|/g,((e,t,n)=>{let s=!1,r=t;for(;--r>=0&&\"\\\\\"===n[r];)s=!s;return s?\"|\":\" |\"})).split(/ \\|/);let s=0;if(n[0].trim()||n.shift(),n.length>0&&!n[n.length-1].trim()&&n.pop(),t)if(n.length>t)n.splice(t);else for(;n.length<t;)n.push(\"\");for(;s<n.length;s++)n[s]=n[s].trim().replace(/\\\\\\|/g,\"|\");return n}function x(e,t,n){const s=e.length;if(0===s)return\"\";let r=0;for(;r<s;){const i=e.charAt(s-r-1);if(i!==t||n){if(i===t||!n)break;r++}else r++}return e.slice(0,s-r)}function b(e,t,n,s){const r=t.href,i=t.title?c(t.title):null,l=e[1].replace(/\\\\([\\[\\]])/g,\"$1\");if(\"!\"!==e[0].charAt(0)){s.state.inLink=!0;const e={type:\"link\",raw:n,href:r,title:i,text:l,tokens:s.inlineTokens(l)};return s.state.inLink=!1,e}return{type:\"image\",raw:n,href:r,title:i,text:c(l)}}class w{options;rules;lexer;constructor(t){this.options=t||e.defaults}space(e){const t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:\"space\",raw:t[0]}}code(e){const t=this.rules.block.code.exec(e);if(t){const e=t[0].replace(/^ {1,4}/gm,\"\");return{type:\"code\",raw:t[0],codeBlockStyle:\"indented\",text:this.options.pedantic?e:x(e,\"\\n\")}}}fences(e){const t=this.rules.block.fences.exec(e);if(t){const e=t[0],n=function(e,t){const n=e.match(/^(\\s+)(?:```)/);if(null===n)return t;const s=n[1];return t.split(\"\\n\").map((e=>{const t=e.match(/^\\s+/);if(null===t)return e;const[n]=t;return n.length>=s.length?e.slice(s.length):e})).join(\"\\n\")}(e,t[3]||\"\");return{type:\"code\",raw:e,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,\"$1\"):t[2],text:n}}}heading(e){const t=this.rules.block.heading.exec(e);if(t){let e=t[2].trim();if(/#$/.test(e)){const t=x(e,\"#\");this.options.pedantic?e=t.trim():t&&!/ $/.test(t)||(e=t.trim())}return{type:\"heading\",raw:t[0],depth:t[1].length,text:e,tokens:this.lexer.inline(e)}}}hr(e){const t=this.rules.block.hr.exec(e);if(t)return{type:\"hr\",raw:t[0]}}blockquote(e){const t=this.rules.block.blockquote.exec(e);if(t){let e=t[0].replace(/\\n {0,3}((?:=+|-+) *)(?=\\n|$)/g,\"\\n    $1\");e=x(e.replace(/^ *>[ \\t]?/gm,\"\"),\"\\n\");const n=this.lexer.state.top;this.lexer.state.top=!0;const s=this.lexer.blockTokens(e);return this.lexer.state.top=n,{type:\"blockquote\",raw:t[0],tokens:s,text:e}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim();const s=n.length>1,r={type:\"list\",raw:\"\",ordered:s,start:s?+n.slice(0,-1):\"\",loose:!1,items:[]};n=s?`\\\\d{1,9}\\\\${n.slice(-1)}`:`\\\\${n}`,this.options.pedantic&&(n=s?n:\"[*+-]\");const i=new RegExp(`^( {0,3}${n})((?:[\\t ][^\\\\n]*)?(?:\\\\n|$))`);let l=\"\",o=\"\",a=!1;for(;e;){let n=!1;if(!(t=i.exec(e)))break;if(this.rules.block.hr.test(e))break;l=t[0],e=e.substring(l.length);let s=t[2].split(\"\\n\",1)[0].replace(/^\\t+/,(e=>\" \".repeat(3*e.length))),c=e.split(\"\\n\",1)[0],h=0;this.options.pedantic?(h=2,o=s.trimStart()):(h=t[2].search(/[^ ]/),h=h>4?1:h,o=s.slice(h),h+=t[1].length);let p=!1;if(!s&&/^ *$/.test(c)&&(l+=c+\"\\n\",e=e.substring(c.length+1),n=!0),!n){const t=new RegExp(`^ {0,${Math.min(3,h-1)}}(?:[*+-]|\\\\d{1,9}[.)])((?:[ \\t][^\\\\n]*)?(?:\\\\n|$))`),n=new RegExp(`^ {0,${Math.min(3,h-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\\\* *){3,})(?:\\\\n+|$)`),r=new RegExp(`^ {0,${Math.min(3,h-1)}}(?:\\`\\`\\`|~~~)`),i=new RegExp(`^ {0,${Math.min(3,h-1)}}#`);for(;e;){const a=e.split(\"\\n\",1)[0];if(c=a,this.options.pedantic&&(c=c.replace(/^ {1,4}(?=( {4})*[^ ])/g,\"  \")),r.test(c))break;if(i.test(c))break;if(t.test(c))break;if(n.test(e))break;if(c.search(/[^ ]/)>=h||!c.trim())o+=\"\\n\"+c.slice(h);else{if(p)break;if(s.search(/[^ ]/)>=4)break;if(r.test(s))break;if(i.test(s))break;if(n.test(s))break;o+=\"\\n\"+c}p||c.trim()||(p=!0),l+=a+\"\\n\",e=e.substring(a.length+1),s=c.slice(h)}}r.loose||(a?r.loose=!0:/\\n *\\n *$/.test(l)&&(a=!0));let u,k=null;this.options.gfm&&(k=/^\\[[ xX]\\] /.exec(o),k&&(u=\"[ ] \"!==k[0],o=o.replace(/^\\[[ xX]\\] +/,\"\"))),r.items.push({type:\"list_item\",raw:l,task:!!k,checked:u,loose:!1,text:o,tokens:[]}),r.raw+=l}r.items[r.items.length-1].raw=l.trimEnd(),r.items[r.items.length-1].text=o.trimEnd(),r.raw=r.raw.trimEnd();for(let e=0;e<r.items.length;e++)if(this.lexer.state.top=!1,r.items[e].tokens=this.lexer.blockTokens(r.items[e].text,[]),!r.loose){const t=r.items[e].tokens.filter((e=>\"space\"===e.type)),n=t.length>0&&t.some((e=>/\\n.*\\n/.test(e.raw)));r.loose=n}if(r.loose)for(let e=0;e<r.items.length;e++)r.items[e].loose=!0;return r}}html(e){const t=this.rules.block.html.exec(e);if(t){return{type:\"html\",block:!0,raw:t[0],pre:\"pre\"===t[1]||\"script\"===t[1]||\"style\"===t[1],text:t[0]}}}def(e){const t=this.rules.block.def.exec(e);if(t){const e=t[1].toLowerCase().replace(/\\s+/g,\" \"),n=t[2]?t[2].replace(/^<(.*)>$/,\"$1\").replace(this.rules.inline.anyPunctuation,\"$1\"):\"\",s=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,\"$1\"):t[3];return{type:\"def\",tag:e,raw:t[0],href:n,title:s}}}table(e){const t=this.rules.block.table.exec(e);if(!t)return;if(!/[:|]/.test(t[2]))return;const n=d(t[1]),s=t[2].replace(/^\\||\\| *$/g,\"\").split(\"|\"),r=t[3]&&t[3].trim()?t[3].replace(/\\n[ \\t]*$/,\"\").split(\"\\n\"):[],i={type:\"table\",raw:t[0],header:[],align:[],rows:[]};if(n.length===s.length){for(const e of s)/^ *-+: *$/.test(e)?i.align.push(\"right\"):/^ *:-+: *$/.test(e)?i.align.push(\"center\"):/^ *:-+ *$/.test(e)?i.align.push(\"left\"):i.align.push(null);for(const e of n)i.header.push({text:e,tokens:this.lexer.inline(e)});for(const e of r)i.rows.push(d(e,i.header.length).map((e=>({text:e,tokens:this.lexer.inline(e)}))));return i}}lheading(e){const t=this.rules.block.lheading.exec(e);if(t)return{type:\"heading\",raw:t[0],depth:\"=\"===t[2].charAt(0)?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){const t=this.rules.block.paragraph.exec(e);if(t){const e=\"\\n\"===t[1].charAt(t[1].length-1)?t[1].slice(0,-1):t[1];return{type:\"paragraph\",raw:t[0],text:e,tokens:this.lexer.inline(e)}}}text(e){const t=this.rules.block.text.exec(e);if(t)return{type:\"text\",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){const t=this.rules.inline.escape.exec(e);if(t)return{type:\"escape\",raw:t[0],text:c(t[1])}}tag(e){const t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&/^<a /i.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&/^<\\/a>/i.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&/^<(pre|code|kbd|script)(\\s|>)/i.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&/^<\\/(pre|code|kbd|script)(\\s|>)/i.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:\"html\",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){const t=this.rules.inline.link.exec(e);if(t){const e=t[2].trim();if(!this.options.pedantic&&/^</.test(e)){if(!/>$/.test(e))return;const t=x(e.slice(0,-1),\"\\\\\");if((e.length-t.length)%2==0)return}else{const e=function(e,t){if(-1===e.indexOf(t[1]))return-1;let n=0;for(let s=0;s<e.length;s++)if(\"\\\\\"===e[s])s++;else if(e[s]===t[0])n++;else if(e[s]===t[1]&&(n--,n<0))return s;return-1}(t[2],\"()\");if(e>-1){const n=(0===t[0].indexOf(\"!\")?5:4)+t[1].length+e;t[2]=t[2].substring(0,e),t[0]=t[0].substring(0,n).trim(),t[3]=\"\"}}let n=t[2],s=\"\";if(this.options.pedantic){const e=/^([^'\"]*[^\\s])\\s+(['\"])(.*)\\2/.exec(n);e&&(n=e[1],s=e[3])}else s=t[3]?t[3].slice(1,-1):\"\";return n=n.trim(),/^</.test(n)&&(n=this.options.pedantic&&!/>$/.test(e)?n.slice(1):n.slice(1,-1)),b(t,{href:n?n.replace(this.rules.inline.anyPunctuation,\"$1\"):n,title:s?s.replace(this.rules.inline.anyPunctuation,\"$1\"):s},t[0],this.lexer)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){const e=t[(n[2]||n[1]).replace(/\\s+/g,\" \").toLowerCase()];if(!e){const e=n[0].charAt(0);return{type:\"text\",raw:e,text:e}}return b(n,e,n[0],this.lexer)}}emStrong(e,t,n=\"\"){let s=this.rules.inline.emStrongLDelim.exec(e);if(!s)return;if(s[3]&&n.match(/[\\p{L}\\p{N}]/u))return;if(!(s[1]||s[2]||\"\")||!n||this.rules.inline.punctuation.exec(n)){const n=[...s[0]].length-1;let r,i,l=n,o=0;const a=\"*\"===s[0][0]?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(a.lastIndex=0,t=t.slice(-1*e.length+n);null!=(s=a.exec(t));){if(r=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!r)continue;if(i=[...r].length,s[3]||s[4]){l+=i;continue}if((s[5]||s[6])&&n%3&&!((n+i)%3)){o+=i;continue}if(l-=i,l>0)continue;i=Math.min(i,i+l+o);const t=[...s[0]][0].length,a=e.slice(0,n+s.index+t+i);if(Math.min(n,i)%2){const e=a.slice(1,-1);return{type:\"em\",raw:a,text:e,tokens:this.lexer.inlineTokens(e)}}const c=a.slice(2,-2);return{type:\"strong\",raw:a,text:c,tokens:this.lexer.inlineTokens(c)}}}}codespan(e){const t=this.rules.inline.code.exec(e);if(t){let e=t[2].replace(/\\n/g,\" \");const n=/[^ ]/.test(e),s=/^ /.test(e)&&/ $/.test(e);return n&&s&&(e=e.substring(1,e.length-1)),e=c(e,!0),{type:\"codespan\",raw:t[0],text:e}}}br(e){const t=this.rules.inline.br.exec(e);if(t)return{type:\"br\",raw:t[0]}}del(e){const t=this.rules.inline.del.exec(e);if(t)return{type:\"del\",raw:t[0],text:t[2],tokens:this.lexer.inlineTokens(t[2])}}autolink(e){const t=this.rules.inline.autolink.exec(e);if(t){let e,n;return\"@\"===t[2]?(e=c(t[1]),n=\"mailto:\"+e):(e=c(t[1]),n=e),{type:\"link\",raw:t[0],text:e,href:n,tokens:[{type:\"text\",raw:e,text:e}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let e,n;if(\"@\"===t[2])e=c(t[0]),n=\"mailto:\"+e;else{let s;do{s=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??\"\"}while(s!==t[0]);e=c(t[0]),n=\"www.\"===t[1]?\"http://\"+t[0]:t[0]}return{type:\"link\",raw:t[0],text:e,href:n,tokens:[{type:\"text\",raw:e,text:e}]}}}inlineText(e){const t=this.rules.inline.text.exec(e);if(t){let e;return e=this.lexer.state.inRawBlock?t[0]:c(t[0]),{type:\"text\",raw:t[0],text:e}}}}const m=/^ {0,3}((?:-[\\t ]*){3,}|(?:_[ \\t]*){3,}|(?:\\*[ \\t]*){3,})(?:\\n+|$)/,y=/(?:[*+-]|\\d{1,9}[.)])/,$=k(/^(?!bull |blockCode|fences|blockquote|heading|html)((?:.|\\n(?!\\s*?\\n|bull |blockCode|fences|blockquote|heading|html))+?)\\n {0,3}(=+|-+) *(?:\\n+|$)/).replace(/bull/g,y).replace(/blockCode/g,/ {4}/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\\n>]+>\\n/).getRegex(),z=/^([^\\n]+(?:\\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\\n)[^\\n]+)*)/,T=/(?!\\s*\\])(?:\\\\.|[^\\[\\]\\\\])+/,R=k(/^ {0,3}\\[(label)\\]: *(?:\\n *)?([^<\\s][^\\s]*|<.*?>)(?:(?: +(?:\\n *)?| *\\n *)(title))? *(?:\\n+|$)/).replace(\"label\",T).replace(\"title\",/(?:\"(?:\\\\\"?|[^\"\\\\])*\"|'[^'\\n]*(?:\\n[^'\\n]+)*\\n?'|\\([^()]*\\))/).getRegex(),_=k(/^( {0,3}bull)([ \\t][^\\n]+?)?(?:\\n|$)/).replace(/bull/g,y).getRegex(),A=\"address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul\",S=/<!--(?:-?>|[\\s\\S]*?(?:-->|$))/,I=k(\"^ {0,3}(?:<(script|pre|style|textarea)[\\\\s>][\\\\s\\\\S]*?(?:</\\\\1>[^\\\\n]*\\\\n+|$)|comment[^\\\\n]*(\\\\n+|$)|<\\\\?[\\\\s\\\\S]*?(?:\\\\?>\\\\n*|$)|<![A-Z][\\\\s\\\\S]*?(?:>\\\\n*|$)|<!\\\\[CDATA\\\\[[\\\\s\\\\S]*?(?:\\\\]\\\\]>\\\\n*|$)|</?(tag)(?: +|\\\\n|/?>)[\\\\s\\\\S]*?(?:(?:\\\\n *)+\\\\n|$)|<(?!script|pre|style|textarea)([a-z][\\\\w-]*)(?:attribute)*? */?>(?=[ \\\\t]*(?:\\\\n|$))[\\\\s\\\\S]*?(?:(?:\\\\n *)+\\\\n|$)|</(?!script|pre|style|textarea)[a-z][\\\\w-]*\\\\s*>(?=[ \\\\t]*(?:\\\\n|$))[\\\\s\\\\S]*?(?:(?:\\\\n *)+\\\\n|$))\",\"i\").replace(\"comment\",S).replace(\"tag\",A).replace(\"attribute\",/ +[a-zA-Z:_][\\w.:-]*(?: *= *\"[^\"\\n]*\"| *= *'[^'\\n]*'| *= *[^\\s\"'=<>`]+)?/).getRegex(),E=k(z).replace(\"hr\",m).replace(\"heading\",\" {0,3}#{1,6}(?:\\\\s|$)\").replace(\"|lheading\",\"\").replace(\"|table\",\"\").replace(\"blockquote\",\" {0,3}>\").replace(\"fences\",\" {0,3}(?:`{3,}(?=[^`\\\\n]*\\\\n)|~{3,})[^\\\\n]*\\\\n\").replace(\"list\",\" {0,3}(?:[*+-]|1[.)]) \").replace(\"html\",\"</?(?:tag)(?: +|\\\\n|/?>)|<(?:script|pre|style|textarea|!--)\").replace(\"tag\",A).getRegex(),q={blockquote:k(/^( {0,3}> ?(paragraph|[^\\n]*)(?:\\n|$))+/).replace(\"paragraph\",E).getRegex(),code:/^( {4}[^\\n]+(?:\\n(?: *(?:\\n|$))*)?)+/,def:R,fences:/^ {0,3}(`{3,}(?=[^`\\n]*(?:\\n|$))|~{3,})([^\\n]*)(?:\\n|$)(?:|([\\s\\S]*?)(?:\\n|$))(?: {0,3}\\1[~`]* *(?=\\n|$)|$)/,heading:/^ {0,3}(#{1,6})(?=\\s|$)(.*)(?:\\n+|$)/,hr:m,html:I,lheading:$,list:_,newline:/^(?: *(?:\\n|$))+/,paragraph:E,table:f,text:/^[^\\n]+/},Z=k(\"^ *([^\\\\n ].*)\\\\n {0,3}((?:\\\\| *)?:?-+:? *(?:\\\\| *:?-+:? *)*(?:\\\\| *)?)(?:\\\\n((?:(?! *\\\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\\\n|$))*)\\\\n*|$)\").replace(\"hr\",m).replace(\"heading\",\" {0,3}#{1,6}(?:\\\\s|$)\").replace(\"blockquote\",\" {0,3}>\").replace(\"code\",\" {4}[^\\\\n]\").replace(\"fences\",\" {0,3}(?:`{3,}(?=[^`\\\\n]*\\\\n)|~{3,})[^\\\\n]*\\\\n\").replace(\"list\",\" {0,3}(?:[*+-]|1[.)]) \").replace(\"html\",\"</?(?:tag)(?: +|\\\\n|/?>)|<(?:script|pre|style|textarea|!--)\").replace(\"tag\",A).getRegex(),L={...q,table:Z,paragraph:k(z).replace(\"hr\",m).replace(\"heading\",\" {0,3}#{1,6}(?:\\\\s|$)\").replace(\"|lheading\",\"\").replace(\"table\",Z).replace(\"blockquote\",\" {0,3}>\").replace(\"fences\",\" {0,3}(?:`{3,}(?=[^`\\\\n]*\\\\n)|~{3,})[^\\\\n]*\\\\n\").replace(\"list\",\" {0,3}(?:[*+-]|1[.)]) \").replace(\"html\",\"</?(?:tag)(?: +|\\\\n|/?>)|<(?:script|pre|style|textarea|!--)\").replace(\"tag\",A).getRegex()},P={...q,html:k(\"^ *(?:comment *(?:\\\\n|\\\\s*$)|<(tag)[\\\\s\\\\S]+?</\\\\1> *(?:\\\\n{2,}|\\\\s*$)|<tag(?:\\\"[^\\\"]*\\\"|'[^']*'|\\\\s[^'\\\"/>\\\\s]*)*?/?> *(?:\\\\n{2,}|\\\\s*$))\").replace(\"comment\",S).replace(/tag/g,\"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\\\b)\\\\w+(?!:|[^\\\\w\\\\s@]*@)\\\\b\").getRegex(),def:/^ *\\[([^\\]]+)\\]: *<?([^\\s>]+)>?(?: +([\"(][^\\n]+[\")]))? *(?:\\n+|$)/,heading:/^(#{1,6})(.*)(?:\\n+|$)/,fences:f,lheading:/^(.+?)\\n {0,3}(=+|-+) *(?:\\n+|$)/,paragraph:k(z).replace(\"hr\",m).replace(\"heading\",\" *#{1,6} *[^\\n]\").replace(\"lheading\",$).replace(\"|table\",\"\").replace(\"blockquote\",\" {0,3}>\").replace(\"|fences\",\"\").replace(\"|list\",\"\").replace(\"|html\",\"\").replace(\"|tag\",\"\").getRegex()},Q=/^\\\\([!\"#$%&'()*+,\\-./:;<=>?@\\[\\]\\\\^_`{|}~])/,v=/^( {2,}|\\\\)\\n(?!\\s*$)/,B=\"\\\\p{P}\\\\p{S}\",C=k(/^((?![*_])[\\spunctuation])/,\"u\").replace(/punctuation/g,B).getRegex(),M=k(/^(?:\\*+(?:((?!\\*)[punct])|[^\\s*]))|^_+(?:((?!_)[punct])|([^\\s_]))/,\"u\").replace(/punct/g,B).getRegex(),O=k(\"^[^_*]*?__[^_*]*?\\\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\\\*)[punct](\\\\*+)(?=[\\\\s]|$)|[^punct\\\\s](\\\\*+)(?!\\\\*)(?=[punct\\\\s]|$)|(?!\\\\*)[punct\\\\s](\\\\*+)(?=[^punct\\\\s])|[\\\\s](\\\\*+)(?!\\\\*)(?=[punct])|(?!\\\\*)[punct](\\\\*+)(?!\\\\*)(?=[punct])|[^punct\\\\s](\\\\*+)(?=[^punct\\\\s])\",\"gu\").replace(/punct/g,B).getRegex(),D=k(\"^[^_*]*?\\\\*\\\\*[^_*]*?_[^_*]*?(?=\\\\*\\\\*)|[^_]+(?=[^_])|(?!_)[punct](_+)(?=[\\\\s]|$)|[^punct\\\\s](_+)(?!_)(?=[punct\\\\s]|$)|(?!_)[punct\\\\s](_+)(?=[^punct\\\\s])|[\\\\s](_+)(?!_)(?=[punct])|(?!_)[punct](_+)(?!_)(?=[punct])\",\"gu\").replace(/punct/g,B).getRegex(),j=k(/\\\\([punct])/,\"gu\").replace(/punct/g,B).getRegex(),H=k(/^<(scheme:[^\\s\\x00-\\x1f<>]*|email)>/).replace(\"scheme\",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace(\"email\",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),U=k(S).replace(\"(?:--\\x3e|$)\",\"--\\x3e\").getRegex(),X=k(\"^comment|^</[a-zA-Z][\\\\w:-]*\\\\s*>|^<[a-zA-Z][\\\\w-]*(?:attribute)*?\\\\s*/?>|^<\\\\?[\\\\s\\\\S]*?\\\\?>|^<![a-zA-Z]+\\\\s[\\\\s\\\\S]*?>|^<!\\\\[CDATA\\\\[[\\\\s\\\\S]*?\\\\]\\\\]>\").replace(\"comment\",U).replace(\"attribute\",/\\s+[a-zA-Z:_][\\w.:-]*(?:\\s*=\\s*\"[^\"]*\"|\\s*=\\s*'[^']*'|\\s*=\\s*[^\\s\"'=<>`]+)?/).getRegex(),F=/(?:\\[(?:\\\\.|[^\\[\\]\\\\])*\\]|\\\\.|`[^`]*`|[^\\[\\]\\\\`])*?/,N=k(/^!?\\[(label)\\]\\(\\s*(href)(?:\\s+(title))?\\s*\\)/).replace(\"label\",F).replace(\"href\",/<(?:\\\\.|[^\\n<>\\\\])+>|[^\\s\\x00-\\x1f]*/).replace(\"title\",/\"(?:\\\\\"?|[^\"\\\\])*\"|'(?:\\\\'?|[^'\\\\])*'|\\((?:\\\\\\)?|[^)\\\\])*\\)/).getRegex(),G=k(/^!?\\[(label)\\]\\[(ref)\\]/).replace(\"label\",F).replace(\"ref\",T).getRegex(),J=k(/^!?\\[(ref)\\](?:\\[\\])?/).replace(\"ref\",T).getRegex(),K={_backpedal:f,anyPunctuation:j,autolink:H,blockSkip:/\\[[^[\\]]*?\\]\\([^\\(\\)]*?\\)|`[^`]*?`|<[^<>]*?>/g,br:v,code:/^(`+)([^`]|[^`][\\s\\S]*?[^`])\\1(?!`)/,del:f,emStrongLDelim:M,emStrongRDelimAst:O,emStrongRDelimUnd:D,escape:Q,link:N,nolink:J,punctuation:C,reflink:G,reflinkSearch:k(\"reflink|nolink(?!\\\\()\",\"g\").replace(\"reflink\",G).replace(\"nolink\",J).getRegex(),tag:X,text:/^(`+|[^`])(?:(?= {2,}\\n)|[\\s\\S]*?(?:(?=[\\\\<!\\[`*_]|\\b_|$)|[^ ](?= {2,}\\n)))/,url:f},V={...K,link:k(/^!?\\[(label)\\]\\((.*?)\\)/).replace(\"label\",F).getRegex(),reflink:k(/^!?\\[(label)\\]\\s*\\[([^\\]]*)\\]/).replace(\"label\",F).getRegex()},W={...K,escape:k(Q).replace(\"])\",\"~|])\").getRegex(),url:k(/^((?:ftp|https?):\\/\\/|www\\.)(?:[a-zA-Z0-9\\-]+\\.?)+[^\\s<]*|^email/,\"i\").replace(\"email\",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'\"~()&]+|\\([^)]*\\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'\"~)]+(?!$))+/,del:/^(~~?)(?=[^\\s~])([\\s\\S]*?[^\\s~])\\1(?=[^~]|$)/,text:/^([`~]+|[^`~])(?:(?= {2,}\\n)|(?=[a-zA-Z0-9.!#$%&'*+\\/=?_`{\\|}~-]+@)|[\\s\\S]*?(?:(?=[\\\\<!\\[`*~_]|\\b_|https?:\\/\\/|ftp:\\/\\/|www\\.|$)|[^ ](?= {2,}\\n)|[^a-zA-Z0-9.!#$%&'*+\\/=?_`{\\|}~-](?=[a-zA-Z0-9.!#$%&'*+\\/=?_`{\\|}~-]+@)))/},Y={...W,br:k(v).replace(\"{2,}\",\"*\").getRegex(),text:k(W.text).replace(\"\\\\b_\",\"\\\\b_| {2,}\\\\n\").replace(/\\{2,\\}/g,\"*\").getRegex()},ee={normal:q,gfm:L,pedantic:P},te={normal:K,gfm:W,breaks:Y,pedantic:V};class ne{tokens;options;state;tokenizer;inlineQueue;constructor(t){this.tokens=[],this.tokens.links=Object.create(null),this.options=t||e.defaults,this.options.tokenizer=this.options.tokenizer||new w,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};const n={block:ee.normal,inline:te.normal};this.options.pedantic?(n.block=ee.pedantic,n.inline=te.pedantic):this.options.gfm&&(n.block=ee.gfm,this.options.breaks?n.inline=te.breaks:n.inline=te.gfm),this.tokenizer.rules=n}static get rules(){return{block:ee,inline:te}}static lex(e,t){return new ne(t).lex(e)}static lexInline(e,t){return new ne(t).inlineTokens(e)}lex(e){e=e.replace(/\\r\\n|\\r/g,\"\\n\"),this.blockTokens(e,this.tokens);for(let e=0;e<this.inlineQueue.length;e++){const t=this.inlineQueue[e];this.inlineTokens(t.src,t.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[]){let n,s,r,i;for(e=this.options.pedantic?e.replace(/\\t/g,\"    \").replace(/^ +$/gm,\"\"):e.replace(/^( *)(\\t+)/gm,((e,t,n)=>t+\"    \".repeat(n.length)));e;)if(!(this.options.extensions&&this.options.extensions.block&&this.options.extensions.block.some((s=>!!(n=s.call({lexer:this},e,t))&&(e=e.substring(n.raw.length),t.push(n),!0)))))if(n=this.tokenizer.space(e))e=e.substring(n.raw.length),1===n.raw.length&&t.length>0?t[t.length-1].raw+=\"\\n\":t.push(n);else if(n=this.tokenizer.code(e))e=e.substring(n.raw.length),s=t[t.length-1],!s||\"paragraph\"!==s.type&&\"text\"!==s.type?t.push(n):(s.raw+=\"\\n\"+n.raw,s.text+=\"\\n\"+n.text,this.inlineQueue[this.inlineQueue.length-1].src=s.text);else if(n=this.tokenizer.fences(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.heading(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.hr(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.blockquote(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.list(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.html(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.def(e))e=e.substring(n.raw.length),s=t[t.length-1],!s||\"paragraph\"!==s.type&&\"text\"!==s.type?this.tokens.links[n.tag]||(this.tokens.links[n.tag]={href:n.href,title:n.title}):(s.raw+=\"\\n\"+n.raw,s.text+=\"\\n\"+n.raw,this.inlineQueue[this.inlineQueue.length-1].src=s.text);else if(n=this.tokenizer.table(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.lheading(e))e=e.substring(n.raw.length),t.push(n);else{if(r=e,this.options.extensions&&this.options.extensions.startBlock){let t=1/0;const n=e.slice(1);let s;this.options.extensions.startBlock.forEach((e=>{s=e.call({lexer:this},n),\"number\"==typeof s&&s>=0&&(t=Math.min(t,s))})),t<1/0&&t>=0&&(r=e.substring(0,t+1))}if(this.state.top&&(n=this.tokenizer.paragraph(r)))s=t[t.length-1],i&&\"paragraph\"===s.type?(s.raw+=\"\\n\"+n.raw,s.text+=\"\\n\"+n.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=s.text):t.push(n),i=r.length!==e.length,e=e.substring(n.raw.length);else if(n=this.tokenizer.text(e))e=e.substring(n.raw.length),s=t[t.length-1],s&&\"text\"===s.type?(s.raw+=\"\\n\"+n.raw,s.text+=\"\\n\"+n.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=s.text):t.push(n);else if(e){const t=\"Infinite loop on byte: \"+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw new Error(t)}}return this.state.top=!0,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){let n,s,r,i,l,o,a=e;if(this.tokens.links){const e=Object.keys(this.tokens.links);if(e.length>0)for(;null!=(i=this.tokenizer.rules.inline.reflinkSearch.exec(a));)e.includes(i[0].slice(i[0].lastIndexOf(\"[\")+1,-1))&&(a=a.slice(0,i.index)+\"[\"+\"a\".repeat(i[0].length-2)+\"]\"+a.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;null!=(i=this.tokenizer.rules.inline.blockSkip.exec(a));)a=a.slice(0,i.index)+\"[\"+\"a\".repeat(i[0].length-2)+\"]\"+a.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);for(;null!=(i=this.tokenizer.rules.inline.anyPunctuation.exec(a));)a=a.slice(0,i.index)+\"++\"+a.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);for(;e;)if(l||(o=\"\"),l=!1,!(this.options.extensions&&this.options.extensions.inline&&this.options.extensions.inline.some((s=>!!(n=s.call({lexer:this},e,t))&&(e=e.substring(n.raw.length),t.push(n),!0)))))if(n=this.tokenizer.escape(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.tag(e))e=e.substring(n.raw.length),s=t[t.length-1],s&&\"text\"===n.type&&\"text\"===s.type?(s.raw+=n.raw,s.text+=n.text):t.push(n);else if(n=this.tokenizer.link(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.reflink(e,this.tokens.links))e=e.substring(n.raw.length),s=t[t.length-1],s&&\"text\"===n.type&&\"text\"===s.type?(s.raw+=n.raw,s.text+=n.text):t.push(n);else if(n=this.tokenizer.emStrong(e,a,o))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.codespan(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.br(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.del(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.autolink(e))e=e.substring(n.raw.length),t.push(n);else if(this.state.inLink||!(n=this.tokenizer.url(e))){if(r=e,this.options.extensions&&this.options.extensions.startInline){let t=1/0;const n=e.slice(1);let s;this.options.extensions.startInline.forEach((e=>{s=e.call({lexer:this},n),\"number\"==typeof s&&s>=0&&(t=Math.min(t,s))})),t<1/0&&t>=0&&(r=e.substring(0,t+1))}if(n=this.tokenizer.inlineText(r))e=e.substring(n.raw.length),\"_\"!==n.raw.slice(-1)&&(o=n.raw.slice(-1)),l=!0,s=t[t.length-1],s&&\"text\"===s.type?(s.raw+=n.raw,s.text+=n.text):t.push(n);else if(e){const t=\"Infinite loop on byte: \"+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw new Error(t)}}else e=e.substring(n.raw.length),t.push(n);return t}}class se{options;constructor(t){this.options=t||e.defaults}code(e,t,n){const s=(t||\"\").match(/^\\S*/)?.[0];return e=e.replace(/\\n$/,\"\")+\"\\n\",s?'<pre><code class=\"language-'+c(s)+'\">'+(n?e:c(e,!0))+\"</code></pre>\\n\":\"<pre><code>\"+(n?e:c(e,!0))+\"</code></pre>\\n\"}blockquote(e){return`<blockquote>\\n${e}</blockquote>\\n`}html(e,t){return e}heading(e,t,n){return`<h${t}>${e}</h${t}>\\n`}hr(){return\"<hr>\\n\"}list(e,t,n){const s=t?\"ol\":\"ul\";return\"<\"+s+(t&&1!==n?' start=\"'+n+'\"':\"\")+\">\\n\"+e+\"</\"+s+\">\\n\"}listitem(e,t,n){return`<li>${e}</li>\\n`}checkbox(e){return\"<input \"+(e?'checked=\"\" ':\"\")+'disabled=\"\" type=\"checkbox\">'}paragraph(e){return`<p>${e}</p>\\n`}table(e,t){return t&&(t=`<tbody>${t}</tbody>`),\"<table>\\n<thead>\\n\"+e+\"</thead>\\n\"+t+\"</table>\\n\"}tablerow(e){return`<tr>\\n${e}</tr>\\n`}tablecell(e,t){const n=t.header?\"th\":\"td\";return(t.align?`<${n} align=\"${t.align}\">`:`<${n}>`)+e+`</${n}>\\n`}strong(e){return`<strong>${e}</strong>`}em(e){return`<em>${e}</em>`}codespan(e){return`<code>${e}</code>`}br(){return\"<br>\"}del(e){return`<del>${e}</del>`}link(e,t,n){const s=g(e);if(null===s)return n;let r='<a href=\"'+(e=s)+'\"';return t&&(r+=' title=\"'+t+'\"'),r+=\">\"+n+\"</a>\",r}image(e,t,n){const s=g(e);if(null===s)return n;let r=`<img src=\"${e=s}\" alt=\"${n}\"`;return t&&(r+=` title=\"${t}\"`),r+=\">\",r}text(e){return e}}class re{strong(e){return e}em(e){return e}codespan(e){return e}del(e){return e}html(e){return e}text(e){return e}link(e,t,n){return\"\"+n}image(e,t,n){return\"\"+n}br(){return\"\"}}class ie{options;renderer;textRenderer;constructor(t){this.options=t||e.defaults,this.options.renderer=this.options.renderer||new se,this.renderer=this.options.renderer,this.renderer.options=this.options,this.textRenderer=new re}static parse(e,t){return new ie(t).parse(e)}static parseInline(e,t){return new ie(t).parseInline(e)}parse(e,t=!0){let n=\"\";for(let s=0;s<e.length;s++){const r=e[s];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[r.type]){const e=r,t=this.options.extensions.renderers[e.type].call({parser:this},e);if(!1!==t||![\"space\",\"hr\",\"heading\",\"code\",\"table\",\"blockquote\",\"list\",\"html\",\"paragraph\",\"text\"].includes(e.type)){n+=t||\"\";continue}}switch(r.type){case\"space\":continue;case\"hr\":n+=this.renderer.hr();continue;case\"heading\":{const e=r;n+=this.renderer.heading(this.parseInline(e.tokens),e.depth,p(this.parseInline(e.tokens,this.textRenderer)));continue}case\"code\":{const e=r;n+=this.renderer.code(e.text,e.lang,!!e.escaped);continue}case\"table\":{const e=r;let t=\"\",s=\"\";for(let t=0;t<e.header.length;t++)s+=this.renderer.tablecell(this.parseInline(e.header[t].tokens),{header:!0,align:e.align[t]});t+=this.renderer.tablerow(s);let i=\"\";for(let t=0;t<e.rows.length;t++){const n=e.rows[t];s=\"\";for(let t=0;t<n.length;t++)s+=this.renderer.tablecell(this.parseInline(n[t].tokens),{header:!1,align:e.align[t]});i+=this.renderer.tablerow(s)}n+=this.renderer.table(t,i);continue}case\"blockquote\":{const e=r,t=this.parse(e.tokens);n+=this.renderer.blockquote(t);continue}case\"list\":{const e=r,t=e.ordered,s=e.start,i=e.loose;let l=\"\";for(let t=0;t<e.items.length;t++){const n=e.items[t],s=n.checked,r=n.task;let o=\"\";if(n.task){const e=this.renderer.checkbox(!!s);i?n.tokens.length>0&&\"paragraph\"===n.tokens[0].type?(n.tokens[0].text=e+\" \"+n.tokens[0].text,n.tokens[0].tokens&&n.tokens[0].tokens.length>0&&\"text\"===n.tokens[0].tokens[0].type&&(n.tokens[0].tokens[0].text=e+\" \"+n.tokens[0].tokens[0].text)):n.tokens.unshift({type:\"text\",text:e+\" \"}):o+=e+\" \"}o+=this.parse(n.tokens,i),l+=this.renderer.listitem(o,r,!!s)}n+=this.renderer.list(l,t,s);continue}case\"html\":{const e=r;n+=this.renderer.html(e.text,e.block);continue}case\"paragraph\":{const e=r;n+=this.renderer.paragraph(this.parseInline(e.tokens));continue}case\"text\":{let i=r,l=i.tokens?this.parseInline(i.tokens):i.text;for(;s+1<e.length&&\"text\"===e[s+1].type;)i=e[++s],l+=\"\\n\"+(i.tokens?this.parseInline(i.tokens):i.text);n+=t?this.renderer.paragraph(l):l;continue}default:{const e='Token with \"'+r.type+'\" type was not found.';if(this.options.silent)return console.error(e),\"\";throw new Error(e)}}}return n}parseInline(e,t){t=t||this.renderer;let n=\"\";for(let s=0;s<e.length;s++){const r=e[s];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[r.type]){const e=this.options.extensions.renderers[r.type].call({parser:this},r);if(!1!==e||![\"escape\",\"html\",\"link\",\"image\",\"strong\",\"em\",\"codespan\",\"br\",\"del\",\"text\"].includes(r.type)){n+=e||\"\";continue}}switch(r.type){case\"escape\":{const e=r;n+=t.text(e.text);break}case\"html\":{const e=r;n+=t.html(e.text);break}case\"link\":{const e=r;n+=t.link(e.href,e.title,this.parseInline(e.tokens,t));break}case\"image\":{const e=r;n+=t.image(e.href,e.title,e.text);break}case\"strong\":{const e=r;n+=t.strong(this.parseInline(e.tokens,t));break}case\"em\":{const e=r;n+=t.em(this.parseInline(e.tokens,t));break}case\"codespan\":{const e=r;n+=t.codespan(e.text);break}case\"br\":n+=t.br();break;case\"del\":{const e=r;n+=t.del(this.parseInline(e.tokens,t));break}case\"text\":{const e=r;n+=t.text(e.text);break}default:{const e='Token with \"'+r.type+'\" type was not found.';if(this.options.silent)return console.error(e),\"\";throw new Error(e)}}}return n}}class le{options;constructor(t){this.options=t||e.defaults}static passThroughHooks=new Set([\"preprocess\",\"postprocess\",\"processAllTokens\"]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}}class oe{defaults={async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null};options=this.setOptions;parse=this.#e(ne.lex,ie.parse);parseInline=this.#e(ne.lexInline,ie.parseInline);Parser=ie;Renderer=se;TextRenderer=re;Lexer=ne;Tokenizer=w;Hooks=le;constructor(...e){this.use(...e)}walkTokens(e,t){let n=[];for(const s of e)switch(n=n.concat(t.call(this,s)),s.type){case\"table\":{const e=s;for(const s of e.header)n=n.concat(this.walkTokens(s.tokens,t));for(const s of e.rows)for(const e of s)n=n.concat(this.walkTokens(e.tokens,t));break}case\"list\":{const e=s;n=n.concat(this.walkTokens(e.items,t));break}default:{const e=s;this.defaults.extensions?.childTokens?.[e.type]?this.defaults.extensions.childTokens[e.type].forEach((s=>{const r=e[s].flat(1/0);n=n.concat(this.walkTokens(r,t))})):e.tokens&&(n=n.concat(this.walkTokens(e.tokens,t)))}}return n}use(...e){const t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach((e=>{const n={...e};if(n.async=this.defaults.async||n.async||!1,e.extensions&&(e.extensions.forEach((e=>{if(!e.name)throw new Error(\"extension name required\");if(\"renderer\"in e){const n=t.renderers[e.name];t.renderers[e.name]=n?function(...t){let s=e.renderer.apply(this,t);return!1===s&&(s=n.apply(this,t)),s}:e.renderer}if(\"tokenizer\"in e){if(!e.level||\"block\"!==e.level&&\"inline\"!==e.level)throw new Error(\"extension level must be 'block' or 'inline'\");const n=t[e.level];n?n.unshift(e.tokenizer):t[e.level]=[e.tokenizer],e.start&&(\"block\"===e.level?t.startBlock?t.startBlock.push(e.start):t.startBlock=[e.start]:\"inline\"===e.level&&(t.startInline?t.startInline.push(e.start):t.startInline=[e.start]))}\"childTokens\"in e&&e.childTokens&&(t.childTokens[e.name]=e.childTokens)})),n.extensions=t),e.renderer){const t=this.defaults.renderer||new se(this.defaults);for(const n in e.renderer){if(!(n in t))throw new Error(`renderer '${n}' does not exist`);if(\"options\"===n)continue;const s=n,r=e.renderer[s],i=t[s];t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n||\"\"}}n.renderer=t}if(e.tokenizer){const t=this.defaults.tokenizer||new w(this.defaults);for(const n in e.tokenizer){if(!(n in t))throw new Error(`tokenizer '${n}' does not exist`);if([\"options\",\"rules\",\"lexer\"].includes(n))continue;const s=n,r=e.tokenizer[s],i=t[s];t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n}}n.tokenizer=t}if(e.hooks){const t=this.defaults.hooks||new le;for(const n in e.hooks){if(!(n in t))throw new Error(`hook '${n}' does not exist`);if(\"options\"===n)continue;const s=n,r=e.hooks[s],i=t[s];le.passThroughHooks.has(n)?t[s]=e=>{if(this.defaults.async)return Promise.resolve(r.call(t,e)).then((e=>i.call(t,e)));const n=r.call(t,e);return i.call(t,n)}:t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n}}n.hooks=t}if(e.walkTokens){const t=this.defaults.walkTokens,s=e.walkTokens;n.walkTokens=function(e){let n=[];return n.push(s.call(this,e)),t&&(n=n.concat(t.call(this,e))),n}}this.defaults={...this.defaults,...n}})),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return ne.lex(e,t??this.defaults)}parser(e,t){return ie.parse(e,t??this.defaults)}#e(e,t){return(n,s)=>{const r={...s},i={...this.defaults,...r};!0===this.defaults.async&&!1===r.async&&(i.silent||console.warn(\"marked(): The async option was set to true by an extension. The async: false option sent to parse will be ignored.\"),i.async=!0);const l=this.#t(!!i.silent,!!i.async);if(null==n)return l(new Error(\"marked(): input parameter is undefined or null\"));if(\"string\"!=typeof n)return l(new Error(\"marked(): input parameter is of type \"+Object.prototype.toString.call(n)+\", string expected\"));if(i.hooks&&(i.hooks.options=i),i.async)return Promise.resolve(i.hooks?i.hooks.preprocess(n):n).then((t=>e(t,i))).then((e=>i.hooks?i.hooks.processAllTokens(e):e)).then((e=>i.walkTokens?Promise.all(this.walkTokens(e,i.walkTokens)).then((()=>e)):e)).then((e=>t(e,i))).then((e=>i.hooks?i.hooks.postprocess(e):e)).catch(l);try{i.hooks&&(n=i.hooks.preprocess(n));let s=e(n,i);i.hooks&&(s=i.hooks.processAllTokens(s)),i.walkTokens&&this.walkTokens(s,i.walkTokens);let r=t(s,i);return i.hooks&&(r=i.hooks.postprocess(r)),r}catch(e){return l(e)}}}#t(e,t){return n=>{if(n.message+=\"\\nPlease report this to https://github.com/markedjs/marked.\",e){const e=\"<p>An error occurred:</p><pre>\"+c(n.message+\"\",!0)+\"</pre>\";return t?Promise.resolve(e):e}if(t)return Promise.reject(n);throw n}}}const ae=new oe;function ce(e,t){return ae.parse(e,t)}ce.options=ce.setOptions=function(e){return ae.setOptions(e),ce.defaults=ae.defaults,n(ce.defaults),ce},ce.getDefaults=t,ce.defaults=e.defaults,ce.use=function(...e){return ae.use(...e),ce.defaults=ae.defaults,n(ce.defaults),ce},ce.walkTokens=function(e,t){return ae.walkTokens(e,t)},ce.parseInline=ae.parseInline,ce.Parser=ie,ce.parser=ie.parse,ce.Renderer=se,ce.TextRenderer=re,ce.Lexer=ne,ce.lexer=ne.lex,ce.Tokenizer=w,ce.Hooks=le,ce.parse=ce;const he=ce.options,pe=ce.setOptions,ue=ce.use,ke=ce.walkTokens,ge=ce.parseInline,fe=ce,de=ie.parse,xe=ne.lex;e.Hooks=le,e.Lexer=ne,e.Marked=oe,e.Parser=ie,e.Renderer=se,e.TextRenderer=re,e.Tokenizer=w,e.getDefaults=t,e.lexer=xe,e.marked=ce,e.options=he,e.parse=fe,e.parseInline=ge,e.parser=de,e.setOptions=pe,e.use=ue,e.walkTokens=ke}));\n")
        load(module_, module_.exports)
        const mod = module_.exports
        if (typeof mod.parse !== 'function' || typeof mod.Renderer !== 'function') { markedFn = null; return markedFn }
        /* 渲染器覆写：原始 HTML token 全转义（预览不可信 MD 时防同源 XSS），
           link/image 只放行白名单协议；其余走 marked 默认渲染 */
        const renderer = new mod.Renderer()
        renderer.html = (text) => esc(text)
        renderer.link = (href, title, text) => {
          const safe = safeHref(href)
          if (safe == null) return text
          return `<a href="${esc(safe)}"${title ? ` title="${esc(title)}"` : ''} target="_blank" rel="noopener noreferrer">${text}</a>`
        }
        renderer.image = (href, title, text) => {
          const safe = safeImgSrc(href)
          if (safe == null) return esc(text)
          return `<img src="${esc(safe)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ''}>`
        }
        markedFn = (src) => mod.parse(src, { gfm: true, breaks: true, renderer })
        return markedFn
      } catch (e) {
        console.error('germina: marked failed to load', e)
        markedFn = null
      }
      return markedFn
    }

    /* ---------- API ---------- */

    async function requestApi(payload) {
      try {
        const res = await fetch(API_ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        return { status: res.status, body: await res.json().catch(() => ({ ok: false, error: 'bad response' })) }
      } catch (error) {
        return { status: 0, body: { ok: false, error: error.message } }
      }
    }

    /* ---------- 工具 ---------- */

    function parentOf(path) {
      const at = path.lastIndexOf('/')
      return at === -1 ? '' : path.slice(0, at)
    }

    function extOf(name) {
      const dot = name.lastIndexOf('.')
      return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
    }

    const isSvgExt = (name) => extOf(name) === 'svg'
    const KIND_BY_EXT = { md: 'markdown', markdown: 'markdown', mdx: 'markdown', json: 'json', jsonc: 'json', html: 'html', htm: 'html', svg: 'html' }
    const kindFor = (name) => KIND_BY_EXT[extOf(name)] ?? 'text'

    /* ---------- 安全工具：MD 渲染加固 ---------- */

    const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC_MAP[c])

    /** 链接协议白名单：http(s)/mailto/锚点/相对路径；其余（javascript: 等）只渲染文字。 */
    function safeHref(href) {
      const h = String(href ?? '').trim()
      if (!h) return null
      if (/^(https?:|mailto:)/i.test(h)) return h
      if (h.startsWith('#') || h.startsWith('/') || h.startsWith('./') || h.startsWith('../')) return h
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(h)) return h
      return null
    }

    /** 图片地址白名单：http(s)/data:image/相对路径。 */
    function safeImgSrc(src) {
      const s = String(src ?? '').trim()
      if (/^(https?:|data:image\/)/i.test(s)) return s
      if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) return s
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return s
      return null
    }

    /* ---------- 样式 ---------- */

    const CSS = `
.germina-root{--germina-soft:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent);--germina-hover:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);--germina-accent:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-base));display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;overflow:hidden;container-type:inline-size;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;-webkit-font-smoothing:antialiased}
.germina-root *{box-sizing:border-box}
.germina-root button,.germina-root input,.germina-root select{font-family:inherit}
.germina-root button{touch-action:manipulation}
.germina-root button:focus-visible,.germina-root input:focus-visible,.germina-root select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.germina-root button:disabled{opacity:.45;cursor:default}
.germina-icon{display:block;flex:none;pointer-events:none}
.germina-studio-header{height:54px;padding:0 20px;display:flex;align-items:center;gap:8px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1)}
.germina-brand{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.germina-brand-mark{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-brand-primary)}
.germina-brand strong{font-size:14px;letter-spacing:-.35px;font-weight:650}
.germina-subtitle{margin-left:4px;color:var(--dsw-alias-label-secondary);font-size:12px}
.germina-btn,.germina-btn-ghost,.germina-icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;flex:none;border:1px solid transparent;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:12px;font-weight:500;line-height:18px}
.germina-btn{padding:6px 12px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.germina-btn-ghost{padding:5px 9px;background:transparent;color:var(--dsw-alias-label-secondary)}
.germina-btn-ghost:hover:not(:disabled),.germina-icon-btn:hover:not(:disabled){background:var(--germina-hover);color:var(--dsw-alias-label-primary)}
.germina-btn-ghost[data-active="true"]{background:var(--germina-soft);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.germina-icon-btn{width:28px;height:28px;padding:0;background:transparent;color:var(--dsw-alias-label-secondary)}
.germina-btn[data-dirty="false"]{background:var(--germina-soft);color:var(--dsw-alias-label-secondary);opacity:1}
.germina-btn[data-dirty="true"]:hover:not(:disabled){filter:brightness(1.08)}
.germina-body{display:flex;flex:1;min-height:0;overflow:hidden}
.germina-sidebar{width:224px;flex:none;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--dsw-specific-sidebar-fill);border-right:1px solid var(--dsw-alias-border-l1)}
.germina-section-head{display:flex;align-items:center;gap:7px;height:48px;flex:none;padding:0 12px}
.germina-section-head strong{flex:1;min-width:0;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.germina-section-head>.germina-icon{color:var(--dsw-alias-label-secondary)}
.germina-count{padding:0 5px;font-size:10px;line-height:18px;font-variant-numeric:tabular-nums;background:var(--germina-soft);color:var(--dsw-alias-label-secondary);border-radius:4px}
.germina-search{margin:0 12px 14px;position:relative;flex:none;display:flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);padding:0 9px;color:var(--dsw-alias-label-secondary)}
.germina-search:focus-within{border-color:var(--dsw-alias-brand-primary)}
.germina-search input{width:100%;min-width:0;border:0;outline:0!important;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;padding:8px 0}
.germina-search input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.7}
.germina-search .germina-icon-btn{width:20px;height:24px}
.germina-tree{flex:1;min-height:0;overflow:auto;padding:0 8px 16px;scrollbar-width:thin}
.germina-tree-row{display:flex;align-items:center;gap:8px;width:100%;min-width:0;min-height:33px;padding:6px 8px;border:0;border-radius:6px;background:transparent;text-align:left;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap}
.germina-tree-row:hover{background:var(--germina-hover)}
.germina-tree-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.germina-caret{color:var(--dsw-alias-label-secondary);opacity:.65}
.germina-file-glyph{color:var(--dsw-alias-label-secondary)}
.germina-tree-item{position:relative;border-radius:6px;margin:1px 0}
.germina-tree-item>.germina-tree-row{padding-right:30px}
.germina-tree-item[data-sel="true"],.germina-tree-row[data-sel="true"]{background:var(--germina-accent);color:var(--dsw-alias-label-primary)}
.germina-tree-item[data-sel="true"] .germina-file-glyph{color:var(--dsw-alias-brand-primary)}
.germina-tree-item[data-sel="true"]>.germina-tree-row{font-weight:550;background:transparent}
.germina-tree-item[data-sel="true"]::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:2px;border-radius:2px;background:var(--dsw-alias-brand-primary)}
.germina-del{position:absolute;right:3px;top:3px;width:26px;height:27px;opacity:0;pointer-events:none}
.germina-tree-item:hover .germina-del,.germina-tree-item:focus-within .germina-del{opacity:1;pointer-events:auto}
.germina-del:hover:not(:disabled),.germina-danger:hover:not(:disabled){color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}
.germina-sidebar-foot{flex:none;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1)}
.germina-sidebar-foot button{width:100%;justify-content:flex-start;padding:8px 9px;border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.germina-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.germina-toolbar{display:flex;align-items:center;gap:8px;min-height:48px;padding:8px 16px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.germina-toolbar>.germina-icon{color:var(--dsw-alias-label-secondary)}
.germina-path{flex:1;min-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-secondary)}
.germina-path strong{color:var(--dsw-alias-label-primary);font-weight:500}
.germina-toolbar-divider{height:18px;width:1px;background:var(--dsw-alias-border-l1);flex:none;margin:0 2px}
.germina-tabs{display:flex;align-items:center;gap:3px;padding:0 12px;min-height:38px;flex:none;overflow-x:auto;border-bottom:1px solid var(--dsw-alias-border-l1);scrollbar-width:thin}
.germina-tab-wrap{display:flex;align-items:center;min-width:0;max-width:230px;flex:none;border-bottom:2px solid transparent;margin-bottom:-1px;padding-right:3px}
.germina-tab-wrap[data-active="true"]{border-bottom-color:var(--dsw-alias-brand-primary);background:var(--germina-soft)}
.germina-tab{display:flex;align-items:center;gap:7px;min-width:0;padding:9px 7px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;font-size:12px}
.germina-tab-wrap[data-active="true"] .germina-tab{color:var(--dsw-alias-label-primary)}
.germina-tab-name{overflow:hidden;text-overflow:ellipsis}
.germina-tab-wrap .germina-icon-btn{width:22px;height:22px;opacity:0}
.germina-tab-wrap:hover .germina-icon-btn,.germina-tab-wrap:focus-within .germina-icon-btn,.germina-tab-wrap[data-active="true"] .germina-icon-btn{opacity:.65}
.germina-tab-dot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-brand-primary);flex:none}
.germina-editor-pane{flex:1;min-height:0;min-width:0;display:grid;grid-template-rows:minmax(0,1fr);overflow:hidden}
.germina-source-pane,.germina-preview-pane{display:flex;min-width:0;min-height:0;overflow:hidden}
.germina-source-pane[hidden],.germina-preview-pane[hidden],.germina-splitter[hidden]{display:none}
.germina-editor{flex:1;width:100%;height:100%;min-width:0;min-height:0;resize:none;border:0;outline:none;padding:32px clamp(24px,4cqw,64px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.85;tab-size:2;scrollbar-width:thin}
.germina-editor::selection,.germina-md ::selection{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 20%,transparent)}
.germina-preview{flex:1;min-width:0;min-height:0;overflow:auto;padding:40px clamp(24px,4cqw,64px);background:var(--dsw-alias-bg-base);overflow-wrap:anywhere;scrollbar-width:thin}
.germina-preview-html{display:flex;flex-direction:column;overflow:hidden}
.germina-preview iframe{flex:1;display:block;min-height:0;width:100%;height:100%;border:0;background:var(--dsw-alias-bg-base)}
.germina-md{max-width:780px;margin:0 auto;font-size:15px;line-height:1.7;word-break:normal}
.germina-md>:first-child{margin-top:0}
.germina-md h1,.germina-md h2,.germina-md h3,.germina-md h4{line-height:1.35;letter-spacing:-.02em;margin:1.65em 0 .6em}
.germina-md h1{font-size:24px;font-weight:700;margin-bottom:1em}
.germina-md h2{font-size:20px;font-weight:600}
.germina-md h3{font-size:17px;font-weight:600}
.germina-md h4{font-size:15px;font-weight:600}
.germina-md p,.germina-md ul,.germina-md ol{margin:.7em 0}
.germina-md ul,.germina-md ol{padding-left:1.6em}
.germina-md li{padding-left:.2em;margin:.2em 0}
.germina-md li::marker{color:var(--dsw-alias-label-secondary)}
.germina-md code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:var(--germina-soft);border:1px solid var(--dsw-alias-border-l1);padding:1px 4px;border-radius:4px}
.germina-md pre{margin:1em 0;background:var(--germina-soft);border:1px solid var(--dsw-alias-border-l1);padding:16px;border-radius:8px;overflow:auto;font-size:13px;line-height:1.65}
.germina-md pre code{border:0;background:transparent;padding:0}
.germina-md blockquote{margin:1em 0;padding:4px 16px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:var(--germina-soft);border-radius:0 6px 6px 0}
.germina-md hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:2em 0}
.germina-md table{border-collapse:collapse;margin:1em 0;font-size:14px;max-width:100%;display:block;overflow:auto}
.germina-md th,.germina-md td{border:1px solid var(--dsw-alias-border-l1);padding:8px 12px}
.germina-md th{background:var(--germina-soft);font-weight:600}
.germina-md img{max-width:100%;height:auto;border-radius:6px}
.germina-md a{color:var(--dsw-alias-brand-primary);text-underline-offset:3px}
.germina-status{flex:none;display:flex;align-items:center;gap:12px;min-height:28px;padding:5px 14px;border-top:1px solid var(--dsw-alias-border-l1);font-size:10px;color:var(--dsw-alias-label-secondary)}
.germina-status span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.germina-status kbd{font:inherit;padding:0 4px;border:1px solid var(--dsw-alias-border-l1);border-radius:3px;background:var(--germina-soft)}
.germina-chat{width:clamp(330px,33%,520px);min-width:300px;flex:none;display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.germina-chat>.germina-section-head{border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 16px}
.germina-chat>.germina-section-head>.germina-icon{color:var(--dsw-alias-brand-primary)}
.germina-chat-body,.germina-chat-content{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.germina-chat-content>*{min-height:0;flex:1}
.germina-session-picker{display:flex;align-items:center;gap:7px;margin:12px 14px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:0 10px;background:var(--germina-soft);color:var(--dsw-alias-label-secondary);flex:none}
.germina-session-picker select{width:100%;min-width:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;padding:8px 0;cursor:pointer;text-overflow:ellipsis}
.germina-session-picker option{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.germina-chat-hint{margin:0 14px 12px;display:flex;align-items:flex-start;gap:6px;font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary);flex:none}
.germina-chat-hint>.germina-icon{margin-top:2px}
.germina-reference{display:flex;align-items:center;gap:9px;margin:0 14px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px;background:var(--germina-soft);flex:none;min-width:0}
.germina-reference-mark{display:grid;place-items:center;flex:none;width:30px;height:34px;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary)}
.germina-reference-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.germina-reference-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.germina-reference-copy small{font-size:10px;color:var(--dsw-alias-label-secondary)}
.germina-reference .germina-btn-ghost{padding:4px 6px;font-size:11px;background:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-border-l1)}
.germina-alert{margin:6px 10px;border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,var(--dsw-alias-border-l1))}
.germina-empty{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:28px;text-align:center;font-size:12px;line-height:1.8;color:var(--dsw-alias-label-secondary)}
.germina-empty .germina-big{font-size:25px;letter-spacing:-.7px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
.germina-empty p{max-width:320px;margin:0}
.germina-empty-mark{display:grid;place-items:center;width:58px;height:58px;margin-bottom:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:15px;background:var(--germina-soft);color:var(--dsw-alias-label-secondary)}
.germina-empty-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:6px}
.germina-empty-actions .germina-btn-ghost{border-color:var(--dsw-alias-border-l1)}
.germina-empty-steps{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;margin-top:30px;font-size:10px;color:var(--dsw-alias-label-secondary)}
.germina-empty-steps span{display:flex;align-items:center;gap:5px}
.germina-tree .germina-empty{padding:32px 12px;font-size:11px;justify-content:flex-start}
.germina-tree .germina-empty-mark{width:36px;height:36px;border-radius:9px}
.germina-chat .germina-empty .germina-big{font-size:18px;letter-spacing:-.35px}
.germina-splitter{position:relative;width:1px;flex:none;background:var(--dsw-alias-border-l1);cursor:col-resize;z-index:2}
.germina-splitter::before{content:"";position:absolute;inset:0 -4px}
.germina-splitter:hover,.germina-splitter:focus-visible{background:var(--dsw-alias-brand-primary)}
.germina-json-tree{font:12.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}
.germina-json-key{color:var(--dsw-alias-brand-primary)}
.germina-json-str{color:var(--dsw-alias-state-success-primary)}
.germina-json-num{color:var(--dsw-alias-state-warn-primary)}
.germina-json-bool{color:var(--dsw-alias-label-secondary)}
.germina-json-row{display:flex;align-items:center;gap:6px;width:100%;padding:0;text-align:left;background:transparent;border:0;color:var(--dsw-alias-label-primary);font:12.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}
.germina-json-row:hover{color:var(--dsw-alias-brand-primary)}
.germina-json-caret{color:var(--dsw-alias-label-secondary);width:12px;flex:none}
@container(max-width:1120px){.germina-sidebar{width:190px}.germina-chat{width:320px;min-width:290px}.germina-subtitle{display:none}.germina-segments .germina-control-label{display:none}.germina-editor,.germina-preview{padding:28px 24px}.germina-toolbar{gap:5px;padding:8px 12px}}
@container(max-width:820px){.germina-sidebar{width:180px}.germina-chat{width:300px;min-width:300px}.germina-main{min-width:320px}.germina-body{overflow-x:auto}.germina-studio-header{padding:0 12px}.germina-studio-header .germina-control-label{display:none}.germina-empty{padding:24px 16px}.germina-empty-steps{gap:10px}}
@media(hover:none){.germina-del{opacity:.6;pointer-events:auto}.germina-tab-wrap .germina-icon-btn{opacity:.65}}
@media(prefers-reduced-motion:no-preference){.germina-btn,.germina-btn-ghost,.germina-icon-btn,.germina-tree-row{transition:background-color .12s,color .12s}.germina-spin{animation:germina-spin .9s linear infinite}@keyframes germina-spin{to{transform:rotate(360deg)}}}
`

    function Styles() {
      return h('style', null, CSS)
    }

    /* ---------- Lucide：固定版本、本地按需子集 ---------- */
    /* LUCIDE_SUBSET_START */
    // Lucide 0.468.0, ISC; full notice: vendor/lucide.LICENSE.
    const ICONS = {"panel-left":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M9 3v18"}]],"panel-right":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M15 3v18"}]],"panels-top-left":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M3 9h18"}],["path",{"d":"M9 21V9"}]],"folder":[["path",{"d":"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"}]],"folder-open":[["path",{"d":"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"}]],"folder-plus":[["path",{"d":"M12 10v6"}],["path",{"d":"M9 13h6"}],["path",{"d":"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"}]],"file-text":[["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4"}],["path",{"d":"M10 9H8"}],["path",{"d":"M16 13H8"}],["path",{"d":"M16 17H8"}]],"file-code-2":[["path",{"d":"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4"}],["path",{"d":"m5 12-3 3 3 3"}],["path",{"d":"m9 18 3-3-3-3"}]],"file-json-2":[["path",{"d":"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4"}],["path",{"d":"M4 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"}],["path",{"d":"M8 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"}]],"file":[["path",{"d":"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"}],["path",{"d":"M14 2v4a2 2 0 0 0 2 2h4"}]],"search":[["circle",{"cx":"11","cy":"11","r":"8"}],["path",{"d":"m21 21-4.3-4.3"}]],"plus":[["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],"refresh-cw":[["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}],["path",{"d":"M8 16H3v5"}]],"x":[["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],"chevron-right":[["path",{"d":"m9 18 6-6-6-6"}]],"chevron-down":[["path",{"d":"m6 9 6 6 6-6"}]],"save":[["path",{"d":"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"}],["path",{"d":"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"}],["path",{"d":"M7 3v4a1 1 0 0 0 1 1h7"}]],"check":[["path",{"d":"M20 6 9 17l-5-5"}]],"pencil-line":[["path",{"d":"M12 20h9"}],["path",{"d":"M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"}],["path",{"d":"m15 5 3 3"}]],"columns-2":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M12 3v18"}]],"eye":[["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}],["circle",{"cx":"12","cy":"12","r":"3"}]],"trash-2":[["path",{"d":"M3 6h18"}],["path",{"d":"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}],["path",{"d":"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}],["line",{"x1":"10","x2":"10","y1":"11","y2":"17"}],["line",{"x1":"14","x2":"14","y1":"11","y2":"17"}]],"message-square":[["path",{"d":"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"}]],"sparkles":[["path",{"d":"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"}],["path",{"d":"M20 3v4"}],["path",{"d":"M22 5h-4"}],["path",{"d":"M4 17v2"}],["path",{"d":"M5 18H3"}]],"quote":[["path",{"d":"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"}],["path",{"d":"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"}]],"arrow-up-right":[["path",{"d":"M7 7h10v10"}],["path",{"d":"M7 17 17 7"}]],"circle-alert":[["circle",{"cx":"12","cy":"12","r":"10"}],["line",{"x1":"12","x2":"12","y1":"8","y2":"12"}],["line",{"x1":"12","x2":"12.01","y1":"16","y2":"16"}]],"loader-circle":[["path",{"d":"M21 12a9 9 0 1 1-6.219-8.56"}]],"keyboard":[["path",{"d":"M10 8h.01"}],["path",{"d":"M12 12h.01"}],["path",{"d":"M14 8h.01"}],["path",{"d":"M16 12h.01"}],["path",{"d":"M18 8h.01"}],["path",{"d":"M6 8h.01"}],["path",{"d":"M7 16h10"}],["path",{"d":"M8 12h.01"}],["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2"}]],"text-cursor-input":[["path",{"d":"M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1"}],["path",{"d":"M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5"}],["path",{"d":"M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"}],["path",{"d":"M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"}],["path",{"d":"M9 7v10"}]]}
    /* LUCIDE_SUBSET_END */

    function Icon({ name, size = 16, className = '' }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round',
        className: `germina-icon ${className}`, 'aria-hidden': true, focusable: false,
      }, (ICONS[name] || ICONS.file).map(([tag, attrs], key) => h(tag, { ...attrs, key })))
    }

    function PanelIcon({ size = 20 }) {
      return h(Icon, { name: 'panels-top-left', size })
    }

    function fileIcon(name) {
      const kind = kindFor(name)
      return kind === 'markdown' ? 'file-text' : kind === 'json' ? 'file-json-2' : kind === 'html' ? 'file-code-2' : 'file'
    }

    function IconButton({ icon, label, className = '', ...props }) {
      return h('button', { type: 'button', className: `germina-icon-btn ${className}`, title: label, 'aria-label': label, ...props }, h(Icon, { name: icon }))
    }

    /* ---------- 文件树（懒加载） ---------- */

    function TreeRow({ node, depth, selectedPath, onOpenFile, onDelete, expanded, toggleDir, childrenMap, loadingDirs, t }) {
      const indent = 8 + depth * 16
      if (node.type === 'dir') {
        const open = expanded.has(node.path)
        const children = open ? childrenMap?.get(node.path) : undefined
        const loading = loadingDirs?.has(node.path)
        return h('div', { className: 'germina-tree-branch' },
          h('button', {
            className: 'germina-tree-row', style: { paddingLeft: `${indent}px` }, onClick: () => toggleDir(node.path),
            'aria-expanded': open, title: node.path,
          },
            h(Icon, { name: open ? 'chevron-down' : 'chevron-right', size: 12, className: 'germina-caret' }),
            h(Icon, { name: open ? 'folder-open' : 'folder', size: 15, className: 'germina-file-glyph' }),
            h('span', { className: 'germina-tree-name' }, node.name),
            loading ? h(Icon, { name: 'loader-circle', size: 12, className: 'germina-spin' }) : null),
          open && children ? children.map((child) => h(TreeRow, {
            key: child.path, node: child, depth: depth + 1, selectedPath,
            onOpenFile, onDelete, expanded, toggleDir, childrenMap, loadingDirs, t,
          })) : null)
      }
      return h('div', { className: 'germina-tree-item', 'data-sel': selectedPath === node.path },
        h('button', {
          className: 'germina-tree-row', style: { paddingLeft: `${indent + 20}px` },
          'aria-current': selectedPath === node.path ? 'page' : undefined,
          onClick: () => onOpenFile(node.path), title: node.path,
        },
          h(Icon, { name: fileIcon(node.name), size: 15, className: 'germina-file-glyph' }),
          h('span', { className: 'germina-tree-name' }, node.name)),
        h(IconButton, { icon: 'trash-2', label: `${t('deleteFile')} ${node.name}`, className: 'germina-del', onClick: () => onDelete(node.path) }))
    }

    /* ---------- 预览渲染器 ---------- */

    function MdPreview({ content }) {
      const parse = getMarked()
      const html = useMemo(() => (parse ? parse(content) : `<pre>${content.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>`), [content])
      return h('div', { className: 'germina-preview' },
        h('article', { className: 'germina-md', dangerouslySetInnerHTML: { __html: html } }))
    }

    function HtmlPreview({ content, isSvg }) {
      const doc = isSvg
        ? `<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;background:#fff">${content}`
        : content
      return h('div', { className: 'germina-preview germina-preview-html' },
        h('iframe', {
          sandbox: '',
          srcDoc: doc,
          title: 'HTML preview',
        }))
    }

    function JsonNode({ keyName, value, depth }) {
      /* 容器节点（对象/数组）可折叠：默认展开前两层，深处的收起 */
      const [open, setOpen] = useState(depth < 2)
      const pad = { paddingLeft: `${depth * 16}px` }
      if (value === null) return h('div', { className: 'germina-json-tree', style: pad }, `${keyName}: `, h('span', { className: 'germina-json-bool' }, 'null'))
      if (Array.isArray(value) || typeof value === 'object') {
        const isArray = Array.isArray(value)
        const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value)
        const brace = isArray ? `[${entries.length}]` : `{${entries.length}}`
        const head = h('div', { className: 'germina-json-tree', style: pad },
          keyName ? h('span', { className: 'germina-json-key' }, `${keyName}: `) : null,
          brace)
        if (!entries.length) return head
        return h('div', null,
          h('button', { className: 'germina-json-row', style: pad, onClick: () => setOpen(!open), 'aria-expanded': open },
            h(Icon, { name: open ? 'chevron-down' : 'chevron-right', size: 12, className: 'germina-json-caret' }),
            keyName ? h('span', { className: 'germina-json-key' }, `${keyName}: `) : null,
            brace),
          open
            ? entries.map(([k, v]) => h(JsonNode, { key: k, keyName: k, value: v, depth: depth + 1 }))
            : null)
      }
      const cls = typeof value === 'string' ? 'germina-json-str'
        : typeof value === 'number' ? 'germina-json-num' : 'germina-json-bool'
      return h('div', { className: 'germina-json-tree', style: pad },
        keyName ? h('span', { className: 'germina-json-key' }, `${keyName}: `) : null,
        h('span', { class: cls }, JSON.stringify(value)))
    }

    function JsonPreview({ content, t }) {
      let parsed = null, err = ''
      try { parsed = JSON.parse(content) } catch (e) { err = e.message }
      if (err) return h('div', { className: 'germina-preview' }, h('div', { className: 'germina-empty' }, h(Icon, { name: 'circle-alert', size: 24 }), h('div', { className: 'germina-big' }, t('jsonInvalid')), h('div', null, err)))
      return h('div', { className: 'germina-preview' }, h(JsonNode, { keyName: '', value: parsed, depth: 0 }))
    }

    /* ---------- 分栏拖拽 ---------- */

    function useSplit(defaultRatio) {
      const [ratio, setRatio] = useState(defaultRatio)
      const dragging = useRef(false)
      const containerRef = useRef(null)
      useEffect(() => {
        const move = (e) => {
          if (!dragging.current || !containerRef.current) return
          const rect = containerRef.current.getBoundingClientRect()
          if (rect.width <= 0) return
          const r = (e.clientX - rect.left) / rect.width
          setRatio(Math.min(0.8, Math.max(0.2, r)))
        }
        const up = () => { dragging.current = false }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
        return () => {
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', up)
        }
      }, [])
      const splitter = h('div', {
        key: 'divider', className: 'germina-splitter',
        onMouseDown: (e) => { e.preventDefault(); dragging.current = true },
      })
      return { ratio, containerRef, splitter }
    }

    /* ---------- 主面板 ---------- */

    /* ---------- 插件装配 ---------- */

    return {
      inject: ['slots', 'locale', 'uiWorkspace', 'sessions'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        let uiPromise
        const loadUI = () => uiPromise ||= Promise.all([
          import(`${API_ROUTE}/workspace.js`),
          fetch(`${API_ROUTE}/client-ui.js`).then((res) => {
            if (!res.ok) throw new Error(`Germina UI script: ${res.status}`)
            return res.text()
          }),
          fetch(`${API_ROUTE}/client-ui.css`).then((res) => {
            if (!res.ok) throw new Error(`Germina UI stylesheet: ${res.status}`)
            return res.text()
          }),
        ]).then(([{ createWorkspaceUI }, source, css]) => {
          const uiKit = new Function('require', `${source}\nreturn __germinaUI;`)((name) => {
            if (name === 'react') return React
            throw new Error(`Germina UI dependency unavailable: ${name}`)
          })
          if (!document.getElementById('germina-ui-styles')) {
            const style = document.createElement('style')
            style.id = 'germina-ui-styles'
            style.textContent = css
            document.head.appendChild(style)
          }
          return createWorkspaceUI({
            React, uiKit, requestApi, sessions: ctx.sessions, Icon, IconButton, PanelIcon, Styles, MdPreview, JsonPreview,
            HtmlPreview, TreeRow, useSplit, kindFor, fileIcon, parentOf, extOf, isSvgExt,
          })
        })
        const MainPanel = React.lazy(() => loadUI().then((ui) => ({ default: ui.WorkspaceShell })))
        const ChatPane = React.lazy(() => loadUI().then((ui) => ({ default: ui.ChatPane })))
        class WorkspaceBoundary extends React.Component {
          state = { failed: false }
          static getDerivedStateFromError() { return { failed: true } }
          render() {
            return this.state.failed
              ? h('div', { className: 'germina-root', role: 'alert' }, h(Styles), h('div', { className: 'germina-empty' }, t('loadFailed')))
              : this.props.children
          }
        }
        const pending = (Component) => (props) => h(WorkspaceBoundary, null,
          h(React.Suspense, { fallback: h('div', { className: 'germina-empty' }, t('loading')) }, h(Component, props)))


        ctx.effect(() => ctx.locale.register(NS, {
          zh: {
            panel: 'Germina',
            openFolder: '打开文件夹',
            newFile: '新建',
            newFileName: '新文件名（可含相对路径）',
            save: '保存',
            saved: '已保存',
            saving: '保存中…',
            formatted: '已格式化',
            formatJson: '格式化 JSON',
            jsonInvalid: 'JSON 无效',
            loading: '加载中…',
            empty: '无文件',
            welcome: '让想法成为作品',
            studio: '内容工作台',
            clearSearch: '清空搜索',
            hideAssistant: '收起策划助手',
            currentDraft: '当前文档 · 含未保存修改',
            selectedPassage: '已选择的文字',
            chatWelcome: '一起推敲下一个想法',
            collectStep: '整理素材',
            writeStep: '专注写作',
            refineStep: '协作打磨',
            characters: '字符',
            unsaved: '未保存修改',
            ready: '就绪',
            files: '文件',
            assistant: 'AI 策划助手',
            editor: '文档编辑',
            refresh: '刷新文件',
            viewMode: '编辑视图',
            folderSession: '专属会话',
            folderSessionHint: '为当前文件夹恢复或创建独立会话，不使用全局默认聊天。',
            chooseFolder: '选择文件夹后开始独立对话',
            welcomeFile: '欢迎.md',
            retry: '重试',
            loadFailed: '工作区加载失败。请重载 Germina 插件并刷新页面；若仍失败，请检查同源模块路由。',
            citeDocument: '引用文档',
            citeSelection: '引用选中文字',
            referenceAdded: '已加入聊天草稿，可继续填写要求后发送。',
            referenceFailed: '当前无法插入草稿，请稍后再试。',
            pickFile: '打开一个文件夹，开始写作、整理素材，与 AI 一起推敲内容。',
            searchFiles: '搜索文件…',
            viewEdit: '编辑',
            viewSplit: '分栏',
            viewPreview: '预览',
            close: '关闭',
            error: '出错了',
            noPicker: '目录选择器不可用',
            noPreview: '该类型无预览',
            noMatch: '无匹配文件',
            deleteFile: '删除',
            deleted: '已删除',
            confirmDelete: '删除后不可恢复：',
            discardChanges: '「{0}」有未保存修改，确认丢弃？',
            discardAll: '切换根目录会丢弃所有未保存修改，继续？',
            tabsFullDirty: '已开 10 个标签且均有未保存修改，请先保存或关闭部分标签',
          },
          en: {
            panel: 'Germina',
            openFolder: 'Open Folder',
            newFile: 'New',
            newFileName: 'New file name (relative path allowed)',
            save: 'Save',
            saved: 'Saved',
            saving: 'Saving…',
            formatted: 'Formatted',
            formatJson: 'Format JSON',
            jsonInvalid: 'Invalid JSON',
            loading: 'Loading…',
            empty: 'No files',
            welcome: 'Make room for your next idea',
            studio: 'Content studio',
            clearSearch: 'Clear search',
            hideAssistant: 'Hide planning assistant',
            currentDraft: 'Current document · includes unsaved edits',
            selectedPassage: 'Selected passage',
            chatWelcome: 'Shape your next idea together',
            collectStep: 'Collect',
            writeStep: 'Write',
            refineStep: 'Refine',
            characters: 'characters',
            unsaved: 'Unsaved changes',
            ready: 'Ready',
            files: 'Files',
            assistant: 'AI planning assistant',
            editor: 'Document editor',
            refresh: 'Refresh files',
            viewMode: 'Editor view',
            folderSession: 'Folder conversation',
            folderSessionHint: 'Restore or create a dedicated conversation for this folder, not the global chat.',
            chooseFolder: 'Choose a folder to start its own conversation',
            welcomeFile: 'Welcome.md',
            retry: 'Retry',
            loadFailed: 'Workspace failed to load. Reload Germina and refresh the page. If it persists, check the same-origin module route.',
            citeDocument: 'Reference document',
            citeSelection: 'Reference selection',
            referenceAdded: 'Added to the chat draft. Add your instructions, then send.',
            referenceFailed: 'Unable to insert into the draft right now. Try again shortly.',
            pickFile: 'Open a folder to write, collect ideas, and shape your content with AI.',
            searchFiles: 'Search files…',
            viewEdit: 'Edit',
            viewSplit: 'Split',
            viewPreview: 'Preview',
            close: 'Close',
            error: 'Error',
            noPicker: 'Directory picker unavailable',
            noPreview: 'No preview for this type',
            noMatch: 'No matching files',
            deleteFile: 'Delete',
            deleted: 'Deleted',
            confirmDelete: 'Irreversible delete:',
            discardChanges: 'Discard unsaved changes in "{0}"?',
            discardAll: 'Switching root discards all unsaved changes. Continue?',
            tabsFullDirty: '10 tabs open, all with unsaved changes. Save or close some first.',
          },
        }), 'germina: dictionaries')

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'germina',
            order: 60,
            label: () => t('panel'),
            locale: NS,
          }, PanelIcon))

        ctx.slots.inject('main', function* () {
          yield ctx.slots.register({
            name: 'main',
            key: 'germina',
            locale: NS,
            children: { 'germina.assistant': { kind: 'single', scope: 'session-maybe' } },
            inject: () => ({
              t,
              pickDirectory: () => ctx.uiWorkspace.pickDirectory(),
              retainSession: (id) => ctx.sessions.retain(id, { source: 'germina' }),
            }),
          }, pending(MainPanel))
          yield ctx.slots.register({ name: 'germina.assistant', locale: NS, inject: () => ({ t }) }, pending(ChatPane))
        })
      },
    }
  },
})
