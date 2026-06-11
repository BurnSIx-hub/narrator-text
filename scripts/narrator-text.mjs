/**
 * Narrator Text — Foundry VTT v13
 * Отображает текстовые надписи на экранах игроков.
 */

const MODULE_ID    = "narrator-text";
const SOCKET_EVENT = `module.${MODULE_ID}`;

/* ══════════════════════════════════════════════════
   КОНСТАНТЫ
══════════════════════════════════════════════════ */

// Локализация: строки лежат в lang/ru.json и lang/en.json (ключи NARRATOR.*)
const L  = (k)    => game.i18n.localize(`NARRATOR.${k}`);
const LF = (k, d) => game.i18n.format(`NARRATOR.${k}`, d);

// Опции вычисляются лениво — на момент загрузки модуля i18n ещё не готов
function FONT_OPTS() {
  return {
    "Alegreya":          `Alegreya (${L("FontSerif")})`,
    "Caveat":            `Caveat (${L("FontHandwritten")})`,
    "Pacifico":          `Pacifico (${L("FontDecorative")})`,
    "Palatino Linotype": `Palatino (${L("FontClassic")})`,
    "Georgia":           `Georgia (${L("FontNewspaper")})`,
    "Times New Roman":   "Times New Roman",
  };
}

function ANIM_OPTS() {
  return {
    "fade":         L("AnimFade"),
    "scale":        L("AnimScale"),
    "slide-top":    L("AnimSlideTop"),
    "slide-bottom": L("AnimSlideBottom"),
    "instant":      L("Instant"),
    "typewriter":   L("Typewriter"),
  };
}

function POS_OPTS() {
  return {
    "top-left":      L("PosTopLeft"),
    "top-center":    L("PosTopCenter"),
    "top-right":     L("PosTopRight"),
    "middle-left":   L("PosMiddleLeft"),
    "middle-center": L("PosMiddleCenter"),
    "middle-right":  L("PosMiddleRight"),
    "bottom-left":   L("PosBottomLeft"),
    "bottom-center": L("PosBottomCenter"),
    "bottom-right":  L("PosBottomRight"),
    "custom":        L("CustomPos"),
  };
}

const DEFAULT_STYLE = {
  font: "Alegreya", fontSize: 64, color: "#ffffff",
  opacity: 1, align: "center", maxWidth: 70,
  animIn: "fade", animOut: "fade",
  fadeInDuration: 1.5, fadeOutDuration: 1.5, duration: 5,
  shadow: true, outline: false, outlineColor: "#000000",
};

/* ══════════════════════════════════════════════════
   ДВИЖОК ОТОБРАЖЕНИЯ
══════════════════════════════════════════════════ */

function ensureOverlay() {
  let el = document.getElementById("narrator-text-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "narrator-text-overlay";
    document.body.appendChild(el);
  }
  return el;
}

function displayNarratorText(payload) {
  const overlay = ensureOverlay();
  if (!payload.allowStack) overlay.innerHTML = "";
  const messages = Array.isArray(payload.messages) ? payload.messages : [payload];
  messages.forEach(msg => {
    const d = { ...payload, ...msg };
    setTimeout(() => spawnMessage(d, overlay), (d.delay ?? 0) * 1000);
  });
}

