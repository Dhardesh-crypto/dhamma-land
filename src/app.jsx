const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;

const T = (th, en) => ({ th, en });
const LangCtx = createContext("th");
const useT = () => { const l = useContext(LangCtx); return (x) => (typeof x === "string" ? x : x[l]); };

const IMG = {
  wave: "img/nen-wave.webp", meditate: "img/nen-meditate.webp", think: "img/nen-think.webp",
  jump: "img/nen-jump.webp", tupCrazy: "img/tup-crazy.webp", tupCalm: "img/tup-calm.webp",
  bg: "img/temple-bg.webp", s1: "img/story1.webp", s2: "img/story2.webp", s3: "img/story3.webp", s4: "img/story4.webp",
};

const store = {
  get(k, d) { try { const v = localStorage.getItem("dhamma-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("dhamma-" + k, JSON.stringify(v)); } catch (e) {} },
};

/* ---------- sound ---------- */
let ac = null;
const audio = () => { interacted = true; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) {} return ac; };
let muted = false;
function tone(freq, dur, type = "sine", vol = 0.2, slide = 0) {
  const a = audio(); if (!a || muted) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
}
const sfx = {
  ding() { tone(880, 0.25, "triangle"); setTimeout(() => tone(1320, 0.4, "triangle"), 110); },
  boing() { tone(300, 0.35, "square", 0.08, -180); },
  pop() { tone(600, 0.1, "sine", 0.15, 400); },
  bark() { tone(520, 0.09, "sawtooth", 0.12, -260); setTimeout(() => tone(560, 0.11, "sawtooth", 0.12, -300), 150); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.35, "triangle", 0.18), i * 140)); },
  // plucked string (Karplus-Strong)
  pluck(freq, decay = 0.996, vol = 0.5) {
    const a = audio(); if (!a || muted) return;
    const sr = a.sampleRate, len = Math.floor(sr * 2.2), buf = a.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const n = Math.max(2, Math.floor(sr / freq)); const ring = new Float32Array(n).map(() => Math.random() * 2 - 1);
    for (let i = 0, p = 0; i < len; i++) { const nx = (p + 1) % n; const v = ring[p]; d[i] = v * vol; ring[p] = (v + ring[nx]) * 0.5 * decay; p = nx; }
    const s = a.createBufferSource(); s.buffer = buf; s.connect(a.destination); s.start();
  },
};

// Recorded voices: audio/<key>.mp3 exists for every key in window.__VOICED__ (written by build.py).
const VOICED = new Set(window.__VOICED__ || []);
function voiceKey(lang, text) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(lang + "|" + text)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
let clip = null;
let interacted = false;
function stopVoice() { try { if (clip) { clip.pause(); clip = null; } if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} }
function speak(text, lang) {
  stopVoice(); if (muted) return;
  const k = voiceKey(lang, text);
  if (VOICED.has(k)) { clip = new Audio(`audio/${k}.mp3`); clip.play().catch(() => {}); return; }
  try {
    const ss = window.speechSynthesis; if (!ss) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[“”"']/g, ""));
    u.lang = lang === "th" ? "th-TH" : "en-US"; u.rate = lang === "th" ? 0.95 : 1; u.pitch = 1.25;
    const v = ss.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith(lang)); if (v) u.voice = v;
    ss.speak(u);
  } catch (e) {}
}

const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

/* ---------- small pieces ---------- */
function Lotus({ on = true, size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={on ? "lotus on" : "lotus"}>
      <path d="M20 6c4 5 5 11 0 19-5-8-4-14 0-19z" />
      <path d="M8 13c6 1 10 6 12 12-7 0-12-5-12-12z" />
      <path d="M32 13c-6 1-10 6-12 12 7 0 12-5 12-12z" />
      <path d="M4 24c5-1 11 1 16 4-6 3-13 2-16-4z" />
      <path d="M36 24c-5-1-11 1-16 4 6 3 13 2 16-4z" />
    </svg>
  );
}

function Typed({ text }) {
  const [n, setN] = useState(reduced() ? text.length : 0);
  useEffect(() => {
    if (reduced()) { setN(text.length); return; }
    setN(0); let i = 0;
    const id = setInterval(() => { i += 2; setN(i); if (i >= text.length) clearInterval(id); }, 22);
    return () => clearInterval(id);
  }, [text]);
  return <span>{text.slice(0, n)}<span className="ghost">{text.slice(n)}</span></span>;
}

/* Narrator: a novice monk with a speech bubble. lines = [{th,en,who?}] */
function Narrator({ pose = "wave", lines, onFinish, compact }) {
  const t = useT(); const lang = useContext(LangCtx);
  const [i, setI] = useState(0);
  const key = lines.map((l) => l.th).join("|");
  useEffect(() => { setI(0); }, [key]);
  const line = lines[Math.min(i, lines.length - 1)];
  const last = i >= lines.length - 1;
  const isTup = line.who === "tup";
  useEffect(() => { if (isTup) sfx.bark(); if (last && onFinish) onFinish(); }, [i, key]);
  useEffect(() => { if (interacted) { const id = setTimeout(() => speak(t(line), lang), isTup ? 350 : 0); return () => clearTimeout(id); } }, [i, key, lang]);
  return (
    <div className={"narrator" + (compact ? " compact" : "")}>
      <img className={"nar-img pose-" + pose} src={IMG[pose]} alt={t(T("เณรต้นบุญกับเจ้าตูบ", "Novice Tonboon and Tup the puppy"))} />
      <div className={"bubble" + (isTup ? " tup" : "")} aria-live="polite">
        <div className="who">{isTup ? t(T("เจ้าตูบ", "Tup")) : t(T("เณรต้นบุญ", "Novice Tonboon"))}</div>
        <p className="say"><Typed text={t(line)} /></p>
        <div className="bubble-row">
          <button className="icon-btn" onClick={() => speak(t(line), lang)} aria-label={t(T("ฟังเสียง", "Listen"))} title={t(T("ฟังเสียง", "Listen"))}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" strokeWidth="2" /></svg>
          </button>
          <span className="dots">{lines.length > 1 && lines.map((_, k) => <i key={k} className={k === i ? "cur" : ""} />)}</span>
          {lines.length > 1 && (i > 0) && <button className="btn ghost-btn" onClick={() => setI(i - 1)}>{t(T("◀ ย้อน", "◀ Back"))}</button>}
          {!last && <button className="btn" onClick={() => { sfx.pop(); setI(i + 1); }}>{t(T("ต่อไป ▶", "Next ▶"))}</button>}
        </div>
      </div>
    </div>
  );
}

function Done({ onNext, isLast }) {
  const t = useT();
  return (
    <div className="done-banner" role="status">
      <Lotus size={44} />
      <div>
        <strong>{t(T("ได้ดอกบัวแล้ว!", "You earned a lotus!"))}</strong>
        <span>{t(T("เก่งมาก ไปด่านต่อไปกันเลย", "Great job. On to the next stop!"))}</span>
      </div>
      <button className="btn big" onClick={onNext}>{isLast ? t(T("กลับแผนที่", "Back to map")) : t(T("ด่านต่อไป ▶", "Next stop ▶"))}</button>
    </div>
  );
}

/* ---------- 1. Meet ---------- */
function Meet({ complete }) {
  const lines = [
    T("สวัสดีครับ! ผมชื่อ “เณรต้นบุญ” อายุ 10 ขวบ เท่ากับเพื่อน ๆ เลย", "Hi there! I'm Novice Tonboon. I'm 10 years old, just like you!"),
    T("ส่วนเจ้าก้อนขนตรงนี้ชื่อ “เจ้าตูบ” ชอบไก่ทอด ชอบไล่งับหางตัวเอง และชอบคาบรองเท้าแตะของหลวงพี่ไปซ่อน", "This fluffball is Tup. He loves fried chicken, chasing his own tail, and hiding the monks' sandals."),
    { ...T("โฮ่ง! ผมไม่ได้ซ่อนนะ ผมแค่… ยืมไปเคี้ยว", "Woof! I didn't hide them. I just… borrowed them for chewing."), who: "tup" },
    T("วันนี้เราจะพาไปผจญภัยในแดนธรรมะ เรียนรู้คำสอนของพระพุทธเจ้าแบบสนุก ๆ", "Today we're going on an adventure to learn what the Buddha taught, the fun way."),
    T("ผ่านแต่ละด่าน จะได้ดอกบัว 1 ดอก เก็บให้ครบทุกด่าน แล้วรับใบประกาศไปอวดคุณพ่อคุณแม่ได้เลย!", "Each stop gives you a lotus flower. Collect them all and get a certificate to show your family!"),
    T("พร้อมไหม? เจ้าตูบ… ปล่อยชายจีวรพี่ก่อน! ไปกันเลย!", "Ready? Tup… let go of my robe! Let's go!"),
  ];
  return <div className="solo"><Narrator pose="wave" lines={lines} onFinish={complete} /></div>;
}

