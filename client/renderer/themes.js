'use strict';
/* Bubble – Themes
   Ein Theme ist ein Objekt (oder eine .json-Datei im Themes-Ordner):
   { name, group, dark, colors: { 'bg-main': '#...', ... }, font, radius, blur,
     background: { type: 'color'|'gradient'|'animated'|'image'|'video', value, src, overlay },
     css: 'eigenes CSS' } */

const THEME_KEYS = ['bg-app', 'bg-guilds', 'bg-sidebar', 'bg-main', 'bg-elev', 'bg-input', 'bg-hover', 'bg-active',
  'border', 'text', 'text-muted', 'text-strong', 'accent', 'accent-text', 'danger', 'success', 'warn', 'mention'];

const THEME_DEFAULTS = {
  'bg-app': '#111214', 'bg-guilds': '#1b1c1f', 'bg-sidebar': '#232428', 'bg-main': '#2b2d31', 'bg-elev': '#313338',
  'bg-input': '#383a40', 'bg-hover': 'rgba(255,255,255,0.06)', 'bg-active': 'rgba(255,255,255,0.11)',
  border: 'rgba(255,255,255,0.07)', text: '#dcdde1', 'text-muted': '#949ba4', 'text-strong': '#ffffff',
  accent: '#e8833a', 'accent-text': '#ffffff', danger: '#e5534b', success: '#3fb87f', warn: '#e0a83a',
  mention: 'rgba(232,131,58,0.14)',
};

// Helle Grundfarben, damit helle Themes nicht jede Farbe angeben müssen
const LIGHT_BASE = {
  'bg-app': '#e3e5e8', 'bg-guilds': '#e3e5e8', 'bg-sidebar': '#f2f3f5', 'bg-main': '#ffffff', 'bg-elev': '#ffffff',
  'bg-input': '#ebedef', 'bg-hover': 'rgba(0,0,0,0.05)', 'bg-active': 'rgba(0,0,0,0.09)', border: 'rgba(0,0,0,0.1)',
  text: '#2e3338', 'text-muted': '#5c6370', 'text-strong': '#060607',
};