function spawnMessage(d, overlay) {
  const el = document.createElement("div");
  el.className = "narrator-text-message";

  // Стиль текста
  const opacity = d.opacity ?? 1;
  el.style.opacity     = "0";
  el.style.fontSize    = (d.fontSize ?? 48) + "px";
  el.style.fontFamily  = `"${d.font ?? "Alegreya"}", serif`;
  el.style.color       = d.color ?? "#ffffff";
  el.style.textAlign   = d.align ?? "center";

  // Тень и обводка
  const shadows = [];
  if (d.shadow) shadows.push("2px 4px 8px rgba(0,0,0,0.85)");
  if (d.outline) {
    const c = d.outlineColor ?? "#000000";
    shadows.push(`-2px -2px 0 ${c}`, `2px -2px 0 ${c}`, `-2px 2px 0 ${c}`, `2px 2px 0 ${c}`);
  }
  if (shadows.length) el.style.textShadow = shadows.join(", ");

  // Позиция
  const wPct = d.maxWidth ?? 70;
  el.style.width = wPct + "%";
  _applyPosition(el, d.position ?? "middle-center", d.posX ?? 50, d.posY ?? 50, wPct);

  // Анимация и текст
  const animIn     = d.animIn         ?? "fade";
  const animOut    = d.animOut        ?? "fade";
  const fadeInDur  = d.fadeInDuration  ?? 1.5;
  const fadeOutDur = d.fadeOutDuration ?? 1.5;
  const showDur    = d.duration        ?? 5;

  if (animIn === "typewriter") {
    el.textContent = "";
    overlay.appendChild(el);
    el.style.opacity = String(opacity);
    _typewriter(el, d.text ?? "", fadeInDur * 1000);
  } else {
    el.textContent = d.text ?? "";
    overlay.appendChild(el);
    _animIn(el, animIn, fadeInDur, opacity);
  }

  setTimeout(
    () => _animOut(el, animOut, fadeOutDur, opacity, () => el.remove()),
    (fadeInDur + showDur) * 1000
  );
}

// Вычисляет left/top в % без transform — надёжнее для всех анимаций
function _applyPosition(el, pos, customX, customY, wPct) {
  const pad = 4;
  const xL  = pad;
  const xC  = (100 - wPct) / 2;
  const xR  = 100 - wPct - pad;

  const MAP = {
    "top-left":      { x: xL, y: 5  },
    "top-center":    { x: xC, y: 5  },
    "top-right":     { x: xR, y: 5  },
    "middle-left":   { x: xL, y: 42 },
    "middle-center": { x: xC, y: 42 },
    "middle-right":  { x: xR, y: 42 },
    "bottom-left":   { x: xL, y: 80 },
    "bottom-center": { x: xC, y: 80 },
    "bottom-right":  { x: xR, y: 80 },
  };

  const { x, y } = pos === "custom"
    ? { x: customX - wPct / 2, y: customY }
    : (MAP[pos] ?? MAP["middle-center"]);

  el.style.left      = x + "%";
  el.style.top       = y + "%";
  el.style.transform = "";
}

function _animIn(el, type, dur, opacity) {
  if (type === "instant") { el.style.opacity = String(opacity); return; }
  const kf = {
    fade:           [{ opacity: 0 },                            { opacity }],
    scale:          [{ opacity: 0, transform: "scale(0.82)" },  { opacity, transform: "scale(1)" }],
    "slide-top":    [{ opacity: 0, transform: "translateY(-50px)" }, { opacity, transform: "translateY(0)" }],
    "slide-bottom": [{ opacity: 0, transform: "translateY(50px)" },  { opacity, transform: "translateY(0)" }],
  }[type] ?? [{ opacity: 0 }, { opacity }];

  const anim = el.animate(kf, { duration: dur * 1000, easing: "ease-out", fill: "forwards" });
  anim.onfinish = () => { el.style.opacity = String(opacity); };
}

