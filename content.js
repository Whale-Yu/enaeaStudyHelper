(function() {
    'use strict';
    if (window.hasHelperInjected) return;
    window.hasHelperInjected = true;

    // ================= 1. 状态面板 =================
    if (!document.getElementById('h-panel')) {
        const panel = document.createElement('div');
        panel.id = 'h-panel';
        panel.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;background:rgba(0,0,0,0.85);color:white;padding:12px;border-radius:8px;font-size:12px;width:260px;border:1px solid #c0130d;font-family:monospace;pointer-events:none;";
        panel.innerHTML = `
            <div style="font-weight:bold;color:#ff4d4d;border-bottom:1px solid #444;margin-bottom:8px;">学习公社云平台 | 视频助手</div>
            <div id="h-info" style="color:#00ff00;">系统准备中...</div>
            <div id="h-log" style="height:100px;overflow-y:auto;background:rgba(255,255,255,0.05);margin-top:5px;padding:3px;font-size:10px;"></div>
        `;
        (document.body || document.documentElement).appendChild(panel);
    }

    let lastLogText = '';
    let lastLogAt = 0;
    const addLog = (msg) => {
        const now = Date.now();
        if (msg === lastLogText && now - lastLogAt < 5000) return; // 同一条日志 5 秒内不重复
        lastLogText = msg;
        lastLogAt = now;
        const log = document.getElementById('h-log');
        if (log) {
            log.innerHTML += `<div>[${new Date().toLocaleTimeString([], {hour12:false})}] ${msg}</div>`;
            log.scrollTop = log.scrollHeight;
        }
    };
    const setInfo = (text) => {
        const el = document.getElementById('h-info');
        if (el) el.innerText = text;
    };

    const url = window.location.pathname;

    // ================= 2. 播放控制（本次新增的核心修复） =================
    // 站点弹「休息提醒」时会暂停视频，点掉弹窗后播放器内部状态仍是暂停的，
    // 原来只点了「继续学习」，所以视频一直停着。这里补上「恢复播放」逻辑。

    const findVideo = () => document.querySelector('video');

    // 各家播放器的播放按钮选择器（学习公社用的是 xgplayer，其余作为兜底）
    const PLAY_BTN_SELECTORS = [
        '.xgplayer-play',
        '.xgplayer-start',
        '.xgplayer-icon-play',
        '.prism-big-play-btn',
        '.vjs-big-play-button',
        '.play-btn',
        '.video-play'
    ];

    let resumeBusy = false;
    let lastResumeAt = 0;

    const playVideo = (v) => {
        try {
            const p = v.play();
            if (p && typeof p.catch === 'function') {
                p.catch(() => {
                    // 被浏览器自动播放策略拦截（不允许带声音自动播放）：静音后再试
                    try {
                        v.muted = true;
                        v.play().catch(() => {});
                    } catch (e) {}
                });
            }
        } catch (e) {}
    };

    const clickPlayerButton = () => {
        for (const sel of PLAY_BTN_SELECTORS) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) {
                el.click();
                return sel;
            }
        }
        return null;
    };

    // 三连击恢复：先 play()，不行就点播放器的播放按钮，再不行点视频画面
    const resumePlayback = () => {
        const v = findVideo();
        if (!v || !v.paused) return false;
        const now = Date.now();
        if (resumeBusy || now - lastResumeAt < 3000) return false;
        resumeBusy = true;
        lastResumeAt = now;

        playVideo(v);

        setTimeout(() => {
            const v1 = findVideo();
            if (v1 && v1.paused) {
                const sel = clickPlayerButton();
                if (sel) addLog('点击播放按钮恢复：' + sel);
            }
        }, 450);

        setTimeout(() => {
            const v2 = findVideo();
            if (v2 && v2.paused) {
                v2.click();
                addLog('点击视频画面恢复播放');
            }
            resumeBusy = false;
        }, 1100);

        return true;
    };

    // 监听视频被暂停（休息弹窗、切后台、切章节都会触发），随后自动恢复
    if (document.addEventListener) {
        document.addEventListener('pause', (e) => {
            const t = e.target;
            if (!t || t.tagName !== 'VIDEO') return;
            setTimeout(() => {
                if (document.querySelector('.dialog-content')) return; // 有弹窗时先交给弹窗逻辑
                const v = findVideo();
                if (v && v.paused) resumePlayback();
            }, 1200);
        }, true);
    }

    // ================= 3. 逻辑 A：视频播放页 =================
    if (url.includes('viewerforccvideo.do')) {
        localStorage.setItem('isStudying', 'true');
        localStorage.setItem('videoIsDone', 'false');

        // 找「继续学习」按钮（只找屏幕上可见的）
        const findContinueButton = () => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                const text = (btn.innerText || '').trim();
                if (text.includes('继续学习') && btn.offsetParent !== null) return btn;
            }
            return null;
        };

        const videoMainLogic = () => {
            // 1) 休息弹窗：点掉后立刻把视频拉起来
            const continueBtn = findContinueButton();
            if (continueBtn) {
                continueBtn.click();
                addLog('检测到休息弹窗，已点击「继续学习」');
                setTimeout(resumePlayback, 800); // ★ 关键修复：弹窗关掉后恢复播放
            }

            // 2) 章节列表：跳过 100%，自动切到未完成章节
            const items = document.querySelectorAll('li.cvtb-MCK-course-content');
            let allDone = true;
            for (let i = 0; i < items.length; i++) {
                const progEl = items[i].querySelector('.cvtb-MCK-CsCt-studyProgress');
                const prog = progEl ? progEl.innerText.trim() : '';
                const isCur = items[i].classList.contains('current');
                if (isCur && prog) setInfo(`正在播放第 ${i + 1} 集 (${prog})`);

                if (prog && prog !== '100%') {
                    allDone = false;
                    if (!isCur) {
                        addLog(`切换至未完成章节: 第 ${i + 1} 节`);
                        items[i].click();
                        setTimeout(resumePlayback, 1500); // 切章节后也把视频拉起来
                        return;
                    }
                    break;
                }
            }

            if (allDone && items.length > 0) {
                addLog('本课程视频已全部完成！');
                localStorage.setItem('videoIsDone', 'true');
                localStorage.removeItem('isStudying');
                setTimeout(() => window.close(), 2000);
            }
        };

        // 每 3 秒处理弹窗 / 章节；另外每 1.5 秒看门狗检查视频有没有被暂停
        setInterval(videoMainLogic, 3000);

        let pausedSince = 0;
        setInterval(() => {
            const v = findVideo();
            if (!v) return;
            if (!v.paused) {
                pausedSince = 0;
                return;
            }
            if (!pausedSince) pausedSince = Date.now();
            // 已暂停 2 秒以上，且当前没有答题/提示弹窗遮挡，就尝试恢复
            if (Date.now() - pausedSince > 2000 && !document.querySelector('.dialog-content')) {
                if (resumePlayback()) setInfo('检测到视频暂停，已尝试恢复播放');
            }
        }, 1500);

        // 首次进入页面：5 秒后静音（避免自动播放被拦截），并尝试开始播放
        setTimeout(() => {
            const muteIcon = document.querySelector('.xgplayer-icon-muted');
            if (muteIcon) muteIcon.click();
            resumePlayback();
        }, 5000);

        window.onbeforeunload = () => localStorage.removeItem('isStudying');
    }

    // ================= 4. 逻辑 B：课程列表页 =================
    if (url.includes('circleIndexRedirect.do')) {
        const listLogic = () => {
            // 互斥锁：视频开着就不扫描
            if (localStorage.getItem('isStudying') === 'true') {
                setInfo('状态：检测到学习窗口，已暂停列表扫描');
                return;
            }

            // 刷新逻辑
            if (localStorage.getItem('videoIsDone') === 'true') {
                localStorage.removeItem('videoIsDone');
                addLog('检测到视频已学完，刷新任务状态...');
                location.reload();
                return;
            }

            // 核心：扫描表格行，跳过 100% 的课程
            const rows = document.querySelectorAll('tbody tr:not([colspan])');
            let targetBtn = null;

            for (const row of rows) {
                const progEl = row.querySelector('.progressvalue');
                const progressText = progEl ? progEl.innerText.trim() : '';
                const goBtn = row.querySelector('.golearn');

                if (progressText && progressText !== '100%') {
                    const titleEl = row.querySelector('.course-title');
                    const courseName = (titleEl && titleEl.title) || '未知课程';
                    addLog(`发现待学课程：${courseName} (${progressText})`);
                    targetBtn = goBtn;
                    break; // 找到第一个没到 100% 的课程，准备进入
                }
            }

            if (targetBtn) {
                setInfo('状态：准备进入未完成课程');
                setTimeout(() => targetBtn.click(), 2000);
            } else {
                setInfo('状态：本页课程已全部学完');
            }
        };

        setInterval(listLogic, 10000);
    }
})();