const BUILTIN_THEMES = [
  // ===================== Standard =====================
  { id: 'bubble', name: 'Bubble', group: 'Standard', dark: true,
    colors: { accent: '#6366f1', mention: 'rgba(99,102,241,0.16)', 'bg-guilds': '#14151a', 'bg-sidebar': '#1c1d24', 'bg-main': '#23242c', 'bg-elev': '#2a2b35', 'bg-input': '#30313c' } },
  { id: 'mitternacht', name: 'Mitternacht', group: 'Standard', dark: true,
    colors: { 'bg-guilds': '#1e1f22', 'bg-sidebar': '#2b2d31', 'bg-main': '#313338', 'bg-elev': '#383a40', 'bg-input': '#383a40', accent: '#5865f2', mention: 'rgba(88,101,242,0.15)' } },
  { id: 'hell', name: 'Hell', group: 'Standard', dark: false,
    colors: { ...LIGHT_BASE, accent: '#4f46e5', mention: 'rgba(79,70,229,0.1)' } },
  { id: 'amoled', name: 'AMOLED Schwarz', group: 'Standard', dark: true,
    colors: { 'bg-app': '#000', 'bg-guilds': '#000', 'bg-sidebar': '#050505', 'bg-main': '#000', 'bg-elev': '#0e0e0e', 'bg-input': '#151515', border: 'rgba(255,255,255,0.09)', accent: '#8b5cf6', mention: 'rgba(139,92,246,0.15)' } },
  { id: 'kontrast', name: 'Hoher Kontrast', group: 'Standard', dark: true,
    colors: { 'bg-app': '#000', 'bg-guilds': '#000', 'bg-sidebar': '#000', 'bg-main': '#000', 'bg-elev': '#000', 'bg-input': '#000', border: 'rgba(255,255,255,0.55)', 'bg-hover': 'rgba(255,212,0,0.15)', 'bg-active': 'rgba(255,212,0,0.28)', text: '#fff', 'text-muted': '#e6e6e6', accent: '#ffd400', 'accent-text': '#000', mention: 'rgba(255,212,0,0.2)' },
    css: '.composer,.btn,.modal,.tile,label input,label select{outline:1px solid rgba(255,255,255,.6)}' },

  // ===================== Retro & Konsolen =====================
  { id: 'aero-messenger', name: 'Aero Messenger 2009', group: 'Retro & Konsolen', dark: false,
    font: '"Segoe UI", Tahoma, sans-serif', radius: '6px', blur: '16px',
    colors: {
      'bg-app': '#cfe7f8', 'bg-guilds': 'rgba(236,245,252,0.82)', 'bg-sidebar': 'rgba(255,255,255,0.82)', 'bg-main': 'rgba(255,255,255,0.9)',
      'bg-elev': '#ffffff', 'bg-input': '#ffffff', 'bg-hover': '#e5f3fb', 'bg-active': '#cce8ff', border: 'rgba(80,140,190,0.28)',
      text: '#1e2b38', 'text-muted': '#5b7186', 'text-strong': '#0d2238', accent: '#2a8ad4', 'accent-text': '#ffffff',
      success: '#3cb81e', danger: '#d9433b', warn: '#e8a317', mention: 'rgba(42,138,212,0.12)',
    },
    background: { type: 'gradient', value: 'linear-gradient(180deg,#5db6ec 0%,#9ad3f4 22%,#dff1fc 55%,#f7fbfe 100%)' },
    css: `
/* Himmel mit grün-blauem Swoosh unten, wie Live Messenger 2009 */
#theme-bg-media::before{content:"";position:absolute;inset:0;background:
  radial-gradient(120% 60% at 15% 108%,rgba(120,210,70,.55),transparent 60%),
  radial-gradient(90% 55% at 80% 112%,rgba(40,170,230,.5),transparent 60%),
  radial-gradient(60% 40% at 70% 0%,rgba(255,255,255,.55),transparent 70%);}
#theme-bg-media::after{content:"";position:absolute;left:-10%;right:-10%;bottom:-8%;height:38%;
  background:radial-gradient(ellipse at 50% 100%,rgba(255,255,255,.75),rgba(255,255,255,0) 65%);transform:rotate(-4deg);}
/* Glanz-Kopfleisten */
.sidebar-header,.main-header{background:linear-gradient(180deg,#fdfeff 0%,#e9f4fc 48%,#d5eaf9 52%,#e4f2fc 100%);
  border-bottom:1px solid #a7cbe6;color:#0d2238;box-shadow:inset 0 1px 0 #fff;}
.main-header{min-height:58px;}
.hdr-title{font-size:16px;color:#1a4f86;font-weight:600;}
.sidebar-title{color:#1a4f86;font-weight:600;}
/* Linke Leiste wie die Symbolleiste */
.guilds{border-right:1px solid #b9d5ea;background:linear-gradient(90deg,rgba(244,250,254,.92),rgba(226,240,250,.85));}
.guild-btn{background:linear-gradient(180deg,#ffffff,#dcecf8);color:#1a4f86;border:1px solid #9cc3e3;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(20,80,140,.15);border-radius:10px;}
.guild-btn:hover,.guild-btn.active{border-radius:10px;background:linear-gradient(180deg,#e7f5ff,#bde0fa);color:#0d2238;border-color:#5aa7e0;}
.guild-btn::before{background:#2a8ad4;}
/* Bilderrahmen wie im Messenger: abgerundet, weisser Rand, glänzender Status-Rahmen */
.avatar{border-radius:7px !important;border:2px solid #fff;box-shadow:0 0 0 2px #9fb4c6,0 1px 3px rgba(0,40,80,.3);}
.av-wrap .avatar{box-shadow:0 0 0 2px #59c62f,0 0 6px rgba(80,200,40,.55);}
.member.offline .avatar,.av-wrap:has(.status-dot:not(.on)) .avatar{box-shadow:0 0 0 2px #a9b3bc;}
.avatar.speaking{box-shadow:0 0 0 2px #fff,0 0 0 5px #3cb81e,0 0 12px rgba(60,184,30,.8) !important;}
.status-dot{width:11px;height:11px;border-radius:3px;border:1px solid #fff;background:linear-gradient(180deg,#d7dde2,#97a3ad);}
.status-dot.on{background:linear-gradient(180deg,#b6f58c 0%,#4fc126 55%,#2f9416 100%);}
/* Gruppenköpfe wie "Online (7)" */
.cat{text-transform:none;font-size:13px;letter-spacing:0;color:#1e2b38;font-weight:700;padding-top:12px;}
.cat span::before{content:"◢ ";font-size:9px;color:#5b7186;vertical-align:1px;}
/* Windows-7-Auswahl */
.ch,.dm-item,.member{border:1px solid transparent;border-radius:3px;color:#1e2b38;}
.ch:hover,.dm-item:hover,.member:hover{background:linear-gradient(180deg,#f2f9fe,#e3f1fb);border-color:#b8d6fb;color:#0d2238;}
.ch.active,.dm-item.active{background:linear-gradient(180deg,#e2f1fd,#c6e3fa);border-color:#84bdf0;color:#0d2238;}
.ch .ic{color:#4a86b8;}
/* Glanz-Knöpfe */
.btn,.vp-btn,.sb-cat,.round{background:linear-gradient(180deg,#ffffff 0%,#f0f5f9 48%,#dde8f1 52%,#eaf2f8 100%);
  color:#1e2b38;border:1px solid #8aa9c4;box-shadow:inset 0 1px 0 #fff;}
.btn.primary,.vp-btn.on,.sb-cat.active,.round.on{background:linear-gradient(180deg,#a8d8ff 0%,#5aaef0 48%,#2a8ad4 52%,#4aa3e6 100%);color:#fff;border-color:#1f6aa8;text-shadow:0 1px 1px rgba(0,50,100,.4);}
.btn.danger,.round.hang,.round.off{background:linear-gradient(180deg,#ffb3ac 0%,#ea5b51 48%,#cf3a30 52%,#e2584f 100%);color:#fff;border-color:#a3271f;}
.btn.success,.round.accept{background:linear-gradient(180deg,#c4f5a2 0%,#62cc37 48%,#3cab17 52%,#5cc532 100%);color:#fff;border-color:#2c7d10;}
.btn.ghost{background:none;border:0;box-shadow:none;}
/* Chat-Fenster */
.messages{background:#fff;}
.msg{padding-top:4px;}
.msg:hover{background:#f3f9fd;}
.msg-author{color:#5b6b7a !important;font-weight:400;}
.msg-author::after{content:" sagt:";}
.msg-content{color:#111;padding-left:2px;}
.composer-wrap{background:linear-gradient(180deg,#eef6fc,#ffffff);border-top:1px solid #b9d5ea;padding-top:8px;}
.composer{background:#fff;border:1px solid #9fbcd6;border-radius:4px;box-shadow:inset 0 1px 3px rgba(20,80,140,.15);}
.user-panel,.voice-panel{background:linear-gradient(180deg,#f3f9fe,#dfeefa);border-top:1px solid #b9d5ea;}
.members{border-left:1px solid #b9d5ea;}
.modal{background:linear-gradient(180deg,#ffffff 0%,#f2f8fd 100%);border:1px solid #8fb5d6;box-shadow:0 0 0 1px rgba(255,255,255,.8) inset,0 20px 60px rgba(0,40,90,.35);}
.modal h2{color:#1a4f86;font-weight:600;}
.menu{background:#fff;border-color:#9cbad6;}
.menu-item:hover{background:linear-gradient(180deg,#e2f1fd,#c6e3fa);color:#0d2238;}
.toast{background:#fffde8;color:#222;border-left-color:#e8a317;}
.stage{background:linear-gradient(180deg,#e8f4fc,#cfe6f7);}
.tile{background:linear-gradient(180deg,#ffffff,#e4f0f9);border:1px solid #a7cbe6;}
.tile-label{background:rgba(255,255,255,.85);color:#0d2238;}
` },
  { id: 'playstation', name: 'PlayStation Blau', group: 'Retro & Konsolen', dark: true, blur: '10px',
    colors: {
      'bg-app': '#001a4d', 'bg-guilds': 'rgba(0,10,40,0.72)', 'bg-sidebar': 'rgba(0,26,77,0.55)', 'bg-main': 'rgba(0,32,96,0.42)',
      'bg-elev': '#0a2a66', 'bg-input': 'rgba(255,255,255,0.1)', 'bg-hover': 'rgba(255,255,255,0.08)', 'bg-active': 'rgba(255,255,255,0.16)',
      border: 'rgba(255,255,255,0.12)', text: '#e8f0ff', 'text-muted': '#9db4dc', accent: '#1f8fff', mention: 'rgba(31,143,255,0.2)',
    },
    background: { type: 'gradient', value: 'radial-gradient(120% 90% at 50% 0%,#0a4fc0 0%,#00317f 45%,#001338 100%)' },
    css: `
#theme-bg-media::before,#theme-bg-media::after{content:"";position:absolute;left:-60%;width:220%;height:70%;border-radius:43%;
  background:radial-gradient(ellipse at center,rgba(130,190,255,.32),rgba(130,190,255,0) 70%);animation:ps-wave 22s linear infinite;}
#theme-bg-media::before{bottom:-18%;}
#theme-bg-media::after{bottom:-34%;opacity:.7;animation-duration:31s;animation-direction:reverse;}
@keyframes ps-wave{from{transform:translateX(-4%) rotate(0deg)}to{transform:translateX(4%) rotate(360deg)}}
.guild-btn.active,.guild-btn:hover{box-shadow:0 0 18px rgba(31,143,255,.7);}
.ch.active,.dm-item.active{background:linear-gradient(90deg,rgba(31,143,255,.35),rgba(31,143,255,.05));}
.btn.primary{box-shadow:0 0 14px rgba(31,143,255,.6);}
` },
  { id: 'konsole-klassik', name: 'Konsole Klassik (PS2)', group: 'Retro & Konsolen', dark: true, blur: '6px',
    colors: { 'bg-app': '#000', 'bg-guilds': 'rgba(0,0,0,0.8)', 'bg-sidebar': 'rgba(6,8,24,0.75)', 'bg-main': 'rgba(8,10,30,0.6)', 'bg-elev': '#0b0f2a', 'bg-input': 'rgba(120,140,255,0.1)', border: 'rgba(120,140,255,0.18)', text: '#d8ddff', 'text-muted': '#8890c8', accent: '#3f5bff', mention: 'rgba(63,91,255,0.2)' },
    background: { type: 'gradient', value: 'radial-gradient(80% 60% at 50% 60%,#0d1450 0%,#03041a 60%,#000 100%)' },
    css: `#theme-bg-media::before{content:"";position:absolute;inset:0;background:
  repeating-linear-gradient(90deg,transparent 0 9%,rgba(80,110,255,.10) 9% 10%),
  linear-gradient(0deg,rgba(60,90,255,.25),transparent 60%);
  -webkit-mask:linear-gradient(0deg,#000 0%,transparent 75%);animation:ps2-glow 6s ease-in-out infinite alternate;}
@keyframes ps2-glow{from{opacity:.5}to{opacity:1}}` },
  { id: 'konsole-gruen', name: 'Konsole Grün', group: 'Retro & Konsolen', dark: true,
    colors: { 'bg-app': '#0b0b0b', 'bg-guilds': '#0e0e0e', 'bg-sidebar': '#161616', 'bg-main': '#1f1f1f', 'bg-elev': '#262626', 'bg-input': '#2c2c2c', accent: '#107c10', mention: 'rgba(16,124,16,0.2)', success: '#5dc21e' },
    css: '.btn.primary,.guild-btn:hover,.guild-btn.active{box-shadow:0 0 12px rgba(16,124,16,.6)}' },
  { id: 'gameboy', name: 'Game Boy', group: 'Retro & Konsolen', dark: false, font: '"Courier New", monospace', radius: '0px',
    colors: { 'bg-app': '#0f380f', 'bg-guilds': '#306230', 'bg-sidebar': '#8bac0f', 'bg-main': '#9bbc0f', 'bg-elev': '#9bbc0f', 'bg-input': '#8bac0f',
      'bg-hover': 'rgba(15,56,15,0.12)', 'bg-active': 'rgba(15,56,15,0.24)', border: 'rgba(15,56,15,0.4)', text: '#0f380f', 'text-muted': '#306230', 'text-strong': '#0f380f',
      accent: '#0f380f', 'accent-text': '#9bbc0f', danger: '#0f380f', success: '#306230', mention: 'rgba(15,56,15,0.15)' },
    css: '.avatar{border-radius:0!important;filter:grayscale(1) sepia(1) hue-rotate(40deg) saturate(3)}.guild-btn{border-radius:0}.round,.btn{border:2px solid #0f380f}' },
  { id: 'windows-xp', name: 'Windows XP', group: 'Retro & Konsolen', dark: false, font: 'Tahoma, "Segoe UI", sans-serif', radius: '4px',
    colors: { ...LIGHT_BASE, 'bg-app': '#5a7edc', 'bg-guilds': 'linear-gradient(180deg,#3a81f3,#245edb)', 'bg-sidebar': 'linear-gradient(180deg,#7ba2e7,#6375d6)', 'bg-main': '#ffffff', 'bg-elev': '#ece9d8', 'bg-input': '#ffffff', accent: '#3c9c2b', mention: 'rgba(60,156,43,0.12)', text: '#000', 'text-muted': '#4a4a4a', border: 'rgba(0,40,120,0.25)' },
    css: `.sidebar,.sidebar .ch,.sidebar .dm-item,.sidebar .cat,.sidebar .voice-user{color:#fff}
.sidebar .ch.active,.sidebar .dm-item.active{background:rgba(255,255,255,.25)}
.main-header{background:linear-gradient(180deg,#0a5ff0,#0841c6 60%,#0a3ca8);color:#fff;border:0}
.hdr-title,.hdr-title>svg{color:#fff}
.btn,.round{background:linear-gradient(180deg,#fff,#ece9d8);border:1px solid #003c74;color:#000;border-radius:3px}
.btn.primary{background:linear-gradient(180deg,#5fbe4f,#3c9c2b 50%,#2d8a1e);color:#fff;font-style:italic}
.modal{background:#ece9d8;border:3px solid #0841c6;border-radius:8px 8px 0 0}
.status-dot{border-color:transparent}` },
  { id: 'retro-98', name: 'Retro 98', group: 'Retro & Konsolen', dark: false, font: '"MS Sans Serif", Tahoma, sans-serif', radius: '0px',
    colors: { 'bg-app': '#008080', 'bg-guilds': '#c0c0c0', 'bg-sidebar': '#c0c0c0', 'bg-main': '#c0c0c0', 'bg-elev': '#c0c0c0', 'bg-input': '#ffffff',
      'bg-hover': 'rgba(0,0,128,0.12)', 'bg-active': '#000080', border: '#808080', text: '#000', 'text-muted': '#404040', 'text-strong': '#000',
      accent: '#000080', 'accent-text': '#fff', mention: 'rgba(0,0,128,0.12)' },
    background: { type: 'color', value: '#008080' },
    css: `.btn,.round,.guild-btn,.vp-btn,.sb-cat{background:#c0c0c0;color:#000;border-radius:0;box-shadow:inset -1px -1px #0a0a0a,inset 1px 1px #fff,inset -2px -2px #808080,inset 2px 2px #dfdfdf}
.btn:active,.round:active{box-shadow:inset 1px 1px #0a0a0a,inset -1px -1px #fff}
.ch.active,.dm-item.active{color:#fff}
.main-header,.sidebar-header{background:linear-gradient(90deg,#000080,#1084d0);color:#fff}
.hdr-title,.hdr-title>svg,.sidebar-title{color:#fff}
.composer,.messages{box-shadow:inset 1px 1px #808080,inset -1px -1px #fff}
.app{gap:3px;padding:3px}.avatar{border-radius:0!important}
.modal{box-shadow:inset -1px -1px #0a0a0a,inset 1px 1px #fff,inset -2px -2px #808080,inset 2px 2px #dfdfdf}` },
  { id: 'terminal', name: 'Terminal Bernstein', group: 'Retro & Konsolen', dark: true, font: 'Consolas, "Courier New", monospace', radius: '2px',
    colors: { 'bg-app': '#0a0700', 'bg-guilds': '#0a0700', 'bg-sidebar': '#110c00', 'bg-main': '#140e00', 'bg-elev': '#1a1300', 'bg-input': '#1f1700', border: 'rgba(255,176,0,0.25)',
      text: '#ffb000', 'text-muted': '#b07a00', 'text-strong': '#ffc94d', accent: '#ffb000', 'accent-text': '#140e00', mention: 'rgba(255,176,0,0.15)', success: '#ffb000' },
    css: 'body{text-shadow:0 0 4px rgba(255,176,0,.45)}.avatar{filter:sepia(1) saturate(4) hue-rotate(-10deg)}' },

  // ===================== Animiert =====================
  { id: 'vaporwave', name: 'Vaporwave', group: 'Animiert', dark: true, blur: '14px',
    colors: { 'bg-guilds': 'rgba(30,0,50,0.6)', 'bg-sidebar': 'rgba(45,5,70,0.5)', 'bg-main': 'rgba(30,5,55,0.45)', 'bg-elev': '#2a0a45', 'bg-input': 'rgba(255,255,255,0.12)',
      border: 'rgba(255,113,206,0.3)', text: '#fbe9ff', 'text-muted': '#d6a8e8', accent: '#ff71ce', 'accent-text': '#1a0030', success: '#05ffa1', mention: 'rgba(255,113,206,0.2)' },
    background: { type: 'animated', value: 'linear-gradient(135deg,#ff71ce,#01cdfe,#b967ff,#05ffa1,#ff71ce)', overlay: 'rgba(20,0,40,0.35)' } },
  { id: 'synthwave', name: 'Synthwave', group: 'Animiert', dark: true, blur: '10px',
    colors: { 'bg-app': '#0b0221', 'bg-guilds': 'rgba(11,2,33,0.8)', 'bg-sidebar': 'rgba(26,4,52,0.68)', 'bg-main': 'rgba(20,3,42,0.6)', 'bg-elev': '#1d0638', 'bg-input': 'rgba(255,42,109,0.12)',
      border: 'rgba(255,42,109,0.3)', text: '#f6e7ff', 'text-muted': '#b48fd6', accent: '#ff2a6d', success: '#05d9e8', mention: 'rgba(255,42,109,0.18)' },
    background: { type: 'gradient', value: 'linear-gradient(180deg,#0b0221 0%,#2b0b4f 45%,#62146e 58%,#0b0221 58.2%,#0b0221 100%)' },
    css: `
#theme-bg-media::before{content:"";position:absolute;left:50%;top:22%;width:34vmin;height:34vmin;transform:translateX(-50%);border-radius:50%;
  background:linear-gradient(180deg,#ffd319 0%,#ff901f 40%,#ff2975 75%,#f222ff 100%);
  -webkit-mask:repeating-linear-gradient(180deg,#000 0 14px,transparent 14px 18px);box-shadow:0 0 80px rgba(255,41,117,.6);}
#theme-bg-media::after{content:"";position:absolute;left:-50%;right:-50%;bottom:0;height:42%;
  background-image:linear-gradient(rgba(255,42,109,.85) 2px,transparent 2px),linear-gradient(90deg,rgba(255,42,109,.85) 2px,transparent 2px);
  background-size:60px 60px;transform:perspective(320px) rotateX(62deg);transform-origin:bottom;animation:synth-grid 1.4s linear infinite;
  -webkit-mask:linear-gradient(0deg,#000 40%,transparent);}
@keyframes synth-grid{from{background-position:0 0}to{background-position:0 60px}}
.btn.primary,.guild-btn.active{box-shadow:0 0 16px rgba(255,42,109,.7)}
.sidebar-title,.hdr-title span{text-shadow:0 0 8px rgba(255,42,109,.8)}` },
  { id: 'polarlicht', name: 'Polarlicht', group: 'Animiert', dark: true, blur: '18px',
    colors: { 'bg-app': '#020617', 'bg-guilds': 'rgba(2,6,23,0.6)', 'bg-sidebar': 'rgba(8,16,40,0.5)', 'bg-main': 'rgba(10,20,45,0.45)', 'bg-elev': '#0b1530', 'bg-input': 'rgba(255,255,255,0.08)',
      border: 'rgba(110,231,183,0.18)', text: '#e2f5ef', 'text-muted': '#93b8b0', accent: '#34d399', 'accent-text': '#022c22', mention: 'rgba(52,211,153,0.16)' },
    background: { type: 'color', value: '#020617' },
    css: `
#theme-bg-media::before,#theme-bg-media::after{content:"";position:absolute;width:90vmax;height:60vmax;border-radius:50%;filter:blur(70px);opacity:.75;}
#theme-bg-media::before{left:-20vmax;top:-20vmax;background:radial-gradient(circle,#10b981,transparent 60%);animation:aurora1 18s ease-in-out infinite alternate;}
#theme-bg-media::after{right:-25vmax;top:-10vmax;background:radial-gradient(circle,#8b5cf6,transparent 60%);animation:aurora2 24s ease-in-out infinite alternate;}
@keyframes aurora1{from{transform:translate(0,0) scale(1)}to{transform:translate(30vmax,15vmax) scale(1.3)}}
@keyframes aurora2{from{transform:translate(0,0) scale(1.1)}to{transform:translate(-30vmax,25vmax) scale(.9)}}` },
  { id: 'sternenhimmel', name: 'Sternenhimmel', group: 'Animiert', dark: true, blur: '8px',
    colors: { 'bg-app': '#030712', 'bg-guilds': 'rgba(3,7,18,0.75)', 'bg-sidebar': 'rgba(10,15,35,0.6)', 'bg-main': 'rgba(12,18,40,0.5)', 'bg-elev': '#0e1530', 'bg-input': 'rgba(255,255,255,0.08)',
      accent: '#60a5fa', mention: 'rgba(96,165,250,0.16)', text: '#e5e9f5' },
    background: { type: 'gradient', value: 'radial-gradient(ellipse at 50% 120%,#1e1b4b 0%,#030712 60%)' },
    css: `
#theme-bg-media::before,#theme-bg-media::after{content:"";position:absolute;inset:-100% 0 0 0;
  background-image:radial-gradient(1.5px 1.5px at 20px 30px,#fff,transparent),radial-gradient(1px 1px at 120px 80px,#fff,transparent),
  radial-gradient(1.5px 1.5px at 200px 160px,#cfe0ff,transparent),radial-gradient(1px 1px at 300px 40px,#fff,transparent),
  radial-gradient(2px 2px at 380px 200px,#fff,transparent),radial-gradient(1px 1px at 60px 240px,#dfe8ff,transparent);
  background-size:420px 280px;animation:stars 120s linear infinite;opacity:.8;}
#theme-bg-media::after{background-size:260px 190px;animation-duration:70s;opacity:.5;}
@keyframes stars{from{transform:translateY(0)}to{transform:translateY(50%)}}` },
  { id: 'matrix', name: 'Matrix', group: 'Animiert', dark: true, font: 'Consolas, "Courier New", monospace', radius: '2px',
    colors: { 'bg-app': '#000', 'bg-guilds': 'rgba(0,0,0,0.85)', 'bg-sidebar': 'rgba(0,10,0,0.78)', 'bg-main': 'rgba(0,8,0,0.72)', 'bg-elev': '#001400', 'bg-input': 'rgba(0,255,65,0.08)',
      border: 'rgba(0,255,65,0.22)', text: '#00ff41', 'text-muted': '#00a82b', 'text-strong': '#9dffb3', accent: '#00ff41', 'accent-text': '#001400', success: '#00ff41', mention: 'rgba(0,255,65,0.14)' },
    background: { type: 'color', value: '#000' },
    css: `
#theme-bg-media::before{content:"";position:absolute;inset:-100% 0 0 0;opacity:.45;
  background:repeating-linear-gradient(0deg,rgba(0,255,65,.0) 0 18px,rgba(0,255,65,.35) 18px 20px),
  repeating-linear-gradient(90deg,rgba(0,0,0,1) 0 14px,transparent 14px 22px);
  -webkit-mask:repeating-linear-gradient(180deg,#000 0 120px,transparent 120px 300px);animation:matrix 9s linear infinite;}
@keyframes matrix{from{transform:translateY(0)}to{transform:translateY(50%)}}
body{text-shadow:0 0 3px rgba(0,255,65,.5)}` },

  // ===================== Klassiker =====================
  { id: 'nord', name: 'Nord', group: 'Klassiker', dark: true,
    colors: { 'bg-app': '#242933', 'bg-guilds': '#2e3440', 'bg-sidebar': '#3b4252', 'bg-main': '#434c5e', 'bg-elev': '#3b4252', 'bg-input': '#4c566a', text: '#e5e9f0', 'text-muted': '#a3acbf', 'text-strong': '#eceff4', accent: '#88c0d0', 'accent-text': '#2e3440', danger: '#bf616a', success: '#a3be8c', warn: '#ebcb8b', mention: 'rgba(136,192,208,0.15)' } },
  { id: 'dracula', name: 'Dracula', group: 'Klassiker', dark: true,
    colors: { 'bg-app': '#191a21', 'bg-guilds': '#191a21', 'bg-sidebar': '#21222c', 'bg-main': '#282a36', 'bg-elev': '#343746', 'bg-input': '#44475a', text: '#f8f8f2', 'text-muted': '#9aa0c0', accent: '#bd93f9', 'accent-text': '#191a21', danger: '#ff5555', success: '#50fa7b', warn: '#f1fa8c', mention: 'rgba(189,147,249,0.15)' } },
  { id: 'solarized', name: 'Solarized Dunkel', group: 'Klassiker', dark: true,
    colors: { 'bg-app': '#001e26', 'bg-guilds': '#00212b', 'bg-sidebar': '#002b36', 'bg-main': '#073642', 'bg-elev': '#073642', 'bg-input': '#0b4252', text: '#93a1a1', 'text-muted': '#657b83', 'text-strong': '#eee8d5', accent: '#b58900', 'accent-text': '#002b36', danger: '#dc322f', success: '#859900', mention: 'rgba(181,137,0,0.15)' } },
  { id: 'gruvbox', name: 'Gruvbox', group: 'Klassiker', dark: true,
    colors: { 'bg-app': '#1d2021', 'bg-guilds': '#1d2021', 'bg-sidebar': '#282828', 'bg-main': '#32302f', 'bg-elev': '#3c3836', 'bg-input': '#504945', text: '#ebdbb2', 'text-muted': '#a89984', 'text-strong': '#fbf1c7', accent: '#fe8019', 'accent-text': '#1d2021', danger: '#fb4934', success: '#b8bb26', warn: '#fabd2f', mention: 'rgba(254,128,25,0.15)' } },
  { id: 'catppuccin', name: 'Catppuccin Mocha', group: 'Klassiker', dark: true,
    colors: { 'bg-app': '#11111b', 'bg-guilds': '#11111b', 'bg-sidebar': '#181825', 'bg-main': '#1e1e2e', 'bg-elev': '#313244', 'bg-input': '#313244', text: '#cdd6f4', 'text-muted': '#9399b2', 'text-strong': '#ffffff', accent: '#cba6f7', 'accent-text': '#11111b', danger: '#f38ba8', success: '#a6e3a1', warn: '#f9e2af', mention: 'rgba(203,166,247,0.15)' }, radius: '12px' },
  { id: 'tokyo-night', name: 'Tokyo Night', group: 'Klassiker', dark: true,
    colors: { 'bg-app': '#16161e', 'bg-guilds': '#16161e', 'bg-sidebar': '#1a1b26', 'bg-main': '#1f2335', 'bg-elev': '#24283b', 'bg-input': '#292e42', text: '#c0caf5', 'text-muted': '#7a82ad', accent: '#7aa2f7', 'accent-text': '#16161e', danger: '#f7768e', success: '#9ece6a', warn: '#e0af68', mention: 'rgba(122,162,247,0.15)' } },
  { id: 'monokai', name: 'Monokai', group: 'Klassiker', dark: true,
    colors: { 'bg-app': '#1e1f1c', 'bg-guilds': '#1e1f1c', 'bg-sidebar': '#252621', 'bg-main': '#272822', 'bg-elev': '#3e3d32', 'bg-input': '#3e3d32', text: '#f8f8f2', 'text-muted': '#a59f85', accent: '#a6e22e', 'accent-text': '#1e1f1c', danger: '#f92672', success: '#a6e22e', warn: '#e6db74', mention: 'rgba(166,226,46,0.14)' } },

  // ===================== Natur & Stimmung =====================
  { id: 'frutiger-aero', name: 'Frutiger Aero', group: 'Natur & Stimmung', dark: false, blur: '18px', radius: '14px', font: '"Segoe UI", sans-serif',
    colors: { 'bg-app': '#9fe0ff', 'bg-guilds': 'rgba(255,255,255,0.45)', 'bg-sidebar': 'rgba(255,255,255,0.55)', 'bg-main': 'rgba(255,255,255,0.68)', 'bg-elev': '#f4fbff', 'bg-input': 'rgba(255,255,255,0.9)',
      'bg-hover': 'rgba(0,140,220,0.08)', 'bg-active': 'rgba(0,140,220,0.16)', border: 'rgba(0,120,190,0.2)', text: '#103248', 'text-muted': '#3f6a86', 'text-strong': '#06223a', accent: '#21a3e8', success: '#41c432', mention: 'rgba(33,163,232,0.14)' },
    background: { type: 'gradient', value: 'linear-gradient(180deg,#2fb6f5 0%,#9fe0ff 45%,#d6f6c4 75%,#7fd35a 100%)' },
    css: `
#theme-bg-media::before{content:"";position:absolute;inset:0;background:
  radial-gradient(circle at 15% 70%,rgba(255,255,255,.55) 0 3%,transparent 3.3%),radial-gradient(circle at 80% 30%,rgba(255,255,255,.45) 0 4%,transparent 4.3%),
  radial-gradient(circle at 60% 80%,rgba(255,255,255,.4) 0 2%,transparent 2.3%),radial-gradient(circle at 35% 20%,rgba(255,255,255,.4) 0 2.5%,transparent 2.8%);
  animation:bubbles 14s ease-in-out infinite alternate;}
@keyframes bubbles{from{transform:translateY(0)}to{transform:translateY(-6%)}}
.btn.primary,.guild-btn:hover,.guild-btn.active{background:linear-gradient(180deg,#9fe3ff 0%,#21a3e8 50%,#0f86cc 51%,#38b4f0 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 2px 6px rgba(0,100,160,.35)}` },
  { id: 'ozean', name: 'Ozean', group: 'Natur & Stimmung', dark: true,
    colors: { 'bg-app': '#021821', 'bg-guilds': '#03202c', 'bg-sidebar': '#062b3a', 'bg-main': '#0a3546', 'bg-elev': '#0e4054', 'bg-input': '#124a60', text: '#d6f3ff', 'text-muted': '#7fb3c7', accent: '#22d3ee', 'accent-text': '#022', mention: 'rgba(34,211,238,0.15)' } },
  { id: 'wald', name: 'Wald', group: 'Natur & Stimmung', dark: true,
    colors: { 'bg-app': '#0c140e', 'bg-guilds': '#0f1a12', 'bg-sidebar': '#152218', 'bg-main': '#1b2b1f', 'bg-elev': '#223526', 'bg-input': '#28402d', text: '#e0eedd', 'text-muted': '#93ad90', accent: '#6fbf4a', 'accent-text': '#0c140e', mention: 'rgba(111,191,74,0.15)', warn: '#d9a440' } },
  { id: 'sonnenuntergang', name: 'Sonnenuntergang', group: 'Natur & Stimmung', dark: true, blur: '12px',
    colors: { 'bg-guilds': 'rgba(40,10,30,0.65)', 'bg-sidebar': 'rgba(60,15,40,0.5)', 'bg-main': 'rgba(45,12,35,0.45)', 'bg-elev': '#3a1030', 'bg-input': 'rgba(255,255,255,0.1)', border: 'rgba(255,170,120,0.2)', text: '#fff0e6', 'text-muted': '#e0a99a', accent: '#ff7a45', mention: 'rgba(255,122,69,0.18)' },
    background: { type: 'animated', value: 'linear-gradient(160deg,#2b1055,#7a2a7a,#d6416f,#ff8c42,#ffc75f,#d6416f,#2b1055)', overlay: 'rgba(20,0,20,0.25)' } },
  { id: 'kirschbluete', name: 'Kirschblüte', group: 'Natur & Stimmung', dark: false,
    colors: { ...LIGHT_BASE, 'bg-app': '#fbe4ec', 'bg-guilds': '#f8d6e3', 'bg-sidebar': '#fdeef3', 'bg-main': '#fff8fa', 'bg-input': '#fbe8ef', border: 'rgba(200,80,120,0.15)', text: '#4a2532', 'text-muted': '#9a6577', 'text-strong': '#2b0f1a', accent: '#e05a8a', mention: 'rgba(224,90,138,0.12)' } },
  { id: 'lavendel', name: 'Lavendel', group: 'Natur & Stimmung', dark: false,
    colors: { ...LIGHT_BASE, 'bg-app': '#e7e2f7', 'bg-guilds': '#ddd5f3', 'bg-sidebar': '#efebfb', 'bg-main': '#faf8ff', 'bg-input': '#ece7fa', border: 'rgba(110,80,200,0.15)', text: '#2f2650', 'text-muted': '#7568a0', 'text-strong': '#1a1238', accent: '#7c5cdb', mention: 'rgba(124,92,219,0.12)' } },
];

