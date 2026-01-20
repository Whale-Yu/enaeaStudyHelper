(function() {
    'use strict';
    if (window.hasHelperInjected) return;
    window.hasHelperInjected = true;

    // --- 1. UI 面板 ---
    const panel = document.createElement('div');
    panel.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;background:rgba(0,0,0,0.85);color:white;padding:12px;border-radius:8px;font-size:12px;width:260px;border:1px solid #c0130d;font-family:monospace;pointer-events:none;";
    panel.innerHTML = `
        <div style="font-weight:bold;color:#ff4d4d;border-bottom:1px solid #444;margin-bottom:8px;">学习公社云平台 | 视频助手</div>
        <div id="h-info" style="color:#00ff00;">系统准备中...</div>
        <div id="h-log" style="height:100px;overflow-y:auto;background:rgba(255,255,255,0.05);margin-top:5px;padding:3px;font-size:10px;"></div>
    `;
    document.body.appendChild(panel);

    const addLog = (msg) => {
        const log = document.getElementById('h-log');
        if (log) {
            log.innerHTML += `<div>[${new Date().toLocaleTimeString([], {hour12:false})}] ${msg}</div>`;
            log.scrollTop = log.scrollHeight;
        }
    };

    const url = window.location.pathname;

    // --- 逻辑 A：视频播放页 (/viewerforccvideo.do) ---
    if (url.includes('viewerforccvideo.do')) {
        localStorage.setItem('isStudying', 'true');
        localStorage.setItem('videoIsDone', 'false');

        const videoMainLogic = () => {
            // 休息弹窗处理
            document.querySelectorAll('button').forEach(btn => {
                if (btn.innerText.includes('继续学习')) {
                    btn.click();
                    addLog("检测到休息弹窗，已点击继续学习");

                }
            });

            // 检查章节列表，跳过 100%
            const items = document.querySelectorAll("li.cvtb-MCK-course-content");
            let allDone = true;
            for (let i = 0; i < items.length; i++) {
                const prog = items[i].querySelector(".cvtb-MCK-CsCt-studyProgress")?.innerText.trim();
                const isCur = items[i].classList.contains('current');
                if (isCur) document.getElementById('h-info').innerText = `正在播放第 ${i+1} 集 (${prog})`;
                
                if (prog !== '100%') {
                    allDone = false;
                    if (!isCur) {
                        addLog(`切换至未完成章节: 第 ${i+1} 节`);
                        items[i].click();
                        return;
                    }
                    break;
                }
            }

            if (allDone && items.length > 0) {
                addLog("本课程视频已全部完成！");
                localStorage.setItem('videoIsDone', 'true');
                localStorage.removeItem('isStudying');
                setTimeout(() => window.close(), 2000);
            }

            /* 
            // 视频播放 & 断点续播
            const v = document.querySelector('video');
            const curLi = document.querySelector('li.current');
            if (v && curLi) {
                const storageKey = "pos_" + curLi.getAttribute('id');
                
                // 等待视频元数据加载完成后计算快进位置
                if (!v.hasAttribute('data-synced')) {
                    // 尝试获取学习进度和视频时长
                    const progElement = curLi.querySelector(".cvtb-MCK-CsCt-studyProgress");
                    const lengthElement = curLi.querySelector(".cvtb-MCK-CsCt-length");
                    let calculatedTime = 0;
                    
                    if (progElement && lengthElement) {
                        const progressText = progElement.innerText.trim();
                        const lengthText = lengthElement.innerText.trim();
                        
                        // 只有当进度大于0%且小于100%时才计算快进位置
                        if (progressText && progressText !== '0%' && progressText !== '100%') {
                            const progressPercent = parseFloat(progressText.replace('%', ''));
                            
                            // 从HTML中解析视频时长（格式：HH:MM:SS 或 MM:SS）
                            const timeParts = lengthText.split(':');
                            let totalTime = 0;
                            
                            if (timeParts.length === 3) { // HH:MM:SS
                                totalTime = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
                            } else if (timeParts.length === 2) { // MM:SS
                                totalTime = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
                            }
                            
                            if (totalTime > 0) {
                                calculatedTime = totalTime * progressPercent / 100;
                                addLog(`根据学习进度${progressText}计算，快进至 ${Math.floor(calculatedTime)}秒/${totalTime}秒`);
                            }
                        }
                    }
                    
                    // 如果有之前保存的播放位置，优先使用
                    const saved = localStorage.getItem(storageKey);
                    if (saved && parseFloat(saved) > 5) {
                        addLog(`续播：快进至 ${Math.floor(saved)}秒`);
                        v.currentTime = parseFloat(saved);
                    } else if (calculatedTime > 5) {
                        // 否则使用根据学习进度计算的时间
                        v.currentTime = calculatedTime;
                    }
                    
                    v.setAttribute('data-synced', 'true');
                }
                if (!v.paused && v.currentTime > 0) localStorage.setItem(storageKey, v.currentTime);
                if (v.paused && !document.querySelector('.dialog-content')) v.play().catch(()=>{});
            }
            */
        };

        setInterval(videoMainLogic, 4000);
        setTimeout(() => { document.querySelector(".xgplayer-icon-muted")?.click(); }, 5000);
        window.onbeforeunload = () => localStorage.removeItem('isStudying');
    }

    // --- 逻辑 B：课程列表页 (/circleIndexRedirect.do) ---
    if (url.includes('circleIndexRedirect.do')) {
        const listLogic = () => {
            // 互斥锁：视频开着就不扫描
            if (localStorage.getItem('isStudying') === 'true') {
                document.getElementById('h-info').innerText = "状态：检测到学习窗口，已暂停列表扫描";
                return;
            }

            // 刷新逻辑
            if (localStorage.getItem('videoIsDone') === 'true') {
                localStorage.removeItem('videoIsDone');
                addLog("检测到视频已学完，刷新任务状态...");
                location.reload();
                return;
            }

            // 核心：扫描表格行，跳过 100% 的课程
            const rows = document.querySelectorAll("tbody tr:not([colspan])");
            let targetBtn = null;

            for (let row of rows) {
                const progressText = row.querySelector(".progressvalue")?.innerText.trim();
                const goBtn = row.querySelector(".golearn");
                
                if (progressText && progressText !== "100%") {
                    const courseName = row.querySelector(".course-title")?.title || "未知课程";
                    addLog(`发现待学课程：${courseName} (${progressText})`);
                    targetBtn = goBtn;
                    break; // 找到第一个没到100%的课程，准备进入
                }
            }

            if (targetBtn) {
                document.getElementById('h-info').innerText = "状态：准备进入未完成课程";
                setTimeout(() => targetBtn.click(), 2000);
            } else {
                document.getElementById('h-info').innerText = "状态：本页课程已全部学完";
            }
        };

        setInterval(listLogic, 10000);
    }
})();