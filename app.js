"use strict";
const STORAGE_KEY = 'gummies:position:v3';
const VOTE_KEY = 'gummies:favorite:v1';
const flavors = [
    { id: 'melon', name: 'Дыня', en: 'MELON', ru: 'Солнечный поворот', number: '01', color: '#f6d251', description: 'Солнечно-жёлтая упаковка, спелая дыня и мармеладное настроение.' },
    { id: 'blue', name: 'Голубая малина', en: 'BLUE RASPBERRY', ru: 'За гранью привычного', number: '02', color: '#69aaff', description: 'Непривычно синие ягоды. Знакомая мармеладная улыбка.' },
    { id: 'blackberry', name: 'Ежевика', en: 'BLACKBERRY', ru: 'Тёмная сторона ягод', number: '03', color: '#ff7c94', description: 'Глубокий ягодный цвет и яркая упаковка. Лови свой вкус.' }
];
function readPosition() {
    try {
        const p = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
        return p?.version === 1 && Number.isFinite(p.y) && Number.isFinite(p.progress) && p.y >= 0 && p.progress >= 0 && p.progress <= 1 && ['scene', 'page'].includes(p.zone) && flavors.some(f => f.id === p.flavor) ? p : null;
    }
    catch {
        return null;
    }
}
const restored = readPosition();
const clamp = (n) => Math.max(0, Math.min(1, n));
const packImages = {};
for (const id of ['melon', 'blue', 'blackberry']) {
    const img = new Image();
    img.src = '/assets/packshot-' + id + '.webp';
    packImages[id] = img;
}
const fruitImages = {};
for (const id of ['melon', 'blue', 'blackberry']) {
    const names = id === 'melon' ? ['melon-whole', 'melon-half', 'melon-slice'] : ['left', 'center', 'right'].map(view => (id === 'blue' ? 'blue' : 'red') + '-' + view);
    fruitImages[id] = names.map(name => { const img = new Image(); img.src = '/assets/fruits/' + name + '.png'; return img; });
}
function Arrow() { return React.createElement("span", { "aria-hidden": "true" }, "\u2197"); }
function Avatar({ large = false }) { return React.createElement("img", { className: large ? 'brand-avatar ending-avatar' : 'brand-avatar', src: "/assets/alien-avatar.png", width: "40", height: "40", alt: "", "aria-hidden": "true" }); }
const ProductView = React.forwardRef(({ flavor, mode, className = '' }, ref) => {
    const canvas = React.useRef(null), renderer = React.useRef(null), progress = React.useRef(0), kind = React.useRef(flavor);
    const [generation, setGeneration] = React.useState(0);
    kind.current = flavor;
    React.useImperativeHandle(ref, () => ({ setProgress(p) { progress.current = p; renderer.current?.set(kind.current, p); } }), []);
    React.useLayoutEffect(() => {
        const el = canvas.current;
        const rebuild = () => setGeneration(v => v + 1);
        el.addEventListener('rebuild-model', rebuild);
        try {
            renderer.current = new Candy3D.Renderer(el, mode, kind.current, packImages, fruitImages, () => { });
            renderer.current.set(kind.current, progress.current);
        }
        catch {
            el.dataset.ready = 'false';
            el.dataset.fallback = 'true';
        }
        return () => { el.removeEventListener('rebuild-model', rebuild); renderer.current?.dispose(); renderer.current = null; };
    }, [mode, generation]);
    React.useLayoutEffect(() => { renderer.current?.set(flavor, progress.current); }, [flavor]);
    const hover = (value) => { if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        renderer.current?.set(flavor, progress.current, value); };
    return React.createElement("div", { className: 'product-render ' + className, onPointerEnter: () => hover(.35), onPointerLeave: () => hover(0) },
        React.createElement("canvas", { ref: canvas, role: "img", "aria-label": mode === 'hero' ? 'Три упаковки мармелада: дыня, голубая малина и ежевика' : 'Объёмная упаковка мармелада: ' + flavors.find(f => f.id === flavor).name }),
        React.createElement("img", { className: "model-fallback", src: '/assets/packshot-' + flavor + '.webp', alt: "", "aria-hidden": "true", width: "400", height: "540" }));
});
function App() {
    React.useEffect(() => {
        const loader = document.getElementById('site-loader');
        if (!loader)
            return;
        const frame = requestAnimationFrame(() => { loader.classList.add('is-done'); });
        const timer = setTimeout(() => loader.remove(), 750);
        return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
    }, []);
    const [flavor, setFlavor] = React.useState(restored?.flavor || 'melon');
    const [reduced, setReduced] = React.useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [chapter, setChapter] = React.useState(0);
    const [vote, setVote] = React.useState(() => { try {
        const v = localStorage.getItem(VOTE_KEY);
        return flavors.some(f => f.id === v) ? v : null;
    }
    catch {
        return null;
    } });
    const [voteStatus, setVoteStatus] = React.useState('');
    const trackRef = React.useRef(null), stageRef = React.useRef(null), triggerRef = React.useRef(null);
    const sceneModel = React.useRef(null), heroModel = React.useRef(null);
    const flavorRef = React.useRef(flavor), initializedRef = React.useRef(false);
    flavorRef.current = flavor;
    const current = flavors.find(f => f.id === flavor);
    React.useEffect(() => { const q = matchMedia('(prefers-reduced-motion: reduce)'), listener = () => setReduced(q.matches); q.addEventListener('change', listener); return () => q.removeEventListener('change', listener); }, []);
    React.useLayoutEffect(() => {
        const track = trackRef.current, stage = stageRef.current;
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ autoRefreshEvents: 'none' });
        let timeline = null, trigger = null;
        let resizeTimer, saveFrame = 0, lastProgress = restored?.zone === 'scene' ? restored.progress : 0, lastZone = 'page', resizing = false, ready = false;
        const paint = (phase) => {
            sceneModel.current?.setProgress(phase);
            const flight = Candy3D.flight(phase), from = flavors.find(f => f.id === flight.from), to = flavors.find(f => f.id === flight.to);
            stage.dataset.progress = phase.toFixed(6);
            stage.dataset.transition = String(flight.transition);
            stage.style.setProperty('--progress', String(phase));
            stage.style.setProperty('--portal-top', (flight.cut * 100) + '%');
            stage.style.setProperty('--world-from', from.color);
            stage.style.setProperty('--world-to', to.color);
            setChapter(phase < .24 ? 0 : phase < .52 ? 1 : phase < .76 ? 2 : 3);
            setFlavor(flight.kind);
            flavorRef.current = flight.kind;
        };
        const context = gsap.context(() => {
            if (!reduced) {
                const motion = { progress: 0 };
                timeline = gsap.timeline({ paused: true }).to(motion, { progress: 1, duration: 1, ease: 'none', onUpdate: () => paint(motion.progress) });
                trigger = ScrollTrigger.create({ trigger: track, start: 'top top', end: () => '+=' + Math.max(1, track.offsetHeight - stage.offsetHeight), onUpdate(self) {
                        const phase = Number(self.progress.toFixed(6));
                        if (!resizing) {
                            lastProgress = phase;
                            lastZone = self.isActive || (phase > 0 && phase < 1) ? 'scene' : 'page';
                        }
                        timeline.progress(phase);
                    } });
                triggerRef.current = trigger;
                ScrollTrigger.create({ trigger: '#top', start: 'top top', end: 'bottom top', onUpdate(self) { heroModel.current?.setProgress(self.progress); } });
            }
            else {
                setChapter(0);
                stage.dataset.progress = 'static';
                sceneModel.current?.setProgress(.84);
            }
        });
        const persist = () => {
            if (!ready || resizing)
                return;
            const zone = trigger && window.scrollY >= trigger.start && window.scrollY <= trigger.end ? 'scene' : 'page';
            // ScrollTrigger's normalized progress is the source of truth. Reading
            // scrollTop here would quantize it to a whole pixel before a refresh.
            const progress = trigger && zone === 'scene' ? clamp(lastProgress) : 0;
            lastProgress = progress;
            lastZone = zone;
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, y: window.scrollY, progress, zone, flavor: flavorRef.current, time: Date.now() }));
            }
            catch { /* Storage may be disabled. Scrolling still works. */ }
        };
        const onScroll = () => { cancelAnimationFrame(saveFrame); saveFrame = requestAnimationFrame(persist); };
        const forceSceneProgress = (progress) => {
            timeline?.progress(progress);
            paint(progress);
            lastProgress = progress;
            lastZone = 'scene';
        };
        const restore = () => {
            ScrollTrigger.refresh();
            const savedSceneProgress = restored?.zone === 'scene' && trigger ? restored.progress : null;
            if (!initializedRef.current && restored) {
                const y = restored.zone === 'scene' && trigger ? trigger.start + restored.progress * (trigger.end - trigger.start) : restored.y;
                window.scrollTo({ top: y, behavior: 'instant' });
            }
            initializedRef.current = true;
            ScrollTrigger.update();
            if (trigger && timeline) {
                const progress = clamp((window.scrollY - trigger.start) / (trigger.end - trigger.start));
                forceSceneProgress(savedSceneProgress ?? progress);
            }
            ready = true;
            // Browsers round scrollTop to a whole pixel. Reapply the stored normalized
            // phase on the next frame so refresh shows the exact same rendered pose.
            if (savedSceneProgress !== null)
                requestAnimationFrame(() => forceSceneProgress(savedSceneProgress));
            else
                persist();
        };
        restore();
        const onResize = () => {
            const progress = lastProgress;
            const zone = lastZone;
            resizing = true;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                ScrollTrigger.refresh();
                if (trigger && zone === 'scene')
                    window.scrollTo({ top: trigger.start + progress * (trigger.end - trigger.start), behavior: 'instant' });
                ScrollTrigger.update();
                resizing = false;
                persist();
            }, 120);
        };
        const onPageShow = (event) => { if (event.persisted) {
            ScrollTrigger.refresh();
            ScrollTrigger.update();
        } };
        const onVisibility = () => { if (document.visibilityState === 'hidden')
            persist(); };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        window.addEventListener('pagehide', persist);
        window.addEventListener('pageshow', onPageShow);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            persist();
            ready = false;
            clearTimeout(resizeTimer);
            cancelAnimationFrame(saveFrame);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            window.removeEventListener('pagehide', persist);
            window.removeEventListener('pageshow', onPageShow);
            document.removeEventListener('visibilitychange', onVisibility);
            context.revert();
            triggerRef.current = null;
        };
    }, [reduced]);
    function castVote(id) { setVote(id); try {
        localStorage.setItem(VOTE_KEY, id);
        setVoteStatus('Твой выбор — ' + flavors.find(f => f.id === id).name + '. Сохранён в этом браузере.');
    }
    catch {
        setVoteStatus('Твой выбор — ' + flavors.find(f => f.id === id).name + '. Сохранён до закрытия страницы.');
    } }
    function toggleMotion() { setReduced(value => !value); requestAnimationFrame(() => trackRef.current?.scrollIntoView({ behavior: 'instant' })); }
    return React.createElement("div", { className: 'app flavor-' + flavor + (reduced ? ' is-reduced' : ''), style: { '--flavor': current.color } },
        React.createElement("svg", { width: "0", height: "0", "aria-hidden": "true", style: { position: 'absolute' } },
            React.createElement("defs", null,
                React.createElement("filter", { id: "avatar-cutout", colorInterpolationFilters: "sRGB" },
                    React.createElement("feColorMatrix", { type: "matrix", values: "0 0 0 0 0  0 0 0 0 1  0 0 0 0 0  0 1 0 0 0" })))),
        React.createElement("a", { className: "skip-link", href: "#scene" }, "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u043F\u043E\u043B\u0451\u0442\u0443"),
        React.createElement("header", { className: "site-header" },
            React.createElement("a", { className: "wordmark", href: "#top", "aria-label": "\u0428\u043A\u0440\u0435\u0434\u0441\u044B \u2014 \u0432 \u043D\u0430\u0447\u0430\u043B\u043E" },
                "\u0428\u041A\u0420\u0415\u0414\u0421\u042B",
                React.createElement(Avatar, null)),
            React.createElement("nav", { "aria-label": "\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F" },
                React.createElement("a", { href: "#scene" }, "\u0412 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0438")),
            React.createElement("span", { className: "header-note" }, "\u0414\u0438\u0437\u0430\u0439\u043D-\u043A\u043E\u043D\u0446\u0435\u043F\u0442 \u00B7 2026")),
        React.createElement("main", null,
            React.createElement("section", { className: "hero", id: "top", "aria-labelledby": "hero-title" },
                React.createElement("div", { className: "hero-grid", "aria-hidden": "true" }),
                React.createElement("div", { className: "hero-topline" },
                    React.createElement("span", null,
                        React.createElement("i", { className: "status-dot" }),
                        " \u041C\u0410\u0420\u041C\u0415\u041B\u0410\u0414 \u0421 \u0425\u0410\u0420\u0410\u041A\u0422\u0415\u0420\u041E\u041C"),
                    React.createElement("span", null, "\u0422\u0420\u0418 \u0412\u041A\u0423\u0421\u0410 / \u041E\u0414\u041D\u041E \u041F\u0420\u0418\u041A\u041B\u042E\u0427\u0415\u041D\u0418\u0415")),
                React.createElement("div", { className: "hero-copy" },
                    React.createElement("p", { className: "eyebrow" }, "\u041D\u0415 \u0414\u0415\u0420\u0416\u0418 \u0421\u0415\u0411\u042F \u0412 \u0420\u0410\u041C\u041A\u0410\u0425"),
                    React.createElement("h1", { id: "hero-title" },
                        "\u0412\u041A\u0423\u0421",
                        React.createElement("br", null),
                        "\u0411\u0415\u0417 ",
                        React.createElement("span", null, "\u041F\u0420\u0410\u0412\u0418\u041B.")),
                    React.createElement("p", { className: "hero-description" },
                        "\u0414\u044B\u043D\u044F, \u0433\u043E\u043B\u0443\u0431\u0430\u044F \u043C\u0430\u043B\u0438\u043D\u0430 \u0438 \u0435\u0436\u0435\u0432\u0438\u043A\u0430.",
                        React.createElement("br", null),
                        "\u0422\u0440\u0438 \u0432\u043A\u0443\u0441\u0430. \u041E\u0434\u0438\u043D \u043F\u043E\u043B\u0451\u0442.")),
                React.createElement("div", { className: "hero-art" },
                    React.createElement("div", { className: "hero-orbit", "aria-hidden": "true" }),
                    React.createElement(ProductView, { ref: heroModel, mode: "hero", flavor: "melon" }),
                    React.createElement("span", { className: "hero-sticker", "aria-hidden": "true" },
                        "\u041B\u041E\u0412\u0418",
                        React.createElement("br", null),
                        "\u0412\u041A\u0423\u0421 \u2197")),
                React.createElement("div", { className: "hero-bottom" },
                    React.createElement("span", null,
                        "\u0421\u041B\u0410\u0414\u041A\u0418\u0419 \u0425\u0410\u041E\u0421.",
                        React.createElement("br", null),
                        "\u042F\u0413\u041E\u0414\u041D\u042B\u0419 \u041A\u041E\u0421\u041C\u041E\u0421."),
                    React.createElement("a", { href: "#scene" },
                        "\u041F\u0440\u043E\u043A\u0440\u0443\u0442\u0438 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0433\u043B\u0430\u0437\u0430\u043C\u0438 ",
                        React.createElement("span", null, "\u2193")),
                    React.createElement("span", { className: "hero-index" }, "01 \u2014 03"))),
            React.createElement("div", { className: "flavor-ribbon", "aria-hidden": "true" },
                React.createElement("span", null, "\u0414\u042B\u041D\u042F"),
                React.createElement("b", { className: "graphic-spark" }),
                React.createElement("span", null, "\u0413\u041E\u041B\u0423\u0411\u0410\u042F \u041C\u0410\u041B\u0418\u041D\u0410"),
                React.createElement("b", { className: "graphic-spark" }),
                React.createElement("span", null, "\u0415\u0416\u0415\u0412\u0418\u041A\u0410"),
                React.createElement("b", { className: "graphic-spark" }),
                React.createElement("span", null, "\u041B\u041E\u0412\u0418 \u0421\u0412\u041E\u0419 \u0412\u041A\u0423\u0421")),
            React.createElement("section", { className: "scene-track", id: "scene", ref: trackRef, "aria-label": "\u041F\u043E\u043B\u0451\u0442 \u0441\u043A\u0432\u043E\u0437\u044C \u0442\u0440\u0438 \u0432\u043A\u0443\u0441\u0430" },
                React.createElement("div", { className: "scene-stage", ref: stageRef },
                    React.createElement("div", { className: "scene-wash world-from", "aria-hidden": "true" }),
                    React.createElement("div", { className: "scene-wash world-to", "aria-hidden": "true" }),
                    React.createElement("div", { className: "scene-grain", "aria-hidden": "true" }),
                    React.createElement("div", { className: "scene-top" },
                        React.createElement("a", { href: "#top" }, "\u2190 \u0412 \u043D\u0430\u0447\u0430\u043B\u043E"),
                        React.createElement("span", null, chapter === 3 ? 'ВЫБЕРИ СВОЮ СТОРОНУ' : current.en + ' / ШКРЕДСЫ'),
                        React.createElement("a", { href: "#channels" }, "\u041D\u0430 \u0441\u0432\u044F\u0437\u0438 \u2197")),
                    reduced && React.createElement("div", { className: "motion-invite" },
                        React.createElement("div", null,
                            React.createElement("strong", null, "\u041F\u043E\u0441\u043C\u043E\u0442\u0440\u0438 \u0432\u043A\u0443\u0441\u044B \u0432 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0438"),
                            React.createElement("p", null, "\u0412\u043A\u043B\u044E\u0447\u0438 \u043F\u043E\u043B\u0451\u0442 \u0443\u043F\u0430\u043A\u043E\u0432\u043E\u043A \u0438 \u043B\u0438\u0441\u0442\u0430\u0439 \u0432\u043D\u0438\u0437.")),
                        React.createElement("button", { type: "button", className: "motion-enable", onClick: toggleMotion },
                            "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 ",
                            React.createElement("span", { "aria-hidden": "true" }, "\u2192"))),
                    React.createElement("div", { className: "scene-visual" },
                        React.createElement(ProductView, { ref: sceneModel, mode: "scene", flavor: flavor })),
                    React.createElement("div", { className: "flavor-gate", "aria-hidden": "true" },
                        React.createElement("span", null, "\u041F\u0415\u0420\u0415\u0421\u0415\u041A\u0410\u0419 \u0413\u0420\u0410\u041D\u0418\u0426\u042B \u0412\u041A\u0423\u0421\u0410"),
                        React.createElement("i", null),
                        React.createElement("b", { className: "graphic-spark" })),
                    React.createElement("div", { className: "scene-copy-stack" },
                        React.createElement("article", { className: 'scene-copy ' + (chapter === 0 ? 'is-active' : ''), "aria-hidden": !reduced && chapter !== 0 },
                            React.createElement("p", { className: "eyebrow" }, "01 / \u0414\u042B\u041D\u042F"),
                            React.createElement("h2", { id: "scene-title", tabIndex: -1 },
                                "\u041B\u043E\u0432\u0438",
                                React.createElement("br", null),
                                React.createElement("em", null, "\u0441\u043E\u043B\u043D\u0446\u0435.")),
                            React.createElement("p", null,
                                "\u0414\u044B\u043D\u044F \u0432 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u043C \u043F\u043E\u043B\u0451\u0442\u0435.",
                                React.createElement("br", null),
                                "\u0417\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u043B\u0438\u043D\u0438\u0435\u0439 \u0432\u0441\u0451 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u0441\u044F.")),
                        React.createElement("article", { className: 'scene-copy ' + (chapter === 1 ? 'is-active' : ''), "aria-hidden": !reduced && chapter !== 1 },
                            React.createElement("p", { className: "eyebrow" }, "02 / \u0413\u041E\u041B\u0423\u0411\u0410\u042F \u041C\u0410\u041B\u0418\u041D\u0410"),
                            React.createElement("h2", null,
                                "\u041F\u043E \u0442\u0443 \u0441\u0442\u043E\u0440\u043E\u043D\u0443",
                                React.createElement("br", null),
                                React.createElement("em", null, "\u043E\u0431\u044B\u0447\u043D\u043E\u0433\u043E.")),
                            React.createElement("p", null,
                                "\u041F\u0435\u0440\u0435\u0441\u0451\u043A \u0433\u0440\u0430\u043D\u0438\u0446\u0443 \u2014 \u0441\u043C\u0435\u043D\u0438\u043B \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435.",
                                React.createElement("br", null),
                                "\u0422\u0435\u043F\u0435\u0440\u044C \u0432\u0435\u0441\u044C \u043C\u0438\u0440 \u0432 \u0441\u0438\u043D\u0438\u0445 \u044F\u0433\u043E\u0434\u0430\u0445.")),
                        React.createElement("article", { className: 'scene-copy ' + (chapter === 2 ? 'is-active' : ''), "aria-hidden": !reduced && chapter !== 2 },
                            React.createElement("p", { className: "eyebrow" }, "03 / \u0415\u0416\u0415\u0412\u0418\u041A\u0410"),
                            React.createElement("h2", null,
                                "\u042F\u0433\u043E\u0434\u043D\u044B\u0439",
                                React.createElement("br", null),
                                React.createElement("em", null, "\u043F\u0435\u0440\u0435\u0432\u043E\u0440\u043E\u0442.")),
                            React.createElement("p", null,
                                "\u0415\u0449\u0451 \u043E\u0434\u043D\u0430 \u043B\u0438\u043D\u0438\u044F. \u0415\u0449\u0451 \u043E\u0434\u0438\u043D \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440.",
                                React.createElement("br", null),
                                "\u0422\u0440\u0438 \u0432\u043A\u0443\u0441\u0430 \u2014 \u0438 \u0432\u044B\u0431\u043E\u0440 \u0437\u0430 \u0442\u043E\u0431\u043E\u0439.")),
                        React.createElement("article", { className: 'scene-copy vote-panel ' + (chapter === 3 ? 'is-active' : ''), "aria-hidden": !reduced && chapter !== 3 },
                            React.createElement("p", { className: "eyebrow" }, "\u0424\u0418\u041D\u0410\u041B / \u0422\u0412\u041E\u0419 \u0413\u041E\u041B\u041E\u0421"),
                            React.createElement("h2", null,
                                "\u041A\u0442\u043E \u0437\u0430\u0431\u0438\u0440\u0430\u0435\u0442",
                                React.createElement("br", null),
                                React.createElement("em", null, "\u0442\u0432\u043E\u0451 \u0441\u0435\u0440\u0434\u0435\u0447\u043A\u043E?")),
                            React.createElement("div", { className: "vote-options", role: "group", "aria-label": "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043B\u044E\u0431\u0438\u043C\u044B\u0439 \u0432\u043A\u0443\u0441" }, flavors.map(f => React.createElement("button", { key: f.id, type: "button", style: { '--vote-color': f.color }, "aria-pressed": vote === f.id, tabIndex: reduced || chapter === 3 ? 0 : -1, onClick: () => castVote(f.id) },
                                React.createElement("span", null, vote === f.id ? '♥' : '♡'),
                                f.name))),
                            React.createElement("p", { className: "vote-status", role: "status" }, voteStatus || (vote ? 'Твой выбор — ' + flavors.find(f => f.id === vote).name + '. Можно передумать.' : 'Выбери фаворита. Можно изменить свой выбор.')),
                            React.createElement("small", null, "\u0412\u044B\u0431\u043E\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435. \u041E\u0431\u0449\u0438\u0439 \u043F\u043E\u0434\u0441\u0447\u0451\u0442 \u043F\u043E\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D."))),
                    React.createElement("div", { className: "scene-footer" },
                        React.createElement("button", { type: "button", className: "motion-toggle", onClick: toggleMotion, "aria-pressed": reduced }, reduced ? 'Включить движение ↗' : 'Без движения'),
                        React.createElement("span", { className: "scroll-cue" }, chapter === 3 ? 'Листай дальше — больше вкуса ↓' : 'Листай — пересекай границы ↓'),
                        React.createElement("div", { className: "scene-progress", "aria-hidden": "true" },
                            React.createElement("i", null)),
                        React.createElement("span", null, chapter === 3 ? '03 / 03' : String(chapter + 1).padStart(2, '0') + ' / 03')))),
            React.createElement("section", { className: "ending", "aria-labelledby": "ending-title" },
                React.createElement("p", { className: "eyebrow" }, "\u041C\u0410\u0420\u041C\u0415\u041B\u0410\u0414 \u041D\u0415 \u041E\u0411\u042F\u0417\u0410\u041D \u0411\u042B\u0422\u042C \u0421\u041A\u0423\u0427\u041D\u042B\u041C."),
                React.createElement("h2", { id: "ending-title" },
                    "\u0411\u041E\u041B\u042C\u0428\u0415 \u0412\u041A\u0423\u0421\u0410.",
                    React.createElement("br", null),
                    React.createElement("span", null, "\u041C\u0415\u041D\u042C\u0428\u0415 \u0420\u0410\u041C\u041E\u041A.")),
                React.createElement("div", { className: "marketplaces", "aria-label": "\u041A\u0443\u043F\u0438\u0442\u044C \u043D\u0430 \u043C\u0430\u0440\u043A\u0435\u0442\u043F\u043B\u0435\u0439\u0441\u0430\u0445" },
                    React.createElement("p", null, "\u041C\u042B \u041D\u0410 \u041C\u0410\u0420\u041A\u0415\u0422\u041F\u041B\u0415\u0419\u0421\u0410\u0425"),
                    React.createElement("div", null,
                        React.createElement("a", { href: "https://www.ozon.ru/product/zhevatelnyy-marmelad-kislyy-i-sladkiy-shkredsy-v-paketikah-9-pachek-5482172781/?oos_search=false&sh=fcFCyg7cSw", target: "_blank", rel: "noopener noreferrer" }, "Ozon"),
                        React.createElement("a", { href: "https://www.wildberries.ru/catalog/1360987641/detail.aspx?size=2024898341", target: "_blank", rel: "noopener noreferrer" }, "Wildberries"))),
                React.createElement(Avatar, { large: true }))),
        React.createElement("footer", { className: "site-footer" },
            React.createElement("div", { id: "channels", className: "footer-socials" },
                React.createElement("p", null, "\u0411\u041E\u041B\u042C\u0428\u0415 \u0428\u041A\u0420\u0415\u0414\u0421\u041E\u0412 \u2014 \u0412 \u0421\u041E\u0426\u0421\u0415\u0422\u042F\u0425"),
                React.createElement("nav", { "aria-label": "\u0421\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0435 \u0441\u0435\u0442\u0438" },
                    React.createElement("a", { href: "https://t.me/shkredsy", target: "_blank", rel: "noopener noreferrer" },
                        "Telegram ",
                        React.createElement(Arrow, null)),
                    React.createElement("a", { href: "https://www.tiktok.com/@shkredsyy?_r=1&_t=ZG-997qMLOF2wb", target: "_blank", rel: "noopener noreferrer" },
                        "TikTok ",
                        React.createElement(Arrow, null)),
                    React.createElement("a", { href: "https://www.youtube.com/channel/UCBPTjBM86PJQBHsRTfK_kzA", target: "_blank", rel: "noopener noreferrer" },
                        "YouTube ",
                        React.createElement(Arrow, null)),
                    React.createElement("a", { href: "https://www.instagram.com/shkredsy?igsh=MTlzZDdqc2NqaXl5eg%3D%3D", target: "_blank", rel: "noopener noreferrer" },
                        "Instagram ",
                        React.createElement(Arrow, null)))),
            React.createElement("a", { className: "wordmark", href: "#top" },
                "\u0428\u041A\u0420\u0415\u0414\u0421\u042B",
                React.createElement(Avatar, null)),
            React.createElement("p", null, "\u0414\u0438\u0437\u0430\u0439\u043D-\u043A\u043E\u043D\u0446\u0435\u043F\u0442 \u00B7 2026"),
            React.createElement("a", { href: "#top" }, "\u041D\u0430\u0432\u0435\u0440\u0445 \u2191"),
            React.createElement("p", { className: "site-hashtag" }, "#\u0448\u043A\u0440\u0435\u0434\u0441\u044B\u043C\u0430\u0440\u043C\u0435\u043B\u0430\u0434")));
}
const firstArtwork = new Image();
firstArtwork.src = '/assets/pack-melon.svg';
const artwork = [...Object.values(packImages), firstArtwork, ...Object.values(fruitImages).flat()];
let loadedArtwork = 0;
Promise.all(artwork.map(img => img.decode().then(() => {
    loadedArtwork++;
    document.getElementById('site-loader')?.style.setProperty('--loaded', String(loadedArtwork / artwork.length));
}))).then(() => { ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App, null)); }).catch(() => { document.getElementById('site-loader')?.remove(); const message = document.createElement('p'); message.textContent = 'Интерактивная сцена пока не загрузилась. Статичная версия остаётся доступной.'; document.querySelector('.initial')?.appendChild(message); });
/** Small project-owned WebGL renderer. No external 3D library or network calls. */
var Candy3D;
(function (Candy3D) {
    function flight(p) {
        for (const [start, end, from, to] of [[.18, .30, 'melon', 'blue'], [.46, .58, 'blue', 'blackberry']]) {
            if (p >= start && p <= end) {
                const t = (p - start) / (end - start);
                return { from, to, cut: 1.25 - t * 1.5, transition: true, kind: t < .5 ? from : to };
            }
        }
        const kind = p < .24 ? 'melon' : p < .52 ? 'blue' : 'blackberry';
        return { from: kind, to: kind, cut: -1, transition: false, kind };
    }
    Candy3D.flight = flight;
    const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    function multiply(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
            for (let k = 0; k < 4; k++)
                o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
    function matrix(t = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
        const [x, y, z] = r, cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
        const rx = new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
        const ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
        const rz = new Float32Array([cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        const tr = identity();
        tr[12] = t[0];
        tr[13] = t[1];
        tr[14] = t[2];
        const sc = identity();
        sc[0] = s[0];
        sc[5] = s[1];
        sc[10] = s[2];
        return multiply(multiply(multiply(multiply(tr, rz), ry), rx), sc);
    }
    function perspective(aspect) { const f = 1 / Math.tan(40 * Math.PI / 360), n = .1, far = 50; return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + n) / (n - far), -1, 0, 0, 2 * far * n / (n - far), 0]); }
    function normalized(a) { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const blend = (a, b, t) => a + (b - a) * t;
    const smooth = (v) => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); };
    const colors = { melon: [.94, .68, .05], blue: [.74, .34, .62], blackberry: [.8, .08, .16] };
    // Texture bounds of reconstructed front packshots, ordered TL, TR, BL, BR.
    const crops = {
        melon: [.046, .036, .956, .036, .046, .963, .956, .963],
        blue: [.031, .05, .97, .05, .031, .959, .97, .959],
        blackberry: [.018, .029, .98, .029, .018, .969, .98, .969]
    };
    const vertex = `attribute vec3 aPosition; attribute vec3 aNormal; attribute vec2 aUV;
    uniform mat4 uMVP; uniform mat4 uModel; varying vec3 vNormal; varying vec3 vWorld; varying vec2 vUV;
    void main(){ vec4 w=uModel*vec4(aPosition,1.);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);vUV=aUV;gl_Position=uMVP*vec4(aPosition,1.); }`;
    const fragment = `precision mediump float; varying vec3 vNormal; varying vec3 vWorld; varying vec2 vUV;
    uniform sampler2D uTexture; uniform vec3 uColor; uniform float uMaterial; uniform vec2 uCorners[4];
    void main(){
      vec3 n=normalize(vNormal);
      vec3 light=normalize(vec3(-3.,5.,7.)-vWorld), eye=normalize(vec3(0.,0.,9.)-vWorld);
      vec3 c=uColor;float gloss=36.;float specPower=.24;
      if(uMaterial>.5&&uMaterial<1.5){vec2 top=mix(uCorners[0],uCorners[1],vUV.x);vec2 bot=mix(uCorners[2],uCorners[3],vUV.x);vec4 tex=texture2D(uTexture,mix(top,bot,vUV.y));c=mix(uColor,tex.rgb,tex.a);gloss=85.;specPower=.3;}
      if(uMaterial>1.5&&uMaterial<2.5){
        float edge=step(.91,vUV.y)+step(vUV.y,.085);c*=1.-edge*.16*(.5+.5*sin(vUV.x*230.));
        float seam=smoothstep(.035,.015,abs(vUV.x-.5));c=mix(c,c*.72,seam);gloss=72.;specPower=.75;
      }
      if(uMaterial>2.5&&uMaterial<3.5){float cells=abs(sin(vWorld.x*32.+sin(vWorld.y*23.))*cos(vWorld.y*34.+sin(vWorld.z*27.)));c=mix(c,vec3(.91,.85,.54),smoothstep(.07,0.,cells)*.7);gloss=20.;specPower=.12;}
      if(uMaterial>3.5&&uMaterial<4.5){float grain=fract(sin(dot(vUV,vec2(127.1,311.7)))*43758.5453);c*=.9+.18*grain;gloss=48.;specPower=.38;}
      if(uMaterial>4.5){vec4 tex=texture2D(uTexture,vUV);if(tex.a<.04)discard;c=tex.rgb;gloss=24.;specPower=.24;}
      float diffuse=max(0.,dot(n,light));float soft=max(0.,dot(n,normalize(vec3(4.,1.,3.))));
      float shine=pow(max(0.,dot(n,normalize(light+eye))),gloss)*specPower;
      float rim=pow(1.-max(0.,dot(n,eye)),3.)*.16;
      vec3 result=c*(.54+.48*diffuse+.15*soft)+vec3(shine)+vec3(.78,.88,1.)*rim;
      gl_FragColor=vec4(result,1.);
    }`;
    function grid(surface, nx, ny, reverse = false) {
        const result = [];
        function push(u, v) { const p = surface(u, v), du = sub(surface(Math.min(1, u + .001), v), surface(Math.max(0, u - .001), v)), dv = sub(surface(u, Math.min(1, v + .001)), surface(u, Math.max(0, v - .001))); let n = normalized(cross(du, dv)); if (reverse)
            n = n.map(x => -x); result.push(...p, ...n, u, v); }
        for (let y = 0; y < ny; y++)
            for (let x = 0; x < nx; x++) {
                const u = x / nx, v = y / ny, uu = (x + 1) / nx, vv = (y + 1) / ny;
                push(u, v);
                push(uu, v);
                push(u, vv);
                push(u, vv);
                push(uu, v);
                push(uu, vv);
            }
        return new Float32Array(result);
    }
    function pouch(u, v, back = false) {
        const px = 2 * u - 1, py = 1 - 2 * v, center = Math.pow(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * v)), .62);
        const wrinkle = (Math.sin(u * 51 + v * 7) * .018 + Math.cos(v * 47 - u * 8) * .012) * Math.pow(Math.abs(px), 2) * Math.sin(Math.PI * v);
        const crimp = (v < .055 || v > .945) ? Math.sin(u * 230) * .01 : 0;
        return [px * (1.04 + .035 * Math.sin(v * Math.PI)), py * 1.4, (back ? -1 : 1) * (.024 + .32 * center + wrinkle + crimp)];
    }
    class Renderer {
        constructor(canvas, mode, kind, images, fruitImages, onReady) {
            this.canvas = canvas;
            this.mode = mode;
            this.uniforms = {};
            this.meshes = [];
            this.textures = {};
            this.seams = [];
            this.fruitAssets = { melon: [], blue: [], blackberry: [] };
            this.progress = 0;
            this.hover = 0;
            this.destroyed = false;
            this.lost = false;
            this.view = identity();
            this.projection = identity();
            this.onLost = (e) => { e.preventDefault(); this.lost = true; this.canvas.dataset.ready = 'false'; };
            this.onRestore = () => { this.canvas.dispatchEvent(new CustomEvent('rebuild-model')); };
            this.kind = kind;
            this.readyCallback = onReady;
            const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
            if (!gl)
                throw new Error('WebGL unavailable');
            this.gl = gl;
            const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(shader) || 'Shader error'); return shader; };
            const program = gl.createProgram(), vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS))
                throw new Error(gl.getProgramInfoLog(program) || 'Program error');
            this.program = program;
            this.attributes = ['aPosition', 'aNormal', 'aUV'].map(n => gl.getAttribLocation(program, n));
            ['uMVP', 'uModel', 'uColor', 'uMaterial', 'uTexture', 'uCorners[0]'].forEach(n => this.uniforms[n] = gl.getUniformLocation(program, n));
            this.front = this.mesh(grid((u, v) => pouch(u, v), 32, 44, true));
            this.back = this.mesh(grid((u, v) => pouch(u, v, true), 24, 36, false));
            for (const side of [0, 1])
                this.seams.push(this.mesh(grid((u, v) => { const a = pouch(side, v), b = pouch(side, v, true); return [a[0], a[1], blend(a[2], b[2], u)]; }, 2, 44)));
            for (const edge of [0, 1])
                this.seams.push(this.mesh(grid((u, v) => { const a = pouch(u, edge), b = pouch(u, edge, true); return [a[0], a[1], blend(a[2], b[2], v)]; }, 32, 2)));
            this.sphere = this.mesh(grid((u, v) => { const a = u * 2 * Math.PI, b = .001 + v * (Math.PI - .002); return [Math.cos(a) * Math.sin(b), Math.cos(b), Math.sin(a) * Math.sin(b)]; }, 18, 14, false));
            this.disc = this.mesh(grid((u, v) => { const a = u * Math.PI * 2; return [Math.cos(a) * v, Math.sin(a) * v, .025 * (1 - v * v)]; }, 30, 10, true));
            for (const id of ['melon', 'blue', 'blackberry']) {
                const texture = gl.createTexture();
                this.textures[id] = texture;
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images[id]);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            }
            for (const kind of ['melon', 'blue', 'blackberry']) {
                this.fruitAssets[kind] = fruitImages[kind].map(img => {
                    const aspect = img.naturalWidth / img.naturalHeight;
                    const mesh = this.mesh(grid((u, v) => [(2 * u - 1) * 1.2, (1 - 2 * v) * 1.2 / aspect, 0], 1, 1, true));
                    const texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    return { mesh, texture };
                });
            }
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            gl.clearColor(0, 0, 0, 0);
            canvas.addEventListener('webglcontextlost', this.onLost);
            canvas.addEventListener('webglcontextrestored', this.onRestore);
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(canvas);
            this.resize();
        }
        mesh(data) { const g = this.gl, b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW); const m = { buffer: b, count: data.length / 8 }; this.meshes.push(m); return m; }
        resize() { if (this.destroyed || this.lost)
            return; const r = this.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, this.mode === 'scene' ? 1.5 : 1.25); if (r.width < 1 || r.height < 1)
            return; this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr); this.gl.viewport(0, 0, this.canvas.width, this.canvas.height); this.projection = perspective(r.width / r.height); this.view = matrix([0, 0, -9]); this.draw(); }
        set(kind, progress, hover = 0) { this.kind = kind; this.progress = progress; this.hover = hover; this.draw(); }
        render(mesh, model, color, material = 0) { const g = this.gl; g.bindBuffer(g.ARRAY_BUFFER, mesh.buffer); this.attributes.forEach((a, i) => { g.enableVertexAttribArray(a); g.vertexAttribPointer(a, i === 2 ? 2 : 3, g.FLOAT, false, 32, i === 0 ? 0 : i === 1 ? 12 : 24); }); g.uniformMatrix4fv(this.uniforms.uModel, false, model); g.uniformMatrix4fv(this.uniforms.uMVP, false, multiply(this.projection, multiply(this.view, model))); g.uniform3fv(this.uniforms.uColor, color); g.uniform1f(this.uniforms.uMaterial, material); g.drawArrays(g.TRIANGLES, 0, mesh.count); }
        bag(parent, kind = this.kind) { const g = this.gl; g.bindTexture(g.TEXTURE_2D, this.textures[kind]); g.uniform2fv(this.uniforms['uCorners[0]'], new Float32Array(crops[kind])); this.render(this.front, parent, colors[kind], 1); this.render(this.back, parent, colors[kind], 2); this.seams.forEach(m => this.render(m, parent, colors[kind], 2)); }
        fruit(parent, kind, size = 1, variant = 0) {
            const item = this.fruitAssets[kind][variant % this.fruitAssets[kind].length];
            this.gl.bindTexture(this.gl.TEXTURE_2D, item.texture);
            this.render(item.mesh, multiply(parent, matrix([0, 0, 0], [0, 0, 0], [size, size, size])), [1, 1, 1], 5);
        }
        draw() {
            if (this.destroyed || this.lost)
                return;
            const g = this.gl, p = this.progress;
            g.useProgram(this.program);
            g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
            g.activeTexture(g.TEXTURE0);
            g.bindTexture(g.TEXTURE_2D, this.textures[this.kind]);
            g.uniform1i(this.uniforms.uTexture, 0);
            const aspect = this.canvas.width / this.canvas.height;
            if (this.mode === 'card') {
                this.bag(matrix([0, -.05, 0], [-.07 + .1 * this.hover, -.16 + .8 * this.hover, -.13], [1.5, 1.5, 1.5]));
            }
            else if (this.mode === 'hero') {
                const spread = Math.min(1.32, aspect * 1.2), scale = Math.min(1.13, aspect * .91);
                this.bag(matrix([-spread, .28, -.35], [-.12, -.22, -.25], [scale, scale, scale]), 'melon');
                this.bag(matrix([spread, .38, -.5], [-.08, .2, .24], [scale, scale, scale]), 'blackberry');
                this.bag(matrix([0, -.4, .6], [-.08, -.1, .035], [scale * 1.06, scale * 1.06, scale * 1.06]), 'blue');
            }
            else {
                const mobile = aspect < .85;
                const reach = mobile ? .60 : Math.min(3.2, aspect * 1.85);
                const state = flight(p);
                const renderWorld = (kind) => {
                    const coords = mobile ? [[-1.4, 2.7, -1.4, .75], [1.35, -1.8, -.7, .78], [1.35, 2.2, -2.3, .5], [-1.2, -2.6, .3, .64], [.2, 3.2, -2, .32]] : [[-reach * 1.3, 2.3, -1.4, .95], [reach * 1.15, -1.6, -.7, .85], [reach * .8, 2.3, -2.3, .58], [-reach * .9, -2.2, .3, .78], [.2, 2.85, -2, .48]];
                    const berrySizes = [1.28, .82, 1.12, .9, 1.34];
                    const finish = smooth((p - .72) / .08);
                    const keyframes = [
                        { p: 0, x: reach, y: mobile ? -.8 : 1.05, rx: -.2, ry: -.42, rz: -.26, s: 1 },
                        { p: .18, x: -reach * .85, y: mobile ? -.4 : .9, rx: .12, ry: .4, rz: .24, s: 1.04 },
                        { p: .30, x: -reach, y: mobile ? -1.4 : -1, rx: .27, ry: .7, rz: .45, s: 1.04 },
                        { p: .46, x: reach * .9, y: mobile ? -.4 : .8, rx: -.15, ry: 5.8, rz: -.27, s: 1 },
                        { p: .58, x: reach, y: mobile ? -1.4 : -1.1, rx: .15, ry: 6.5, rz: -.4, s: 1 },
                        { p: .74, x: -reach * .8, y: mobile ? -1 : -.6, rx: -.1, ry: 6.0, rz: .18, s: .95 },
                        { p: .81, x: 0, y: mobile ? -1.1 : -1.4, rx: -.08, ry: Math.PI * 2 - .13, rz: -.06, s: .64 },
                        { p: 1, x: 0, y: mobile ? -1.1 : -1.4, rx: -.08, ry: Math.PI * 2 - .13, rz: -.06, s: .64 }
                    ];
                    let a = keyframes[0], b = keyframes[1];
                    for (let i = 1; i < keyframes.length; i++) {
                        if (p <= keyframes[i].p) {
                            a = keyframes[i - 1];
                            b = keyframes[i];
                            break;
                        }
                    }
                    const t = smooth((p - a.p) / (b.p - a.p)), base = mobile ? .64 : 1.05;
                    const pose = { x: blend(a.x, b.x, t), y: blend(a.y, b.y, t), rx: blend(a.rx, b.rx, t), ry: blend(a.ry, b.ry, t), rz: blend(a.rz, b.rz, t), s: blend(a.s, b.s, t) * base };
                    coords.forEach(([x, y, z, s], i) => {
                        const drift = Math.sin(p * 3.7 + i) * .35, fy = y + (i % 2 ? -1 : 1) * p * .7;
                        const ss = (mobile ? s * .68 : s) * (1 - finish * .72), rotation = [0, 0, .22 * Math.sin(p * 4 + i)];
                        // Only the lower-left sprite shared the pouch's depth. Move it
                        // behind the full mesh, compensating perspective to preserve its
                        // exact screen position, size and original scroll motion.
                        const depth = i === 3 ? -2.6 : z, projectionScale = (9 - depth) / (9 - z);
                        this.fruit(matrix([(x + drift) * projectionScale, fy * projectionScale, depth], rotation, [ss * projectionScale, ss * projectionScale, ss * projectionScale]), kind, berrySizes[i], i);
                    });
                    this.canvas.dataset.pose = JSON.stringify(pose);
                    this.canvas.dataset.flavor = state.kind;
                    this.bag(matrix([pose.x, pose.y, .3], [pose.rx, pose.ry, pose.rz], [pose.s, pose.s, pose.s]), kind);
                    if (p > .74) {
                        const s = smooth((p - .74) / .07) * base * (mobile ? .49 : .59), spread = mobile ? 1.02 : 1.45;
                        this.bag(matrix([-spread, pose.y - .12, -.4], [.05, .35, -.2], [s, s, s]), 'melon');
                        this.bag(matrix([spread, pose.y - .12, -.4], [.05, -.35, .2], [s, s, s]), 'blue');
                    }
                };
                // Two scissored renders share the exact same pose: crossing the line
                // changes only the material and fruit world, in either scroll direction.
                this.canvas.dataset.portal = state.transition ? state.cut.toFixed(4) : 'none';
                if (state.transition) {
                    const boundary = Math.round((1 - Math.max(0, Math.min(1, state.cut))) * this.canvas.height);
                    g.enable(g.SCISSOR_TEST);
                    g.scissor(0, boundary, this.canvas.width, this.canvas.height - boundary);
                    renderWorld(state.from);
                    g.scissor(0, 0, this.canvas.width, boundary);
                    renderWorld(state.to);
                    g.disable(g.SCISSOR_TEST);
                }
                else
                    renderWorld(state.kind);
            }
            if (this.canvas.dataset.ready !== 'true') {
                this.canvas.dataset.ready = 'true';
                this.readyCallback();
            }
        }
        dispose() { this.destroyed = true; this.resizeObserver.disconnect(); this.canvas.removeEventListener('webglcontextlost', this.onLost); this.canvas.removeEventListener('webglcontextrestored', this.onRestore); this.meshes.forEach(m => this.gl.deleteBuffer(m.buffer)); Object.values(this.textures).forEach(t => this.gl.deleteTexture(t)); Object.values(this.fruitAssets).flat().forEach(item => this.gl.deleteTexture(item.texture)); this.gl.deleteProgram(this.program); }
    }
    Candy3D.Renderer = Renderer;
})(Candy3D || (Candy3D = {}));