// ---------- Theme anwenden ----------
function themeAssetUrl(src, theme) {
  if (!src) return '';
  if (/^(https?:|data:|blob:|bubble-file:)/i.test(src)) return src;
  return 'bubble-file://themes/' + encodeURIComponent(src);
}

function themeColor(theme, key) {
  const base = theme.dark === false ? { ...THEME_DEFAULTS, ...LIGHT_BASE } : THEME_DEFAULTS;
  return (theme.colors && theme.colors[key]) || base[key];
}

function applyTheme(theme, opts = {}) {
  const root = document.documentElement;
  const base = theme.dark === false ? { ...THEME_DEFAULTS, ...LIGHT_BASE } : THEME_DEFAULTS;
  for (const k of THEME_KEYS) {
    const v = (theme.colors && theme.colors[k]) || base[k];
    root.style.setProperty('--' + k, v);
  }
  root.style.setProperty('--font', opts.uiFont || theme.font || '"Segoe UI", "Inter", system-ui, sans-serif');
  root.style.setProperty('--font-chat', opts.chatFont || opts.uiFont || theme.font || '"Segoe UI", "Inter", system-ui, sans-serif');
  root.style.setProperty('--radius', theme.radius || '8px');
  root.style.setProperty('--blur', opts.reduceMotion ? '0px' : (theme.blur || '0px'));
  root.style.colorScheme = theme.dark === false ? 'light' : 'dark';
  document.body.dataset.theme = theme.id || 'custom';
  document.body.classList.toggle('reduce-motion', !!opts.reduceMotion);

  const media = document.getElementById('theme-bg-media');
  const overlay = document.getElementById('theme-bg-overlay');
  media.innerHTML = '';
  media.className = '';
  media.style.background = '';
  const bg = theme.background || {};
  const url = themeAssetUrl(bg.src, theme);
  if (bg.type === 'video' && url) {
    const v = document.createElement('video');
    v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = !opts.reduceMotion;
    if (!opts.reduceMotion) v.play().catch(() => {});
    media.append(v);
  } else if (bg.type === 'image' && url) {
    media.style.background = `center / cover no-repeat url("${url.replace(/"/g, '%22')}")`;
  } else if (bg.type === 'animated' && bg.value) {
    media.style.background = bg.value;
    media.className = 'animated';
  } else if ((bg.type === 'gradient' || bg.type === 'color') && bg.value) {
    media.style.background = bg.value;
  } else {
    media.style.background = 'var(--bg-app)';
  }
  overlay.style.background = bg.overlay || '';
  document.getElementById('theme-css').textContent = theme.css || '';
}