/* ---------- 2. Story ---------- */
function Story({ complete }) {
  const t = useT(); const lang = useContext(LangCtx);
  const slides = [
    { img: IMG.s1, title: T("เจ้าชายในวังแสนสบาย", "A prince in a comfy palace"),
      text: T("นานมาแล้วกว่า 2,600 ปี ที่ประเทศอินเดีย มีเจ้าชายชื่อ “สิทธัตถะ” อยู่ในวังที่มีทุกอย่าง ทั้งดนตรี ขนม สวนดอกไม้ แต่เจ้าชายกลับสงสัยว่า “ชีวิตมีแค่นี้เหรอ?”",
        "Over 2,600 years ago in India lived Prince Siddhartha. His palace had everything: music, snacks, flower gardens. Yet he wondered, “Is this all life is?”"),
      tup: T("ถ้าเป็นผม มีไก่ทอดทุกวันก็พอใจแล้วครับ", "If it were me, fried chicken every day would be plenty.") },
    { img: IMG.s2, title: T("เทวทูตทั้ง 4", "The four sights"),
      text: T("วันหนึ่งเจ้าชายออกนอกวัง ได้เห็นคนแก่ คนเจ็บ คนตาย และนักบวชที่ใจสงบ เจ้าชายคิดว่า “ทุกคนต้องแก่ เจ็บ ตาย ต้องมีทางที่ทำให้ใจไม่ทุกข์สิ!”",
        "One day the prince left the palace and saw an old man, a sick man, a funeral, and a calm monk. He thought, “Everyone gets old, sick, and dies. There must be a way to free the heart from suffering!”"),
      tup: T("เหมือนตอนผมเห็นชามข้าวว่าง… ใจหายเลยครับ", "Like when I see my food bowl empty… heartbreaking.") },
    { img: IMG.s3, title: T("ตรัสรู้ใต้ต้นโพธิ์", "Awakening under the Bodhi tree"),
      text: T("เจ้าชายออกบวชและฝึกฝนอยู่ 6 ปี จนคืนวันเพ็ญเดือน 6 ใต้ต้นโพธิ์ ท่านก็ “ตรัสรู้” คือเข้าใจความจริงของชีวิต และเป็น “พระพุทธเจ้า” ซึ่งแปลว่า ผู้รู้ ผู้ตื่น ผู้เบิกบาน",
        "He became a monk and practised for 6 years. On the full moon of the 6th lunar month, under the Bodhi tree, he awakened and understood the truth of life. He became the Buddha: the one who knows, the awake, the joyful."),
      tup: T("ผู้ตื่น… ผมก็ตื่นนะ ตื่นตอนได้ยินเสียงถุงขนม", "Awake… I wake up too. Whenever I hear a snack bag.") },
    { img: IMG.s4, title: T("สอนครั้งแรกที่ป่ากวาง", "First teaching in the Deer Park"),
      text: T("พระพุทธเจ้าไปสอนนักบวช 5 รูป (ปัญจวัคคีย์) ที่ป่ากวาง เป็นการสอนครั้งแรก ตรงกับ “วันอาสาฬหบูชา” จากนั้นท่านก็เดินทางสอนผู้คนอีก 45 ปี",
        "The Buddha taught five monks in the Deer Park. It was his very first teaching, which Thais remember on Asanha Bucha Day. He went on teaching people for 45 more years."),
      tup: T("45 ปี! ผมนั่งฟังได้ 45 วินาทีก็เก่งแล้ว", "45 years! I can only sit still for 45 seconds.") },
  ];
  const [i, setI] = useState(0);
  const [ans, setAns] = useState(null);
  const s = slides[i];
  useEffect(() => { if (interacted) speak(t(s.text), lang); }, [i, lang]);
  const opts = [
    { l: T("วันวิสาขบูชา", "Visakha Bucha Day"), ok: true },
    { l: T("วันสงกรานต์", "Songkran (water festival)") },
    { l: T("วันเกิดเจ้าตูบ", "Tup's birthday") },
  ];
  return (
    <div className="story">
      <figure className="story-card">
        <img src={s.img} alt={t(s.title)} />
        <figcaption>
          <span className="pill">{t(T("ตอนที่", "Part"))} {i + 1}/4</span>
          <h3>{t(s.title)}</h3>
          <p>{t(s.text)}</p>
          <button className="tup-line" onClick={() => { sfx.bark(); setTimeout(() => speak(t(s.tup), lang), 300); }}><b>{t(T("เจ้าตูบ:", "Tup:"))}</b> {t(s.tup)}</button>
          <div className="row">
            <button className="btn ghost-btn" disabled={i === 0} onClick={() => setI(i - 1)}>{t(T("◀ ก่อนหน้า", "◀ Previous"))}</button>
            <button className="btn ghost-btn" onClick={() => speak(t(s.text), lang)}>{t(T("ฟังเสียง", "Listen"))}</button>
            {i < 3 && <button className="btn" onClick={() => { sfx.pop(); setI(i + 1); }}>{t(T("ถัดไป ▶", "Next ▶"))}</button>}
          </div>
        </figcaption>
      </figure>
      {i === 3 && (
        <div className="quiz-box">
          <h3>{t(T("คำถามชิงดอกบัว: วันที่พระพุทธเจ้าตรัสรู้ ตรงกับวันอะไร?", "Lotus question: on which Thai holy day do we remember the Buddha's awakening?"))}</h3>
          <div className="choices">
            {opts.map((o, k) => (
              <button key={k} className={"choice" + (ans === k ? (o.ok ? " right" : " wrong") : "")}
                onClick={() => { setAns(k); if (o.ok) { sfx.ding(); complete(); } else sfx.boing(); }}>{t(o.l)}</button>
            ))}
          </div>
          {ans != null && <p className="feedback">{opts[ans].ok
            ? t(T("ถูกต้อง! วันวิสาขบูชา คือวันประสูติ ตรัสรู้ และปรินิพพาน ตรงกันทั้ง 3 เหตุการณ์ในวันเพ็ญเดือน 6", "Correct! Visakha Bucha marks the Buddha's birth, awakening and passing, all on the full moon of the 6th month."))
            : ans === 2 ? t(T("โฮ่ง! วันเกิดผมไม่ใช่ แต่ขอบคุณที่คิดถึงนะ ลองใหม่!", "Woof! Not my birthday, but thanks for thinking of me. Try again!"))
            : t(T("สงกรานต์คือวันปีใหม่ไทย สาดน้ำสนุก แต่ยังไม่ใช่ ลองใหม่นะ", "Songkran is Thai New Year, with water fights. Not this one, try again!"))}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- 3. Three Jewels ---------- */
function Jewels({ complete }) {
  const t = useT();
  const gems = [
    { name: T("พระพุทธ", "The Buddha"), color: "gold", tag: T("ครูผู้ค้นพบทาง", "The teacher who found the way"),
      text: T("เหมือนโค้ชที่เคยเดินทางนี้มาก่อน แล้วกลับมาบอกเราว่า “ทางนี้ไปได้ ไม่หลงแน่นอน”", "Like a coach who walked the path first and came back to tell us: “This way works. You won't get lost.”") },
    { name: T("พระธรรม", "The Dhamma"), color: "blue", tag: T("คำสอนของพระพุทธเจ้า", "The Buddha's teachings"),
      text: T("เหมือนแผนที่ หรือสูตรทำขนม บอกว่าต้องทำอะไร ทีละขั้น ใจถึงจะเป็นสุข", "Like a map, or a recipe: what to do, step by step, so the heart can be happy.") },
    { name: T("พระสงฆ์", "The Sangha"), color: "saffron", tag: T("ผู้ปฏิบัติและสืบทอดคำสอน", "Those who practise and pass it on"),
      text: T("เหมือนพี่ ๆ ในทีม ที่ฝึกตามแผนที่และช่วยสอนรุ่นน้อง อย่างหลวงพี่ที่วัดไงล่ะ", "Like older teammates who follow the map and help the younger ones, such as the monks at your local temple.") },
  ];
  const [open, setOpen] = useState([false, false, false]);
  const all = open.every(Boolean);
  useEffect(() => { if (all) { sfx.fanfare(); complete(); } }, [all]);
  return (
    <div className="split">
      <Narrator pose="think" compact lines={[
        T("พระรัตนตรัย แปลว่า “แก้ว 3 ดวง” เป็นสิ่งที่มีค่าที่สุดของชาวพุทธ", "The Triple Gem means “three precious jewels”. They're the most valuable things for Buddhists."),
        T("ลองแตะแก้วแต่ละดวงให้ส่องแสงดูสิ ครบ 3 ดวงได้ดอกบัว!", "Tap each jewel to make it shine. Light up all 3 to earn a lotus!"),
        { ...T("ผมก็มีแก้ว 3 ดวงนะ: ไก่ทอด ลูกบอล และพี่เณร… เรียงตามนั้นเลย", "I have 3 jewels too: fried chicken, my ball, and Tonboon… in that order."), who: "tup" },
      ]} />
      <div className="gems">
        {gems.map((g, k) => (
          <button key={k} className={"gem-card gem-" + g.color + (open[k] ? " lit" : "")}
            onClick={() => { sfx.ding(); setOpen((o) => o.map((v, j) => (j === k ? true : v))); }} aria-expanded={open[k]}>
            <svg className="gem" viewBox="0 0 60 60" aria-hidden="true"><path d="M14 8h32l12 16-28 30L2 24z" /><path d="M2 24h56M14 8l8 16 8-16 8 16 8-16M22 24l8 30 8-30" fill="none" /></svg>
            <span className="gem-name">{t(g.name)}</span>
            <span className="gem-tag">{open[k] ? t(g.tag) : t(T("แตะเพื่อดู", "Tap to reveal"))}</span>
            {open[k] && <span className="gem-text">{t(g.text)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- 4. Five Precepts ---------- */
const PRECEPTS = [
  T("ไม่ทำร้ายหรือฆ่าสัตว์", "Don't hurt or kill living beings"),
  T("ไม่ลักขโมย ไม่เอาของที่เขาไม่ได้ให้", "Don't steal or take what isn't given"),
  T("เคารพร่างกายของตัวเองและผู้อื่น", "Respect your own body and other people's"),
  T("ไม่พูดโกหก", "Don't lie"),
  T("ไม่ดื่มเหล้า ไม่ใช้สิ่งเสพติด", "No alcohol or drugs that cloud the mind"),
];
function Precepts({ complete }) {
  const t = useT();
  const cards = [
    { s: T("แอบหยิบยางลบรูปแมวของน้องมาใช้ แล้วไม่คืน", "Secretly take your sister's cat-shaped eraser and never give it back"), good: false, p: 1,
      f: T("ผิดศีลข้อ 2 แม้ยางลบจะน่ารักแค่ไหน ก็ต้องขอก่อนนะ", "Breaks precept 2. No matter how cute the eraser is, ask first!") },
    { s: T("เห็นมดตกลงในแก้วน้ำ เลยเอาใบไม้ช่วยตักขึ้นมา", "See an ant drowning in a glass and scoop it out with a leaf"), good: true, p: 0,
      f: T("ดีมาก! นี่คือความเมตตา ตรงข้ามกับการทำร้ายสัตว์ (ข้อ 1)", "Lovely! That's kindness, the opposite of harming (precept 1).") },
    { s: T("เอาไม้ไปเขี่ยรังมดเล่น ให้มันวิ่งวุ่น", "Poke an anthill with a stick to watch the ants panic"), good: false, p: 0,
      f: T("ผิดศีลข้อ 1 มดก็กลัวเจ็บเหมือนเรานะ", "Breaks precept 1. Ants don't want to get hurt either.") },
    { s: T("ทำแจกันของแม่แตก แล้วบอกว่าเจ้าตูบทำ", "Break Mum's vase and say Tup did it"), good: false, p: 3,
      f: T("ผิดศีลข้อ 4! เจ้าตูบประท้วง: “โฮ่ง! ใส่ร้ายหมาไม่ได้นะ!”", "Breaks precept 4! Tup protests: “Woof! Don't blame the dog!”") },
    { s: T("เก็บกระเป๋าสตางค์ได้ที่โรงเรียน แล้วเอาไปคืนครู", "Find a wallet at school and hand it to the teacher"), good: true, p: 1,
      f: T("เยี่ยม! ซื่อสัตย์ ไม่เอาของที่ไม่ใช่ของเรา (ข้อ 2)", "Great! Honest, and didn't take what isn't yours (precept 2).") },
    { s: T("พี่ข้างบ้านยื่นบุหรี่ไฟฟ้าให้ลอง เราบอกว่า “ไม่เอา ขอบคุณ”", "An older kid offers you a vape and you say “No thanks”"), good: true, p: 4,
      f: T("ถูกต้อง! ใจกับร่างกายเราสำคัญ ไม่ลองสิ่งเสพติด (ข้อ 5)", "Right! Your mind and body matter. Say no to things that cloud them (precept 5).") },
    { s: T("เพื่อนบอกว่าไม่อยากให้กอด เราก็หยุดและเคารพเขา", "A friend says they don't want a hug, so you stop and respect that"), good: true, p: 2,
      f: T("ดีมาก! ร่างกายของใครก็เป็นของคนนั้น (ข้อ 3)", "Well done! Everyone's body belongs to them (precept 3).") },
    { s: T("บอกเพื่อนตรง ๆ ว่าเราเผลอกินขนมของเขาไป แล้วขอโทษ", "Tell your friend you ate their snack by mistake, and say sorry"), good: true, p: 3,
      f: T("เก่งมาก! พูดความจริงแม้จะยาก (ข้อ 4)", "Brave! Telling the truth even when it's hard (precept 4).") },
  ];
  const [i, setI] = useState(0);
  const [res, setRes] = useState(null);
  const [score, setScore] = useState(0);
  const finished = i >= cards.length;
  useEffect(() => { if (finished) { sfx.fanfare(); complete(); } }, [finished]);
  const c = cards[i];
  const pick = (g) => {
    if (res) return; const ok = g === c.good; setRes({ ok }); if (ok) { setScore(score + 1); sfx.ding(); } else sfx.boing();
  };
  return (
    <div className="split">
      <div className="stack">
        <Narrator pose="wave" compact lines={[
          T("ศีล 5 คือ 5 ข้อตกลงกับตัวเอง ที่ช่วยให้เราและคนรอบตัวอยู่อย่างปลอดภัยและมีความสุข", "The Five Precepts are 5 promises to yourself that keep you and everyone around you safe and happy."),
          T("มาเล่นเกมกัน! อ่านสถานการณ์ แล้วตัดสินว่า “ทำดี” หรือ “ผิดศีล”", "Let's play! Read each situation and decide: good deed, or breaks a precept?"),
        ]} />
        <ol className="precepts">{PRECEPTS.map((p, k) => <li key={k} className={c && res && c.p === k ? "hl" : ""}><b>{k + 1}</b>{t(p)}</li>)}</ol>
      </div>
      <div className="game">
        <div className="game-head"><span className="pill">{t(T("การ์ด", "Card"))} {Math.min(i + 1, cards.length)}/{cards.length}</span><span className="pill score">{t(T("ตอบถูก", "Correct"))} {score}</span></div>
        {!finished ? (
          <div className={"scenario" + (res ? (res.ok ? " right" : " wrong") : "")}>
            <p className="scn">{t(c.s)}</p>
            {!res ? (
              <div className="row center">
                <button className="btn good big" onClick={() => pick(true)}>{t(T("ทำดี", "Good deed"))}</button>
                <button className="btn bad big" onClick={() => pick(false)}>{t(T("ผิดศีล", "Breaks a precept"))}</button>
              </div>
            ) : (
              <>
                <p className="feedback"><b>{res.ok ? t(T("ถูกต้อง! ", "Correct! ")) : t(T("อุ๊ย ยังไม่ใช่ ", "Oops, not quite. "))}</b>{t(c.f)}</p>
                <button className="btn big" onClick={() => { setRes(null); setI(i + 1); }}>{t(T("การ์ดต่อไป ▶", "Next card ▶"))}</button>
              </>
            )}
          </div>
        ) : (
          <div className="scenario right"><p className="scn">{t(T(`ครบแล้ว! ตอบถูก ${score} จาก ${cards.length} ข้อ`, `All done! ${score} out of ${cards.length} correct`))}</p>
            <p className="feedback">{t(T("ศีลไม่ใช่กฎที่ใครบังคับ แต่เป็นเกราะที่เราเลือกใส่เอง เพื่อให้ใจสบาย ไม่ต้องกลัวใครจับได้", "Precepts aren't rules someone forces on you. They're armour you choose to wear, so your heart feels light and you never have to worry about getting caught."))}</p></div>
        )}
      </div>
    </div>
  );
}

/* ---------- 5. Middle Way ---------- */
function MiddleWay({ complete }) {
  const t = useT();
  const [ten, setTen] = useState(15);
  const [broken, setBroken] = useState(false);
  const [msg, setMsg] = useState(null);
  const [found, setFound] = useState(false);
  const zone = ten < 38 ? "loose" : ten > 68 ? "tight" : "just";
  const sag = Math.max(0, (60 - ten) * 0.9);
  const pluck = () => {
    if (broken) return;
    if (zone === "loose") { sfx.pluck(70, 0.9, 0.6); setMsg(T("ปึ้ง… เสียงยานคาง เหมือนเจ้าตูบหาว", "Thwump… a saggy sound, like Tup yawning.")); }
    else if (zone === "tight") {
      if (ten > 85) { sfx.pluck(1400, 0.95, 0.5); setTimeout(() => tone(200, 0.3, "sawtooth", 0.2, -150), 60); setBroken(true); setMsg(T("เป๊าะ! สายขาดเลย ตึงเกินไป", "SNAP! The string broke. Too tight!")); }
      else { sfx.pluck(900, 0.985, 0.45); setMsg(T("แป๊น! เสียงแหลมเสียดหู ระวังจะขาดนะ", "Pyiing! Shrill and scary. It might snap!")); }
    } else { sfx.pluck(330, 0.997, 0.5); setMsg(T("ติ๊ง~ เพราะมาก! นี่แหละ “พอดี”", "Ting~ Beautiful! That's “just right”.")); if (!found) { setFound(true); complete(); } }
  };
  return (
    <div className="split">
      <Narrator pose="think" compact lines={[
        T("ก่อนตรัสรู้ เจ้าชายเคยลองอดอาหารจนผอมมาก แต่ก็ไม่เจอคำตอบ", "Before awakening, the prince tried starving himself until he was very thin, but found no answer."),
        T("คนไทยเล่าว่า ตอนนั้นพระอินทร์มาดีดพิณ 3 สาย: สายหย่อนเกินไปเสียงไม่เพราะ สายตึงเกินไปก็ขาด สายที่ขึงพอดีเสียงไพเราะที่สุด", "Thais tell how the god Indra played a 3-string lute: too loose sounded dull, too tight snapped, and the one tuned just right sang beautifully."),
        T("ท่านจึงเข้าใจ “ทางสายกลาง” คือไม่สบายเกินไป และไม่ทรมานตัวเองเกินไป ลองหมุนลูกบิดหาเสียงที่พอดีดูสิ!", "So he understood the Middle Way: not too comfy, not too harsh. Try tuning the string to find the sweet spot!"),
      ]} />
      <div className="lute-box">
        <svg className="lute" viewBox="0 0 400 140" role="img" aria-label="string">
          <rect x="6" y="40" width="22" height="60" rx="6" className="peg" />
          <rect x="372" y="40" width="22" height="60" rx="6" className="peg" />
          {!broken ? <path d={`M28 70 Q200 ${70 + sag * 1.4} 372 70`} className={"str " + zone} />
            : <><path d="M28 70 Q110 95 170 120" className="str tight" /><path d="M372 70 Q300 100 250 125" className="str tight" /></>}
        </svg>
        <label className="knob" htmlFor="tension">{t(T("ความตึงของสาย", "String tension"))}
          <input id="tension" type="range" min="0" max="100" value={ten} disabled={broken} onChange={(e) => setTen(+e.target.value)} />
          <span className="scale"><span>{t(T("หย่อน", "loose"))}</span><span>{t(T("พอดี", "just right"))}</span><span>{t(T("ตึง", "tight"))}</span></span>
        </label>
        <div className="row center">
          {!broken ? <button className="btn big" onClick={pluck}>{t(T("ดีดสาย!", "Pluck!"))}</button>
            : <button className="btn big" onClick={() => { setBroken(false); setTen(50); setMsg(T("เปลี่ยนสายใหม่ให้แล้ว คราวนี้ลองขึงพอดี ๆ นะ", "New string fitted. Try just right this time!")); }}>{t(T("ใส่สายใหม่", "New string"))}</button>}
        </div>
        {msg && <p className={"feedback " + zone}>{t(msg)}</p>}
        {found && (
          <div className="balance">
            <h4>{t(T("ทางสายกลางในชีวิตเรา", "The Middle Way in everyday life"))}</h4>
            <ul>
              <li><b>{t(T("ขนม", "Snacks"))}</b>{t(T("ไม่กินเลยก็หิว กินหมดถุงก็ปวดท้อง กินพอดีอร่อยสุด", "None and you're hungry, the whole bag and your tummy hurts. Just enough tastes best."))}</li>
              <li><b>{t(T("เกม", "Games"))}</b>{t(T("เล่นทั้งคืนก็ง่วง ห้ามเล่นเลยก็เครียด เล่นพอดีแล้วไปทำการบ้าน", "All night and you're a zombie, never and you're grumpy. Play a bit, then homework."))}</li>
              <li><b>{t(T("อ่านหนังสือ", "Studying"))}</b>{t(T("ไม่อ่านเลยก็สอบตก อ่านจนไม่นอนก็สมองเบลอ", "No study and you fail, no sleep and your brain turns to mush."))}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- 6. Puppy mind (mindfulness) ---------- */
const DISTRACT = [T("ไก่ทอด!", "Fried chicken!"), T("การ์ตูนตอนใหม่!", "New cartoon!"), T("การบ้านเลข!", "Maths homework!"), T("แมวข้างบ้าน!", "The neighbour's cat!"), T("ไอติม!", "Ice cream!"), T("เกมมือถือ!", "Phone game!"), T("เพื่อนเรียก!", "A friend calling!"), T("ยุงกัด!", "Mosquito bite!")];
function Mind({ complete }) {
  const t = useT();
  const GOAL = 5;
  const [run, setRun] = useState(false);
  const [phase, setPhase] = useState("in");
  const [breaths, setBreaths] = useState(0);
  const [bubbles, setBubbles] = useState([]);
  const [letGo, setLetGo] = useState(0);
  const calm = Math.min(1, (breaths + letGo * 0.25) / GOAL);
  const done = breaths >= GOAL;
  useEffect(() => {
    if (!run || done) return;
    const id = setInterval(() => setPhase((p) => { if (p === "out") setBreaths((b) => b + 1); return p === "in" ? "out" : "in"; }), 4000);
    return () => clearInterval(id);
  }, [run, done]);
  useEffect(() => {
    if (!run || done) return;
    const id = setInterval(() => setBubbles((bs) => bs.length > 2 ? bs : [...bs, { id: Math.random(), w: DISTRACT[Math.floor(Math.random() * DISTRACT.length)], x: 5 + Math.random() * 65, y: 8 + Math.random() * 60 }]), 2600);
    return () => clearInterval(id);
  }, [run, done]);
  useEffect(() => { if (done) { setRun(false); setBubbles([]); sfx.fanfare(); complete(); } }, [done]);
  useEffect(() => { if (run) phase === "in" ? tone(392, 0.6, "sine", 0.06) : tone(294, 0.6, "sine", 0.06); }, [phase, run]);
  return (
    <div className="split">
      <Narrator pose="meditate" compact lines={[
        T("รู้ไหม ใจของเราเหมือนลูกหมา ชอบวิ่งไปโน่นมานี่ ได้กลิ่นอะไรก็วิ่งตาม", "Did you know your mind is like a puppy? It runs here and there, chasing every smell."),
        T("เราไม่ต้องดุมัน แค่ค่อย ๆ พากลับมาบ้าน ทุกครั้งที่มันวิ่งไป การรู้ตัวแบบนี้เรียกว่า “สติ”", "No need to scold it. Just gently bring it home each time it runs off. Noticing like this is called mindfulness (sati)."),
        T("กดเริ่ม แล้วหายใจตามวงกลม หายใจเข้าว่า “พุท” หายใจออกว่า “โธ” ถ้ามีความคิดลอยมา แตะมันเบา ๆ ให้ลอยไป", "Press start and breathe with the circle: in, “Bud”, out, “dho”. If a thought floats by, tap it gently and let it drift away."),
        { ...T("ผมไม่ได้ฟุ้งซ่านนะ! ผมแค่… เอ๊ะ นั่นกลิ่นไก่ทอดหรือเปล่า?!", "I'm not distracted! I'm just… wait, is that fried chicken?!"), who: "tup" },
      ]} />
      <div className="mind">
        <div className="mind-stage">
          <img className="tup crazy" src={IMG.tupCrazy} alt="" style={{ opacity: 1 - calm }} />
          <img className="tup calm" src={IMG.tupCalm} alt={t(T("เจ้าตูบ", "Tup"))} style={{ opacity: calm }} />
          {bubbles.map((b) => (
            <button key={b.id} className="thought" style={{ left: b.x + "%", top: b.y + "%" }}
              onClick={() => { sfx.pop(); setLetGo(letGo + 1); setBubbles(bubbles.filter((x) => x.id !== b.id)); }}>{t(b.w)}</button>
          ))}
        </div>
        <div className={"breath " + (run ? phase : "idle")} aria-live="polite">
          <span>{done ? t(T("สงบแล้ว", "Calm")) : run ? (phase === "in" ? t(T("หายใจเข้า… พุท", "Breathe in… Bud")) : t(T("หายใจออก… โธ", "Breathe out… dho"))) : t(T("พร้อม", "Ready"))}</span>
        </div>
        <div className="meter" aria-label="calm"><i style={{ width: calm * 100 + "%" }} /></div>
        <p className="center-text">{t(T(`หายใจครบ ${Math.min(breaths, GOAL)}/${GOAL} รอบ · ปล่อยความคิด ${letGo} ครั้ง`, `Breaths ${Math.min(breaths, GOAL)}/${GOAL} · thoughts let go ${letGo}`))}</p>
        <div className="row center">
          {!done ? <button className="btn big" onClick={() => { audio(); setRun(!run); }}>{run ? t(T("พักก่อน", "Pause")) : t(T("เริ่มหายใจ", "Start breathing"))}</button>
            : <p className="feedback just">{t(T("เจ้าตูบนั่งนิ่งแล้ว! ฝึกแบบนี้ก่อนนอนหรือก่อนสอบ วันละนิดก็ได้ผล", "Tup is sitting still! Try this before bed or a test. A little each day helps."))}</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------- 7. Four Noble Truths ---------- */
function Truths({ complete }) {
  const t = useT();
  const truths = [
    { n: T("ทุกข์", "Dukkha"), q: T("ป่วยเป็นอะไร?", "What's wrong?"), m: T("ความทุกข์ ความไม่สบายกายไม่สบายใจ", "Suffering: when body or heart doesn't feel okay"),
      tup: T("เจ้าตูบปวดท้องร้องโอ๊ย", "Tup has a terrible tummy ache"), life: T("เสียใจ ผิดหวัง โกรธ เหงา", "Feeling sad, let down, angry, lonely") },
    { n: T("สมุทัย", "Samudaya"), q: T("เพราะอะไร?", "What caused it?"), m: T("เหตุของทุกข์ คือความอยากไม่รู้จักพอ (ตัณหา)", "The cause: wanting without ever feeling it's enough (craving)"),
      tup: T("อยากกินไก่ทอดไม่หยุด 12 ชิ้น!", "Couldn't stop wanting fried chicken: 12 pieces!"), life: T("อยากได้ อยากเป็น อยากให้ทุกอย่างเป็นอย่างใจ", "Wanting things, wanting everything our way") },
    { n: T("นิโรธ", "Nirodha"), q: T("หายได้ไหม?", "Can it be cured?"), m: T("ทุกข์ดับได้ เมื่อดับที่สาเหตุ", "Yes! Suffering ends when its cause ends"),
      tup: T("หายปวดได้แน่นอน ถ้าเลิกกินเกิน", "The ache goes away once he stops overeating"), life: T("ใจกลับมาเบาสบาย", "The heart feels light again") },
    { n: T("มรรค", "Magga"), q: T("ยาคืออะไร?", "What's the medicine?"), m: T("ทางดับทุกข์ มรรคมีองค์ 8 สรุปง่าย ๆ คือ ศีล สมาธิ ปัญญา", "The path: the Noble Eightfold Path, in short: good conduct, a calm mind, wisdom"),
      tup: T("กินพอดี ฟังคุณหมอ วิ่งเล่นบ้าง", "Eat just enough, listen to the vet, go play"), life: T("ทำดี ฝึกใจให้สงบ คิดให้เข้าใจ", "Do good, calm the mind, understand clearly") },
  ];
  const order = useMemo(() => [2, 0, 3, 1], []);
  const [picked, setPicked] = useState([]);
  const [wrong, setWrong] = useState(null);
  const done = picked.length === 4;
  useEffect(() => { if (done) { sfx.fanfare(); complete(); } }, [done]);
  const tap = (k) => {
    if (picked.includes(k)) return;
    if (k === picked.length) { sfx.ding(); setPicked([...picked, k]); setWrong(null); } else { sfx.boing(); setWrong(k); }
  };
  return (
    <div className="split">
      <Narrator pose="think" compact lines={[
        T("วันนี้ผมขอเป็น “คุณหมอเณร” ครับ เพราะพระพุทธเจ้าสอนอริยสัจ 4 เหมือนหมอรักษาคนไข้เลย", "Today I'm Doctor Novice! The Buddha taught the Four Noble Truths the way a doctor treats a patient."),
        { ...T("คุณหมอครับ… ผมกินไก่ทอดไป 12 ชิ้น… โอ๊ยยย ท้องจะระเบิดแล้ว", "Doctor… I ate 12 pieces of fried chicken… ooooh, my tummy's going to explode."), who: "tup" },
        T("หมอที่เก่งจะทำ 4 ขั้นตามลำดับ ลองแตะการ์ดให้ถูกลำดับ ขั้นที่ 1 ถึง 4 ดูสิ!", "A good doctor works in 4 steps, in order. Tap the cards in the right order, step 1 to 4!"),
      ]} />
      <div className="truths">
        {order.map((k) => {
          const x = truths[k]; const pos = picked.indexOf(k);
          return (
            <button key={k} className={"truth" + (pos >= 0 ? " open" : "") + (wrong === k ? " shake" : "")} onClick={() => tap(k)}>
              {pos >= 0 ? (
                <>
                  <span className="step">{pos + 1}</span>
                  <span className="t-name">{t(x.n)}</span>
                  <span className="t-mean">{t(x.m)}</span>
                  <span className="t-ex"><b>{t(T("เจ้าตูบ:", "Tup:"))}</b> {t(x.tup)}</span>
                  <span className="t-ex"><b>{t(T("ชีวิตเรา:", "Our life:"))}</b> {t(x.life)}</span>
                </>
              ) : (
                <>
                  <span className="step q">?</span>
                  <span className="t-q">{t(x.q)}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      {wrong != null && !done && <p className="feedback tight full">{t(T("ยังไม่ใช่ขั้นนี้ หมอต้องรู้ก่อนว่าป่วยเป็นอะไร แล้วค่อยหาสาเหตุ หาทางหาย และให้ยา", "Not that step yet. A doctor first finds what's wrong, then the cause, then whether it can be cured, then the medicine."))}</p>}
    </div>
  );
}

/* ---------- 8. Karma garden ---------- */
function Karma({ complete }) {
  const t = useT();
  const acts = [
    { a: T("ช่วยแม่ล้างจาน", "Help Mum wash the dishes"), g: true },
    { a: T("แกล้งดึงหางแมว", "Pull the cat's tail"), g: false },
    { a: T("แบ่งขนมให้เพื่อน", "Share snacks with a friend"), g: true },
    { a: T("พูดจาเพราะกับคุณยาย", "Speak kindly to Grandma"), g: true },
    { a: T("ลอกการบ้านเพื่อน", "Copy a friend's homework"), g: false },
    { a: T("รดน้ำต้นไม้", "Water the plants"), g: true },
    { a: T("หัวเราะเยาะเพื่อนที่ล้ม", "Laugh at a friend who fell"), g: false },
    { a: T("ใส่บาตรตอนเช้ากับครอบครัว", "Give alms to the monks with family"), g: true },
    { a: T("ให้อาหารเจ้าตูบ", "Feed Tup"), g: true },
  ];
  const [garden, setGarden] = useState([]);
  const flowers = garden.filter((x) => x.g).length;
  const done = flowers >= 6;
  useEffect(() => { if (done) { sfx.fanfare(); complete(); } }, [done]);
  const [last, setLast] = useState(null);
  return (
    <div className="split">
      <Narrator pose="wave" compact lines={[
        T("“กรรม” แปลว่า การกระทำ ทั้งที่ทำด้วยมือ พูดด้วยปาก และคิดด้วยใจ", "Karma just means action: what we do with our hands, say with our mouths, and think in our hearts."),
        T("ทุกการกระทำเหมือนการปลูกเมล็ด ทำดีได้ดอกไม้ ทำไม่ดีได้ต้นหนาม ลองเลือกการกระทำแล้วดูสวนของเราโตสิ!", "Every action plants a seed. Good ones grow flowers, unkind ones grow thorns. Pick actions and watch your garden grow!"),
        T("ปลูกดอกไม้ให้ได้ 6 ดอก รับดอกบัวไปเลย", "Grow 6 flowers to earn a lotus."),
      ]} />
      <div className="karma">
        <div className="garden" aria-label="garden">
          {garden.length === 0 && <span className="empty">{t(T("สวนยังว่างอยู่… เลือกการกระทำด้านล่างเพื่อปลูก", "Your garden is empty… pick an action below to plant."))}</span>}
          {garden.map((p, k) => (
            <svg key={k} className={"plant " + (p.g ? "flower" : "thorn")} viewBox="0 0 40 60" aria-hidden="true">
              <path d="M20 58V28" className="stem" />
              {p.g ? (<g><circle cx="20" cy="18" r="6" className="core" />{[0, 60, 120, 180, 240, 300].map((r) => <ellipse key={r} cx="20" cy="8" rx="5" ry="8" className="petal" transform={`rotate(${r} 20 18)`} />)}<circle cx="20" cy="18" r="5" className="core" /><path d="M20 44c-6-6-12-4-12-4 3 6 12 4 12 4z" className="leaf" /></g>)
                : (<g><path d="M20 30l-9-4 9-2-7-9 8 4 0-11 3 10 7-6-4 9 10 1-10 4z" className="spike" /><path d="M20 44l-8-3M20 50l8-3M20 38l7-2" className="thornline" /></g>)}
            </svg>
          ))}
        </div>
        <p className="center-text"><b>{t(T("ดอกไม้", "Flowers"))} {flowers}</b> · {t(T("ต้นหนาม", "Thorns"))} {garden.length - flowers}</p>
        {last && <p className={"feedback " + (last.g ? "just" : "tight")}>{last.g ? t(T("ปลูกดอกไม้ 1 ดอก! ทำดี ใจก็ฟู", "A flower sprouts! Good deeds make the heart bloom.")) : t(T("ต้นหนามงอก… ปลูกแล้วถอนไม่ได้ แต่เราปลูกดอกไม้เพิ่มได้เสมอ และครั้งหน้าเลือกใหม่ได้", "A thorn bush grows… you can't unplant it, but you can always plant more flowers, and choose differently next time."))}</p>}
        <div className="acts">
          {acts.map((x, k) => (
            <button key={k} className="act" disabled={done} onClick={() => { x.g ? sfx.ding() : sfx.boing(); setLast(x); setGarden([...garden, x]); }}>{t(x.a)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- 9. Final quiz + certificate ---------- */
function Final({ complete, lotuses, total, name, setName }) {
  const t = useT();
  const qs = [
    { q: T("พระพุทธเจ้าเดิมเป็นใคร?", "Who was the Buddha before he awakened?"), o: [T("เจ้าชายสิทธัตถะ", "Prince Siddhartha"), T("พ่อค้าขายไก่ทอด", "A fried-chicken seller"), T("นักบินอวกาศ", "An astronaut")], a: 0 },
    { q: T("พระรัตนตรัยมีอะไรบ้าง?", "What is the Triple Gem?"), o: [T("ทอง เงิน เพชร", "Gold, silver, diamonds"), T("พระพุทธ พระธรรม พระสงฆ์", "Buddha, Dhamma, Sangha"), T("ไก่ทอด ลูกบอล เณร", "Chicken, ball, novice")], a: 1 },
    { q: T("โทษเจ้าตูบว่าทำแจกันแตก ทั้งที่เราทำเอง ผิดศีลข้อไหน?", "Blaming Tup for a vase you broke breaks which precept?"), o: [T("ข้อ 1 ไม่ทำร้ายสัตว์", "1: don't harm"), T("ข้อ 4 ไม่พูดโกหก", "4: don't lie"), T("ข้อ 5 ไม่ดื่มเหล้า", "5: no alcohol")], a: 1 },
    { q: T("ทางสายกลางเหมือนสายพิณแบบไหน?", "The Middle Way is like a string that is…"), o: [T("หย่อนสุด ๆ", "super loose"), T("ตึงจนขาด", "tight enough to snap"), T("ขึงพอดี", "tuned just right")], a: 2 },
    { q: T("เวลาใจวิ่งไปคิดเรื่องอื่น ควรทำอย่างไร?", "When your mind wanders off, what should you do?"), o: [T("ดุตัวเองแรง ๆ", "Scold yourself"), T("ค่อย ๆ พากลับมาที่ลมหายใจ", "Gently come back to the breath"), T("ไปหาไก่ทอดกิน", "Go find fried chicken")], a: 1 },
    { q: T("สาเหตุของทุกข์ (สมุทัย) คืออะไร?", "What causes suffering (samudaya)?"), o: [T("ความอยากไม่รู้จักพอ", "Craving that's never satisfied"), T("ฝนตก", "Rain"), T("การบ้าน", "Homework")], a: 0 },
  ];
  const [ans, setAns] = useState({});
  const right = qs.filter((q, k) => ans[k] === q.a).length;
  const allRight = right === qs.length;
  useEffect(() => { if (allRight) { sfx.fanfare(); complete(); } }, [allRight]);
  return (
    <div className="final">
      <div className="quiz-list">
        {qs.map((q, k) => (
          <div key={k} className="quiz-box">
            <h3><span className="qn">{k + 1}</span>{t(q.q)}</h3>
            <div className="choices">
              {q.o.map((o, j) => (
                <button key={j} className={"choice" + (ans[k] === j ? (j === q.a ? " right" : " wrong") : "")}
                  onClick={() => { setAns({ ...ans, [k]: j }); j === q.a ? sfx.ding() : sfx.boing(); }}>{t(o)}</button>
              ))}
            </div>
          </div>
        ))}
        <p className="center-text"><b>{t(T(`ตอบถูก ${right}/${qs.length} ข้อ`, `${right}/${qs.length} correct`))}</b>{!allRight && " · " + t(T("ตอบให้ถูกครบทุกข้อเพื่อรับใบประกาศ", "Get them all right to unlock your certificate"))}</p>
      </div>
      {allRight && (
        <div className="cert">
          <img className="cert-nen" src={IMG.jump} alt="" />
          <label htmlFor="kidname" className="name-label">{t(T("เขียนชื่อของหนูตรงนี้", "Write your name here"))}</label>
          <input id="kidname" className="name-in" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={t(T("ชื่อเล่น", "Your name"))} />
          <div className="cert-paper">
            <span className="cert-eyebrow">{t(T("ใบประกาศเกียรติคุณ", "Certificate of Merit"))}</span>
            <h2>{name || t(T("นักผจญภัยตัวน้อย", "Little Adventurer"))}</h2>
            <p>{t(T("ได้ผ่านการผจญภัยในแดนธรรมะ กับเณรต้นบุญและเจ้าตูบ เป็น “บัณฑิตน้อยแดนธรรมะ”", "has completed the Dhamma Land adventure with Novice Tonboon and Tup, and is now a “Little Dhamma Scholar”."))}</p>
            <div className="cert-lotus">{Array.from({ length: total }).map((_, k) => <Lotus key={k} on={k < lotuses} size={30} />)}</div>
            <p className="motto">{t(T("ไม่ทำชั่ว · ทำความดี · ทำใจให้ผ่องใส", "Avoid harm · Do good · Keep your heart clear"))}</p>
            <span className="cert-note">{t(T("หัวใจของคำสอน (โอวาทปาติโมกข์)", "The heart of the teaching (Ovada Patimokkha)"))}</span>
          </div>
          <p className="center-text small">{t(T("ถ่ายภาพหน้าจอไปอวดคุณพ่อคุณแม่ได้เลย!", "Take a screenshot to show your family!"))}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- chapters ---------- */
const CHAPTERS = [
  { id: "meet", C: Meet, title: T("พบเณรต้นบุญ", "Meet Tonboon"), sub: T("ทักทายเพื่อนใหม่", "Say hello"), col: "saffron" },
  { id: "story", C: Story, title: T("เจ้าชายผู้ตื่น", "The Prince Who Woke Up"), sub: T("ประวัติพระพุทธเจ้า", "The Buddha's life"), col: "gold" },
  { id: "jewels", C: Jewels, title: T("แก้ว 3 ดวง", "Three Jewels"), sub: T("พระรัตนตรัย", "The Triple Gem"), col: "blue" },
  { id: "precepts", C: Precepts, title: T("ศีล 5", "Five Precepts"), sub: T("เกมทำดีหรือผิดศีล", "Good deed or not?"), col: "leaf" },
  { id: "middle", C: MiddleWay, title: T("สายพิณพอดี", "The Just-Right String"), sub: T("ทางสายกลาง", "The Middle Way"), col: "lotus" },
  { id: "mind", C: Mind, title: T("ใจลูกหมา", "Puppy Mind"), sub: T("ฝึกสติ พุทโธ", "Mindful breathing"), col: "sky" },
  { id: "truths", C: Truths, title: T("คุณหมอเณร", "Doctor Novice"), sub: T("อริยสัจ 4", "Four Noble Truths"), col: "saffron" },
  { id: "karma", C: Karma, title: T("สวนแห่งกรรม", "The Karma Garden"), sub: T("ทำดีได้ดี", "Plant good seeds"), col: "leaf" },
  { id: "final", C: Final, title: T("สอบบัณฑิตน้อย", "Final Challenge"), sub: T("รับใบประกาศ", "Get your certificate"), col: "gold" },
];

/* ---------- Daily good-deed missions ---------- */
const MISSIONS = [
  T("ไหว้ขอบคุณคุณพ่อคุณแม่ก่อนนอน", "Wai and thank your parents before bed"),
  T("ช่วยล้างจานหรือเก็บโต๊ะหลังกินข้าว", "Help wash the dishes or clear the table after a meal"),
  T("หายใจ พุท–โธ 5 ครั้งก่อนนอน", "Breathe Bud–dho 5 times before bed"),
  T("แบ่งขนมให้เพื่อนหรือพี่น้อง 1 ชิ้น", "Share one snack with a friend or sibling"),
  T("พูดขอบคุณคนที่ทำอาหารให้เรากิน", "Say thank you to whoever cooked your food"),
  T("เก็บขยะ 3 ชิ้นที่ไม่ใช่ของเรา", "Pick up 3 bits of litter that aren't yours"),
  T("ให้อาหารสัตว์เลี้ยงหรือรดน้ำต้นไม้", "Feed a pet or water a plant"),
  T("พูดความจริง แม้จะยาก", "Tell the truth, even when it's hard"),
  T("ชมเพื่อน 1 คนอย่างจริงใจ", "Give one friend a real compliment"),
  T("ยิ้มและทักทายทุกคนในบ้านตอนเช้า", "Smile and say good morning to everyone at home"),
  T("ไม่เล่นมือถือหรือเกมระหว่างกินข้าว", "No phone or games during meals"),
  T("จัดของเล่นหรือโต๊ะเรียนให้เรียบร้อย", "Tidy up your toys or your desk"),
  T("เวลาโกรธ ให้นับ 1 ถึง 10 ช้า ๆ ก่อนพูด", "When you're angry, count slowly to 10 before you speak"),
  T("ช่วยคนที่ถือของหนัก", "Help someone carry something heavy"),
  T("ขอโทษคนที่เราทำให้เสียใจ", "Say sorry to someone you upset"),
  T("ดีใจด้วยเมื่อเพื่อนทำได้ดี", "Be happy for a friend who did well"),
  T("อ่านหนังสือให้น้องหรือคุณยายฟัง", "Read a book to a younger child or a grandparent"),
  T("ปิดไฟและปิดน้ำเมื่อไม่ได้ใช้", "Switch off lights and taps you're not using"),
  T("ตั้งใจฟังคุณครูหรือผู้ใหญ่พูดจนจบ", "Listen to a teacher or grown-up until they finish"),
  T("ใส่บาตรหรือช่วยเตรียมของทำบุญกับครอบครัว", "Give alms, or help your family prepare offerings"),
  T("ก่อนนอน นึกถึงความดี 3 อย่างที่ทำวันนี้", "Before bed, remember 3 good things you did today"),
];
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayNumber = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

function Missions({ onBloom }) {
  const t = useT(); const lang = useContext(LangCtx);
  const today = new Date();
  const todayKey = dayKey(today);
  const mission = MISSIONS[dayNumber(today) % MISSIONS.length];
  const [log, setLog] = useState(() => store.get("missions", {}));
  const [asking, setAsking] = useState(false);
  useEffect(() => store.set("missions", log), [log]);
  const doneToday = !!log[todayKey];
  const days = Array.from({ length: 14 }, (_, k) => { const d = new Date(today); d.setDate(d.getDate() - 13 + k); return d; });
  let streak = 0;
  for (let k = 0; k < 400; k++) { const d = new Date(today); d.setDate(d.getDate() - k); if (log[dayKey(d)]) streak++; else if (k > 0) break; }
  const total = Object.keys(log).length;
  return (
    <section className="missions" aria-labelledby="mission-h">
      <div className="mission-card">
        <img className="mission-nen" src={IMG.wave} alt="" />
        <div className="mission-body">
          <span className="eyebrow" id="mission-h">{t(T("ภารกิจความดีวันนี้", "Today's good-deed mission"))}</span>
          <p className="mission-text">{t(mission)}</p>
          <div className="row">
            <button className="icon-btn" onClick={() => { audio(); speak(t(mission), lang); }} aria-label={t(T("ฟังเสียง", "Listen"))}>
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" strokeWidth="2" /></svg>
            </button>
            {doneToday ? <span className="pill done-pill">{t(T("ทำแล้ววันนี้ เก่งมาก!", "Done today. Well done!"))}</span>
              : !asking ? <button className="btn" onClick={() => { audio(); setAsking(true); }}>{t(T("หนูทำแล้ว!", "I did it!"))}</button>
              : <span className="confirm">
                  <span>{t(T("ทำจริงใช่ไหม? ซื่อสัตย์กับตัวเองนะ (ศีลข้อ 4!)", "Really done? Be honest with yourself (precept 4!)"))}</span>
                  <button className="btn good" onClick={() => { setLog({ ...log, [todayKey]: true }); setAsking(false); sfx.fanfare(); onBloom(); }}>{t(T("ใช่ ทำจริง", "Yes, really"))}</button>
                  <button className="btn ghost-btn" onClick={() => setAsking(false)}>{t(T("ยังเลย", "Not yet"))}</button>
                </span>}
          </div>
          <p className="small">{t(T("ภารกิจใหม่ทุกวัน ทำในชีวิตจริง แล้วกลับมากดบอกเณรนะ", "A new mission every day. Do it in real life, then come back and tell Tonboon."))}</p>
        </div>
      </div>
      <div className="pond" aria-label={t(T("บ่อบัว 14 วันล่าสุด", "Lotus pond, last 14 days"))}>
        <div className="pond-head">
          <strong>{t(T("บ่อบัวของหนู", "Your lotus pond"))}</strong>
          <span>{t(T(`ทำต่อเนื่อง ${streak} วัน · รวม ${total} ภารกิจ`, `${streak}-day streak · ${total} missions in all`))}</span>
        </div>
        <ol className="pads">
          {days.map((d) => { const on = !!log[dayKey(d)]; const isToday = dayKey(d) === todayKey; return (
            <li key={dayKey(d)} className={"pad" + (on ? " on" : "") + (isToday ? " today" : "")}>
              {on ? <Lotus size={30} /> : <span className="leaf-pad" />}
              <span className="pad-day">{d.getDate()}</span>
            </li>); })}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Jataka theatre ---------- */
const JATAKAS = [
  { n: T("เตมีย์", "Temiya"), v: T("เนกขัมมะ · การไม่ยึดติด", "Renunciation") },
  { n: T("มหาชนก", "Mahajanaka"), v: T("วิริยะ · ความเพียร", "Perseverance"), ep: "mahajanaka" },
  { n: T("สุวรรณสาม", "Suvannasama"), v: T("เมตตา · ความรักความปรารถนาดี", "Loving-kindness") },
  { n: T("เนมิราช", "Nemi"), v: T("อธิษฐาน · ความตั้งใจมั่น", "Determination") },
  { n: T("มโหสถ", "Mahosadha"), v: T("ปัญญา · ความรอบรู้", "Wisdom") },
  { n: T("ภูริทัต", "Bhuridatta"), v: T("ศีล · การรักษาความดี", "Moral conduct") },
  { n: T("จันทกุมาร", "Candakumara"), v: T("ขันติ · ความอดทน", "Patience") },
  { n: T("พรหมนารท", "Narada"), v: T("อุเบกขา · ใจเป็นกลาง", "Equanimity") },
  { n: T("วิธุรบัณฑิต", "Vidhura"), v: T("สัจจะ · ความจริง", "Truthfulness") },
  { n: T("เวสสันดร", "Vessantara"), v: T("ทาน · การให้", "Generosity") },
];

function Theatre({ open, badges }) {
  const t = useT();
  return (
    <section className="theatre">
      <h2>{t(T("โรงละครนิทานชาดก", "Jataka Theatre"))}</h2>
      <p className="theatre-sub">{t(T("ทศชาติชาดก: 10 ชาติสุดท้ายของพระโพธิสัตว์ แต่ละเรื่องฝึกความดีหนึ่งอย่าง", "The Ten Jatakas: the Buddha's last ten lives, each one practising a different good quality"))}</p>
      <ol className="shelf">
        {JATAKAS.map((j, k) => (
          <li key={k}>
            {j.ep ? (
              <button className={"ep-card live" + (badges.includes(j.ep) ? " got" : "")} onClick={() => open(j.ep)}>
                <img src="img/jataka-mahajanaka-3.webp" alt="" />
                <span className="ep-num">{k + 1}</span>
                <span className="ep-name">{t(j.n)}</span>
                <span className="ep-virtue">{t(j.v)}</span>
                <span className="ep-cta">{badges.includes(j.ep) ? t(T("ได้ดาวแล้ว ★ ดูอีกครั้ง", "Star earned ★ Watch again")) : t(T("▶ ดูเลย", "▶ Watch now"))}</span>
              </button>
            ) : (
              <div className="ep-card soon" aria-disabled="true">
                <span className="ep-num">{k + 1}</span>
                <span className="ep-name">{t(j.n)}</span>
                <span className="ep-virtue">{t(j.v)}</span>
                <span className="ep-cta">{t(T("เร็ว ๆ นี้", "Coming soon"))}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Episode({ onDone, onBack }) {
  const t = useT(); const lang = useContext(LangCtx);
  const qs = [
    { q: T("หนูซ้อมเตะฟุตบอลมาทั้งเดือน แต่ยังยิงไม่เข้าประตูเลย หนูจะทำยังไง?", "You've practised football for a whole month and still can't score. What do you do?"),
      o: [T("เลิกเล่นเลย ไม่เก่งก็ช่างมัน", "Quit. Who cares if I'm bad"), T("ซ้อมต่อทีละนิด และขอให้โค้ชช่วยดู", "Keep practising a little at a time and ask the coach for tips"), T("โทษว่าลูกบอลมันกลมเกินไป", "Blame the ball for being too round")], a: 1,
      ok: T("ใช่เลย! นี่แหละความเพียรแบบพระมหาชนก ว่ายต่อไปแม้ยังไม่เห็นฝั่ง", "Yes! That's Mahajanaka-style perseverance: keep swimming even before you can see the shore.") },
    { q: T("พระมหาชนกว่ายน้ำอยู่กลางทะเลนานเท่าไร?", "How long did Mahajanaka swim in the ocean?"),
      o: [T("1 ชั่วโมง", "1 hour"), T("7 วัน 7 คืน", "7 days and 7 nights"), T("100 ปี", "100 years")], a: 1,
      ok: T("ถูกต้อง! 7 วัน 7 คืน โดยไม่ยอมแพ้", "Correct! Seven days and nights without giving up.") },
    { q: T("เจ้าตูบบอกว่าเขา “เพียร” ขอไก่ทอดทุกวัน อันนี้คือความเพียรไหม?", "Tup says he “perseveres” at begging for fried chicken every day. Is that perseverance?"),
      o: [T("ใช่ เพราะเขาขอทุกวัน", "Yes, he asks every day"), T("ไม่ใช่ อันนั้นคือความอยาก ความเพียรคือการพยายามทำสิ่งที่ดี", "No, that's craving. Perseverance means keeping at something good")], a: 1,
      ok: T("เก่งมาก! ความเพียรคือพยายามทำความดี ส่วนอยากได้ไม่หยุดคือ “ตัณหา” ที่เราเรียนในด่านคุณหมอเณร", "Great! Perseverance is sticking with something good. Wanting non-stop is craving, which we met with Doctor Novice.") },
  ];
  const [ans, setAns] = useState({});
  const allRight = qs.every((q, k) => ans[k] === q.a);
  useEffect(() => { if (allRight) { sfx.fanfare(); onDone(); } }, [allRight]);
  return (
    <main className="chapter episode col-blue">
      <div className="ch-head">
        <button className="btn ghost-btn" onClick={onBack}>{t(T("◀ หน้าแรก", "◀ Home"))}</button>
        <div>
          <span className="eyebrow">{t(T("นิทานชาดก เรื่องที่ 2 · วิริยะ ความเพียร", "Jataka 2 · Perseverance"))}</span>
          <h1>{t(T("พระมหาชนก", "Mahajanaka"))}</h1>
        </div>
      </div>
      <Narrator pose="wave" compact lines={[
        T("ทศชาติชาดก คือเรื่องเล่า 10 ชาติสุดท้ายของพระโพธิสัตว์ ก่อนจะมาเกิดเป็นเจ้าชายสิทธัตถะ แต่ละชาติท่านฝึกความดีคนละอย่าง", "The Ten Jatakas tell the Buddha's last ten lives before he was born as Prince Siddhartha. In each life he practised a different good quality."),
        T("เรื่องนี้คือ “พระมหาชนก” เรื่องของความเพียร กดเล่นวิดีโอแล้วดูไปพร้อมกันเลย!", "This one is Mahajanaka, a story about perseverance. Press play and let's watch together!"),
        { ...T("ผมเตรียมป๊อปคอร์นไว้แล้วครับ!", "I've got the popcorn ready!"), who: "tup" },
      ]} />
      <div className="ep-player">
        <video key={lang} src={`video/mahajanaka-${lang}.mp4`} poster="video/mahajanaka.webp" controls playsInline preload="metadata"
          onPlay={() => { audio(); stopVoice(); }} />
      </div>
      <div className="quiz-list">
        <h2 className="ep-q-head">{t(T("ถ้าเป็นหนู จะทำยังไง?", "What would you do?"))}</h2>
        {qs.map((q, k) => (
          <div key={k} className="quiz-box">
            <h3><span className="qn">{k + 1}</span>{t(q.q)}</h3>
            <div className="choices">
              {q.o.map((o, j) => (
                <button key={j} className={"choice" + (ans[k] === j ? (j === q.a ? " right" : " wrong") : "")}
                  onClick={() => { setAns({ ...ans, [k]: j }); j === q.a ? sfx.ding() : sfx.boing(); }}>{t(o)}</button>
              ))}
            </div>
            {ans[k] === q.a && <p className="feedback just">{t(q.ok)}</p>}
          </div>
        ))}
        {allRight && <div className="done-banner" role="status"><span className="star">★</span><div><strong>{t(T("ได้ดาวความเพียรแล้ว!", "You earned the Perseverance Star!"))}</strong><span>{t(T("ลองทำภารกิจความดีวันนี้ด้วยความเพียรนะ", "Now try today's good-deed mission with the same perseverance."))}</span></div><button className="btn big" onClick={onBack}>{t(T("กลับหน้าแรก", "Back home"))}</button></div>}
      </div>
    </main>
  );
}

/* ---------- The Wheel of Causes (advanced: five aggregates + dependent origination) ---------- */
const KHANDHAS = [
  { th: "รูป", pali: "rūpa", c: "#7cb86a",
    m: T("ร่างกายและสิ่งที่จับต้องได้ ซึ่งเปลี่ยนแปลงอยู่เสมอ", "The body and physical things, which are always changing"),
    ex: T("ตาของผม และตัวขนฟู ๆ ของเจ้าส้ม", "My eyes, and Som's fluffy body") },
  { th: "เวทนา", pali: "vedanā", c: "#f2b43c",
    m: T("ความรู้สึก สุข ทุกข์ หรือเฉย ๆ", "Feeling: pleasant, painful or neutral"),
    ex: T("รู้สึกสบายใจ “ชอบจัง!”", "A pleasant feeling: “I like this!”") },
  { th: "สัญญา", pali: "saññā", c: "#4fb3c9",
    m: T("การจำได้ หมายรู้ว่าสิ่งนี้คืออะไร", "Recognising and remembering what something is"),
    ex: T("จำได้ว่า “นี่คือแมว ชื่อเจ้าส้ม ตัวที่ชอบนอนหน้าโบสถ์”", "Recognising: “That's a cat. It's Som, the one who naps by the temple hall.”") },
  { th: "สังขาร", pali: "saṅkhāra", c: "#9b7fd1",
    m: T("ความคิด ความตั้งใจ และนิสัยที่ปรุงแต่งการกระทำ", "Thoughts, intentions and habits that shape what we do"),
    ex: T("คิดว่า “อยากอุ้มจัง!” แล้วตั้งใจเดินเข้าไปหา", "Thinking “I want to cuddle her!” and deciding to walk over") },
  { th: "วิญญาณ", pali: "viññāṇa", c: "#e8795a",
    m: T("การรู้แจ้งอารมณ์ ทางตา หู จมูก ลิ้น กาย ใจ", "Consciousness: the knowing, through eye, ear, nose, tongue, body or mind"),
    ex: T("การรู้ว่ามีบางอย่างปรากฏทางตา คือ “การเห็น”", "The bare knowing that something appeared to the eye: seeing") },
];

const LINKS = [
  { th: "อวิชชา", pali: "avijjā", m: T("ไม่รู้ความจริง ไม่เห็นว่าความอยากและการยึดถือนำมาซึ่งทุกข์", "Not seeing the truth: not realising that craving and clinging lead to suffering"),
    ex: T("ผมคิดว่า “ถ้าได้หุ่นยนต์ตัวนั้น ผมจะมีความสุขตลอดไป”", "I believed: “If I get that robot, I'll be happy forever.”") },
  { th: "สังขาร", pali: "saṅkhāra", m: T("ความเคยชินและเจตนาที่ปรุงแต่งใจ", "Habits and intentions that shape the mind"),
    ex: T("ใจผมเคยชินกับการอยากได้ของใหม่", "My mind is used to wanting new things") },
  { th: "วิญญาณ", pali: "viññāṇa", m: T("การรู้ทางตา หู จมูก ลิ้น กาย ใจ", "Knowing through eye, ear, nose, tongue, body and mind"),
    ex: T("ตาเห็นหุ่นยนต์ในมือเพื่อน", "My eyes see the robot in my friend's hands") },
  { th: "นามรูป", pali: "nāmarūpa", m: T("ใจกับกายทำงานร่วมกัน", "Mind and body working together"),
    ex: T("ทั้งตัวทั้งใจหันไปสนใจหุ่นยนต์", "My whole body and mind turn towards the robot") },
  { th: "สฬายตนะ", pali: "saḷāyatana", m: T("ช่องทางรับรู้ 6 ทาง: ตา หู จมูก ลิ้น กาย ใจ", "The six sense doors: eye, ear, nose, tongue, body, mind"),
    ex: T("ตา หู และใจ เปิดรับเรื่องหุ่นยนต์เต็มที่", "My eyes, ears and mind are wide open to the robot") },
  { th: "ผัสสะ", pali: "phassa", m: T("การกระทบ เมื่อช่องทาง สิ่งที่ถูกรู้ และการรู้ มาเจอกัน", "Contact: a sense door, an object and knowing meet"),
    ex: T("ตา + หุ่นยนต์ + การเห็น มาเจอกัน “ปิ๊ง!”", "Eye + robot + seeing meet: “ping!”") },
  { th: "เวทนา", pali: "vedanā", m: T("ความรู้สึก สุข ทุกข์ หรือเฉย ๆ", "Feeling: pleasant, painful or neutral"),
    ex: T("รู้สึก “ว้าว!” ชอบมาก", "“Wow!” A pleasant feeling") },
  { th: "ตัณหา", pali: "taṇhā", m: T("ความอยาก: อยากได้ อยากเป็น อยากไม่ให้เป็น", "Craving: wanting to have, to become, or for something not to be"),
    ex: T("“อยากได้! อยากได้ตัวที่เท่กว่าของเพื่อนอีก!”", "“I want it! I want an even cooler one than his!”") },
  { th: "อุปาทาน", pali: "upādāna", m: T("การยึดถือ จับไว้แน่นว่า “ต้องเป็นของฉัน”", "Clinging: holding on tight to “it has to be mine”"),
    ex: T("“ฉันต้องมี ไม่งั้นฉันจะไม่มีความสุขเลย”", "“I have to have it, or I'll never be happy.”") },
  { th: "ภพ", pali: "bhava", m: T("ความเป็น ใจเริ่มกลายเป็นอะไรบางอย่าง", "Becoming: the mind starts turning into something"),
    ex: T("ใจกลายเป็น “เด็กที่ไม่มีหุ่นยนต์”", "My mind becomes “the kid without a robot”") },
  { th: "ชาติ", pali: "jāti", m: T("การเกิด", "Birth"),
    ex: T("“ตัวฉันผู้น่าสงสาร” เกิดขึ้นเต็มตัว", "A whole “poor me” is born") },
  { th: "ชรามรณะ", pali: "jarāmaraṇa", m: T("ความแก่ ความตาย พร้อมความเศร้า เสียใจ คับแค้นใจ", "Ageing and death, with sorrow, grief and distress"),
    ex: T("งอนแม่ อิจฉาเพื่อน ถึงได้มาก็กลัวพัง พอพังก็เสียใจ", "I sulk at Mum and envy my friend. Even if I get one, I worry it'll break, and I'm sad when it does") },
];

const WHEEL_LESSONS = [
  { title: T("หนึ่งขณะ ห้าส่วน", "One Moment, Five Parts"), sub: T("ขันธ์ 5", "The five aggregates"), img: IMG.think },
  { title: T("วงล้อ 12 ห่วง", "The 12-Link Wheel"), sub: T("ปฏิจจสมุปบาท", "Dependent origination"), img: IMG.think },
  { title: T("หยุดวงล้อตรงไหนดี?", "Where Can the Wheel Stop?"), sub: T("ทางออกจากทุกข์", "The way out"), img: IMG.wave },
  { title: T("ความดับไม่เหลือของทุกข์", "The End of Suffering"), sub: T("นิพพาน และแบบทดสอบ", "Nibbāna and review"), img: IMG.meditate },
];

function WheelArea({ open, stars }) {
  const t = useT();
  return (
    <section className="wheel-area">
      <div className="wheel-head">
        <h2>{t(T("วงล้อเหตุปัจจัย", "The Wheel of Causes"))}</h2>
        <span className="pill level">{t(T("ขั้นสูง · ป.5 ขึ้นไป", "Advanced · age 10+"))}</span>
      </div>
      <p className="theatre-sub">{t(T("ทำไมเราถึงทุกข์ และจะออกจากทุกข์ได้อย่างไร เรียนรู้ ขันธ์ 5 และ ปฏิจจสมุปบาท ทีละขั้น ผ่านเรื่องในชีวิตประจำวัน", "Why do we suffer, and how do we get free? Learn the five aggregates and dependent origination step by step, through everyday stories."))}</p>
      <ol className="wheel-lessons">
        {WHEEL_LESSONS.map((l, k) => (
          <li key={k}>
            <button className={"wl-card" + (stars.includes(k) ? " got" : "")} onClick={() => open(k)}>
              <img src={l.img} alt="" />
              <span className="wl-num">{k + 1}</span>
              <span className="wl-text"><span className="wl-title">{t(l.title)}</span><span className="wl-sub">{t(l.sub)}</span></span>
              <span className="wl-star" aria-label={stars.includes(k) ? t(T("เรียนแล้ว", "Done")) : ""}>{stars.includes(k) ? "★" : "☆"}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TeacherNote({ children }) {
  const t = useT();
  return (
    <details className="teacher-note">
      <summary>{t(T("หมายเหตุสำหรับคุณครูและผู้ปกครอง", "Note for teachers and parents"))}</summary>
      {children}
    </details>
  );
}

/* Lesson 1: the five aggregates in one moment */
function LessonKhandha({ complete }) {
  const t = useT(); const lang = useContext(LangCtx);
  const [seen, setSeen] = useState([]);
  const [pick, setPick] = useState(null);
  const sort = [
    { s: T("ขาที่มีแผลถลอก", "The leg with the scrape on it"), a: 0 },
    { s: T("รู้สึกเจ็บแสบ", "It stings and hurts"), a: 1 },
    { s: T("จำได้ว่า “แผลแบบนี้ ต้องล้างด้วยน้ำสะอาด”", "Remembering: “A cut like this needs washing with clean water”"), a: 2 },
    { s: T("ตั้งใจว่าจะลุกขึ้นไปล้างแผล ไม่โวยวาย", "Deciding to get up and wash it, without making a fuss"), a: 3 },
    { s: T("การรู้ว่ามีบางอย่างมากระทบที่ขา", "The knowing that something has touched the leg"), a: 4 },
  ];
  const [si, setSi] = useState(0);
  const [res, setRes] = useState(null);
  const allSeen = seen.length === 5;
  const sorted = si >= sort.length;
  useEffect(() => { if (allSeen && sorted) { sfx.fanfare(); complete(); } }, [allSeen, sorted]);
  const choose = (k) => {
    if (res) return; const ok = k === sort[si].a; setRes({ ok, k }); ok ? sfx.ding() : sfx.boing();
  };
  return (
    <>
      <Narrator pose="think" compact lines={[
        T("รู้ไหม แค่เราเห็นแมวหนึ่งตัว ในใจก็เกิดอะไรขึ้นตั้งหลายอย่าง พระพุทธเจ้าทรงแบ่งชีวิตเราออกเป็น 5 ส่วน เรียกว่า “ขันธ์ 5”", "Did you know that just seeing one cat sets off lots of things inside you? The Buddha described a person as five parts, called the five aggregates."),
        T("ลองดูตอนที่ผมเห็นเจ้าส้ม แมวของวัด แล้วแตะการ์ดทีละใบนะ", "Let's look at the moment I saw Som, the temple cat. Tap the cards one by one."),
        { ...T("แมว?! ที่ไหน?! โฮ่ง!", "A cat?! Where?! Woof!"), who: "tup" },
        T("ทั้ง 5 ส่วนนี้เกิดขึ้นพร้อมกันในขณะเดียว ไม่ได้เกิดทีละอย่าง และเปลี่ยนไปตลอดเวลา", "All five happen together in the same moment, not one after another, and they keep changing all the time."),
      ]} />
      <div className="moment">
        <p className="moment-cap">{t(T("ขณะเดียว: เณรต้นบุญเห็นเจ้าส้ม", "One moment: Tonboon sees Som the cat"))}</p>
        <div className="khandhas">
          {KHANDHAS.map((k, i) => {
            const open = seen.includes(i);
            return (
              <button key={i} className={"khandha" + (open ? " open" : "")} style={{ "--k": k.c }} aria-expanded={open}
                onClick={() => { sfx.pop(); if (!open) setSeen([...seen, i]); speak((lang === "th" ? k.th : k.pali) + ". " + t(k.m), lang); }}>
                <span className="k-num">{i + 1}</span>
                <span className="k-name">{k.th}</span>
                <span className="k-pali">{k.pali}</span>
                {open ? <><span className="k-mean">{t(k.m)}</span><span className="k-ex">{t(k.ex)}</span></>
                  : <span className="k-tap">{t(T("แตะเพื่อดู", "Tap to see"))}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {allSeen && (
        <div className="big-idea">
          <strong>{t(T("ความลับสำคัญ", "The big idea"))}</strong>
          <p>{t(T("ทั้ง 5 ส่วนนี้เปลี่ยนตลอด ร่างกายโต ความรู้สึกมาแล้วก็ไป ความคิดก็เปลี่ยน ถ้าเรายึดว่า “นี่คือฉัน ต้องเป็นอย่างที่ฉันอยาก” พอมันเปลี่ยน เราก็ทุกข์", "All five keep changing: bodies grow, feelings come and go, thoughts change. If we hold on to “this is me, and it must be how I want”, we suffer when it changes."))}</p>
        </div>
      )}
      {allSeen && (
        <div className="scenario sorter">
          <p className="moment-cap">{t(T("ลองแยกเอง: หกล้มที่สนาม", "Your turn: falling over in the playground"))} · {Math.min(si + 1, sort.length)}/{sort.length}</p>
          {!sorted ? (
            <>
              <p className="scn">{t(sort[si].s)}</p>
              <div className="choices center">
                {KHANDHAS.map((k, i) => (
                  <button key={i} className={"choice" + (res && res.k === i ? (res.ok ? " right" : " wrong") : "")} onClick={() => choose(i)}>{k.th}</button>
                ))}
              </div>
              {res && <>
                <p className={"feedback " + (res.ok ? "just" : "tight")}>{res.ok ? t(T("ถูกต้อง! ", "Correct! ")) : t(T(`ยังไม่ใช่ นี่คือ “${KHANDHAS[sort[si].a].th}” `, `Not quite. This is ${KHANDHAS[sort[si].a].th} (${KHANDHAS[sort[si].a].pali}). `))}{t(KHANDHAS[sort[si].a].m)}</p>
                <button className="btn" onClick={() => { setRes(null); setSi(si + 1); }}>{t(T("ข้อต่อไป ▶", "Next ▶"))}</button>
              </>}
            </>
          ) : <p className="feedback just">{t(T("เก่งมาก! หนูแยกขันธ์ 5 ได้แล้ว", "Well done! You can tell the five aggregates apart."))}</p>}
        </div>
      )}
      <TeacherNote>
        <p>{t(T("ลำดับ รูป เวทนา สัญญา สังขาร วิญญาณ เป็นลำดับตามพระไตรปิฎก แต่ไม่ใช่ลำดับการเกิด ขันธ์ทั้ง 5 เกิดร่วมกันในทุกขณะ จึงไม่ควรวาดเป็นวงจรที่หมุนต่อกัน “สังขาร” ในขันธ์ 5 กว้างกว่า “สังขาร” ห่วงที่ 2 ของปฏิจจสมุปบาท แม้จะใช้คำเดียวกัน", "The order rūpa, vedanā, saññā, saṅkhāra, viññāṇa follows the Pali Canon, but it is not an order of arising: all five arise together in every moment, so they should not be drawn as a cycle. Saṅkhāra as an aggregate is broader than saṅkhāra as the second link of dependent origination, even though the word is the same."))}</p>
      </TeacherNote>
    </>
  );
}

/* Lesson 2: the twelve links */
function WheelSvg({ sel, seen, onPick }) {
  const t = useT();
  const R1 = 190, R0 = 112, C = 200;
  const pt = (r, a) => [C + r * Math.sin(a), C - r * Math.cos(a)];
  return (
    <svg className="wheel-svg" viewBox="0 0 400 400" role="group" aria-label={t(T("วงล้อ 12 ห่วง", "The 12-link wheel"))}>
      {LINKS.map((l, i) => {
        const a0 = (i / 12) * Math.PI * 2 + 0.012, a1 = ((i + 1) / 12) * Math.PI * 2 - 0.012, am = (a0 + a1) / 2;
        const [x0, y0] = pt(R1, a0), [x1, y1] = pt(R1, a1), [x2, y2] = pt(R0, a1), [x3, y3] = pt(R0, a0);
        const [tx, ty] = pt((R0 + R1) / 2, am);
        const cls = "seg" + (sel === i ? " sel" : "") + (seen.includes(i) ? " seen" : "") + (i >= 7 && i <= 8 ? " hot" : "");
        return (
          <g key={i} className={cls} tabIndex={0} role="button" aria-label={`${i + 1} ${l.th}`}
            onClick={() => onPick(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(i); } }}>
            <path d={`M${x0} ${y0} A${R1} ${R1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R0} ${R0} 0 0 0 ${x3} ${y3}Z`} />
            <text x={tx} y={ty - 6} className="seg-num">{i + 1}</text>
            <text x={tx} y={ty + 13} className="seg-name">{l.th}</text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R0 - 10} className="hub" />
      <text x={C} y={C - 8} className="hub-t">{t(T("แตะห่วง", "Tap a link"))}</text>
      <text x={C} y={C + 18} className="hub-s">{`${seen.length}/12`}</text>
    </svg>
  );
}

function LessonLinks({ complete }) {
  const t = useT(); const lang = useContext(LangCtx);
  const [sel, setSel] = useState(null);
  const [seen, setSeen] = useState([]);
  useEffect(() => { if (seen.length === 12) { sfx.fanfare(); complete(); } }, [seen.length]);
  const pick = (i) => { audio(); sfx.pop(); setSel(i); if (!seen.includes(i)) setSeen([...seen, i]); speak((lang === "th" ? LINKS[i].th : LINKS[i].pali) + ". " + t(LINKS[i].m), lang); };
  const l = sel != null ? LINKS[sel] : null;
  return (
    <>
      <Narrator pose="think" compact lines={[
        T("“ปฏิจจสมุปบาท” แปลว่า สิ่งต่าง ๆ เกิดขึ้นเพราะมีเหตุ เหมือนโดมิโน ตัวหนึ่งล้ม ตัวต่อไปก็ล้มตาม", "Dependent origination means things arise because of causes, like dominoes: when one falls, the next one follows."),
        T("พระพุทธเจ้าทรงอธิบายว่า ความทุกข์ก็เกิดแบบนี้ เป็นสาย 12 ห่วง แตะแต่ละห่วงในวงล้อดูนะ", "The Buddha explained that suffering arises like this too, in a chain of 12 links. Tap each link on the wheel."),
        T("ผมจะยกตัวอย่างตอนที่เห็นเพื่อนได้หุ่นยนต์ตัวใหม่ ใจผมหมุนไปตามวงล้อเลย", "I'll use the time my friend got a new robot toy. My mind spun right round the wheel."),
        { ...T("ผมก็เคยนะ ตอนเห็นกระดูกของหมาข้างบ้าน", "Me too! When I saw the neighbour dog's bone."), who: "tup" },
      ]} />
      <div className="links-layout">
        <WheelSvg sel={sel} seen={seen} onPick={pick} />
        <div className="link-panel" aria-live="polite">
          {l ? (
            <>
              <div className="lp-head">
                <span className="lp-num">{sel + 1}</span>
                <div><h3>{l.th}</h3><span className="lp-pali">{l.pali}</span></div>
              </div>
              <p className="lp-mean">{t(l.m)}</p>
              <div className="lp-ex"><b>{t(T("ตัวอย่างของเณร:", "Tonboon's example:"))}</b> {t(l.ex)}</div>
              <p className="lp-flow">{sel < 11
                ? t(T(`เพราะมี “${l.th}” จึงมี “${LINKS[sel + 1].th}”`, `Because there is ${l.pali}, there is ${LINKS[sel + 1].pali}.`))
                : t(T("และวงล้อก็หมุนต่อไป ถ้ายังไม่เห็นความจริง", "And the wheel keeps turning while the truth isn't seen."))}</p>
              <div className="row">
                <button className="btn ghost-btn" disabled={sel === 0} onClick={() => pick(sel - 1)}>{t(T("◀ ห่วงก่อน", "◀ Previous"))}</button>
                {sel < 11 && <button className="btn" onClick={() => pick(sel + 1)}>{t(T("ห่วงถัดไป ▶", "Next link ▶"))}</button>}
              </div>
            </>
          ) : (
            <p className="lp-empty">{t(T("เริ่มที่ห่วงที่ 1 “อวิชชา” แล้วไล่ไปจนครบ 12 ห่วง ห่วงสีแดงคือจุดที่ไฟลุกง่ายที่สุด: ตัณหา กับ อุปาทาน", "Start with link 1, ignorance, and go round all 12. The red links are where the fire catches most easily: craving and clinging."))}</p>
          )}
        </div>
      </div>
      {seen.length === 12 && (
        <div className="big-idea">
          <strong>{t(T("สรุปเป็นภาษาง่าย ๆ", "In plain words"))}</strong>
          <p>{t(T("กระทบ → รู้สึก → อยาก → ยึด → กลายเป็นตัวฉันที่ทุกข์ ห่วงที่ 6 ถึง 12 นี้ เราเห็นได้ในชีวิตจริงทุกวัน และ “อุปาทาน” ยึดอะไร? ยึดขันธ์ 5 ว่าเป็นตัวเรา ของเรา", "Contact → feeling → craving → clinging → a suffering “me”. You can watch links 6 to 12 happen in real life every day. And what does clinging hold on to? The five aggregates, as “me” and “mine”."))}</p>
        </div>
      )}
      <TeacherNote>
        <p>{t(T("ในพระไตรปิฎก “ชาติ” และ “ชรามรณะ” หมายถึงการเกิด แก่ และตาย ในภพชาติ ครูบาอาจารย์บางท่าน เช่น ท่านพุทธทาสภิกขุ อธิบายว่าวงจรนี้เกิดขึ้นในใจได้ในชีวิตประจำวัน ทุกครั้งที่ “ตัวฉัน” เกิดขึ้นด้วยความอยากและการยึดถือ ตัวอย่างในหน้านี้ใช้แบบหลังเพื่อให้เด็กเห็นได้ด้วยตนเอง คุณครูอาจเล่าความหมายแบบแรกเพิ่มเติมได้", "In the Pali Canon, birth and ageing-and-death refer to being born, growing old and dying across lives. Some Thai teachers, notably Buddhadāsa Bhikkhu, explain that the whole chain can also run in the mind in daily life, every time a “me” is born out of craving and clinging. The examples here use that second reading so children can observe it for themselves; teachers may add the traditional reading."))}</p>
      </TeacherNote>
    </>
  );
}

/* Lesson 3: where the wheel can be broken */
function LessonBreak({ complete }) {
  const t = useT();
  const cases = [
    { s: T("เห็นเพื่อนได้หุ่นยนต์ใหม่ รู้สึกอยากได้มาก", "Your friend gets a new robot and you really want one"),
      o: [T("ร้องไห้งอนแม่ จนกว่าจะซื้อให้", "Cry and sulk until Mum buys one"), T("รู้ทันว่า “อ๋อ ใจกำลังอยาก” แล้วดีใจกับเพื่อน", "Notice “Ah, my mind is wanting”, and be happy for your friend"), T("ไม่มองของใครอีกเลยตลอดชีวิต", "Never look at anyone's things ever again")], a: 1,
      why: [T("แบบนี้วงล้อหมุนเต็มที่เลย ตัณหาพาไปถึงอุปาทาน", "That spins the wheel at full speed: craving leads straight to clinging."), T("เยี่ยม! รู้ทันเวทนา ไม่ไปกับตัณหา วงล้อหยุดตรงนี้เลย", "Great! You noticed the feeling and didn't follow the craving. The wheel stops right here."), T("หลบตาตลอดไปไม่ได้หรอก ตาก็ต้องเห็นอยู่ดี สิ่งที่ฝึกได้คือใจที่รู้ทัน", "You can't close your eyes forever. Eyes will see things anyway; what you can train is a mind that notices.")] },
    { s: T("เพื่อนแซวว่าหนูวาดรูปไม่สวย รู้สึกโกรธ", "A friend teases you that your drawing is ugly, and you feel angry"),
      o: [T("จำไว้ แล้วแกล้งคืนทีหลัง", "Remember it and get them back later"), T("ฉีกรูปทิ้ง บอกว่าจะไม่วาดอีกแล้ว", "Tear up the drawing and swear you'll never draw again"), T("หายใจลึก ๆ สังเกตว่าใจกำลังร้อน แล้วค่อยพูด", "Breathe deeply, notice your mind is heating up, then speak")], a: 2,
      why: [T("ความโกรธกลายเป็นการยึดถือ และกลายเป็น “ตัวฉันผู้แค้น”", "The anger turns into clinging, and a “me who wants revenge” is born."), T("นี่คือ “อยากไม่ให้เป็น” ก็เป็นตัณหาเหมือนกัน แล้วเราก็เสียสิ่งที่เรารักไป", "That's craving too, the kind that wants something not to be, and you lose something you love."), T("ถูกต้อง! เวทนาที่ไม่สบายใจเกิดขึ้นได้ แต่ถ้ารู้ทัน มันก็ไม่ลามเป็นไฟ", "Right! An unpleasant feeling can arise, but if you notice it, it doesn't spread into a fire.")] },
    { s: T("เล่นเกมแพ้ แล้วอยากเล่นใหม่ทันทีจนดึก", "You lose a game and want to keep playing late into the night"),
      o: [T("รู้ว่าใจกำลังอยากชนะ ยอมรับว่าแพ้ได้ แล้วไปนอน", "Notice your mind wants to win, accept that losing happens, and go to bed"), T("เล่นต่อจนกว่าจะชนะ ถึงจะตีสอง", "Keep playing until you win, even at 2 a.m."), T("โทษว่าเกมโกง", "Blame the game for cheating")], a: 0,
      why: [T("เก่งมาก! นี่แหละการรู้ทันตัณหา", "Brilliant! That's catching craving in the act."), T("ตัณหาลากเราไปจนเหนื่อยและง่วง แถมพรุ่งนี้ก็ยังอยากชนะอยู่ดี", "Craving drags you along until you're exhausted, and tomorrow you'll still want to win."), T("โทษคนอื่นทำให้ “ตัวฉันผู้ถูกโกง” เกิดขึ้น ใจยิ่งร้อน", "Blaming others gives birth to a “me who got cheated”, and the heat grows.")] },
  ];
  const steps = [
    T("รู้ทันผัสสะ: รู้ตัวว่ามีอะไรมากระทบ", "Notice contact: know when something touches your senses"),
    T("สังเกตเวทนา: รู้ว่ากำลังชอบ ไม่ชอบ หรือเฉย ๆ", "Watch the feeling: know if it's pleasant, unpleasant or neutral"),
    T("ไม่ไปกับตัณหา: อยากได้ก็รู้ แต่ไม่วิ่งตาม", "Don't follow craving: notice the wanting, but don't chase it"),
    T("ไม่ยึดถือ: ไม่จับไว้ว่า “ต้องเป็นของฉัน”", "Don't cling: don't grab hold of “it has to be mine”"),
    T("ตัวฉันผู้ทุกข์ ไม่ได้ก่อตัวขึ้น (ภพดับ)", "A suffering “me” doesn't take shape (becoming ceases)"),
    T("ไม่มี “ตัวฉันผู้น่าสงสาร” เกิดขึ้น (ชาติดับ)", "No “poor me” is born (birth ceases)"),
    T("ความเศร้า เสียใจ คับแค้นใจ ก็ไม่เกิด ทุกข์ดับ", "Sorrow, grief and distress don't arise: suffering ends"),
  ];
  const [ci, setCi] = useState(0);
  const [ans, setAns] = useState(null);
  const [climb, setClimb] = useState(0);
  const casesDone = ci >= cases.length;
  useEffect(() => { if (casesDone && climb >= steps.length) { sfx.fanfare(); complete(); } }, [casesDone, climb]);
  const c = cases[ci];
  return (
    <>
      <Narrator pose="wave" compact lines={[
        T("ข่าวดี! วงล้อนี้หยุดได้ ถ้าเราเห็นทันว่ามันกำลังหมุน", "Good news: the wheel can be stopped, if we notice it spinning in time."),
        T("จุดที่ฝึกได้ง่ายที่สุดคือ ระหว่าง “เวทนา” กับ “ตัณหา” รู้สึกชอบได้ แต่ไม่ต้องวิ่งตามความอยาก", "The easiest place to practise is between feeling and craving. You can like something without chasing the wanting."),
        T("ลองเลือกดูว่า ในแต่ละเรื่อง หนูจะหยุดวงล้ออย่างไร", "Let's see how you'd stop the wheel in each situation."),
      ]} />
      <div className="scenario">
        {!casesDone ? (
          <>
            <p className="moment-cap">{t(T("สถานการณ์", "Situation"))} {ci + 1}/{cases.length}</p>
            <p className="scn">{t(c.s)}</p>
            <div className="choices col">
              {c.o.map((o, j) => (
                <button key={j} className={"choice" + (ans === j ? (j === c.a ? " right" : " wrong") : "")}
                  onClick={() => { if (ans === c.a) return; setAns(j); j === c.a ? sfx.ding() : sfx.boing(); }}>{t(o)}</button>
              ))}
            </div>
            {ans != null && <p className={"feedback " + (ans === c.a ? "just" : "tight")}>{t(c.why[ans])}</p>}
            {ans === c.a && <button className="btn" onClick={() => { setAns(null); setCi(ci + 1); }}>{t(T("ต่อไป ▶", "Next ▶"))}</button>}
          </>
        ) : <p className="feedback just">{t(T("หนูหยุดวงล้อได้ทั้ง 3 ครั้งเลย!", "You stopped the wheel all three times!"))}</p>}
      </div>
      {casesDone && (
        <div className="way-out">
          <h3>{t(T("บันได 7 ขั้น สู่ทางออก", "Seven steps out"))}</h3>
          <p className="small">{t(T("พระพุทธเจ้าทรงสอนว่า เมื่อเหตุดับ ผลก็ดับ ตัณหาดับ อุปาทานก็ดับ อุปาทานดับ ภพก็ดับ ไล่ไปจนทุกข์ดับ แตะเพื่อปีนทีละขั้น", "The Buddha taught that when the cause ends, the result ends: when craving ends, clinging ends; when clinging ends, becoming ends; and so on until suffering ends. Tap to climb one step at a time."))}</p>
          <ol className="ladder">
            {steps.map((s, k) => (
              <li key={k} className={k < climb ? "on" : k === climb ? "next" : ""}>
                <button disabled={k !== climb} onClick={() => { sfx.ding(); setClimb(climb + 1); }}>
                  <span className="step-n">{k + 1}</span><span>{t(s)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

/* Lesson 4: the goal and review */
function LessonGoal({ complete }) {
  const t = useT();
  const qs = [
    { q: T("ขันธ์ 5 มีอะไรบ้าง?", "What are the five aggregates?"), o: [T("รูป เวทนา สัญญา สังขาร วิญญาณ", "Body, feeling, recognition, mental formations, consciousness"), T("ตา หู จมูก ลิ้น กาย", "Eye, ear, nose, tongue, body"), T("ดิน น้ำ ลม ไฟ ฟ้า", "Earth, water, wind, fire, sky")], a: 0 },
    { q: T("“จำได้ว่านี่คือแมวชื่อเจ้าส้ม” คือขันธ์ไหน?", "“Recognising that this is Som the cat” is which aggregate?"), o: [T("เวทนา", "Feeling"), T("สัญญา", "Recognition (saññā)"), T("รูป", "Body")], a: 1 },
    { q: T("ขันธ์ทั้ง 5 เกิดขึ้นอย่างไร?", "How do the five aggregates arise?"), o: [T("ทีละอย่าง เรียงต่อกันเป็นวงกลม", "One at a time, in a circle"), T("พร้อมกันในทุกขณะ และเปลี่ยนตลอด", "Together in every moment, always changing"), T("ไม่เคยเปลี่ยนเลย", "They never change")], a: 1 },
    { q: T("ในวงล้อ 12 ห่วง อะไรเกิดต่อจาก “เวทนา”?", "In the 12-link wheel, what comes after feeling?"), o: [T("ตัณหา", "Craving"), T("ชาติ", "Birth"), T("อวิชชา", "Ignorance")], a: 0 },
    { q: T("“อุปาทาน” ยึดอะไรว่าเป็นตัวเรา ของเรา?", "What does clinging hold on to as “me” and “mine”?"), o: [T("ขันธ์ 5", "The five aggregates"), T("ไก่ทอด", "Fried chicken"), T("ไม่ยึดอะไรเลย", "Nothing at all")], a: 0 },
    { q: T("“นิพพาน” คืออะไร?", "What is Nibbāna?"), o: [T("สวรรค์ชั้นสูงสุด", "The highest heaven"), T("ความดับไม่เหลือของทุกข์", "The complete ending of suffering"), T("ขันธ์ที่ 6", "A sixth aggregate")], a: 1 },
  ];
  const [ans, setAns] = useState({});
  const allRight = qs.every((q, k) => ans[k] === q.a);
  useEffect(() => { if (allRight) { sfx.fanfare(); complete(); } }, [allRight]);
  return (
    <>
      <Narrator pose="meditate" compact lines={[
        T("พระพุทธเจ้าตรัสว่า “เราสอนเพียงเรื่องทุกข์ และความดับไม่เหลือของทุกข์”", "The Buddha said: “I teach only suffering and the ending of suffering.”"),
        T("ความดับไม่เหลือของทุกข์ เรียกว่า “นิพพาน” แปลว่า ดับ หรือเย็นสนิท ไม่ใช่สถานที่ ไม่ใช่สวรรค์ แต่คือใจที่ไม่ถูกไฟแห่งความอยากและการยึดถือเผาอีกแล้ว", "The complete ending of suffering is called Nibbāna, which means “going out” or “cooled”. It isn't a place or a heaven. It's a heart no longer burned by the fire of craving and clinging."),
        T("เราเริ่มฝึกได้ตั้งแต่วันนี้ ทุกครั้งที่รู้ทันใจตัวเอง ทุกข์ก็เบาลงทีละนิด", "We can start practising today. Each time we catch our own mind, suffering gets a little lighter."),
        { ...T("ผมจะเริ่มจากรู้ทันความอยากกินไก่ทอดก่อนแล้วกันครับ", "I'll start by catching my fried-chicken cravings."), who: "tup" },
      ]} />
      <div className="goal-card">
        <div className="goal-col">
          <span className="goal-tag">{t(T("ทุกข์และเหตุแห่งทุกข์", "Suffering and its cause"))}</span>
          <p>{t(T("ไม่รู้ความจริง → อยาก → ยึดขันธ์ 5 ว่าเป็นตัวฉัน → ทุกข์ วงล้อหมุนไม่รู้จบ", "Not seeing the truth → craving → clinging to the five aggregates as “me” → suffering, round and round"))}</p>
        </div>
        <div className="goal-arrow" aria-hidden="true">→</div>
        <div className="goal-col cool">
          <span className="goal-tag">{t(T("ความดับทุกข์", "The end of suffering"))}</span>
          <p>{t(T("เห็นเหตุ → คลายความยึดถือ → ทุกข์ดับ ด้วยการฝึกของตัวเราเอง", "See the causes → loosen clinging → suffering ends, through our own practice"))}</p>
        </div>
      </div>
      <div className="quiz-list">
        <h2 className="ep-q-head">{t(T("ทบทวนวงล้อ", "Wheel review"))}</h2>
        {qs.map((q, k) => (
          <div key={k} className="quiz-box">
            <h3><span className="qn">{k + 1}</span>{t(q.q)}</h3>
            <div className="choices">
              {q.o.map((o, j) => (
                <button key={j} className={"choice" + (ans[k] === j ? (j === q.a ? " right" : " wrong") : "")}
                  onClick={() => { setAns({ ...ans, [k]: j }); j === q.a ? sfx.ding() : sfx.boing(); }}>{t(o)}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <TeacherNote>
        <p>{t(T("ข้อความ “เราสอนเพียงเรื่องทุกข์ และความดับไม่เหลือของทุกข์” มาจากอลคัททูปมสูตร (มัชฌิมนิกาย มูลปัณณาสก์; MN 22) นิพพานไม่ใช่ขันธ์ใดขันธ์หนึ่ง แต่เป็นความพ้นจากการยึดถือขันธ์ทั้งปวง", "“I teach only suffering and the ending of suffering” comes from the Alagaddūpama Sutta (MN 22). Nibbāna is not one of the aggregates; it is freedom from clinging to all of them."))}</p>
      </TeacherNote>
    </>
  );
}

const LESSON_PAGES = [LessonKhandha, LessonLinks, LessonBreak, LessonGoal];

function WheelLesson({ k, onDone, onBack, onNext }) {
  const t = useT();
  const L = WHEEL_LESSONS[k], Page = LESSON_PAGES[k];
  const [finished, setFinished] = useState(false);
  return (
    <main className="chapter wheel-lesson col-lotus">
      <div className="ch-head">
        <button className="btn ghost-btn" onClick={onBack}>{t(T("◀ หน้าแรก", "◀ Home"))}</button>
        <div>
          <span className="eyebrow">{t(T("วงล้อเหตุปัจจัย · บทที่", "Wheel of Causes · Lesson"))} {k + 1}/4 · {t(L.sub)}</span>
          <h1>{t(L.title)}</h1>
        </div>
      </div>
      <Page complete={() => { setFinished(true); onDone(); }} />
      {finished && (
        <div className="done-banner" role="status">
          <span className="star">★</span>
          <div><strong>{t(T("ได้ดาววงล้อธรรมแล้ว!", "Dhamma Wheel star earned!"))}</strong><span>{k < 3 ? t(T("ไปบทต่อไปกันเลย", "On to the next lesson")) : t(T("เรียนครบทั้งวงล้อแล้ว เก่งมาก!", "You've completed the whole wheel. Well done!"))}</span></div>
          <button className="btn big" onClick={k < 3 ? onNext : onBack}>{k < 3 ? t(T("บทต่อไป ▶", "Next lesson ▶")) : t(T("กลับหน้าแรก", "Back home"))}</button>
        </div>
      )}
    </main>
  );
}

/* ---------- HyperFrames video pieces ---------- */
const VID = { intro: "video/intro.mp4", poster: "video/intro-poster.webp", bloom: "video/bloom.mp4", card: (k) => `video/card-${k + 1}.mp4`, still: (k) => `video/card-${k + 1}.webp` };

// React does not reliably set the muted attribute, which browsers require for autoplay; do it by hand.
function useAutoplay(ref, on = true) {
  useEffect(() => { const v = ref.current; if (!v || !on) return; v.muted = true; const p = v.play(); if (p && p.catch) p.catch(() => {}); }, [on]);
}

// Full-screen curtain: plays a stop's animated title card, then gets out of the way.
function Curtain({ src, poster, onDone }) {
  const t = useT();
  const [leaving, setLeaving] = useState(false);
  const vref = useRef(null);
  const gone = useRef(false);
  useAutoplay(vref);
  const finish = () => { if (gone.current) return; gone.current = true; setLeaving(true); setTimeout(onDone, 280); };
  useEffect(() => { const id = setTimeout(finish, 5000); const k = (e) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish(); }; addEventListener("keydown", k); return () => { clearTimeout(id); removeEventListener("keydown", k); }; }, []);
  return (
    <div className={"curtain" + (leaving ? " leaving" : "")} onClick={finish} role="dialog" aria-label={t(T("เปิดด่าน", "Opening the stop"))}>
      <video ref={vref} className="curtain-vid" src={src} poster={poster} muted playsInline onEnded={finish} onError={finish} />
      <button className="btn ghost-btn curtain-skip" onClick={(e) => { e.stopPropagation(); finish(); }}>{t(T("ข้าม ▶", "Skip ▶"))}</button>
    </div>
  );
}

// Lotus bloom pop-up when a stop is completed.
function Bloom({ onDone, label }) {
  const t = useT();
  const vref = useRef(null);
  useAutoplay(vref);
  useEffect(() => { const id = setTimeout(onDone, 3400); return () => clearTimeout(id); }, []);
  return (
    <div className="bloom" onClick={onDone} role="status">
      <div className="bloom-card">
        <video ref={vref} src={VID.bloom} poster="video/bloom.webp" muted playsInline />
        <strong>{t(label || T("ได้ดอกบัวแล้ว!", "You earned a lotus!"))}</strong>
      </div>
    </div>
  );
}

// Map thumbnail: frozen on its title frame, plays when hovered or focused.
function StopThumb({ k }) {
  const ref = useRef(null);
  return (
    <span className="thumb"
      onMouseEnter={() => { const v = ref.current; if (v && !reduced()) { v.muted = true; v.play().catch(() => {}); } }}
      onMouseLeave={() => { const v = ref.current; if (v) v.load(); }}>
      <video ref={ref} src={VID.card(k)} poster={VID.still(k)} muted playsInline preload="none" tabIndex={-1} aria-hidden="true" />
    </span>
  );
}

function HeroFilm() {
  const t = useT();
  const ref = useRef(null);
  const [playing, setPlaying] = useState(!reduced());
  useAutoplay(ref, !reduced());
  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) { v.play().catch(() => {}); setPlaying(true); } else { v.pause(); setPlaying(false); } };
  return (
    <div className="film">
      <video ref={ref} src={VID.intro} poster={VID.poster} muted loop playsInline
        aria-label={t(T("ภาพยนตร์เปิดเรื่อง: เณรต้นบุญและเจ้าตูบชวนผจญภัย", "Opening film: Novice Tonboon and Tup invite you on an adventure"))} />
      <button className="film-btn" onClick={toggle}>{playing ? t(T("❚❚ หยุด", "❚❚ Pause")) : t(T("▶ เล่น", "▶ Play"))}</button>
    </div>
  );
}

function App() {
  const [lang, setLang] = useState(() => store.get("lang", "th"));
  const [done, setDone] = useState(() => store.get("done", []));
  const [cur, setCur] = useState(null);
  const [name, setName] = useState(() => store.get("name", ""));
  const [mute, setMute] = useState(false);
  const [curtain, setCurtain] = useState(null);
  const [bloom, setBloom] = useState(false);
  const [episode, setEpisode] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [wheelStars, setWheelStars] = useState(() => store.get("wheel", []));
  useEffect(() => store.set("wheel", wheelStars), [wheelStars]);
  const openLesson = (k) => { audio(); stopVoice(); setCur(null); setEpisode(null); setBloom(false); setLesson(k); setTimeout(() => top.current && top.current.scrollIntoView({ behavior: "auto" }), 0); };
  const [badges, setBadges] = useState(() => store.get("badges", []));
  useEffect(() => store.set("badges", badges), [badges]);
  const openEpisode = (id) => { audio(); stopVoice(); setCur(null); setLesson(null); setEpisode(id); setTimeout(() => top.current && top.current.scrollIntoView({ behavior: "auto" }), 0); };
  const top = useRef(null);
  const doneRef = useRef(done);
  doneRef.current = done;
  useEffect(() => store.set("lang", lang), [lang]);
  useEffect(() => store.set("done", done), [done]);
  useEffect(() => store.set("name", name), [name]);
  useEffect(() => { muted = mute; if (mute) stopVoice(); }, [mute]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const t = (x) => x[lang];
  const go = (k) => {
    audio(); stopVoice();
    setCur(k); setBloom(false); setEpisode(null); setLesson(null);
    if (k != null && !reduced()) { setCurtain(k); sfx.pop(); }
    setTimeout(() => top.current && top.current.scrollIntoView({ behavior: "auto" }), 0);
  };
  const complete = (id) => () => {
    if (doneRef.current.includes(id)) return;
    doneRef.current = [...doneRef.current, id];
    setDone((d) => (d.includes(id) ? d : [...d, id]));
    if (!reduced()) setBloom(true);
  };
  const ch = cur != null ? CHAPTERS[cur] : null;
  return (
    <LangCtx.Provider value={lang}>
      <div ref={top} />
      <header className="topbar">
        <button className="brand" onClick={() => go(null)}>
          <Lotus size={30} />
          <span>{t(T("แดนธรรมะ", "Dhamma Land"))}</span>
        </button>
        <div className="lotus-bar" aria-label={t(T("ดอกบัวที่เก็บได้", "Lotuses collected"))}>
          {CHAPTERS.map((c) => <Lotus key={c.id} on={done.includes(c.id)} size={22} />)}
          <span className="count">{done.length}/{CHAPTERS.length}</span>
        </div>
        <div className="tools">
          <button className="chip" onClick={() => setMute(!mute)} aria-pressed={mute}>{mute ? t(T("เปิดเสียง", "Sound on")) : t(T("ปิดเสียง", "Mute"))}</button>
          <button className="chip" onClick={() => setLang(lang === "th" ? "en" : "th")}>{lang === "th" ? "EN" : "ไทย"}</button>
        </div>
      </header>

      {lesson != null ? (
        <WheelLesson key={lesson + lang} k={lesson} onBack={() => go(null)} onNext={() => openLesson(lesson + 1)}
          onDone={() => { if (!wheelStars.includes(lesson)) { setWheelStars((w) => (w.includes(lesson) ? w : [...w, lesson])); if (!reduced()) setBloom(T("ได้ดาววงล้อธรรม!", "Dhamma Wheel star!")); } }} />
      ) : episode ? (
        <Episode key={lang} onBack={() => go(null)} onDone={() => { if (!badges.includes(episode)) { setBadges([...badges, episode]); if (!reduced()) setBloom(T("ได้ดาวความเพียร!", "Perseverance Star!")); } }} />
      ) : !ch ? (
        <main>
          <section className="hero">
            <HeroFilm />
            <div className="hero-text">
              <span className="eyebrow">{t(T("ผจญภัยกับเณรต้นบุญและเจ้าตูบ", "An adventure with Novice Tonboon & Tup"))}</span>
              <h1>{t(T("ผจญภัยแดนธรรมะ", "Dhamma Land Adventure"))}</h1>
              <p>{t(T("9 ด่าน เรียนรู้คำสอนของพระพุทธเจ้า ผ่านเกม เรื่องเล่า และเสียงหัวเราะ เก็บดอกบัวให้ครบ!", "9 stops to learn the Buddha's teachings through games, stories and giggles. Collect every lotus!"))}</p>
              <button className="btn big hero-btn" onClick={() => go(Math.max(0, CHAPTERS.findIndex((c) => !done.includes(c.id))))}>
                {done.length === 0 ? t(T("เริ่มผจญภัย ▶", "Start the adventure ▶")) : done.length === CHAPTERS.length ? t(T("ดูใบประกาศ ▶", "See my certificate ▶")) : t(T("ผจญภัยต่อ ▶", "Continue ▶"))}
              </button>
            </div>
          </section>

          <Missions onBloom={() => { if (!reduced()) setBloom(T("ปลูกบัวในบ่อแล้ว!", "A lotus for your pond!")); }} />

          <section className="map">
            <h2>{t(T("แผนที่การผจญภัย", "Adventure map"))}</h2>
            <ol className="stops">
              {CHAPTERS.map((c, k) => (
                <li key={c.id}>
                  <button className={"stop col-" + c.col + (done.includes(c.id) ? " got" : "")} onClick={() => go(k)}
                    onFocus={(e) => { const v = e.currentTarget.querySelector("video"); if (v && !reduced()) { v.muted = true; v.play().catch(() => {}); } }}
                    onBlur={(e) => { const v = e.currentTarget.querySelector("video"); if (v) v.load(); }}>
                    <StopThumb k={k} />
                    <span className="stop-body">
                      <span className="num">{k + 1}</span>
                      <span className="stop-text">
                        <span className="stop-title">{t(c.title)}</span>
                        <span className="stop-sub">{t(c.sub)}</span>
                      </span>
                      <span className="stop-lotus"><Lotus on={done.includes(c.id)} size={28} /></span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
          <Theatre open={openEpisode} badges={badges} />
          <WheelArea open={openLesson} stars={wheelStars} />
          <footer className="foot">
            <p>{t(T("สำหรับเด็กอายุประมาณ 8–12 ปี · ผู้ปกครองและคุณครูใช้ประกอบการสอนวิชาพระพุทธศาสนาได้", "For kids aged about 8–12 · Parents and teachers can use it alongside Buddhism lessons"))}</p>
          </footer>
        </main>
      ) : (
        <main className={"chapter col-" + ch.col}>
          <div className="ch-head">
            <button className="btn ghost-btn" onClick={() => go(null)}>{t(T("◀ แผนที่", "◀ Map"))}</button>
            <div>
              <span className="eyebrow">{t(T("ด่านที่", "Stop"))} {cur + 1} · {t(ch.sub)}</span>
              <h1>{t(ch.title)}</h1>
            </div>
          </div>
          <ch.C key={ch.id + lang} complete={complete(ch.id)} lotuses={done.length} total={CHAPTERS.length} name={name} setName={setName} />
          {done.includes(ch.id) && ch.id !== "final" && <Done isLast={cur === CHAPTERS.length - 1} onNext={() => go(cur + 1)} />}
        </main>
      )}
      {curtain != null && <Curtain key={curtain} src={VID.card(curtain)} poster={VID.still(curtain)} onDone={() => setCurtain(null)} />}
      {bloom && curtain == null && <Bloom label={bloom === true ? null : bloom} onDone={() => setBloom(false)} />}
    </LangCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
