(function () {
  "use strict";

  // ==================== CONSTANTS ====================
  const FINISH_DIST = 1000;
  const STAGE1_END = 330;
  const STAGE2_END = 660;

  const LANE_W = 2.55;
  const ROAD_HALF_W = 3.95;
  const SHOULDER_W = 4.42;
  const RAIL_X = 4.56;

  const SEG_LEN = 2.0;
  const NEAR_Z = 1.05;
  const DRAW_DIST = 148;
  const CAM_BACK = 6.2;
  const CAM_HEIGHT = 3.18;

  const JUMP_VEL = 11.6;
  const GRAVITY = 29.0;
  const MAX_HEARTS = 3;

  const STORAGE_KEY_BEST = "seabreeze_city_dash_best_v1";

  const STAGE_INFO = [
    {
      id: 0,
      icon: "🌊",
      name: "海边公路",
      sub: "STAGE 1 · 0–330m",
      desc: "海风轻拂，沿着蔚蓝海岸线加速出发！",
      accent: "#38bdf8",
    },
    {
      id: 1,
      icon: "🌇",
      name: "城市高架",
      sub: "STAGE 2 · 330–660m",
      desc: "跃上落日高架桥，穿梭摩天大楼天际线！",
      accent: "#fb923c",
    },
    {
      id: 2,
      icon: "🏮",
      name: "夜间灯牌街区",
      sub: "STAGE 3 · 660–1000m",
      desc: "霓虹闪烁，最后冲刺直奔 1000m 终点！",
      accent: "#f472b6",
    },
  ];

  const NEON_SIGNS = [
    { text: "拉面", color: "#ff4d94", bg: "#2b0a20" },
    { text: "猫咖", color: "#38bdf8", bg: "#082032" },
    { text: "夜市", color: "#fbbf24", bg: "#2c1905" },
    { text: "冰室", color: "#34d399", bg: "#06261d" },
    { text: "唱片", color: "#c084fc", bg: "#210c38" },
    { text: "海风", color: "#22d3ee", bg: "#072630" },
    { text: "电玩", color: "#fb7185", bg: "#300a14" },
    { text: "烧鸟", color: "#fb923c", bg: "#2d1406" },
  ];

  // ==================== DOM ====================
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const elHud = document.getElementById("hud");
  const elStageIcon = document.getElementById("stage-icon");
  const elStageName = document.getElementById("stage-name");
  const elHeartsBox = document.getElementById("hearts-box");
  const elProgressFill = document.getElementById("progress-fill");
  const elProgressCat = document.getElementById("progress-cat");
  const elDistText = document.getElementById("dist-text");
  const elCoinText = document.getElementById("coin-text");
  const elBtnSound = document.getElementById("btn-sound");
  const elBtnPause = document.getElementById("btn-pause");

  const elStageBanner = document.getElementById("stage-banner");
  const elBannerSub = document.getElementById("banner-sub");
  const elBannerTitle = document.getElementById("banner-title");
  const elBannerDesc = document.getElementById("banner-desc");

  const elOverlayStart = document.getElementById("overlay-start");
  const elOverlayPause = document.getElementById("overlay-pause");
  const elOverlayResult = document.getElementById("overlay-result");
  const elStartBest = document.getElementById("start-best");

  const elResultBadge = document.getElementById("result-badge");
  const elResultRank = document.getElementById("result-rank");
  const elResultTitle = document.getElementById("result-title");
  const elResultSub = document.getElementById("result-sub");
  const elStatDist = document.getElementById("stat-dist");
  const elStatCoins = document.getElementById("stat-coins");
  const elStatTime = document.getElementById("stat-time");
  const elStatScore = document.getElementById("stat-score");
  const elResultBestNote = document.getElementById("result-best-note");

  const elTouchControls = document.getElementById("touch-controls");
  const elToast = document.getElementById("toast");

  const sound = new window.SoundEngine();

  // ==================== UTILITIES ====================
  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function lerpRgb(c1, c2, t) {
    const r = Math.round(lerp(c1[0], c2[0], t));
    const g = Math.round(lerp(c1[1], c2[1], t));
    const b = Math.round(lerp(c1[2], c2[2], t));
    return `rgb(${r},${g},${b})`;
  }

  function mix3Color(c0, c1, c2, w1, w2) {
    const w0 = Math.max(0, 1 - w1 - w2);
    const r = Math.round(c0[0] * w0 + c1[0] * w1 + c2[0] * w2);
    const g = Math.round(c0[1] * w0 + c1[1] * w1 + c2[1] * w2);
    const b = Math.round(c0[2] * w0 + c1[2] * w1 + c2[2] * w2);
    return `rgb(${r},${g},${b})`;
  }

  function getStageWeights(z) {
    const wTo1 = smoothstep(STAGE1_END - 26, STAGE1_END + 26, z);
    const wTo2 = smoothstep(STAGE2_END - 26, STAGE2_END + 26, z);
    const w2 = wTo2;
    const w1 = Math.max(0, wTo1 - wTo2);
    const w0 = Math.max(0, 1 - w1 - w2);
    return { w0, w1, w2 };
  }

  function getStageIndex(z) {
    if (z < STAGE1_END) return 0;
    if (z < STAGE2_END) return 1;
    return 2;
  }

  function drawRoundedRect(x, y, w, h, r) {
    const rad = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  function drawQuad(p1, p2, p3, p4, fillStyle, strokeStyle, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth || 1;
      ctx.stroke();
    }
  }

  // ==================== TRACK GEOMETRY (UNIFIED CURVE & ELEVATION) ====================
  function trackTaper(z) {
    const a = smoothstep(18, 62, z);
    const b = 1 - smoothstep(935, 985, z);
    return a * b;
  }

  function roadCenterX(z) {
    const t = trackTaper(z);
    if (t <= 0) return 0;
    return t * (Math.sin(z * 0.0115) * 9.0 + Math.sin(z * 0.024 + 1.1) * 3.8);
  }

  function roadCenterXDeriv(z) {
    const eps = 0.08;
    return (roadCenterX(z + eps) - roadCenterX(z - eps)) / (2 * eps);
  }

  function roadCenterY(z) {
    const t = trackTaper(z);
    if (t <= 0) return 0;
    // Gentle elevation keeps screenY strictly monotonic from far to near
    return t * (Math.sin(z * 0.0145 + 0.3) * 1.1 + Math.sin(z * 0.028) * 0.4);
  }

  function roadCenterYDeriv(z) {
    const eps = 0.08;
    return (roadCenterY(z + eps) - roadCenterY(z - eps)) / (2 * eps);
  }

  // ==================== CAMERA & UNIFIED PROJECTION ====================
  let viewW = window.innerWidth;
  let viewH = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const cam = {
    z: 0,
    lateral: 0,
    height: CAM_HEIGHT,
    baseCurveX: 0,
    slopeCurveX: 0,
    baseHillY: 0,
    slopeHillY: 0,
    focal: 600,
    centerX: 600,
    horizonY: 300,
  };

  function resize() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
  }

  function updateCamera() {
    cam.z = state.playerZ - CAM_BACK;
    cam.lateral = state.playerX * 0.42;
    cam.height = CAM_HEIGHT + state.playerY * 0.14;
    cam.baseCurveX = roadCenterX(cam.z);
    cam.slopeCurveX = roadCenterXDeriv(cam.z);
    cam.baseHillY = roadCenterY(cam.z);
    cam.slopeHillY = roadCenterYDeriv(cam.z);

    const shakeMag = state.shakeTimer > 0 ? state.shakeTimer * 18 : 0;
    const sx = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
    const sy = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;

    const isPortrait = viewH > viewW;
    cam.focal = isPortrait ? viewW * 0.94 : Math.min(viewW * 0.74, viewH * 0.94);
    cam.centerX = viewW * 0.5 + sx;
    cam.horizonY = viewH * (isPortrait ? 0.45 : 0.42) + sy;
  }

  /**
   * SINGLE unified pinhole projection shared by road, curbs, guardrails,
   * coins, obstacles, props, finish arch, shadows, and the cat.
   * Returns null if point is behind or closer than NEAR_Z.
   */
  function project(localX, localY, worldZ) {
    const dz = worldZ - cam.z;
    if (dz < NEAR_Z) return null;
    const curveDX = (roadCenterX(worldZ) - cam.baseCurveX) - cam.slopeCurveX * dz;
    const hillDY = (roadCenterY(worldZ) - cam.baseHillY) - cam.slopeHillY * dz;
    const rx = (localX + curveDX) - cam.lateral;
    const ry = (localY + hillDY) - cam.height;
    const scale = cam.focal / dz;
    return {
      x: cam.centerX + rx * scale,
      y: cam.horizonY - ry * scale,
      scale,
      dz,
    };
  }

  // ==================== GAME STATE ====================
  const state = {
    mode: "menu", // 'menu' | 'playing' | 'paused' | 'finishing' | 'gameover' | 'victory'
    time: 0,
    runTime: 0,
    playerZ: 0,
    targetLane: 0,
    playerX: 0,
    playerVX: 0,
    playerY: 0,
    playerVY: 0,
    jumpBuffer: 0,
    speed: 22,
    hearts: MAX_HEARTS,
    invulnTimer: 0,
    shakeTimer: 0,
    hitFlash: 0,
    coins: 0,
    currentStage: 0,
    bannerTimer: 0,
    finishDelay: 0,
    lastResult: null,
    obstacles: [],
    coinList: [],
    props: [],
    particles: [],
    confetti: [],
    stars: [],
    skyline: [],
  };

  function initBackdropSeeds() {
    state.stars = [];
    for (let i = 0; i < 95; i++) {
      state.stars.push({
        u: Math.random(),
        v: Math.random() * 0.85,
        r: 0.7 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
    state.skyline = [];
    let cursor = -0.1;
    while (cursor < 1.15) {
      const w = 0.028 + Math.random() * 0.048;
      const h = 0.06 + Math.random() * 0.17;
      state.skyline.push({
        u: cursor,
        w,
        h,
        rows: 3 + Math.floor(Math.random() * 5),
        cols: 2 + Math.floor(Math.random() * 3),
        seed: Math.random() * 100,
      });
      cursor += w * (0.78 + Math.random() * 0.25);
    }
  }

  // ==================== LEVEL & SCENERY GENERATION ====================
  function generateCourse() {
    state.obstacles = [];
    state.coinList = [];
    state.props = [];
    state.particles = [];
    state.confetti = [];

    // 1. Roadside props along the entire 0 -> 1040m track
    for (let z = 14; z <= 1045; z += 11) {
      const st = getStageIndex(z);
      if (st === 0) {
        // Coastal Highway: palm trees on right & occasional left, lighthouse on right
        state.props.push({
          z,
          side: 1,
          x: RAIL_X + 2.4 + (z % 3) * 0.6,
          kind: z % 88 === 0 ? "lighthouse" : "palm",
          scale: 0.9 + ((z * 17) % 10) * 0.03,
          phase: z * 0.3,
        });
        if (z % 22 === 0) {
          state.props.push({
            z: z + 4,
            side: -1,
            x: -(RAIL_X + 2.1),
            kind: "palm",
            scale: 0.88 + ((z * 13) % 10) * 0.025,
            phase: z * 0.5,
          });
        }
        if (z % 66 === 0) {
          state.props.push({
            z: z + 2,
            side: -1,
            x: -(RAIL_X + 12 + (z % 9)),
            kind: "sailboat",
            scale: 1.0,
            phase: z * 0.2,
          });
        }
      } else if (st === 1) {
        // Urban Overpass: symmetrical highway streetlamps + overhead green gantries
        if (z % 22 === 0) {
          state.props.push({
            z,
            side: -1,
            x: -(RAIL_X + 0.55),
            kind: "lamp",
            scale: 1.0,
          });
          state.props.push({
            z,
            side: 1,
            x: RAIL_X + 0.55,
            kind: "lamp",
            scale: 1.0,
          });
        }
        if (z === 377 || z === 487 || z === 597) {
          const label =
            z === 377 ? "城市高架 · 前方 620m" : z === 487 ? "中环高速 · 注意变道" : "前方进入夜间灯牌街区";
          state.props.push({
            z,
            side: 0,
            x: 0,
            kind: "gantry",
            label,
          });
        }
      } else {
        // Night Neon Signboard District: glowing vertical & cantilevered Chinese signs + lanterns
        const signL = NEON_SIGNS[Math.floor(z / 11) % NEON_SIGNS.length];
        const signR = NEON_SIGNS[(Math.floor(z / 11) + 3) % NEON_SIGNS.length];
        state.props.push({
          z,
          side: -1,
          x: -(RAIL_X + 1.55),
          kind: "neon_sign",
          sign: signL,
          tall: z % 22 === 0,
        });
        state.props.push({
          z: z + 5,
          side: 1,
          x: RAIL_X + 1.55,
          kind: "neon_sign",
          sign: signR,
          tall: z % 22 !== 0,
        });
        if (z >= 690 && z <= 955 && Math.round(z) % 55 === 0) {
          state.props.push({
            z,
            side: 0,
            x: 0,
            kind: "lantern_arch",
          });
        }
      }
    }

    // 2. Obstacles & Coins from 46m to 964m (100% solvable patterns)
    const lanes = [-1, 0, 1];
    let z = 44;
    let prevSafeLane = 0;
    let patIndex = 0;

    // Warm-up welcome coins right ahead of start
    for (let i = 0; i < 4; i++) {
      state.coinList.push({
        z: 18 + i * 5.2,
        lane: 0,
        x: 0,
        y: 0.65,
        collected: false,
      });
    }

    while (z < 962) {
      const st = getStageIndex(z);
      const spacing = st === 0 ? 31 : st === 1 ? 27.5 : 24.5;
      const patternType = patIndex % 5;
      patIndex++;

      // Pick a guaranteed safe lane reachable from previous safe lane
      const candidates = lanes.filter((l) => Math.abs(l - prevSafeLane) <= 1);
      const safeLane = candidates[Math.floor(Math.random() * candidates.length)];
      const otherLanes = lanes.filter((l) => l !== safeLane);

      if (patternType === 0) {
        // Pattern 0: One tall obstacle + one low jumpable obstacle, safe lane has ground coins
        const tallLane = otherLanes[0];
        const lowLane = otherLanes[1];
        addObstacle(z, tallLane, false, st);
        if (Math.random() < 0.72) {
          addObstacle(z + 0.4, lowLane, true, st);
          addJumpCoinArc(z + 0.4, lowLane);
        }
        addCoinLine(z - 5, safeLane, 4, 3.6);
      } else if (patternType === 1) {
        // Pattern 1: Low jumpable barrier across 2 lanes (or center) with enticing jump-arc coins!
        const jumpLane = safeLane;
        addObstacle(z, jumpLane, true, st);
        addJumpCoinArc(z, jumpLane);
        // One side lane blocked by tall obstacle, the other side lane open as alternative
        addObstacle(z, otherLanes[0], false, st);
      } else if (patternType === 2) {
        // Pattern 2: Twin tall obstacles leaving 1 clean safe lane with coin line
        addObstacle(z, otherLanes[0], false, st);
        addObstacle(z, otherLanes[1], false, st);
        addCoinLine(z - 4.5, safeLane, 4, 3.5);
      } else if (patternType === 3) {
        // Pattern 3: Staggered slalom (obstacle A then obstacle B 12m later) + ribbon coins
        const midLane = otherLanes[0];
        addObstacle(z, prevSafeLane, Math.random() < 0.45, st);
        addObstacle(z + 11, midLane, false, st);
        addCoinLine(z - 2, safeLane, 3, 4.0);
        z += 8;
      } else {
        // Pattern 4: Low barrier jump festival — all 3 lanes have low jumpable barriers (or 2 low + 1 open)
        const openOne = Math.random() < 0.35;
        lanes.forEach((ln) => {
          if (openOne && ln === safeLane) return;
          addObstacle(z, ln, true, st);
        });
        addJumpCoinArc(z, safeLane);
      }

      prevSafeLane = safeLane;
      z += spacing + Math.random() * 4.5;
    }

    // Final celebration sprint coins leading right into the 1000m finish line!
    for (let cz = 968; cz <= 994; cz += 4.5) {
      state.coinList.push({
        z: cz,
        lane: 0,
        x: 0,
        y: 0.7,
        collected: false,
      });
    }
  }

  function addObstacle(z, lane, jumpable, stage) {
    let kind, width, height, depth;
    if (jumpable) {
      if (Math.random() < 0.5) {
        kind = "cones";
        width = 1.65;
        height = 0.88;
        depth = 0.85;
      } else {
        kind = "barrier";
        width = 1.95;
        height = 0.92;
        depth = 0.75;
      }
    } else {
      if (Math.random() < 0.65) {
        kind = stage === 0 ? "van" : stage === 1 ? "taxi" : "truck";
        width = 1.95;
        height = stage === 1 ? 1.75 : 2.15;
        depth = 3.6;
      } else {
        kind = "tall_wall";
        width = 2.0;
        height = 2.05;
        depth = 0.9;
      }
    }
    state.obstacles.push({
      z,
      lane,
      x: lane * LANE_W,
      width,
      height,
      depth,
      jumpable,
      kind,
      stage,
      hit: false,
    });
  }

  function addCoinLine(startZ, lane, count, step) {
    for (let i = 0; i < count; i++) {
      const cz = startZ + i * step;
      if (cz > 10 && cz < 995) {
        state.coinList.push({
          z: cz,
          lane,
          x: lane * LANE_W,
          y: 0.65,
          collected: false,
        });
      }
    }
  }

  function addJumpCoinArc(centerZ, lane) {
    const offsets = [
      [-4.2, 1.35],
      [-1.8, 1.95],
      [0.6, 2.18],
      [3.0, 1.95],
      [5.4, 1.35],
    ];
    offsets.forEach(([dz, y]) => {
      const cz = centerZ + dz;
      if (cz > 12 && cz < 995) {
        state.coinList.push({
          z: cz,
          lane,
          x: lane * LANE_W,
          y,
          collected: false,
        });
      }
    });
  }

  // ==================== PARTICLES & CONFETTI ====================
  function spawnCoinBurst(x, y, z) {
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      state.particles.push({
        x,
        y,
        z,
        vx: Math.cos(ang) * (1.8 + Math.random() * 1.4),
        vy: 1.5 + Math.random() * 2.2,
        vz: (Math.random() - 0.5) * 2,
        life: 0.42,
        maxLife: 0.42,
        color: i % 2 === 0 ? "#fde047" : "#ffffff",
        size: 0.14,
      });
    }
  }

  function spawnDust(x, z, count, color) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x: x + (Math.random() - 0.5) * 0.6,
        y: 0.12,
        z: z - 0.2,
        vx: (Math.random() - 0.5) * 2.0,
        vy: 0.8 + Math.random() * 1.4,
        vz: -2 - Math.random() * 3,
        life: 0.34,
        maxLife: 0.34,
        color: color || "rgba(255,255,255,0.75)",
        size: 0.18,
      });
    }
  }

  function spawnConfetti() {
    const colors = ["#38bdf8", "#fde047", "#f472b6", "#34d399", "#fb923c", "#ffffff"];
    for (let i = 0; i < 90; i++) {
      state.confetti.push({
        x: viewW * (0.2 + Math.random() * 0.6),
        y: viewH * (0.15 + Math.random() * 0.25),
        vx: (Math.random() - 0.5) * 420,
        vy: -140 - Math.random() * 320,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 12,
        w: 7 + Math.random() * 6,
        h: 4 + Math.random() * 5,
        color: colors[i % colors.length],
        life: 3.5,
      });
    }
  }

  // ==================== BEST SCORE STORAGE ====================
  function loadBest() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BEST);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveBest(record) {
    try {
      localStorage.setItem(STORAGE_KEY_BEST, JSON.stringify(record));
    } catch (_) {}
  }

  function refreshStartBest() {
    const best = loadBest();
    if (best && best.score > 0) {
      elStartBest.textContent = `🏆 历史最高：${best.score} 分 · ${best.coins} 金币${best.cleared ? ` · ${best.time.toFixed(1)}s 冲线` : ""}`;
      elStartBest.classList.remove("hidden");
    } else {
      elStartBest.classList.add("hidden");
    }
  }

  // ==================== UI & GAME LIFECYCLE ====================
  function showToast(msg) {
    elToast.textContent = msg;
    elToast.classList.remove("hidden");
    clearTimeout(showToast._tid);
    showToast._tid = setTimeout(() => {
      elToast.classList.add("hidden");
    }, 2400);
  }

  function showStageBanner(stageIdx) {
    const info = STAGE_INFO[stageIdx];
    elBannerSub.textContent = info.sub;
    elBannerSub.style.color = info.accent;
    elBannerTitle.textContent = `${info.icon} ${info.name}`;
    elBannerDesc.textContent = info.desc;
    elStageBanner.classList.remove("hidden");
    state.bannerTimer = 2.4;
  }

  function updateHud() {
    const dist = Math.min(FINISH_DIST, Math.floor(state.playerZ));
    const pct = clamp((state.playerZ / FINISH_DIST) * 100, 0, 100);
    elDistText.textContent = `${dist} m`;
    elProgressFill.style.width = `${pct}%`;
    elProgressCat.style.left = `${pct}%`;
    elCoinText.textContent = String(state.coins);

    const st = STAGE_INFO[state.currentStage];
    elStageIcon.textContent = st.icon;
    elStageName.textContent = st.name;

    const heartEls = elHeartsBox.children;
    for (let i = 0; i < heartEls.length; i++) {
      heartEls[i].classList.toggle("lost", i >= state.hearts);
    }
  }

  function startRun() {
    sound.ensure();
    state.mode = "playing";
    state.runTime = 0;
    state.playerZ = 0;
    state.targetLane = 0;
    state.playerX = 0;
    state.playerVX = 0;
    state.playerY = 0;
    state.playerVY = 0;
    state.jumpBuffer = 0;
    state.speed = 21.5;
    state.hearts = MAX_HEARTS;
    state.invulnTimer = 0;
    state.shakeTimer = 0;
    state.hitFlash = 0;
    state.coins = 0;
    state.currentStage = 0;
    state.finishDelay = 0;
    state.lastResult = null;

    generateCourse();
    updateHud();

    elOverlayStart.classList.add("hidden");
    elOverlayPause.classList.add("hidden");
    elOverlayResult.classList.add("hidden");
    elHud.classList.remove("hidden");
    elTouchControls.classList.remove("hidden");

    showStageBanner(0);
    sound.playStageUp();
  }

  function pauseRun() {
    if (state.mode !== "playing") return;
    state.mode = "paused";
    elOverlayPause.classList.remove("hidden");
  }

  function resumeRun() {
    if (state.mode !== "paused") return;
    state.mode = "playing";
    elOverlayPause.classList.add("hidden");
  }

  function openSettlement(cleared) {
    state.mode = cleared ? "victory" : "gameover";
    const dist = cleared ? FINISH_DIST : Math.min(FINISH_DIST - 1, Math.floor(state.playerZ));
    const coins = state.coins;
    const elapsed = state.runTime;
    const heartBonus = cleared ? state.hearts * 300 : 0;
    const clearBonus = cleared ? 1000 : 0;
    const speedBonus = cleared ? Math.max(0, Math.round((50 - elapsed) * 25)) : 0;
    const score = Math.round(dist + coins * 30 + heartBonus + clearBonus + speedBonus);

    let rank = "C";
    if (cleared) {
      if (score >= 4200 && state.hearts === MAX_HEARTS) rank = "S+";
      else if (score >= 3400) rank = "S";
      else if (score >= 2700) rank = "A";
      else rank = "B";
    } else if (dist >= 650) {
      rank = "B";
    }

    state.lastResult = { cleared, dist, coins, elapsed, score, rank };

    elResultBadge.textContent = cleared ? "🎉 冲线成功" : "😿 体力耗尽";
    elResultBadge.classList.toggle("fail", !cleared);
    elResultRank.textContent = rank;

    if (cleared) {
      elResultTitle.textContent = "小猫冲过 1000m 终点！";
      elResultSub.textContent =
        state.hearts === MAX_HEARTS
          ? "零失误完美通关！海风、高架与霓虹街区全部征服！"
          : "穿过海风公路与霓虹夜街，成功抵达终点线！";
    } else {
      elResultTitle.textContent = `停在了 ${dist}m 处`;
      elResultSub.textContent = `离 1000m 终点只差 ${FINISH_DIST - dist}m，再来一次一定能冲线！`;
    }

    elStatDist.textContent = `${dist} m`;
    elStatCoins.textContent = `${coins} 枚`;
    elStatTime.textContent = `${elapsed.toFixed(1)} s`;
    elStatScore.textContent = score.toLocaleString("zh-CN");

    const prevBest = loadBest();
    if (!prevBest || score > prevBest.score) {
      saveBest({ score, coins, time: elapsed, cleared, dist });
      elResultBestNote.textContent = "✨ 刷新历史最高分纪录！";
    } else {
      elResultBestNote.textContent = `🏆 历史最高分：${prevBest.score.toLocaleString("zh-CN")} 分`;
    }
    refreshStartBest();

    elTouchControls.classList.add("hidden");
    elOverlayResult.classList.remove("hidden");
  }

  async function shareResult() {
    const r = state.lastResult;
    const url = window.location.href;
    const text = r && r.cleared
      ? `🐱 我在「海风城市冲刺」里带小猫 ${r.elapsed.toFixed(1)}s 冲过 1000m 终点！收集 ${r.coins} 枚金币，拿下 ${r.rank} 级 (${r.score}分)！快来挑战 👉 ${url}`
      : `🐱 我在「海风城市冲刺」跑出了 ${r ? r.dist : 0}m (${r ? r.score : 0}分)！一起来帮小猫冲过 1000m 终点 👉 ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "海风城市冲刺 · 1000m 小猫跑酷",
          text,
          url,
        });
        showToast("已打开系统分享！");
        return;
      } catch (_) {}
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("已复制战绩文案与分享链接！");
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("已复制战绩文案与分享链接！");
    }
  }

  // ==================== INPUT ====================
  function moveLane(dir) {
    if (state.mode !== "playing") return;
    const next = clamp(state.targetLane + dir, -1, 1);
    if (next !== state.targetLane) {
      state.targetLane = next;
      sound.playLaneSwitch(dir);
    }
  }

  function triggerJump() {
    if (state.mode !== "playing") return;
    state.jumpBuffer = 0.14;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      moveLane(-1);
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      moveLane(1);
    } else if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") {
      e.preventDefault();
      if (state.mode === "menu" || state.mode === "victory" || state.mode === "gameover") {
        startRun();
      } else {
        triggerJump();
      }
    } else if (e.code === "Escape" || e.code === "KeyP") {
      if (state.mode === "playing") pauseRun();
      else if (state.mode === "paused") resumeRun();
    } else if (e.code === "KeyR") {
      if (state.mode === "playing" || state.mode === "paused" || state.mode === "victory" || state.mode === "gameover") {
        startRun();
      }
    }
  });

  // Swipe gestures on canvas
  let touchStartX = 0;
  let touchStartY = 0;
  let touchSwiped = false;

  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (state.mode !== "playing") return;
      const t = e.changedTouches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchSwiped = false;
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (state.mode !== "playing" || touchSwiped) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 28 || Math.abs(dy) > 28) {
        touchSwiped = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          moveLane(dx > 0 ? 1 : -1);
        } else if (dy < -24) {
          triggerJump();
        }
      }
    },
    { passive: true }
  );

  // Buttons
  document.getElementById("btn-start").addEventListener("click", startRun);
  document.getElementById("btn-resume").addEventListener("click", resumeRun);
  document.getElementById("btn-pause-restart").addEventListener("click", startRun);
  document.getElementById("btn-replay").addEventListener("click", startRun);
  document.getElementById("btn-share").addEventListener("click", shareResult);
  elBtnPause.addEventListener("click", () => {
    if (state.mode === "playing") pauseRun();
    else if (state.mode === "paused") resumeRun();
  });
  elBtnSound.addEventListener("click", () => {
    const muted = sound.toggleMute();
    elBtnSound.textContent = muted ? "🔇" : "🔊";
  });

  function bindTouchBtn(id, fn) {
    const btn = document.getElementById(id);
    const handler = (e) => {
      e.preventDefault();
      fn();
    };
    btn.addEventListener("pointerdown", handler);
  }
  bindTouchBtn("touch-left", () => moveLane(-1));
  bindTouchBtn("touch-right", () => moveLane(1));
  bindTouchBtn("touch-jump", triggerJump);

  // ==================== UPDATE SIMULATION ====================
  function update(dt) {
    state.time += dt;

    // Gentle idle showcase camera while on start menu
    if (state.mode === "menu") {
      state.playerZ = (state.playerZ + 11 * dt) % 240;
      state.playerX = Math.sin(state.time * 0.7) * 0.8;
      return;
    }

    if (state.mode === "paused" || state.mode === "gameover" || state.mode === "victory") {
      updateConfetti(dt);
      return;
    }

    // Banner countdown
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) {
        elStageBanner.classList.add("hidden");
      }
    }

    if (state.invulnTimer > 0) state.invulnTimer = Math.max(0, state.invulnTimer - dt);
    if (state.shakeTimer > 0) state.shakeTimer = Math.max(0, state.shakeTimer - dt);
    if (state.hitFlash > 0) state.hitFlash = Math.max(0, state.hitFlash - dt * 2.6);

    // Target speed scales smoothly across the 3 stages
    const stageProgress = clamp(state.playerZ / FINISH_DIST, 0, 1);
    const targetSpeed = state.mode === "finishing" ? 8.5 : 22.0 + stageProgress * 9.5;
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 3.8);

    // Advance forward
    state.playerZ += state.speed * dt;
    if (state.mode === "playing") {
      state.runTime += dt;
    }

    // Lateral lane smoothing
    const desiredX = state.targetLane * LANE_W;
    const prevX = state.playerX;
    state.playerX += (desiredX - state.playerX) * (1 - Math.exp(-16 * dt));
    state.playerVX = (state.playerX - prevX) / Math.max(dt, 0.001);

    // Jump physics + buffer
    if (state.jumpBuffer > 0) {
      state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
      if (state.playerY <= 0.001) {
        state.playerVY = JUMP_VEL;
        state.playerY = 0.01;
        state.jumpBuffer = 0;
        sound.playJump();
        spawnDust(state.playerX, state.playerZ, 6, "rgba(255,255,255,0.85)");
      }
    }
    if (state.playerY > 0 || state.playerVY !== 0) {
      state.playerY += state.playerVY * dt;
      state.playerVY -= GRAVITY * dt;
      if (state.playerY <= 0) {
        state.playerY = 0;
        state.playerVY = 0;
        spawnDust(state.playerX, state.playerZ, 5, "rgba(226,232,240,0.75)");
      }
    }

    // Stage transitions
    if (state.mode === "playing") {
      const newStage = getStageIndex(state.playerZ);
      if (newStage !== state.currentStage) {
        state.currentStage = newStage;
        showStageBanner(newStage);
        sound.playStageUp();
      }
    }

    // Coin collection
    if (state.mode === "playing") {
      for (let i = 0; i < state.coinList.length; i++) {
        const c = state.coinList[i];
        if (c.collected) continue;
        const dz = c.z - state.playerZ;
        if (dz < -2.2) continue;
        if (dz > 2.2) continue;
        const dx = Math.abs(c.x - state.playerX);
        const dy = Math.abs(c.y - (state.playerY + 0.65));
        if (dx < 1.18 && Math.abs(dz) < 1.65 && dy < 1.25) {
          c.collected = true;
          state.coins++;
          sound.playCoin();
          spawnCoinBurst(c.x, c.y, c.z);
        }
      }

      // Obstacle collisions
      if (state.invulnTimer <= 0) {
        for (let i = 0; i < state.obstacles.length; i++) {
          const o = state.obstacles[i];
          if (o.hit) continue;
          const relZ = o.z - state.playerZ;
          if (relZ > 1.0 || relZ + o.depth < -0.55) continue;
          const dx = Math.abs(o.x - state.playerX);
          if (dx < o.width * 0.42 + 0.34) {
            // Check jump clearance
            if (o.jumpable && state.playerY >= o.height - 0.14) {
              continue;
            }
            // Hit!
            o.hit = true;
            state.hearts--;
            state.invulnTimer = 1.45;
            state.shakeTimer = 0.34;
            state.hitFlash = 0.85;
            state.speed = Math.max(13, state.speed * 0.56);
            sound.playHit();
            spawnDust(state.playerX, state.playerZ, 12, "rgba(251,113,133,0.9)");
            if (state.hearts <= 0) {
              updateHud();
              openSettlement(false);
              return;
            }
            break;
          }
        }
      }

      // Check finish line!
      if (state.playerZ >= FINISH_DIST) {
        state.mode = "finishing";
        state.finishDelay = 0.95;
        state.targetLane = 0;
        sound.playVictory();
        spawnConfetti();
      }
    } else if (state.mode === "finishing") {
      state.finishDelay -= dt;
      if (state.finishDelay <= 0) {
        openSettlement(true);
      }
    }

    // Update 3D particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 7.5 * dt;
      if (p.y < 0.05) p.y = 0.05;
    }

    updateConfetti(dt);
    updateHud();
  }

  function updateConfetti(dt) {
    for (let i = state.confetti.length - 1; i >= 0; i--) {
      const c = state.confetti[i];
      c.life -= dt;
      if (c.life <= 0) {
        state.confetti.splice(i, 1);
        continue;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 420 * dt;
      c.vx *= 0.99;
      c.rot += c.vrot * dt;
    }
  }

  // ==================== SKY & BACKDROP RENDERING ====================
  function drawSkyAndBackdrop() {
    const { w0, w1, w2 } = getStageWeights(state.playerZ);

    const skyTop = mix3Color([26, 132, 232], [58, 36, 98], [9, 13, 34], w1, w2);
    const skyMid = mix3Color([102, 200, 248], [219, 98, 108], [22, 20, 62], w1, w2);
    const skyBot = mix3Color([222, 247, 255], [254, 188, 118], [58, 28, 92], w1, w2);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, cam.horizonY + 24);
    skyGrad.addColorStop(0, skyTop);
    skyGrad.addColorStop(0.58, skyMid);
    skyGrad.addColorStop(1, skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, viewW, cam.horizonY + 24);

    // Stars (Stage 3 night)
    if (w2 > 0.05) {
      ctx.save();
      for (let i = 0; i < state.stars.length; i++) {
        const s = state.stars[i];
        const tw = 0.45 + 0.55 * Math.sin(state.time * 2.4 + s.phase);
        ctx.fillStyle = `rgba(255, 255, 255, ${w2 * tw * 0.9})`;
        ctx.beginPath();
        ctx.arc(s.u * viewW, s.v * cam.horizonY, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Sun (Stage 1 high coastal sun -> Stage 2 low sunset sun)
    if (w0 + w1 > 0.05) {
      const sunAlpha = clamp(w0 + w1, 0, 1);
      const sunX = viewW * lerp(0.24, 0.54, w1);
      const sunY = cam.horizonY * lerp(0.32, 0.78, w1);
      const sunR = Math.min(viewW, viewH) * lerp(0.052, 0.078, w1);
      const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.0);
      glow.addColorStop(0, w1 > 0.5 ? `rgba(255, 232, 160, ${0.95 * sunAlpha})` : `rgba(255, 253, 224, ${0.92 * sunAlpha})`);
      glow.addColorStop(0.35, w1 > 0.5 ? `rgba(251, 146, 60, ${0.52 * sunAlpha})` : `rgba(253, 224, 71, ${0.32 * sunAlpha})`);
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR * 3.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 250, 225, ${sunAlpha})`;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crescent Moon (Stage 3) — clean vector crescent with soft outer halo (no dark cutout disc)
    if (w2 > 0.1) {
      const mx = viewW * 0.78;
      const my = cam.horizonY * 0.28;
      const mr = Math.min(viewW, viewH) * 0.036;
      ctx.save();
      ctx.globalAlpha = w2;
      const mg = ctx.createRadialGradient(mx - mr * 0.2, my, mr * 0.2, mx, my, mr * 2.6);
      mg.addColorStop(0, "rgba(254, 249, 195, 0.35)");
      mg.addColorStop(1, "rgba(224, 242, 254, 0)");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fef9c3";
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0.35 * Math.PI, 1.75 * Math.PI, false);
      ctx.quadraticCurveTo(mx - mr * 0.15, my - mr * 0.08, mx + Math.cos(0.35 * Math.PI) * mr, my + Math.sin(0.35 * Math.PI) * mr);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Fluffy coastal clouds (Stage 1 & 2)
    if (w0 + w1 > 0.08) {
      ctx.save();
      ctx.globalAlpha = (w0 * 0.85 + w1 * 0.5);
      const cloudColor = w1 > 0.5 ? "#fed7aa" : "#ffffff";
      ctx.fillStyle = cloudColor;
      const drift = (state.time * 12) % (viewW + 240);
      for (let i = 0; i < 5; i++) {
        const cx = ((i * viewW * 0.27 + drift) % (viewW + 220)) - 110;
        const cy = cam.horizonY * (0.2 + (i % 3) * 0.16);
        const s = 26 + (i % 3) * 12;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.65, 0, Math.PI * 2);
        ctx.arc(cx + s * 0.6, cy - s * 0.18, s * 0.78, 0, Math.PI * 2);
        ctx.arc(cx + s * 1.25, cy, s * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Distant coastal mountains / island (Stage 1)
    if (w0 > 0.05) {
      ctx.save();
      ctx.globalAlpha = w0 * 0.85;
      ctx.fillStyle = "#5ba4cf";
      ctx.beginPath();
      ctx.moveTo(0, cam.horizonY + 4);
      ctx.lineTo(viewW * 0.12, cam.horizonY - 24);
      ctx.lineTo(viewW * 0.28, cam.horizonY - 8);
      ctx.lineTo(viewW * 0.55, cam.horizonY - 38);
      ctx.lineTo(viewW * 0.78, cam.horizonY - 14);
      ctx.lineTo(viewW * 0.92, cam.horizonY - 46);
      ctx.lineTo(viewW, cam.horizonY - 22);
      ctx.lineTo(viewW, cam.horizonY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // City Skyline Silhouette (Stage 2 sunset & Stage 3 neon night)
    if (w1 + w2 > 0.05) {
      ctx.save();
      const vis = clamp(w1 + w2, 0, 1);
      ctx.globalAlpha = vis;
      const bldgColor = lerpRgb([66, 44, 92], [18, 22, 48], w2 / Math.max(vis, 0.001));
      const winColor = w2 > 0.45 ? "rgba(56, 189, 248, 0.55)" : "rgba(254, 240, 138, 0.55)";
      const parallax = -(cam.slopeCurveX * 90) % 120;
      for (let i = 0; i < state.skyline.length; i++) {
        const b = state.skyline[i];
        const bx = b.u * viewW + parallax;
        const bw = b.w * viewW;
        const bh = b.h * viewH;
        const by = cam.horizonY - bh + 4;
        ctx.fillStyle = bldgColor;
        ctx.fillRect(bx, by, bw, bh);

        // Lit windows
        ctx.fillStyle = winColor;
        const padX = bw * 0.18;
        const stepX = (bw - padX * 2) / Math.max(1, b.cols);
        const stepY = (bh - 10) / Math.max(1, b.rows);
        for (let r = 0; r < b.rows; r++) {
          for (let c = 0; c < b.cols; c++) {
            if (((r * 7 + c * 13 + Math.floor(b.seed)) % 5) < 2) continue;
            ctx.fillRect(bx + padX + c * stepX, by + 6 + r * stepY, Math.max(2, stepX * 0.45), Math.max(2, stepY * 0.4));
          }
        }
      }
      ctx.restore();
    }

    // Ground base below horizon (prevents any sub-pixel seam at the horizon)
    const groundTop = mix3Color([24, 168, 212], [44, 38, 64], [14, 16, 32], w1, w2);
    const groundBot = mix3Color([236, 208, 152], [32, 34, 48], [10, 12, 24], w1, w2);
    const gGrad = ctx.createLinearGradient(0, cam.horizonY, 0, viewH);
    gGrad.addColorStop(0, groundTop);
    gGrad.addColorStop(1, groundBot);
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, cam.horizonY, viewW, viewH - cam.horizonY);

    // Stage 1 left ocean shimmer + horizon glow
    if (w0 > 0.08) {
      ctx.save();
      ctx.globalAlpha = w0;
      const seaGrad = ctx.createLinearGradient(0, cam.horizonY, 0, viewH);
      seaGrad.addColorStop(0, "#0ea5e9");
      seaGrad.addColorStop(0.55, "#06b6d4");
      seaGrad.addColorStop(1, "#38bdf8");
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, cam.horizonY, viewW * 0.56, viewH - cam.horizonY);

      // Animated sun-sparkle waves on ocean
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      for (let i = 0; i < 14; i++) {
        const fy = cam.horizonY + 8 + i * i * 1.9;
        if (fy > viewH) break;
        const fx = viewW * 0.04 + ((i * 53 + state.time * 24) % (viewW * 0.38));
        ctx.fillRect(fx, fy, 16 + i * 2.5, 2);
      }
      ctx.restore();
    }

    // Stage 3 neon horizon haze
    if (w2 > 0.1) {
      const hGlow = ctx.createLinearGradient(0, cam.horizonY - 36, 0, cam.horizonY + 26);
      hGlow.addColorStop(0, "rgba(244, 114, 182, 0)");
      hGlow.addColorStop(0.5, `rgba(244, 114, 182, ${w2 * 0.25})`);
      hGlow.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = hGlow;
      ctx.fillRect(0, cam.horizonY - 36, viewW, 62);
    }
  }

  // ==================== ROAD, CURB & GUARDRAIL SEGMENT RENDERER ====================
  function drawRoadSegment(idx, zn, zf) {
    // STRICT guarantee: zn >= cam.z + NEAR_Z and zf > zn
    const pNearL = project(-ROAD_HALF_W, 0, zn);
    const pNearR = project(ROAD_HALF_W, 0, zn);
    const pFarL = project(-ROAD_HALF_W, 0, zf);
    const pFarR = project(ROAD_HALF_W, 0, zf);
    if (!pNearL || !pNearR || !pFarL || !pFarR) return;

    const pShNearL = project(-SHOULDER_W, 0, zn);
    const pShNearR = project(SHOULDER_W, 0, zn);
    const pShFarL = project(-SHOULDER_W, 0, zf);
    const pShFarR = project(SHOULDER_W, 0, zf);

    const segZ = (zn + zf) * 0.5;
    const { w0, w1, w2 } = getStageWeights(segZ);
    const stripe = (idx & 1) === 0;

    // 1. Side terrain bands (beach / viaduct deck / dark night sidewalk)
    const rightGround = stripe
      ? mix3Color([236, 214, 168], [66, 70, 84], [22, 22, 42], w1, w2)
      : mix3Color([231, 208, 160], [60, 64, 78], [19, 19, 37], w1, w2);
    const leftGround = stripe
      ? mix3Color([236, 216, 172], [66, 70, 84], [22, 22, 42], w1, w2)
      : mix3Color([230, 209, 164], [60, 64, 78], [19, 19, 37], w1, w2);

    // Right shoulder extension to right edge of viewport
    if (pShNearR && pShFarR) {
      drawQuad(
        pShFarR,
        { x: viewW + 40, y: pShFarR.y },
        { x: viewW + 40, y: pShNearR.y + 1 },
        { x: pShNearR.x, y: pShNearR.y + 1 },
        rightGround
      );
    }

    // Left terrain: smooth crossfade between Stage 1 coastal beach+ocean and Stage 2/3 viaduct/sidewalk
    if (pShNearL && pShFarL) {
      if (w0 < 0.99) {
        ctx.save();
        ctx.globalAlpha = 1 - w0;
        drawQuad(
          { x: -40, y: pShFarL.y },
          pShFarL,
          { x: pShNearL.x, y: pShNearL.y + 1 },
          { x: -40, y: pShNearL.y + 1 },
          leftGround
        );
        ctx.restore();
      }
      if (w0 > 0.01) {
        const pBeachNear = project(-(RAIL_X + 3.4), 0, zn);
        const pBeachFar = project(-(RAIL_X + 3.4), 0, zf);
        if (pBeachNear && pBeachFar) {
          ctx.save();
          ctx.globalAlpha = w0;
          drawQuad(
            pBeachFar,
            pShFarL,
            { x: pShNearL.x, y: pShNearL.y + 1 },
            { x: pBeachNear.x, y: pBeachNear.y + 1 },
            leftGround
          );
          // Seafoam ribbon along water's edge
          const pFoamNear = project(-(RAIL_X + 4.3), 0, zn);
          const pFoamFar = project(-(RAIL_X + 4.3), 0, zf);
          if (pFoamNear && pFoamFar) {
            drawQuad(
              pFoamFar,
              pBeachFar,
              { x: pBeachNear.x, y: pBeachNear.y + 1 },
              { x: pFoamNear.x, y: pFoamNear.y + 1 },
              stripe ? "rgba(224, 247, 255, 0.72)" : "rgba(125, 211, 252, 0.45)"
            );
          }
          ctx.restore();
        }
      }
    }

    // 2. Shoulder / Curb strips
    const curbColor = stripe
      ? mix3Color([248, 250, 252], [250, 204, 21], [56, 189, 248], w1, w2)
      : mix3Color([56, 189, 248], [226, 232, 240], [244, 114, 182], w1, w2);

    if (pShNearL && pShFarL) {
      drawQuad(pShFarL, pFarL, { x: pNearL.x, y: pNearL.y + 1 }, { x: pShNearL.x, y: pShNearL.y + 1 }, curbColor);
    }
    if (pShNearR && pShFarR) {
      drawQuad(pFarR, pShFarR, { x: pShNearR.x, y: pShNearR.y + 1 }, { x: pNearR.x, y: pNearR.y + 1 }, curbColor);
    }

    // 3. Road Asphalt Surface
    const asphalt = stripe
      ? mix3Color([86, 102, 122], [66, 70, 86], [28, 30, 52], w1, w2)
      : mix3Color([76, 92, 112], [58, 62, 78], [23, 25, 44], w1, w2);
    drawQuad(
      pFarL,
      pFarR,
      { x: pNearR.x, y: pNearR.y + 1 },
      { x: pNearL.x, y: pNearL.y + 1 },
      asphalt
    );

    // Subtle Stage 3 wet-road neon reflections on outer lanes
    if (w2 > 0.2 && (idx % 3 === 0)) {
      const refL1 = project(-ROAD_HALF_W + 0.25, 0, zf);
      const refL2 = project(-ROAD_HALF_W + 1.05, 0, zf);
      const refL3 = project(-ROAD_HALF_W + 1.05, 0, zn);
      const refL4 = project(-ROAD_HALF_W + 0.25, 0, zn);
      if (refL1 && refL2 && refL3 && refL4) {
        drawQuad(refL1, refL2, refL3, refL4, `rgba(56, 189, 248, ${0.12 * w2})`);
      }
      const refR1 = project(ROAD_HALF_W - 1.05, 0, zf);
      const refR2 = project(ROAD_HALF_W - 0.25, 0, zf);
      const refR3 = project(ROAD_HALF_W - 0.25, 0, zn);
      const refR4 = project(ROAD_HALF_W - 1.05, 0, zn);
      if (refR1 && refR2 && refR3 && refR4) {
        drawQuad(refR1, refR2, refR3, refR4, `rgba(244, 114, 182, ${0.12 * w2})`);
      }
    }

    // 4. Road edge lines & dashed lane dividers (separating 3 lanes: -1, 0, +1)
    const edgeLineColor = w2 > 0.5 ? "rgba(224, 242, 254, 0.72)" : "rgba(255, 255, 255, 0.85)";
    drawRoadStripe(-ROAD_HALF_W + 0.14, 0.08, zn, zf, edgeLineColor);
    drawRoadStripe(ROAD_HALF_W - 0.14, 0.08, zn, zf, edgeLineColor);

    if (idx % 2 === 0) {
      const dashColor =
        w1 > 0.5 ? "rgba(253, 224, 71, 0.88)" : w2 > 0.5 ? "rgba(125, 211, 252, 0.78)" : "rgba(255, 255, 255, 0.88)";
      drawRoadStripe(-LANE_W * 0.5, 0.09, zn, zf, dashColor);
      drawRoadStripe(LANE_W * 0.5, 0.09, zn, zf, dashColor);
    }

    // 5. Checkered Finish Line painted on the asphalt at 998m - 1002m
    if (zf >= FINISH_DIST - 2 && zn <= FINISH_DIST + 2) {
      const cols = 8;
      const cellW = (ROAD_HALF_W * 2) / cols;
      const rowEven = Math.floor(segZ) % 2 === 0;
      for (let c = 0; c < cols; c++) {
        const x1 = -ROAD_HALF_W + c * cellW;
        const x2 = x1 + cellW;
        const q1 = project(x1, 0.01, zf);
        const q2 = project(x2, 0.01, zf);
        const q3 = project(x2, 0.01, zn);
        const q4 = project(x1, 0.01, zn);
        if (q1 && q2 && q3 && q4) {
          drawQuad(q1, q2, q3, q4, (c + (rowEven ? 0 : 1)) % 2 === 0 ? "#ffffff" : "#0f172a");
        }
      }
    }
  }

  function drawRoadStripe(centerLocalX, halfW, zn, zf, color) {
    const a = project(centerLocalX - halfW, 0.005, zf);
    const b = project(centerLocalX + halfW, 0.005, zf);
    const c = project(centerLocalX + halfW, 0.005, zn);
    const d = project(centerLocalX - halfW, 0.005, zn);
    if (!a || !b || !c || !d) return;
    drawQuad(a, b, c, d, color);
  }

  function drawGuardrailSide(side, idx, zn, zf, w1, w2) {
    const rx = side * RAIL_X;
    const beamBot = 0.42;
    const beamTop = 0.82;

    const pFarTop = project(rx, beamTop, zf);
    const pFarBot = project(rx, beamBot, zf);
    const pNearTop = project(rx, beamTop, zn);
    const pNearBot = project(rx, beamBot, zn);
    if (!pFarTop || !pFarBot || !pNearTop || !pNearBot) return;

    // Extra safety sanity check: ensure left rail stays left of road center and right rail stays right
    const pCenterNear = project(0, 0, zn);
    const pCenterFar = project(0, 0, zf);
    if (!pCenterNear || !pCenterFar) return;
    if (side < 0 && (pNearTop.x >= pCenterNear.x || pFarTop.x >= pCenterFar.x)) return;
    if (side > 0 && (pNearTop.x <= pCenterNear.x || pFarTop.x <= pCenterFar.x)) return;

    // Vertical support post at the far end of every 2nd segment (every 4m)
    if (idx % 2 === 0) {
      const pPostBase = project(rx, 0, zf);
      const pPostTop = project(rx, 0.9, zf);
      if (pPostBase && pPostTop) {
        const postW = Math.max(1.2, 0.14 * pPostBase.scale);
        ctx.fillStyle = mix3Color([148, 163, 184], [100, 116, 139], [51, 65, 85], w1, w2);
        ctx.fillRect(pPostTop.x - postW * 0.5, pPostTop.y, postW, Math.max(1, pPostBase.y - pPostTop.y));
      }
    }

    // Main horizontal guardrail beam quad
    const stripe = (idx & 1) === 0;
    const railFill = stripe
      ? mix3Color([241, 245, 249], [203, 213, 225], [71, 85, 105], w1, w2)
      : mix3Color([226, 232, 240], [186, 198, 214], [58, 70, 92], w1, w2);
    const railStroke = mix3Color([148, 163, 184], [100, 116, 139], [30, 41, 59], w1, w2);

    drawQuad(pFarTop, pNearTop, pNearBot, pFarBot, railFill, railStroke, 0.8);

    // Center corrugated groove / reflector line along the rail
    const pFarMid = project(rx, 0.62, zf);
    const pNearMid = project(rx, 0.62, zn);
    if (pFarMid && pNearMid) {
      ctx.beginPath();
      ctx.moveTo(pFarMid.x, pFarMid.y);
      ctx.lineTo(pNearMid.x, pNearMid.y);
      if (w2 > 0.35) {
        // Glowing neon LED rail strip at night!
        ctx.strokeStyle = side < 0 ? `rgba(56, 189, 248, ${0.4 + w2 * 0.55})` : `rgba(244, 114, 182, ${0.4 + w2 * 0.55})`;
        ctx.lineWidth = Math.max(1.2, 0.08 * pNearMid.scale);
      } else {
        ctx.strokeStyle = stripe
          ? (w1 > 0.5 ? "rgba(251, 146, 60, 0.85)" : "rgba(14, 165, 233, 0.72)")
          : "rgba(148, 163, 184, 0.5)";
        ctx.lineWidth = Math.max(1, 0.055 * pNearMid.scale);
      }
      ctx.stroke();
    }
  }

  // ==================== ROADSIDE PROPS RENDERING ====================
  function drawProp(prop) {
    const p = project(prop.x, 0, prop.z);
    if (!p) return;
    const s = p.scale * (prop.scale || 1);
    if (s < 1.2) return;

    if (prop.kind === "palm") {
      const sway = Math.sin(state.time * 2.1 + prop.phase) * 0.25 * s;
      const topX = p.x + prop.side * 0.45 * s + sway;
      const topY = p.y - 5.4 * s;

      // Trunk
      ctx.strokeStyle = "#85522d";
      ctx.lineWidth = Math.max(1.5, 0.34 * s);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + prop.side * 0.1 * s, p.y - 2.7 * s, topX, topY);
      ctx.stroke();

      // Palm fronds
      const frondAngles = [-2.5, -1.8, -1.1, -0.35, 0.3, 0.9];
      ctx.lineWidth = Math.max(1.2, 0.24 * s);
      frondAngles.forEach((a, i) => {
        ctx.strokeStyle = i % 2 === 0 ? "#16a34a" : "#22c55e";
        const len = (1.55 + (i % 2) * 0.4) * s;
        const ex = topX + Math.cos(a) * len;
        const ey = topY + Math.sin(a) * len * 0.7 + 0.45 * s;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.55, topY + Math.sin(a) * len * 0.35 - 0.25 * s, ex, ey);
        ctx.stroke();
      });
    } else if (prop.kind === "lighthouse") {
      const h = 8.6 * s;
      const wBot = 1.6 * s;
      const wTop = 0.9 * s;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.moveTo(p.x - wBot * 0.5, p.y);
      ctx.lineTo(p.x - wTop * 0.5, p.y - h);
      ctx.lineTo(p.x + wTop * 0.5, p.y - h);
      ctx.lineTo(p.x + wBot * 0.5, p.y);
      ctx.closePath();
      ctx.fill();

      // Red coastal bands
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(p.x - wBot * 0.38, p.y - h * 0.38, wBot * 0.76, h * 0.16);
      ctx.fillRect(p.x - wBot * 0.32, p.y - h * 0.72, wBot * 0.64, h * 0.15);

      // Lantern dome
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(p.x - wTop * 0.46, p.y - h - 0.7 * s, wTop * 0.92, 0.7 * s);
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.moveTo(p.x - wTop * 0.6, p.y - h - 0.7 * s);
      ctx.lineTo(p.x, p.y - h - 1.45 * s);
      ctx.lineTo(p.x + wTop * 0.6, p.y - h - 0.7 * s);
      ctx.closePath();
      ctx.fill();
    } else if (prop.kind === "sailboat") {
      const bob = Math.sin(state.time * 2.2 + prop.phase) * 0.12 * s;
      const by = p.y + bob;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(p.x, by - 2.6 * s);
      ctx.lineTo(p.x + 1.2 * s, by - 0.45 * s);
      ctx.lineTo(p.x, by - 0.45 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.moveTo(p.x - 1.1 * s, by - 0.4 * s);
      ctx.lineTo(p.x + 1.3 * s, by - 0.4 * s);
      ctx.lineTo(p.x + 0.9 * s, by);
      ctx.lineTo(p.x - 0.8 * s, by);
      ctx.closePath();
      ctx.fill();
    } else if (prop.kind === "lamp") {
      const h = 6.2 * s;
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = Math.max(1.2, 0.16 * s);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - h);
      ctx.lineTo(p.x - prop.side * 1.4 * s, p.y - h - 0.25 * s);
      ctx.stroke();

      // Warm sunset streetlamp bulb
      const lx = p.x - prop.side * 1.4 * s;
      const ly = p.y - h - 0.2 * s;
      ctx.fillStyle = "rgba(253, 224, 71, 0.35)";
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(2, 0.55 * s), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fef9c3";
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(1.2, 0.2 * s), 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === "gantry") {
      const pL = project(-(RAIL_X + 0.45), 0, prop.z);
      const pR = project(RAIL_X + 0.45, 0, prop.z);
      const pLT = project(-(RAIL_X + 0.45), 5.4, prop.z);
      const pRT = project(RAIL_X + 0.45, 5.4, prop.z);
      if (!pL || !pR || !pLT || !pRT) return;
      const pw = Math.max(2, 0.24 * pL.scale);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(pLT.x - pw * 0.5, pLT.y, pw, pL.y - pLT.y);
      ctx.fillRect(pRT.x - pw * 0.5, pRT.y, pw, pR.y - pRT.y);

      const barH = Math.max(4, 0.32 * pL.scale);
      ctx.fillRect(pLT.x, pLT.y, pRT.x - pLT.x, barH);

      // Green highway overhead board
      const bw = (pRT.x - pLT.x) * 0.58;
      const bh = Math.max(8, 1.35 * pL.scale);
      const bx = (pLT.x + pRT.x) * 0.5 - bw * 0.5;
      const by = pLT.y - bh * 0.32;
      ctx.fillStyle = "#047857";
      ctx.strokeStyle = "#ecfdf5";
      ctx.lineWidth = Math.max(1, 0.08 * pL.scale);
      drawRoundedRect(bx, by, bw, bh, Math.max(2, 0.14 * pL.scale));
      ctx.fill();
      ctx.stroke();

      if (bh > 13) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `800 ${Math.round(bh * 0.42)}px "PingFang SC", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(prop.label, bx + bw * 0.5, by + bh * 0.52);
      }
    } else if (prop.kind === "neon_sign") {
      const sign = prop.sign;
      const poleH = (prop.tall ? 6.8 : 5.1) * s;
      // Dark urban building pillar behind sign
      const bW = 2.6 * s;
      const bH = (prop.tall ? 10.5 : 8.2) * s;
      const bx = prop.side < 0 ? p.x - bW : p.x;
      ctx.fillStyle = "#11162b";
      ctx.fillRect(bx, p.y - bH, bW, bH);

      // Cantilevered neon signboard
      const boardW = (prop.tall ? 1.55 : 2.2) * s;
      const boardH = (prop.tall ? 3.5 : 1.55) * s;
      const boardX = prop.side < 0 ? p.x - boardW * 0.35 : p.x - boardW * 0.65;
      const boardY = p.y - poleH;

      // Outer neon glow
      ctx.save();
      ctx.fillStyle = sign.bg;
      ctx.strokeStyle = sign.color;
      ctx.lineWidth = Math.max(1.2, 0.11 * s);
      ctx.shadowColor = sign.color;
      ctx.shadowBlur = Math.min(20, 0.55 * s);
      drawRoundedRect(boardX, boardY, boardW, boardH, Math.max(2, 0.16 * s));
      ctx.fill();
      ctx.stroke();

      // Chinese Neon Text
      const fontSize = Math.round(prop.tall ? boardW * 0.62 : boardH * 0.54);
      if (fontSize >= 8) {
        ctx.fillStyle = sign.color;
        ctx.font = `900 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (prop.tall) {
          const chars = sign.text.split("");
          chars.forEach((ch, idx) => {
            ctx.fillText(ch, boardX + boardW * 0.5, boardY + boardH * (0.31 + idx * 0.38));
          });
        } else {
          ctx.fillText(sign.text, boardX + boardW * 0.5, boardY + boardH * 0.53);
        }
      }
      ctx.restore();
    } else if (prop.kind === "lantern_arch") {
      const pL = project(-RAIL_X, 4.9, prop.z);
      const pR = project(RAIL_X, 4.9, prop.z);
      if (!pL || !pR) return;
      const midX = (pL.x + pR.x) * 0.5;
      const sag = 0.55 * pL.scale;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = Math.max(1, 0.05 * pL.scale);
      ctx.beginPath();
      ctx.moveTo(pL.x, pL.y);
      ctx.quadraticCurveTo(midX, pL.y + sag * 2, pR.x, pR.y);
      ctx.stroke();

      const count = 7;
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const lx = lerp(pL.x, pR.x, t);
        const ly = pL.y + 4 * t * (1 - t) * sag;
        const r = Math.max(2, 0.28 * pL.scale);
        ctx.fillStyle = i % 2 === 0 ? "#fb7185" : "#fbbf24";
        ctx.beginPath();
        ctx.ellipse(lx, ly + r * 0.7, r * 0.85, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ==================== FINISH ARCH (1000m) ====================
  function drawFinishArch() {
    const z = FINISH_DIST;
    const pLB = project(-(ROAD_HALF_W + 0.5), 0, z);
    const pRB = project(ROAD_HALF_W + 0.5, 0, z);
    const pLT = project(-(ROAD_HALF_W + 0.5), 5.3, z);
    const pRT = project(ROAD_HALF_W + 0.5, 5.3, z);
    if (!pLB || !pRB || !pLT || !pRT) return;

    const s = pLB.scale;
    const pillarW = Math.max(3, 0.5 * s);
    // Pillars
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(pLT.x - pillarW * 0.5, pLT.y, pillarW, pLB.y - pLT.y);
    ctx.fillRect(pRT.x - pillarW * 0.5, pRT.y, pillarW, pRB.y - pRT.y);

    // Overhead finish banner
    const bannerH = Math.max(10, 1.55 * s);
    const bx = pLT.x - pillarW * 0.5;
    const bw = pRT.x - pLT.x + pillarW;
    const by = pLT.y - bannerH * 0.2;

    const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
    grad.addColorStop(0, "#0ea5e9");
    grad.addColorStop(0.5, "#f59e0b");
    grad.addColorStop(1, "#ec4899");
    ctx.fillStyle = grad;
    drawRoundedRect(bx, by, bw, bannerH, Math.max(3, 0.2 * s));
    ctx.fill();

    // Checkered trim top & bottom
    const checks = 14;
    const cw = bw / checks;
    const ch = Math.max(2, bannerH * 0.18);
    for (let i = 0; i < checks; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#0f172a";
      ctx.fillRect(bx + i * cw, by, cw, ch);
      ctx.fillRect(bx + i * cw, by + bannerH - ch, cw, ch);
    }

    if (bannerH > 16) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 ${Math.round(bannerH * 0.44)}px "PingFang SC", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🏁 GOAL · 1000m 终点 🏁", bx + bw * 0.5, by + bannerH * 0.52);
    }
  }

  // ==================== OBSTACLES RENDERING (TRUE 3D PERSPECTIVE) ====================
  function drawObstacle(o) {
    const zFront = Math.max(o.z, cam.z + NEAR_Z);
    const zBack = o.z + o.depth;
    if (zBack <= cam.z + NEAR_Z) return;

    const pBase = project(o.x, 0, zFront);
    if (!pBase) return;
    const s = pBase.scale;

    // Ground shadow
    ctx.fillStyle = "rgba(6, 12, 24, 0.36)";
    ctx.beginPath();
    ctx.ellipse(pBase.x, pBase.y + 0.04 * s, o.width * 0.54 * s, Math.max(2, 0.2 * s), 0, 0, Math.PI * 2);
    ctx.fill();

    if (o.kind === "cones") {
      // Twin traffic cones (clearly jumpable)
      const offsets = [-0.46, 0.46];
      offsets.forEach((ox) => {
        const pc = project(o.x + ox, 0, zFront);
        if (!pc) return;
        const cs = pc.scale;
        const ch = o.height * cs;
        const cw = 0.58 * cs;
        // Base
        ctx.fillStyle = "#c2410c";
        ctx.fillRect(pc.x - cw * 0.62, pc.y - 0.1 * cs, cw * 1.24, 0.12 * cs);
        // Cone body
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.moveTo(pc.x - cw * 0.48, pc.y - 0.08 * cs);
        ctx.lineTo(pc.x - cw * 0.12, pc.y - ch);
        ctx.lineTo(pc.x + cw * 0.12, pc.y - ch);
        ctx.lineTo(pc.x + cw * 0.48, pc.y - 0.08 * cs);
        ctx.closePath();
        ctx.fill();
        // Reflective white stripe
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(pc.x - cw * 0.33, pc.y - ch * 0.42);
        ctx.lineTo(pc.x - cw * 0.24, pc.y - ch * 0.66);
        ctx.lineTo(pc.x + cw * 0.24, pc.y - ch * 0.66);
        ctx.lineTo(pc.x + cw * 0.33, pc.y - ch * 0.42);
        ctx.closePath();
        ctx.fill();
      });
      return;
    }

    if (o.kind === "barrier") {
      // Low jumpable chevron sawhorse barrier
      const hw = o.width * 0.5;
      const pFL = project(o.x - hw, 0, zFront);
      const pFR = project(o.x + hw, 0, zFront);
      const pTL = project(o.x - hw, o.height, zFront);
      const pTR = project(o.x + hw, o.height, zFront);
      const pML = project(o.x - hw, o.height * 0.42, zFront);
      const pMR = project(o.x + hw, o.height * 0.42, zFront);
      if (!pFL || !pFR || !pTL || !pTR || !pML || !pMR) return;

      // Support legs
      const legW = Math.max(2, 0.16 * s);
      ctx.fillStyle = "#475569";
      ctx.fillRect(pFL.x + legW * 0.3, pML.y, legW, pFL.y - pML.y);
      ctx.fillRect(pFR.x - legW * 1.3, pMR.y, legW, pFR.y - pMR.y);

      // Top warning plank with alternating stripes
      const boardX = pTL.x;
      const boardY = pTL.y;
      const boardW = pTR.x - pTL.x;
      const boardH = pML.y - pTL.y;
      const stripes = 6;
      const sw = boardW / stripes;
      const cA = o.stage === 2 ? "#f43f5e" : "#f59e0b";
      const cB = o.stage === 2 ? "#1e1b4b" : "#1e293b";
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? cA : cB;
        ctx.fillRect(boardX + i * sw, boardY, sw + 0.5, boardH);
      }
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, 0.05 * s);
      ctx.strokeRect(boardX, boardY, boardW, boardH);
      return;
    }

    // 3D Extruded Box Helper for Tall Obstacles (Vehicles & Tall Roadblocks)
    const hw = o.width * 0.5;
    const fBL = project(o.x - hw, 0, zFront);
    const fBR = project(o.x + hw, 0, zFront);
    const fTL = project(o.x - hw, o.height, zFront);
    const fTR = project(o.x + hw, o.height, zFront);

    const bBL = project(o.x - hw, 0, zBack);
    const bBR = project(o.x + hw, 0, zBack);
    const bTL = project(o.x - hw, o.height, zBack);
    const bTR = project(o.x + hw, o.height, zBack);
    if (!fBL || !fBR || !fTL || !fTR || !bBL || !bBR || !bTL || !bTR) return;

    if (o.kind === "tall_wall") {
      // Tall construction barrier (must switch lane!)
      // Visible side face
      if (bBL.x < fBL.x) drawQuad(bTL, fTL, fBL, bBL, "#991b1b");
      if (bBR.x > fBR.x) drawQuad(fTR, bTR, bBR, fBR, "#991b1b");
      // Top
      drawQuad(bTL, bTR, fTR, fTL, "#fca5a5");
      // Front face
      drawQuad(fTL, fTR, fBR, fBL, "#dc2626");

      // Hazard white chevrons
      const fw = fTR.x - fTL.x;
      const fh = fBL.y - fTL.y;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(fTL.x + fw * 0.1, fTL.y + fh * 0.22, fw * 0.8, fh * 0.16);
      ctx.fillRect(fTL.x + fw * 0.1, fTL.y + fh * 0.56, fw * 0.8, fh * 0.16);

      // Flashing beacon lights on top
      const blink = Math.sin(state.time * 10 + o.z) > 0;
      const r = Math.max(2, 0.16 * s);
      ctx.fillStyle = blink ? "#fde047" : "#f97316";
      ctx.beginPath();
      ctx.arc(fTL.x + fw * 0.22, fTL.y - r * 0.6, r, 0, Math.PI * 2);
      ctx.arc(fTL.x + fw * 0.78, fTL.y - r * 0.6, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Stylized 3D Vehicles (Coastal Van, Sunset City Taxi, Neon Kei-Truck)
    const palette =
      o.kind === "van"
        ? { body: "#0284c7", top: "#7dd3fc", side: "#0369a1", stripe: "#fef08a" }
        : o.kind === "taxi"
        ? { body: "#eab308", top: "#fde047", side: "#ca8a04", stripe: "#1e293b" }
        : { body: "#6366f1", top: "#a5b4fc", side: "#4338ca", stripe: "#f472b6" };

    // Wheels peeking under chassis
    const wheelW = Math.max(2, 0.26 * s);
    const wheelH = Math.max(2, 0.34 * s);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(fBL.x + 0.08 * s, fBL.y - wheelH * 0.85, wheelW, wheelH);
    ctx.fillRect(fBR.x - wheelW - 0.08 * s, fBR.y - wheelH * 0.85, wheelW, wheelH);

    // Side face (whichever side faces camera!)
    const chassisY = 0.22;
    const fCL = project(o.x - hw, chassisY, zFront);
    const fCR = project(o.x + hw, chassisY, zFront);
    const bCL = project(o.x - hw, chassisY, zBack);
    const bCR = project(o.x + hw, chassisY, zBack);
    if (!fCL || !fCR || !bCL || !bCR) return;

    if (bCL.x < fCL.x) drawQuad(bTL, fTL, fCL, bCL, palette.side);
    if (bCR.x > fCR.x) drawQuad(fTR, bTR, bCR, fCR, palette.side);

    // Roof
    drawQuad(bTL, bTR, fTR, fTL, palette.top);

    // Rear face facing the player
    drawQuad(fTL, fTR, fCR, fCL, palette.body);

    // Rear window
    const rw = fTR.x - fTL.x;
    const rh = fCL.y - fTL.y;
    ctx.fillStyle = o.stage === 2 ? "#1e1b4b" : "#bae6fd";
    drawRoundedRect(fTL.x + rw * 0.12, fTL.y + rh * 0.11, rw * 0.76, rh * 0.34, Math.max(2, 0.1 * s));
    ctx.fill();

    // Accent stripe
    ctx.fillStyle = palette.stripe;
    ctx.fillRect(fTL.x + rw * 0.04, fTL.y + rh * 0.54, rw * 0.92, rh * 0.11);

    // Glowing red taillights!
    const tlW = rw * 0.18;
    const tlH = rh * 0.13;
    ctx.save();
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = o.stage === 2 ? 12 : 4;
    ctx.fillRect(fTL.x + rw * 0.08, fTL.y + rh * 0.7, tlW, tlH);
    ctx.fillRect(fTR.x - rw * 0.08 - tlW, fTL.y + rh * 0.7, tlW, tlH);
    ctx.restore();
  }

  // ==================== COINS RENDERING ====================
  function drawCoin(c) {
    if (c.collected) return;
    const bob = Math.sin(state.time * 5.2 + c.z * 0.35) * 0.12;
    const p = project(c.x, c.y + bob, c.z);
    const pShadow = project(c.x, 0.02, c.z);
    if (!p || !pShadow) return;

    const r = 0.42 * p.scale;
    if (r < 1.2) return;

    // Ground shadow directly beneath coin so jump height is crystal clear!
    const shadowScale = clamp(1 - c.y * 0.22, 0.38, 1);
    ctx.fillStyle = "rgba(10, 18, 34, 0.32)";
    ctx.beginPath();
    ctx.ellipse(
      pShadow.x,
      pShadow.y,
      r * 0.85 * shadowScale,
      Math.max(1.2, r * 0.32 * shadowScale),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Spinning 3D coin ellipse
    const spin = Math.abs(Math.cos(state.time * 4.8 + c.z * 0.3));
    const rx = Math.max(r * 0.24, r * spin);

    ctx.save();
    // Outer golden rim
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, r, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bright gold face
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 0.78, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Specular shine
    if (rx > 3.5) {
      ctx.fillStyle = "#fef9c3";
      ctx.beginPath();
      ctx.ellipse(p.x - rx * 0.2, p.y - r * 0.24, rx * 0.22, r * 0.28, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==================== PLAYER CAT RENDERING ====================
  function drawPlayerCat() {
    const pGround = project(state.playerX, 0.02, state.playerZ);
    const pCat = project(state.playerX, state.playerY, state.playerZ);
    if (!pGround || !pCat) return;

    const invulnAlpha =
      state.invulnTimer > 0 && Math.floor(state.invulnTimer * 14) % 2 === 0 ? 0.42 : 1;

    const s = pCat.scale;

    // 1. Ground shadow (scales down smoothly as the cat jumps higher!)
    const hFactor = clamp(1 - state.playerY / 3.4, 0.32, 1);
    ctx.fillStyle = `rgba(8, 15, 30, ${0.42 * hFactor})`;
    ctx.beginPath();
    ctx.ellipse(
      pGround.x,
      pGround.y + 0.04 * pGround.scale,
      0.72 * pGround.scale * hFactor,
      0.22 * pGround.scale * hFactor,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // 2. Animated Cat Sprite (3/4 rear runner view)
    const runCycle = state.time * (state.speed * 0.62);
    const airborne = state.playerY > 0.08;
    const bounce = airborne ? 0 : Math.abs(Math.sin(runCycle)) * 0.14 * s;
    const tilt = clamp(state.playerVX * 0.026, -0.26, 0.26);
    const stretchY = airborne ? 1.08 : 1 - Math.abs(Math.sin(runCycle)) * 0.05;
    const stretchX = 1 / Math.sqrt(stretchY);

    ctx.save();
    ctx.globalAlpha = invulnAlpha;
    ctx.translate(pCat.x, pCat.y - bounce);
    ctx.rotate(tilt);
    ctx.scale(stretchX, stretchY);

    // Tail swaying merrily behind the cat (curved upward above body)
    const tailWave = Math.sin(state.time * 11) * 0.28 * s;
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = Math.max(3, 0.16 * s);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -0.52 * s);
    ctx.quadraticCurveTo(tailWave * 1.15 - 0.12 * s, -0.92 * s, tailWave * 1.5 - 0.36 * s, -1.24 * s);
    ctx.stroke();
    // White tail tip
    ctx.strokeStyle = "#fff7ed";
    ctx.lineWidth = Math.max(2.5, 0.14 * s);
    ctx.beginPath();
    ctx.moveTo(tailWave * 1.32 - 0.28 * s, -1.12 * s);
    ctx.lineTo(tailWave * 1.5 - 0.36 * s, -1.24 * s);
    ctx.stroke();

    // Running hind paws
    const leftPawY = airborne ? -0.18 * s : Math.max(0, Math.sin(runCycle)) * -0.26 * s;
    const rightPawY = airborne ? -0.24 * s : Math.max(0, -Math.sin(runCycle)) * -0.26 * s;
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath();
    ctx.ellipse(-0.28 * s, -0.12 * s + leftPawY, 0.17 * s, 0.13 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(0.28 * s, -0.12 * s + rightPawY, 0.17 * s, 0.13 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Plump orange-tabby body
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.ellipse(0, -0.58 * s, 0.52 * s, 0.48 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Back tabby stripes
    ctx.strokeStyle = "#c2410c";
    ctx.lineWidth = Math.max(2, 0.08 * s);
    ctx.beginPath();
    ctx.moveTo(-0.24 * s, -0.68 * s);
    ctx.lineTo(0.24 * s, -0.68 * s);
    ctx.moveTo(-0.2 * s, -0.52 * s);
    ctx.lineTo(0.2 * s, -0.52 * s);
    ctx.stroke();

    // Sea-breeze scarf fluttering around neck!
    const scarfFlutter = Math.sin(state.time * 16) * 0.18 * s;
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.ellipse(0, -0.94 * s, 0.44 * s, 0.14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fluttering scarf tail
    ctx.beginPath();
    ctx.moveTo(0.24 * s, -0.92 * s);
    ctx.quadraticCurveTo(0.62 * s, -0.84 * s + scarfFlutter, 0.78 * s, -0.64 * s + scarfFlutter * 1.4);
    ctx.lineTo(0.62 * s, -0.52 * s + scarfFlutter * 1.3);
    ctx.quadraticCurveTo(0.42 * s, -0.74 * s + scarfFlutter * 0.7, 0.14 * s, -0.86 * s);
    ctx.closePath();
    ctx.fill();

    // Cat Head (rear view)
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.ellipse(0, -1.28 * s, 0.46 * s, 0.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Whiskers sticking out cleanly on both sides
    ctx.strokeStyle = "#fff7ed";
    ctx.lineWidth = Math.max(1.2, 0.04 * s);
    ctx.beginPath();
    ctx.moveTo(-0.4 * s, -1.24 * s);
    ctx.lineTo(-0.62 * s, -1.28 * s);
    ctx.moveTo(-0.4 * s, -1.16 * s);
    ctx.lineTo(-0.6 * s, -1.14 * s);
    ctx.moveTo(0.4 * s, -1.24 * s);
    ctx.lineTo(0.62 * s, -1.28 * s);
    ctx.moveTo(0.4 * s, -1.16 * s);
    ctx.lineTo(0.6 * s, -1.14 * s);
    ctx.stroke();

    // Pointy Cat Ears (sweep back slightly when jumping!)
    const earBack = airborne ? 0.08 * s : 0;
    // Left ear
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(-0.38 * s, -1.48 * s);
    ctx.lineTo(-0.46 * s, -1.94 * s + earBack);
    ctx.lineTo(-0.1 * s, -1.62 * s);
    ctx.closePath();
    ctx.fill();
    // Right ear
    ctx.beginPath();
    ctx.moveTo(0.38 * s, -1.48 * s);
    ctx.lineTo(0.46 * s, -1.94 * s + earBack);
    ctx.lineTo(0.1 * s, -1.62 * s);
    ctx.closePath();
    ctx.fill();

    // Subtle ear rim highlight (rear view)
    ctx.fillStyle = "#fdba74";
    ctx.beginPath();
    ctx.moveTo(-0.34 * s, -1.55 * s);
    ctx.lineTo(-0.4 * s, -1.8 * s + earBack);
    ctx.lineTo(-0.2 * s, -1.61 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.34 * s, -1.55 * s);
    ctx.lineTo(0.4 * s, -1.8 * s + earBack);
    ctx.lineTo(0.2 * s, -1.61 * s);
    ctx.closePath();
    ctx.fill();

    // Head back-of-head tabby stripes
    ctx.strokeStyle = "#c2410c";
    ctx.lineWidth = Math.max(1.5, 0.065 * s);
    ctx.beginPath();
    ctx.moveTo(-0.14 * s, -1.55 * s);
    ctx.lineTo(-0.1 * s, -1.36 * s);
    ctx.moveTo(0, -1.58 * s);
    ctx.lineTo(0, -1.34 * s);
    ctx.moveTo(0.14 * s, -1.55 * s);
    ctx.lineTo(0.1 * s, -1.36 * s);
    ctx.stroke();

    ctx.restore();
  }

  // ==================== SCREEN FX ====================

  function drawScreenFx() {
    // Final 120m turbo speed lines!
    if (state.mode === "playing" && state.playerZ > 880) {
      const intensity = smoothstep(880, 990, state.playerZ) * 0.32;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2 + Math.floor(state.time * 18) * 0.2;
        const r1 = Math.min(viewW, viewH) * 0.42;
        const r2 = Math.max(viewW, viewH) * 0.78;
        ctx.beginPath();
        ctx.moveTo(viewW * 0.5 + Math.cos(ang) * r1, viewH * 0.5 + Math.sin(ang) * r1);
        ctx.lineTo(viewW * 0.5 + Math.cos(ang) * r2, viewH * 0.5 + Math.sin(ang) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Damage red vignette flash
    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${state.hitFlash * 0.34})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    // Victory confetti
    for (let i = 0; i < state.confetti.length; i++) {
      const c = state.confetti[i];
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w * 0.5, -c.h * 0.5, c.w, c.h);
      ctx.restore();
    }
  }

  // ==================== MAIN RENDER PASS (SEGMENT-INTERLEAVED BACK-TO-FRONT) ====================
  function render() {
    ctx.save();
    ctx.scale(dpr, dpr);

    updateCamera();
    drawSkyAndBackdrop();

    // Compute visible world segment index range
    const minVisibleZ = cam.z + NEAR_Z;
    const maxVisibleZ = cam.z + DRAW_DIST;
    const nearIdx = Math.floor(minVisibleZ / SEG_LEN);
    const farIdx = Math.ceil(maxVisibleZ / SEG_LEN);

    // Bucket all visible entities by segment index so road, roadside props, guardrails,
    // obstacles, coins, finish arch, and cat interleave in exact back-to-front Z order!
    const propBuckets = new Map();
    const roadBuckets = new Map();

    function pushBucket(map, idx, item) {
      let arr = map.get(idx);
      if (!arr) {
        arr = [];
        map.set(idx, arr);
      }
      arr.push(item);
    }

    for (let i = 0; i < state.props.length; i++) {
      const pr = state.props[i];
      if (pr.z >= minVisibleZ && pr.z <= maxVisibleZ) {
        const sIdx = Math.floor(pr.z / SEG_LEN);
        if (pr.kind === "gantry" || pr.kind === "lantern_arch") {
          pushBucket(roadBuckets, sIdx, { z: pr.z, type: "prop", ref: pr });
        } else {
          pushBucket(propBuckets, sIdx, { z: pr.z, type: "prop", ref: pr });
        }
      }
    }

    if (FINISH_DIST >= minVisibleZ && FINISH_DIST <= maxVisibleZ) {
      pushBucket(roadBuckets, Math.floor(FINISH_DIST / SEG_LEN), { z: FINISH_DIST, type: "finish" });
    }

    for (let i = 0; i < state.obstacles.length; i++) {
      const o = state.obstacles[i];
      if (o.z + o.depth >= minVisibleZ && o.z <= maxVisibleZ) {
        const anchorZ = Math.max(o.z, minVisibleZ);
        pushBucket(roadBuckets, Math.floor(anchorZ / SEG_LEN), { z: anchorZ, type: "obs", ref: o });
      }
    }

    for (let i = 0; i < state.coinList.length; i++) {
      const c = state.coinList[i];
      if (!c.collected && c.z >= minVisibleZ && c.z <= maxVisibleZ) {
        pushBucket(roadBuckets, Math.floor(c.z / SEG_LEN), { z: c.z, type: "coin", ref: c });
      }
    }

    for (let i = 0; i < state.particles.length; i++) {
      const pt = state.particles[i];
      if (pt.z >= minVisibleZ && pt.z <= maxVisibleZ) {
        pushBucket(roadBuckets, Math.floor(pt.z / SEG_LEN), { z: pt.z, type: "particle", ref: pt });
      }
    }

    if (state.mode !== "menu") {
      pushBucket(roadBuckets, Math.floor(state.playerZ / SEG_LEN), { z: state.playerZ, type: "cat" });
    }

    // Unified FAR -> NEAR slice pass
    for (let idx = farIdx; idx >= nearIdx; idx--) {
      const z1 = idx * SEG_LEN;
      const z2 = (idx + 1) * SEG_LEN;
      if (z2 <= minVisibleZ) continue;
      const zn = Math.max(z1, minVisibleZ);
      const zf = z2;
      if (zf - zn < 0.04) continue;

      const segZ = (zn + zf) * 0.5;
      const { w1, w2 } = getStageWeights(segZ);

      // 1. Road surface, curbs, markings & terrain
      drawRoadSegment(idx, zn, zf);

      // 2. Roadside props OUTSIDE the guardrails at this Z slice
      const pList = propBuckets.get(idx);
      if (pList) {
        pList.sort((a, b) => b.z - a.z);
        for (let j = 0; j < pList.length; j++) {
          drawProp(pList[j].ref);
        }
      }

      // 3. Left & Right Guardrails (strictly clipped to [zn, zf] >= NEAR_Z, outside road edges!)
      drawGuardrailSide(-1, idx, zn, zf, w1, w2);
      drawGuardrailSide(1, idx, zn, zf, w1, w2);

      // 4. Entities ON/ABOVE the road at this Z slice (obstacles, coins, arches, particles, cat)
      const rList = roadBuckets.get(idx);
      if (rList) {
        rList.sort((a, b) => b.z - a.z);
        for (let j = 0; j < rList.length; j++) {
          const item = rList[j];
          if (item.type === "prop") drawProp(item.ref);
          else if (item.type === "finish") drawFinishArch();
          else if (item.type === "obs") drawObstacle(item.ref);
          else if (item.type === "coin") drawCoin(item.ref);
          else if (item.type === "cat") drawPlayerCat();
          else if (item.type === "particle") {
            const pt = item.ref;
            const p = project(pt.x, pt.y, pt.z);
            if (p) {
              const alpha = clamp(pt.life / pt.maxLife, 0, 1);
              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.fillStyle = pt.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, Math.max(1.5, pt.size * p.scale * alpha), 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
        }
      }
    }

    drawScreenFx();

    ctx.restore();
  }

  // ==================== LOOP ====================
  let lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ==================== BOOTSTRAP ====================
  window.addEventListener("resize", resize);
  resize();
  initBackdropSeeds();
  generateCourse();
  refreshStartBest();
  requestAnimationFrame(frame);
})();