// Mini-Vorschau für die Theme-Auswahl
function themePreviewHtml(theme) {
  const c = (k) => themeColor(theme, k);
  const bg = theme.background || {};
  let back = c('bg-app');
  const url = themeAssetUrl(bg.src, theme);
  if (bg.type === 'image' && url) back = `center / cover url("${url}")`;
  else if (bg.value && bg.type !== 'video') back = bg.value;
  const badge = bg.type === 'video' ? 'VIDEO' : (bg.type === 'animated' || /@keyframes/.test(theme.css || '')) ? 'ANIMIERT' : bg.type === 'image' && /\.gif/i.test(bg.src || '') ? 'GIF' : '';
  const video = bg.type === 'video' && url ? `<video src="${url}" muted loop autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>` : '';
  return `<div class="theme-prev" style="background:${back}">${video}
    <div class="tp-g" style="background:${c('bg-guilds')};position:relative"></div>
    <div class="tp-s" style="background:${c('bg-sidebar')};position:relative"></div>
    <div class="tp-m" style="background:${c('bg-main')};position:relative">
      <div class="tp-line" style="background:${c('text-strong')};width:70%"></div>
      <div class="tp-line" style="background:${c('text-muted')};width:90%"></div>
      <div class="tp-line" style="background:${c('text-muted')};width:55%"></div>
      <div class="tp-acc" style="background:${c('accent')}"></div>
    </div>${badge ? `<span class="tp-badge">${badge}</span>` : ''}</div>`;
}

// Schriften, die auf praktisch jedem Windows-PC vorhanden sind
const FONT_PRESETS = [
  'Segoe UI', 'Segoe UI Variable', 'Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Calibri', 'Cambria', 'Candara',
  'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Palatino Linotype',
  'Segoe Print', 'Segoe Script', 'Times New Roman', 'Franklin Gothic Medium', 'Gabriola', 'Bahnschrift', 'Ink Free',
];
