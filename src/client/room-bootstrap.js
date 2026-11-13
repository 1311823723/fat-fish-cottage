// Tiny classic script injected into HTML. It must not wait for the game engine.
(() => {
  let stopped = false, retryTimer, slowTimer;
  const $ = id => document.getElementById(id);
  const boot = window.__cottageBoot = {
    promise: null, receivedAt: 0, used: false,
    stop() { stopped = true; clearTimeout(retryTimer); clearTimeout(slowTimer); },
  };
  const retry = $('retryConnection');
  if (retry) retry.onclick = () => location.reload();
  function probe() {
    clearTimeout(retryTimer);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 16000);
    boot.promise = fetch('/api/room-state', {
      method: 'POST', headers: {'content-type': 'application/json'}, body: '{}',
      signal: controller.signal, cache: 'no-store',
    }).then(async response => {
      const state = await response.json();
      if (!response.ok || !state.ok) throw Error('state unavailable');
      boot.receivedAt = Date.now();
      if (!stopped) {
        const weather = state.weather, away = state.travel?.phase === 'away';
        $('weather').textContent = weather?.available ? `${weather.city} · ${weather.label} ${weather.temperature}℃` : '天气暂不可用';
        $('place').textContent = away ? '外出 · ' + (state.travel.destination || state.location || '路上') : '在家 · 小屋';
        $('roomActivity').textContent = away ? '出游中' : ({sleep:'睡觉中',read:'翻书中',eat:'吃饭中',tea:'喝东西',rest:'休息中',walk:'散步中',sing:'哼歌中'}[state.activity?.name] || '发呆中');
        $('connection').textContent = '状态已连接 · 正在加载角色';
        const loading = document.querySelector('.loading');
        if (loading) loading.firstChild.textContent = '正在加载角色…';
        clearTimeout(slowTimer);
        slowTimer = setTimeout(() => {
          if (stopped) return;
          $('connection').textContent = '角色加载较慢，可稍候或重新加载';
          if (retry) retry.hidden = false;
        }, 12000);
      }
      return state;
    }).catch(() => {
      if (!stopped) {
        $('connection').textContent = '暂时连不上后台，正在重试';
        if (retry) retry.hidden = false;
        retryTimer = setTimeout(probe, 5000);
      }
      return null;
    }).finally(() => clearTimeout(timeout));
  }
  slowTimer = setTimeout(() => {
    if (!stopped && !boot.receivedAt) {
      $('connection').textContent = '后台连接较慢，正在等待';
      if (retry) retry.hidden = false;
    }
  }, 8000);
  probe();
})();