function _animOut(el, type, dur, opacity, onDone) {
  if (type === "instant") { el.style.opacity = "0"; onDone(); return; }
  const kf = {
    fade:           [{ opacity },                            { opacity: 0 }],
    scale:          [{ opacity, transform: "scale(1)" },     { opacity: 0, transform: "scale(0.82)" }],
    "slide-top":    [{ opacity, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-50px)" }],
    "slide-bottom": [{ opacity, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(50px)" }],
  }[type] ?? [{ opacity }, { opacity: 0 }];

  const anim = el.animate(kf, { duration: dur * 1000, easing: "ease-in", fill: "forwards" });
  anim.onfinish = onDone;
}

function _typewriter(el, text, totalMs) {
  const chars = [...text];
  if (!chars.length) return;
  const interval = totalMs / chars.length;
  let i = 0;
  const timer = setInterval(() => {
    el.textContent += chars[i++];
    if (i >= chars.length) clearInterval(timer);
  }, interval);
}

/* ══════════════════════════════════════════════════
   ПРИЛОЖЕНИЕ ГМА
══════════════════════════════════════════════════ */

class NarratorTextApp extends foundry.applications.api.ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id: "narrator-text-app",
    window:   { title: "NARRATOR.Title", resizable: false },
    position: { width: 360, height: "auto" },
    // Без classes: ["no-pip"] окно в v14 может захватывать фокус канваса
    classes:  ["narrator-text-window"],
  };

  constructor(options = {}) {
    super(options);

    // История: поддержка миграции старого формата
    const raw = JSON.parse(localStorage.getItem("narratorTextHistory") ?? "[]");
    this._history = raw.map(e => {
      if (e?.style && Array.isArray(e?.messages)) return e;
      if (e?.text != null) return {
        style:    { ...DEFAULT_STYLE },
        messages: [{ text: e.text, position: e.position ?? "middle-center", posX: 50, posY: 50 }],
        targets:  [],
      };
      return null;
    }).filter(Boolean);

    this._tab     = "compose";
    this._targets = new Set();   // пусто = все игроки
    this._stack   = false;
    this._msgs    = [this._newMsg()];
    this._style   = { ...DEFAULT_STYLE };
  }

  _newMsg() {
    return { text: "", position: "middle-center", posX: 50, posY: 50 };
  }

  /* ── Рендер (ApplicationV2 API) ── */

  async _renderHTML(_ctx, _opts) {
    const wrap = document.createElement("div");
    wrap.innerHTML = this._buildHTML();
    return wrap;
  }

  _replaceHTML(result, content) {
    content.innerHTML = "";
    content.appendChild(result);
    this._addListeners(content);
  }

  /* ── HTML ── */

  _buildHTML() {
    const s = this._style;

    const tabBar = ["compose","style","anim","history"].map(t => {
      const labels = { compose:L("TabText"), style:L("TabStyle"), anim:L("TabAnim"), history:L("TabHistory") };
      return `<button class="narrator-tab-btn${this._tab===t?" active":""}" data-tab="${t}">${labels[t]}</button>`;
    }).join("");

    const fontOpts = Object.entries(FONT_OPTS())
      .map(([v,l]) => `<option value="${v}"${s.font===v?" selected":""}>${l}</option>`).join("");

    const animInBtns = Object.entries(ANIM_OPTS())
      .map(([v,l]) => `<button class="narrator-anim-btn${s.animIn===v?" selected":""}" data-anim-in="${v}">${l}</button>`).join("");

    const animOutBtns = Object.entries(ANIM_OPTS()).filter(([v]) => v !== "typewriter")
      .map(([v,l]) => `<button class="narrator-anim-btn${s.animOut===v?" selected":""}" data-anim-out="${v}">${l}</button>`).join("");

    return `
<div class="narrator-tabs">${tabBar}</div>

<!-- ── ТЕКСТ ── -->
<div class="narrator-tab-panel${this._tab==="compose"?" active":""}" data-panel="compose">

  <div class="narrator-section" style="margin-top:6px">${L("ShowToPlayers")}</div>
  <div id="nt-targets">${this._buildTargetsHTML()}</div>

  <div class="narrator-check-field" style="margin:8px 0 4px">
    <input type="checkbox" id="nt-stack"${this._stack?" checked":""}>
    <label for="nt-stack">${L("AllowStack")}</label>
  </div>

  <div id="nt-msgs">${this._buildMsgsHTML()}</div>
  ${this._stack ? `<button class="narrator-add-item-btn" id="nt-add">${L("AddMessage")}</button>` : ""}
  <button class="narrator-send-btn" id="nt-send">${L("Send")}</button>
</div>

<!-- ── СТИЛЬ ── -->
<div class="narrator-tab-panel${this._tab==="style"?" active":""}" data-panel="style">
  <div class="narrator-field">
    <label>${L("Font")}</label>
    <select id="nt-font">${fontOpts}</select>
  </div>
  <div class="narrator-row">
    <div class="narrator-field"><label>${L("FontSize")}</label>
      <input type="number" id="nt-size" value="${s.fontSize}" min="10" max="200"></div>
    <div class="narrator-field"><label>${L("Color")}</label>
      <input type="color" id="nt-color" value="${s.color}"></div>
  </div>
  <div class="narrator-field"><label>${L("Opacity")}</label>
    <div class="narrator-range-wrap">
      <input type="range" id="nt-opacity" min="0" max="1" step="0.05" value="${s.opacity}">
      <span id="nt-opacity-v">${Math.round(s.opacity * 100)}%</span>
    </div>
  </div>
  <div class="narrator-field"><label>${L("MaxWidth")}</label>
    <div class="narrator-range-wrap">
      <input type="range" id="nt-maxw" min="10" max="100" value="${s.maxWidth}">
      <span id="nt-maxw-v">${s.maxWidth}%</span>
    </div>
  </div>
  <div class="narrator-field"><label>${L("Alignment")}</label>
    <div class="narrator-align-btns">
      <button class="narrator-align-btn" data-align="left"   data-sel="${s.align==="left"?"1":"0"}">${L("AlignLeft")}</button>
      <button class="narrator-align-btn" data-align="center" data-sel="${s.align==="center"?"1":"0"}">${L("AlignCenter")}</button>
      <button class="narrator-align-btn" data-align="right"  data-sel="${s.align==="right"?"1":"0"}">${L("AlignRight")}</button>
    </div>
  </div>
  <div class="narrator-check-field">
    <input type="checkbox" id="nt-shadow"${s.shadow?" checked":""}><label for="nt-shadow">${L("Shadow")}</label>
  </div>
  <div class="narrator-check-field">
    <input type="checkbox" id="nt-outline"${s.outline?" checked":""}><label for="nt-outline">${L("Outline")}</label>
  </div>
  <div class="narrator-field" id="nt-outline-color-row"${s.outline?"":" style=\"display:none\""}>
    <label>${L("OutlineColor")}</label>
    <input type="color" id="nt-outline-color" value="${s.outlineColor}">
  </div>
  <div class="narrator-section">${L("Preview")}</div>
  <div id="nt-preview" class="narrator-font-preview"
    style="font-family:'${s.font}';font-size:${Math.min(s.fontSize,36)}px;color:${s.color};opacity:${s.opacity};text-align:${s.align}">
    ${this._esc(this._msgs[0]?.text) || L("PreviewPlaceholder")}
  </div>
</div>

<!-- ── АНИМАЦИЯ ── -->
<div class="narrator-tab-panel${this._tab==="anim"?" active":""}" data-panel="anim">
  <div class="narrator-section">${L("AnimIn")}</div>
  <div class="narrator-anim-grid">${animInBtns}</div>
  <div class="narrator-section">${L("AnimOut")}</div>
  <div class="narrator-anim-grid">${animOutBtns}</div>
  <div class="narrator-section">${L("Timing")}</div>
  <div class="narrator-field"><label>${L("FadeInDuration")}</label>
    <div class="narrator-range-wrap">
      <input type="range" id="nt-fin" min="0" max="10" step="0.5" value="${s.fadeInDuration}">
      <span id="nt-fin-v">${s.fadeInDuration}${L("SecondsShort")}</span>
    </div>
  </div>
  <div class="narrator-field"><label>${L("Duration")}</label>
    <div class="narrator-range-wrap">
      <input type="range" id="nt-dur" min="1" max="30" step="0.5" value="${s.duration}">
      <span id="nt-dur-v">${s.duration}${L("SecondsShort")}</span>
    </div>
  </div>
  <div class="narrator-field"><label>${L("FadeOutDuration")}</label>
    <div class="narrator-range-wrap">
      <input type="range" id="nt-fout" min="0" max="10" step="0.5" value="${s.fadeOutDuration}">
      <span id="nt-fout-v">${s.fadeOutDuration}${L("SecondsShort")}</span>
    </div>
  </div>
</div>

<!-- ── ИСТОРИЯ ── -->
<div class="narrator-tab-panel${this._tab==="history"?" active":""}" data-panel="history">
  <div class="narrator-history-list" id="nt-history">${this._buildHistoryHTML()}</div>
</div>`;
  }

  _buildTargetsHTML() {
    const active = game.users.filter(u => u.active && !u.isGM);
    if (!active.length) return `<div class="narrator-no-players">${L("NoActivePlayers")}</div>`;

    const allChecked = this._targets.size === 0;
    const rows = active.map(u => {
      const color = typeof u.color === "string" ? u.color : (u.color?.css ?? "#888888");
      const checked = !allChecked && this._targets.has(u.id);
      return `<div class="narrator-target-item">
        <input type="checkbox" id="nt-t-${u.id}" class="nt-target nt-target-p" data-uid="${u.id}"${checked?" checked":""}>
        <label for="nt-t-${u.id}" class="narrator-target-label">
          <span class="narrator-target-dot" style="background:${color}"></span>${u.name}
        </label></div>`;
    }).join("");

    return `<div class="narrator-target-item">
      <input type="checkbox" id="nt-t-all" class="nt-target" data-uid="all"${allChecked?" checked":""}>
      <label for="nt-t-all" class="narrator-target-label narrator-target-all">
        <span class="narrator-target-icon">👥</span> ${L("AllPlayers")}
      </label></div>${rows}`;
  }

  _buildMsgsHTML() {
    return this._msgs.map((m, i) => {
      const posOpts = Object.entries(POS_OPTS())
        .map(([v,l]) => `<option value="${v}"${m.position===v?" selected":""}>${l}</option>`).join("");
      return `<div class="narrator-stack-item">
  ${this._msgs.length > 1 ? `
    <div class="narrator-stack-header">
      <span class="narrator-stack-num">${LF("MessageNum", { n: i + 1 })}</span>
      <button class="narrator-stack-remove" data-rm="${i}">✕</button>
    </div>` : ""}
  <div class="narrator-field">
    <textarea class="nt-msg-text" data-mi="${i}" placeholder="${L("TextPlaceholder")}">${this._esc(m.text)}</textarea>
  </div>
  <div class="narrator-field">
    <label>${L("Position")}</label>
    <select class="nt-msg-pos" data-mi="${i}">${posOpts}</select>
  </div>
  ${m.position === "custom" ? `
  <div class="narrator-stack-pos-row">
    <div class="narrator-field" style="flex:1"><label>${L("PosX")}</label>
      <input type="number" class="nt-msg-x" data-mi="${i}" value="${m.posX ?? 50}" min="0" max="100"></div>
    <div class="narrator-field" style="flex:1"><label>${L("PosY")}</label>
      <input type="number" class="nt-msg-y" data-mi="${i}" value="${m.posY ?? 50}" min="0" max="100"></div>
  </div>` : ""}
</div>`;
    }).join("");
  }

  _buildHistoryHTML() {
    if (!this._history.length) return `<div class="narrator-history-empty">${L("HistoryEmpty")}</div>`;
    return [...this._history].reverse().map((e, ri) => {
      const idx     = this._history.length - 1 - ri;
      const preview = e.messages.map(m => m.text).filter(Boolean).join(" / ").substring(0, 60);
      const meta    = [
        FONT_OPTS()[e.style.font] ?? e.style.font,
        e.style.fontSize + "px",
        ANIM_OPTS()[e.style.animIn] ?? e.style.animIn,
        e.style.duration + L("SecondsShort"),
        e.messages.length > 1 ? LF("MessagesCount", { n: e.messages.length }) : "",
      ].filter(Boolean).join(" · ");
      return `<div class="narrator-history-item">
  <div class="narrator-history-text">${this._esc(preview)}${preview.length >= 60 ? "…" : ""}</div>
  <div class="narrator-history-meta">${meta}</div>
  <div class="narrator-history-actions">
    <button data-resend="${idx}">${L("Resend")}</button>
    <button data-load="${idx}">${L("Load")}</button>
    <button class="del-btn" data-del="${idx}">✕</button>
  </div></div>`;
    }).join("");
  }

  _esc(str) {
    return String(str ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ── Обработчики событий ── */

  _addListeners(root) {
    const s = this._style;

    // Переключение вкладок
    root.querySelectorAll(".narrator-tab-btn").forEach(btn =>
      btn.addEventListener("click", () => {
        this._tab = btn.dataset.tab;
        root.querySelectorAll(".narrator-tab-btn").forEach(b =>
          b.classList.toggle("active", b.dataset.tab === this._tab));
        root.querySelectorAll(".narrator-tab-panel").forEach(p =>
          p.classList.toggle("active", p.dataset.panel === this._tab));
        // Синхронизируем selected-состояния при открытии вкладок
        if (this._tab === "style" || this._tab === "anim") {
          root.querySelectorAll("[data-align]").forEach(x =>
            x.setAttribute("data-sel", x.dataset.align === s.align ? "1" : "0"));
          root.querySelectorAll("[data-anim-in]").forEach(x =>
            x.classList.toggle("selected", x.dataset.animIn === s.animIn));
          root.querySelectorAll("[data-anim-out]").forEach(x =>
            x.classList.toggle("selected", x.dataset.animOut === s.animOut));
        }
      })
    );

    // Таргеты
    root.querySelectorAll(".nt-target").forEach(cb =>
      cb.addEventListener("change", () => {
        const allCb = root.querySelector('[data-uid="all"]');
        if (cb.dataset.uid === "all") {
          this._targets.clear();
          root.querySelectorAll(".nt-target-p").forEach(c => c.checked = false);
        } else {
          cb.checked ? this._targets.add(cb.dataset.uid) : this._targets.delete(cb.dataset.uid);
          if (allCb) allCb.checked = this._targets.size === 0;
        }
      })
    );

    // Режим стека
    root.querySelector("#nt-stack")?.addEventListener("change", e => {
      this._stack = e.target.checked;
      if (!this._stack) this._msgs = [this._msgs[0] ?? this._newMsg()];
      this.render(true);
    });

    // Поля надписей — делегирование событий
    const msgsEl = root.querySelector("#nt-msgs");
    if (msgsEl) {
      msgsEl.addEventListener("input", e => {
        const mi = e.target.dataset.mi != null ? +e.target.dataset.mi : -1;
        if (mi < 0 || !this._msgs[mi]) return;
        if (e.target.classList.contains("nt-msg-text")) {
          this._msgs[mi].text = e.target.value;
          if (mi === 0) this._updatePreview(root);
        }
        if (e.target.classList.contains("nt-msg-x")) this._msgs[mi].posX = +e.target.value;
        if (e.target.classList.contains("nt-msg-y")) this._msgs[mi].posY = +e.target.value;
      });
      msgsEl.addEventListener("change", e => {
        const mi = e.target.dataset.mi != null ? +e.target.dataset.mi : -1;
        if (mi < 0 || !this._msgs[mi]) return;
        if (e.target.classList.contains("nt-msg-pos")) {
          this._msgs[mi].position = e.target.value;
          this.render(true);
        }
      });
      msgsEl.addEventListener("click", e => {
        if (e.target.dataset.rm != null) {
          this._msgs.splice(+e.target.dataset.rm, 1);
          if (!this._msgs.length) this._msgs.push(this._newMsg());
          this.render(true);
        }
      });
    }

    // Добавить надпись
    root.querySelector("#nt-add")?.addEventListener("click", () => {
      this._msgs.push(this._newMsg());
      this.render(true);
    });

    // Стиль
    root.querySelector("#nt-font")?.addEventListener("change", e => {
      s.font = e.target.value; this._updatePreview(root);
    });
    root.querySelector("#nt-size")?.addEventListener("input", e => {
      s.fontSize = +e.target.value; this._updatePreview(root);
    });
    root.querySelector("#nt-color")?.addEventListener("input", e => {
      s.color = e.target.value; this._updatePreview(root);
    });
    this._bindRange(root, "#nt-opacity", "#nt-opacity-v", v => {
      s.opacity = v; this._updatePreview(root); return Math.round(v * 100) + "%";
    });
    this._bindRange(root, "#nt-maxw", "#nt-maxw-v", v => {
      s.maxWidth = v; return v + "%";
    });
    root.querySelectorAll("[data-align]").forEach(btn =>
      btn.addEventListener("click", () => {
        s.align = btn.dataset.align;
        root.querySelectorAll("[data-align]").forEach(x =>
          x.setAttribute("data-sel", x.dataset.align === s.align ? "1" : "0"));
        this._updatePreview(root);
      })
    );
    root.querySelector("#nt-shadow")?.addEventListener("change", e => s.shadow = e.target.checked);
    root.querySelector("#nt-outline")?.addEventListener("change", e => {
      s.outline = e.target.checked;
      root.querySelector("#nt-outline-color-row").style.display = s.outline ? "" : "none";
    });
    root.querySelector("#nt-outline-color")?.addEventListener("input", e => s.outlineColor = e.target.value);

    // Анимация
    root.querySelectorAll("[data-anim-in]").forEach(btn =>
      btn.addEventListener("click", () => {
        s.animIn = btn.dataset.animIn;
        root.querySelectorAll("[data-anim-in]").forEach(x =>
          x.classList.toggle("selected", x.dataset.animIn === s.animIn));
      })
    );
    root.querySelectorAll("[data-anim-out]").forEach(btn =>
      btn.addEventListener("click", () => {
        s.animOut = btn.dataset.animOut;
        root.querySelectorAll("[data-anim-out]").forEach(x =>
          x.classList.toggle("selected", x.dataset.animOut === s.animOut));
      })
    );
    this._bindRange(root, "#nt-fin",  "#nt-fin-v",  v => { s.fadeInDuration  = v; return v + L("SecondsShort"); });
    this._bindRange(root, "#nt-dur",  "#nt-dur-v",  v => { s.duration        = v; return v + L("SecondsShort"); });
    this._bindRange(root, "#nt-fout", "#nt-fout-v", v => { s.fadeOutDuration = v; return v + L("SecondsShort"); });

    // Отправить
    root.querySelector("#nt-send")?.addEventListener("click", () => this._send());

    // История
    this._addHistoryListeners(root);
  }

  _bindRange(root, rangeId, valId, cb) {
    const range = root.querySelector(rangeId);
    const label = root.querySelector(valId);
    if (!range) return;
    range.addEventListener("input", () => {
      if (label) label.textContent = cb(+range.value);
    });
  }

  _updatePreview(root) {
    const s = this._style;
    const p = root.querySelector("#nt-preview");
    if (!p) return;
    p.style.fontFamily = `"${s.font}", serif`;
    p.style.fontSize   = Math.min(s.fontSize, 36) + "px";
    p.style.color      = s.color;
    p.style.opacity    = String(s.opacity);
    p.style.textAlign  = s.align;
    p.textContent      = this._msgs[0]?.text || L("PreviewPlaceholder");
  }

  _addHistoryListeners(root) {
    root.querySelectorAll("[data-resend]").forEach(btn =>
      btn.addEventListener("click", () => {
        const e = this._history[+btn.dataset.resend];
        if (e) this._emit(e);
      })
    );
    root.querySelectorAll("[data-load]").forEach(btn =>
      btn.addEventListener("click", () => {
        const e = this._history[+btn.dataset.load];
        if (!e) return;
        Object.assign(this._style, e.style);
        this._msgs  = e.messages.map(m => ({ ...m }));
        this._stack = this._msgs.length > 1;
        this.render(true);
      })
    );
    root.querySelectorAll("[data-del]").forEach(btn =>
      btn.addEventListener("click", () => {
        this._history.splice(+btn.dataset.del, 1);
        this._saveHistory();
        const list = root.querySelector("#nt-history");
        if (list) { list.innerHTML = this._buildHistoryHTML(); this._addHistoryListeners(root); }
      })
    );
  }

  _send() {
    const filled = this._msgs.filter(m => m.text.trim());
    if (!filled.length) { ui.notifications.warn(L("EnterText")); return; }

    const entry = {
      style:    { ...this._style },
      messages: filled.map(m => ({ ...m })),
      targets:  this._targets.size > 0 ? [...this._targets] : [],
    };
    this._emit(entry);
    this._history.push(entry);
    if (this._history.length > 50) this._history.shift();
    this._saveHistory();
  }

  _emit(entry) {
    const payload = {
      ...entry.style,
      allowStack: entry.messages.length > 1,
      messages:   entry.messages,
      targets:    entry.targets ?? [],
    };
    displayNarratorText(payload);
    game.socket.emit(SOCKET_EVENT, { type: "showText", data: payload });

    const names = payload.targets.length
      ? game.users.filter(u => payload.targets.includes(u.id)).map(u => u.name).join(", ")
      : L("AllPlayers").toLowerCase();
    ui.notifications.info(`Narrator → ${names}`);
  }

  _saveHistory() {
    localStorage.setItem("narratorTextHistory", JSON.stringify(this._history));
  }
}

/* ══════════════════════════════════════════════════
   ПАНЕЛЬ ИНСТРУМЕНТОВ
══════════════════════════════════════════════════ */

function openApp() {
  if (!game.user.isGM) return;
  // v14: foundry.applications.instances хранит все открытые окна по id
  const existing = foundry.applications.instances.get("narrator-text-app");
  if (existing) {
    existing.close();
  } else {
    new NarratorTextApp().render({ force: true });
  }
}

// v13/v14: controls — plain object { tokens: { tools: {...} }, ... }
// onChange — официальный callback для кнопок-действий (не onClick, не button:true)
Hooks.on("getSceneControlButtons", controls => {
  if (!game.user.isGM) return;
  try {
    const grp = controls.tokens ?? controls.token;
    if (!grp?.tools) {
      console.warn("[narrator-text] Группа токенов не найдена. Ключи:", Object.keys(controls));
      return;
    }
    grp.tools["narrator-text"] = {
      name:    "narrator-text",
      title:   "Narrator Text",
      icon:    "fas fa-scroll",
      visible: true,
      order:   999,
      button:  true,
      onChange: openApp,
    };
  } catch (err) {
    console.error("[narrator-text] Ошибка регистрации кнопки:", err);
  }
});

/* ══════════════════════════════════════════════════
   ИНИЦИАЛИЗАЦИЯ
══════════════════════════════════════════════════ */

Hooks.once("init", () => console.log(`[${MODULE_ID}] init`));

Hooks.once("ready", () => {
  console.log(`[${MODULE_ID}] ready`);
  ensureOverlay();

  game.socket.on(SOCKET_EVENT, msg => {
    if (msg?.type !== "showText" || game.user.isGM) return;
    const targets = msg.data?.targets ?? [];
    if (!targets.length || targets.includes(game.user.id)) {
      displayNarratorText(msg.data);
    }
  });
});
